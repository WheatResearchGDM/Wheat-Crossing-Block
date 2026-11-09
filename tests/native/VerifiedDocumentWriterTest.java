package expo.modules.bcdocuments;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

public final class VerifiedDocumentWriterTest {
  private static final byte[] DATA = "PK\u0003\u0004;avaliação;espigas ou observação".getBytes(StandardCharsets.UTF_8);
  private static int passed = 0;
  private static void require(boolean condition) { if (!condition) throw new AssertionError(); }
  private static void test(String name, Task task) throws Exception { task.run(); passed++; System.out.println("OK: " + name); }
  @FunctionalInterface private interface Task { void run() throws Exception; }
  private static void fails(Task task) throws Exception {
    try { task.run(); throw new AssertionError("Expected failure"); }
    catch (IOException expected) { require(expected.getMessage().contains("Os dados continuam no aparelho")); }
  }

  public static void main(String[] args) throws Exception {
    test("confirma arquivo em branco após gravar e fechar", () -> {
      Path file = Files.createTempFile("bc-blank-", ".xlsx");
      try {
        VerifiedDocumentWriter.replace(DATA, bytes -> { try (FileOutputStream out = new FileOutputStream(file.toFile())) { VerifiedDocumentWriter.writeSeekable(out, bytes); } }, () -> Files.newInputStream(file), ms -> {throw new AssertionError("No retry expected");});
        require(Arrays.equals(Files.readAllBytes(file), DATA));
      } finally { Files.delete(file); }
    });
    test("remove cauda de arquivo anterior mesmo com stream em modo append", () -> {
      Path file = Files.createTempFile("bc-tail-", ".csv");
      try {
        Files.write(file, new byte[32000]);
        VerifiedDocumentWriter.replace(DATA, bytes -> { try (FileOutputStream out = new FileOutputStream(file.toFile(), true)) { VerifiedDocumentWriter.writeSeekable(out, bytes); } }, () -> Files.newInputStream(file), ms -> {});
        require(Files.size(file) == DATA.length);
      } finally { Files.delete(file); }
    });
    test("provedor vazio ou desatualizado confirma depois sem regravar", () -> {
      int[] calls = {0,0}; List<Long> waits = new ArrayList<>();
      VerifiedDocumentWriter.replace(DATA, bytes -> calls[0]++, () -> new ByteArrayInputStream(++calls[1] < 4 ? new byte[0] : DATA), waits::add);
      require(calls[0] == 1 && calls[1] == 4); require(waits.equals(Arrays.asList(300L,700L,1500L)));
    });
    test("leitura temporariamente indisponível é repetida", () -> {
      int[] reads = {0};
      VerifiedDocumentWriter.replace(DATA, bytes -> {}, () -> { if (++reads[0] < 3) throw new IOException("Provider busy"); return new ByteArrayInputStream(DATA); }, ms -> {});
      require(reads[0] == 3);
    });
    test("arquivo com prefixo correto e bytes sobrando nunca confirma", () -> {
      int[] writes = {0}; byte[] longer = Arrays.copyOf(DATA, DATA.length + 100);
      fails(() -> VerifiedDocumentWriter.replace(DATA, bytes -> writes[0]++, () -> new ByteArrayInputStream(longer), ms -> {}));
      require(writes[0] == 1);
    });
    test("conteúdo truncado ou diferente nunca confirma", () -> {
      for (byte[] wrong : new byte[][] { Arrays.copyOf(DATA, 2), new byte[DATA.length] })
        fails(() -> VerifiedDocumentWriter.replace(DATA, bytes -> {}, () -> new ByteArrayInputStream(wrong), ms -> {}));
    });
    test("falha de escrita ou fechamento impede leitura e não regrava", () -> {
      int[] writes = {0};
      fails(() -> VerifiedDocumentWriter.replace(DATA, bytes -> { writes[0]++; throw new IOException("Close failed"); }, () -> {throw new AssertionError("Should not read");}, ms -> {}));
      require(writes[0] == 1);
    });
    test("comparação suporta leitura parcial e exige fechamento sem erro", () -> {
      VerifiedDocumentWriter.replace(DATA, bytes -> {}, () -> new ByteArrayInputStream(DATA) { @Override public synchronized int read(byte[] b,int off,int len) { return super.read(b,off,Math.min(2,len)); } }, ms -> {});
      fails(() -> VerifiedDocumentWriter.replace(DATA, bytes -> {}, () -> new ByteArrayInputStream(DATA) { @Override public void close() throws IOException { throw new IOException("Read close failed"); } }, ms -> {}));
    });
    test("ausência permanente de leitura falha após tentativas limitadas", () -> {
      int[] reads = {0};
      fails(() -> VerifiedDocumentWriter.replace(DATA, bytes -> {}, () -> { reads[0]++; return null; }, ms -> {}));
      require(reads[0] == 6);
    });
    test("cancelamento interrompe espera e não confirma", () -> {
      fails(() -> VerifiedDocumentWriter.replace(DATA, bytes -> {}, () -> null, ms -> {throw new InterruptedException();}));
      require(Thread.currentThread().isInterrupted()); Thread.interrupted();
    });
    test("compara arquivos binários maiores que o buffer e rejeita diferença no final", () -> {
      byte[] large = new byte[256000]; new Random(42).nextBytes(large);
      VerifiedDocumentWriter.replace(large, bytes -> {}, () -> new ByteArrayInputStream(large), ms -> {});
      byte[] corrupted = large.clone(); corrupted[corrupted.length - 1] ^= 1;
      fails(() -> VerifiedDocumentWriter.replace(large, bytes -> {}, () -> new ByteArrayInputStream(corrupted), ms -> {}));
    });
    System.out.println("PASSED: " + passed + " native document writer tests");
  }
}
