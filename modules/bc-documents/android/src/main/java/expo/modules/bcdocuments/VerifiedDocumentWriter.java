package expo.modules.bcdocuments;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** Provider-independent commit verification; never equates closing a stream with success. */
public final class VerifiedDocumentWriter {
  private static final long[] DELAYS_MS = {0, 300, 700, 1500, 2500, 4000};
  public static final String NOT_CONFIRMED = "A gravação não pôde ser confirmada no destino. Os dados continuam no aparelho. Aguarde e tente novamente ou use Configurações → Enviar cópia dos dados.";

  @FunctionalInterface public interface Writer { void write(byte[] content) throws IOException; }
  @FunctionalInterface public interface Reader { InputStream open() throws IOException; }
  @FunctionalInterface public interface Pause { void sleep(long milliseconds) throws InterruptedException; }

  private VerifiedDocumentWriter() {}

  public static void writeSeekable(FileOutputStream output, byte[] content) throws IOException {
    output.getChannel().truncate(0);
    output.getChannel().position(0);
    output.write(content);
    output.flush();
    output.getChannel().force(true);
  }

  public static void replace(byte[] content, Writer writer, Reader reader, Pause pause) throws IOException {
    // A writer includes close/commit. An exception here must never trigger a second write.
    try { writer.write(content); }
    catch (IOException error) { throw new IOException(NOT_CONFIRMED, error); }
    IOException lastError = null;
    for (long delay : DELAYS_MS) {
      try {
        if (delay > 0) pause.sleep(delay);
        if (matches(reader, content)) return;
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
        throw new IOException(NOT_CONFIRMED, error);
      } catch (IOException error) {
        lastError = error; // A cloud provider can temporarily return stale or unavailable content.
      }
    }
    throw new IOException(NOT_CONFIRMED, lastError);
  }

  private static boolean matches(Reader reader, byte[] expected) throws IOException {
    try (InputStream input = reader.open()) {
      if (input == null) return false;
      byte[] buffer = new byte[8192];
      int position = 0;
      while (position < expected.length) {
        int count = input.read(buffer, 0, Math.min(buffer.length, expected.length - position));
        if (count < 0) return false;
        if (count == 0) {
          int value = input.read();
          if (value < 0 || (byte) value != expected[position++]) return false;
        } else {
          for (int index = 0; index < count; index++) if (buffer[index] != expected[position + index]) return false;
          position += count;
        }
      }
      // Detect leftover bytes, even when the complete prefix matches.
      return input.read() == -1;
    }
  }
}
