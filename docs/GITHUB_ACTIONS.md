# Gerar APK pelo GitHub Actions

O workflow **Gerar APK Android** compila no próprio GitHub. Não exige conta/token Expo nem chave de produção nos Secrets. Ele produz uma variante independente para teste chamada **Registro de BC (GitHub)**.

Primeira execução concluída com sucesso: [ver execução](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40144356972). [Baixar o artefato com o APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40144356972/artifacts/12580640662). O pacote gerado foi conferido: integridade do ZIP, estrutura do APK, bloco de assinatura, JavaScript embarcado e bibliotecas ARM de 32/64 bits. A instalação e o teste de campo no aparelho continuam no roteiro do piloto.

## Executar

1. Abra a aba Actions do repositório.
2. Selecione **Gerar APK Android** e clique em **Run workflow**.
3. Em `source_ref`, mantenha `feat/coleta-offline`, ou informe a branch/tag que contém o aplicativo.
4. Em `target`, escolha `celular-tablet` para aparelhos físicos ARM ou `emulador` para emuladores x86_64.
5. Aguarde a execução concluir com sucesso.
6. Na página da execução, baixe o artefato **RegistroBC-Android-celular-tablet** (ou emulador).
7. Extraia o ZIP e abra `RegistroBC-GitHub.apk` no Android para instalar.

O APK inclui o JavaScript e funciona sem o servidor do VS Code. O build usa `assembleRelease` com a assinatura de teste do template Android gerado pelo Expo. Não é uma assinatura de distribuição em loja.

Esta variante usa o identificador `com.wheatresearchgdm.crossingblock.github`, diferente da variante assinada pelo Expo. As duas podem coexistir, mas cada uma mantém seu próprio banco de coletas. Dados não são transferidos automaticamente entre elas. Para uso operacional, escolha uma variante e mantenha sua assinatura nas atualizações.

O workflow manual é disponibilizado na `main` para o botão aparecer na interface do GitHub. O código é obtido da referência selecionada. O arquivo também acompanha a branch do aplicativo. Apenas dados sintéticos e código estão no repositório; CSVs operacionais e bancos locais continuam ignorados.

O artefato fica disponível por 30 dias, conforme a retenção configurada. Para preservá-lo por mais tempo, baixe uma cópia. A compilação inicial pode demorar vários minutos; builds seguintes podem aproveitar o cache do Gradle.
