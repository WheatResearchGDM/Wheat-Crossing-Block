package expo.modules.bcdocuments

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.system.Os
import android.system.OsConstants
import android.util.Base64
import androidx.documentfile.provider.DocumentFile
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.exception.toCodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException
import java.io.ByteArrayOutputStream

private const val PICK_OUTPUT = 61432
private const val MAX_CATALOG_BYTES = 5 * 1024 * 1024

class BCDocumentsModule : Module() {
  private var pending: Promise? = null
  private var pickerKind = "folder"
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun writeDocument(uri: Uri, content: ByteArray) {
    // Some providers support only write-only streams. Negotiate mode before writing any bytes.
    val descriptor = try { context.contentResolver.openFileDescriptor(uri, "rwt") }
      catch (_: IOException) { null }
      catch (_: IllegalArgumentException) { null }
      catch (_: UnsupportedOperationException) { null }
      ?: context.contentResolver.openFileDescriptor(uri, "wt")
      ?: throw IOException("Não foi possível abrir o arquivo para escrita.")
    ParcelFileDescriptor.AutoCloseOutputStream(descriptor).use { output ->
      if (OsConstants.S_ISREG(Os.fstat(descriptor.fileDescriptor).st_mode)) {
        // Do not rely on the provider honoring the truncate flag on an existing cached file.
        VerifiedDocumentWriter.writeSeekable(output, content)
      } else {
        // Pipe-backed cloud uploads commit only after this stream is closed.
        output.write(content)
        output.flush()
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("BCDocuments")

    AsyncFunction("chooseAsync") { kind: String, filename: String, promise: Promise ->
      if (pending != null) throw IOException("Já há uma seleção aberta.")
      require(kind in listOf("folder", "create", "open", "catalog"))
      val intent = Intent(when (kind) {
        "folder" -> Intent.ACTION_OPEN_DOCUMENT_TREE
        "create" -> Intent.ACTION_CREATE_DOCUMENT
        else -> Intent.ACTION_OPEN_DOCUMENT
      }).apply {
        putExtra(Intent.EXTRA_LOCAL_ONLY, false)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        if (kind != "catalog") addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        if (kind != "folder") {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = if (kind == "open" || kind == "catalog") "*/*" else if (filename.endsWith(".xlsx", ignoreCase = true)) "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" else "text/csv"
          putExtra(Intent.EXTRA_TITLE, filename)
        }
      }
      pickerKind = kind
      pending = promise
      try { appContext.throwingActivity.startActivityForResult(intent, PICK_OUTPUT) }
      catch (e: Exception) { pending = null; promise.reject(e.toCodedException()) }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode != PICK_OUTPUT) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      if (resultCode != Activity.RESULT_OK || intent?.data == null) {
        promise.resolve(null)
        return@OnActivityResult
      }
      try {
        val uri = intent.data!!
        val flags = intent.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        if (pickerKind == "catalog") {
          if (flags and Intent.FLAG_GRANT_READ_URI_PERMISSION == 0) throw IOException("O arquivo não concedeu acesso de leitura.")
        } else if (flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION == 0) throw IOException("O destino não concedeu acesso de escrita.")
        context.contentResolver.takePersistableUriPermission(uri, if (pickerKind == "catalog") flags and Intent.FLAG_GRANT_READ_URI_PERMISSION else flags)
        val document = if (pickerKind == "folder") DocumentFile.fromTreeUri(context, uri) else DocumentFile.fromSingleUri(context, uri)
        promise.resolve(mapOf("kind" to (if (pickerKind == "folder") "folder" else "file"), "uri" to uri.toString(), "name" to (document?.name ?: "Destino selecionado")))
      } catch (e: Exception) { promise.reject(e.toCodedException()) }
    }

    AsyncFunction("readCatalogAsync") { location: String ->
      val uri = Uri.parse(location)
      if (uri.scheme != "content") throw IOException("Escolha o arquivo do cadastro novamente.")
      val file = DocumentFile.fromSingleUri(context, uri) ?: throw IOException("Arquivo indisponível. Último cadastro mantido.")
      if (!file.isFile || !file.canRead()) throw IOException("Não foi possível acessar o arquivo. Último cadastro mantido. Confira a conexão ou escolha o arquivo novamente.")
      if (file.length() > MAX_CATALOG_BYTES) throw IOException("Use um cadastro com até 5 MB.")
      val bytes = (context.contentResolver.openInputStream(uri) ?: throw IOException("Não foi possível ler o arquivo. Último cadastro mantido.")).use { input ->
        ByteArrayOutputStream().use { output ->
          val buffer = ByteArray(8192)
          var total = 0
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            if (total > MAX_CATALOG_BYTES) throw IOException("Use um cadastro com até 5 MB.")
            output.write(buffer, 0, count)
          }
          output.toByteArray()
        }
      }
      mapOf("name" to (file.name ?: "cadastro.xlsx"), "base64" to Base64.encodeToString(bytes, Base64.NO_WRAP))
    }

    AsyncFunction("writeFileAsync") { kind: String, location: String, filename: String, base64: String, mime: String ->
      require(kind in listOf("folder", "file"))
      val extension = if (mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ".xlsx" else if (mime == "text/csv") ".csv" else throw IOException("Formato de saída inválido.")
      if (filename.contains('/') || filename.contains('\\') || !filename.endsWith(extension, ignoreCase = true)) throw IOException("Nome de arquivo incompatível com o formato escolhido.")
      val uri = Uri.parse(location)
      val file = if (kind == "folder") {
        val folder = DocumentFile.fromTreeUri(context, uri) ?: throw IOException("Selecione a pasta novamente.")
        if (!folder.isDirectory || !folder.canWrite()) throw IOException("Pasta indisponível. Confira a conexão ou selecione o destino novamente.")
        folder.findFile(filename) ?: folder.createFile(mime, filename) ?: throw IOException("Não foi possível criar o arquivo.")
      } else {
        DocumentFile.fromSingleUri(context, uri) ?: throw IOException("Selecione o arquivo novamente.")
      }
      if (file.name?.endsWith(extension, ignoreCase = true) != true) throw IOException("Escolha um arquivo $extension.")
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      VerifiedDocumentWriter.replace(bytes,
        { content ->
          try { writeDocument(file.uri, content) }
          catch (error: Exception) { throw IOException("Falha ao gravar o destino.", error) }
        },
        { context.contentResolver.openInputStream(file.uri) },
        { milliseconds -> Thread.sleep(milliseconds) }
      )
      // Exact readback confirms provider content, not completion of cloud synchronization.
      mapOf("uri" to file.uri.toString(), "name" to (file.name ?: filename))
    }
  }
}
