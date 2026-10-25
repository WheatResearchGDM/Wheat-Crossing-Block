package expo.modules.bcdocuments

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.exception.toCodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException

private const val PICK_OUTPUT = 61432

class BCDocumentsModule : Module() {
  private var pending: Promise? = null
  private var pickerKind = "folder"
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BCDocuments")

    AsyncFunction("chooseAsync") { kind: String, filename: String, promise: Promise ->
      if (pending != null) throw IOException("Já há uma seleção aberta.")
      require(kind in listOf("folder", "create", "open"))
      val intent = Intent(when (kind) {
        "folder" -> Intent.ACTION_OPEN_DOCUMENT_TREE
        "create" -> Intent.ACTION_CREATE_DOCUMENT
        else -> Intent.ACTION_OPEN_DOCUMENT
      }).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        if (kind != "folder") {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = if (kind == "open") "*/*" else "text/csv"
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
        if (flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION == 0) throw IOException("O destino não concedeu acesso de escrita.")
        context.contentResolver.takePersistableUriPermission(uri, flags)
        val document = if (pickerKind == "folder") DocumentFile.fromTreeUri(context, uri) else DocumentFile.fromSingleUri(context, uri)
        promise.resolve(mapOf("kind" to (if (pickerKind == "folder") "folder" else "file"), "uri" to uri.toString(), "name" to (document?.name ?: "Destino selecionado")))
      } catch (e: Exception) { promise.reject(e.toCodedException()) }
    }

    AsyncFunction("writeCsvAsync") { kind: String, location: String, filename: String, content: String ->
      val uri = Uri.parse(location)
      val file = if (kind == "folder") {
        val folder = DocumentFile.fromTreeUri(context, uri) ?: throw IOException("Selecione a pasta novamente.")
        if (!folder.isDirectory || !folder.canWrite()) throw IOException("Pasta indisponível. Confira a conexão ou selecione o destino novamente.")
        folder.findFile(filename) ?: folder.createFile("text/csv", filename) ?: throw IOException("Não foi possível criar o CSV.")
      } else {
        DocumentFile.fromSingleUri(context, uri) ?: throw IOException("Selecione o CSV novamente.")
      }
      if (file.name != filename) throw IOException("Escolha o arquivo $filename para este usuário.")
      val bytes = content.toByteArray(Charsets.UTF_8)
      (context.contentResolver.openOutputStream(file.uri, "wt") ?: throw IOException("Não foi possível abrir o CSV para escrita.")).use { it.write(bytes); it.flush() }
      // Provider success does not mean OneDrive has finished cloud synchronization.
      val readback = context.contentResolver.openInputStream(file.uri)?.use { it.readBytes() }
      if (readback == null || !readback.contentEquals(bytes)) throw IOException("O destino não confirmou o conteúdo completo. Os dados continuam no aparelho; tente exportar novamente.")
      mapOf("uri" to file.uri.toString(), "name" to filename)
    }
  }
}
