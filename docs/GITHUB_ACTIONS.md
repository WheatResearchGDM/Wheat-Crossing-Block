# Gerar APK pelo GitHub Actions

O workflow **Gerar APK Android** compila no próprio GitHub. Não exige conta/token Expo nem chave de produção nos Secrets. Ele produz uma variante independente para teste chamada **Registro de BC (GitHub)**.

Versão **0.4.0**: [baixar APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40368474405/artifacts/12672497189). [Compilação concluída com sucesso](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40368474405), código `ce10380`. Inclui prioridade persistente por balde com controle discreto em `#b4bd00`, nova coluna final `Prioridade` (`SIM`/`NÃO`) no CSV e retorno ao primeiro balde do bloco ao iniciar uma nova coleta. Mantém as seções e os campos existentes; as setas maiores e próximas ao número seguem o esboço aprovado. O aplicativo coleta a prioridade, mas não recomenda cruzas. TypeScript, lint, 31 testes e exportação do bundle Android passaram localmente; a compilação GitHub também passou em suas verificações.

O pacote 0.4.0 foi baixado e conferido: digest do ZIP, CRC dos arquivos do APK, manifesto com versão 0.4.0/código 4 e mesmo pacote, bundle embarcado com prioridade/cor, bibliotecas ARM 32/64 bits e certificado igual ao da versão 0.3.0. Cópia local ignorada pelo Git: `outputs/RegistroBC-GitHub-0.4.0.apk`. SHA-256 do APK: `a5801b7de0b68400d6ff45ae9a959fe2ae7b81c6fbdf77a302edd3a6cbe21141`. Instale como atualização, preservando o banco local. A instalação e o uso no aparelho ainda precisam ser conferidos no piloto.

Versão **0.3.0**: [baixar APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40155081615/artifacts/12584104042). [Compilação concluída com sucesso](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40155081615), código `c67438c`. Inclui CSV por aparelho com nome do usuário, nova rodada em branco após exportar ou trocar usuário, lixeira no pop-up de usuários e envio de cópia por compartilhamento. Os 28 testes, TypeScript e lint passaram. Exclusão de usuário e limpeza de formulário preservam o histórico. Enviar cópia não confirma recebimento e não limpa o formulário; o teste de OneDrive real ainda depende do aparelho.

O pacote 0.3.0 foi baixado e conferido: digest do ZIP, estrutura do APK, JavaScript embarcado, ARM 32/64 bits e certificado igual ao da versão 0.2.0. Cópia local ignorada pelo Git: `outputs/RegistroBC-GitHub-0.3.0.apk`. SHA-256 do APK: `71f42a122c7aec4ffb099ffb394c2f6991ab65ec9d226dbd5841d8f105fb1782`. Instale como atualização, preservando os dados do app. A instalação e o uso no aparelho continuam no roteiro de piloto.

Versão **0.2.0**, com coleta compacta, salvamento automático e ícone de espiga: [baixar APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40150872590/artifacts/12582304034). [Execução concluída com sucesso](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40150872590), código `ed67275`. Os 21 testes, lint e TypeScript passaram. O teste em aparelho e com o OneDrive real faz parte do piloto.

Conferidos o digest SHA-256 do ZIP, a estrutura do APK, o bundle embarcado, as bibliotecas ARM 32/64 bits e a igualdade do certificado com o APK GitHub anterior. APK local: `outputs/RegistroBC-GitHub-0.2.0.apk` (ignorado pelo Git). SHA-256: `0aac9c9c0f4d376bac917e0b37460ffbdc15ddf2a889b83896781e64a97da4fa`. A comparação do certificado não substitui o teste de instalação e funcionamento no aparelho.

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
