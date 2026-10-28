# Gerar APK pelo GitHub Actions

O workflow **Gerar APK Android** compila no próprio GitHub. Não exige conta/token Expo nem chave de produção nos Secrets. Ele produz uma variante independente para teste chamada **Registro de BC (GitHub)**.

Versão **0.6.0**: [baixar APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40564446738/artifacts/12763960179). [Compilação concluída com sucesso](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40564446738), código `4c3fab0`. A importação/atualização dos baldes é manual em Configurações e não é solicitada após exportar. Inclui Iniciar novo bloco com confirmação da limpeza de coletas de todos os usuários, revisões, prioridades, cadastro, rascunhos, cache/CSV internos e destinos salvos. Arquivos originais e CSVs externos são preservados; nomes de coletores e identidade do aparelho permanecem. O resumo da exportação informa o total e os novos IDs desde a última exportação confirmada, sem contar correções/reenvios como novos, e solicita conferir a sincronização no OneDrive.

TypeScript, lint, 39 testes e bundle Android passaram. A compilação GitHub concluiu com sucesso. O pacote baixado foi conferido: digest do ZIP, CRC dos arquivos, manifesto 0.6.0/código 6, mesmo identificador, bundle com os novos pop-ups e bibliotecas ARM 32/64 bits. O certificado é o mesmo dos APKs 0.3.0–0.5.0. SHA-256 do APK: `03151b1945260537ad4a628a0a8dc9915632e9cafd5b767c9b696b2fbdac89bd`. A instalação e o teste em aparelho ainda fazem parte do piloto.

Versão **0.5.0**: [baixar APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40382133395/artifacts/12679722866). [Compilação concluída com sucesso](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40382133395), código `493b588`. As últimas datas selecionadas preenchem campos vazios dos próximos baldes, inclusive os visitados anteriormente, preservando avaliações existentes. A coleta de cada usuário é retomada sem limpeza ao trocar de usuário; somente a exportação confirmada limpa os campos. Inclui revisão do cadastro no início de cada ciclo com alternativa offline, configurações em três grupos e CSV na ordem `Nome do Bloco;Balde;Data;Propósito;Disponibilidade;Observação;Prioridade;Nome do usuário;Data de criação;Device ID`. TypeScript, lint, 34 testes e bundle Android passaram localmente, e o workflow GitHub concluiu com sucesso.

O pacote 0.5.0 foi baixado e conferido: digest do ZIP, CRC dos arquivos do APK, manifesto com versão 0.5.0/código 5, mesmo pacote, bundle embarcado, bibliotecas ARM 32/64 bits e certificado igual ao da versão 0.4.0. Cópia local ignorada pelo Git: `outputs/RegistroBC-GitHub-0.5.0.apk`. SHA-256: `07a6c1aa74ead5053f637e98c57ae50e4da884c836c34d50120fe5a59854ff43`. A instalação e o uso no aparelho ainda precisam ser conferidos no piloto. O banco interno preserva avaliações e revisões; Enviar cópia dos dados permite gerar novamente o CSV acumulado, mas não é um backup externo automático.

Versão **0.4.0**: [baixar APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40368474405/artifacts/12672497189). [Compilação concluída com sucesso](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40368474405), código `ce10380`. Inclui prioridade persistente por balde com controle discreto em `#b4bd00`, nova coluna final `Prioridade` (`SIM`/`NÃO`) no CSV e retorno ao primeiro balde do bloco ao iniciar uma nova coleta. Mantém as seções e os campos existentes; as setas maiores e próximas ao número seguem o esboço aprovado. O aplicativo coleta a prioridade, mas não recomenda cruzas. TypeScript, lint, 31 testes e exportação do bundle Android passaram localmente; a compilação GitHub também passou em suas verificações.

O pacote 0.4.0 foi baixado e conferido: digest do ZIP, CRC dos arquivos do APK, manifesto com versão 0.4.0/código 4 e mesmo pacote, bundle embarcado com prioridade/cor, bibliotecas ARM 32/64 bits e certificado igual ao da versão 0.3.0. Cópia local ignorada pelo Git: `outputs/RegistroBC-GitHub-0.4.0.apk`. SHA-256 do APK: `a5801b7de0b68400d6ff45ae9a959fe2ae7b81c6fbdf77a302edd3a6cbe21141`. Instale como atualização, preservando o banco local. A instalação e o uso no aparelho ainda precisam ser conferidos no piloto.

Versão **0.3.0**: [baixar APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40155081615/artifacts/12584104042). [Compilação concluída com sucesso](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40155081615), código `c67438c`. Inclui CSV por aparelho com nome do usuário, nova rodada em branco após exportar ou trocar usuário, lixeira no pop-up de usuários e envio de cópia por compartilhamento. Os 28 testes, TypeScript e lint passaram. Exclusão de usuário e limpeza de formulário preservam o histórico. Enviar cópia não confirma recebimento e não limpa o formulário; o teste de OneDrive real ainda depende do aparelho.

O pacote 0.3.0 foi baixado e conferido: digest do ZIP, estrutura do APK, JavaScript embarcado, ARM 32/64 bits e certificado igual ao da versão 0.2.0. Cópia local ignorada pelo Git: `outputs/RegistroBC-GitHub-0.3.0.apk`. SHA-256 do APK: `71f42a122c7aec4ffb099ffb394c2f6991ab65ec9d226dbd5841d8f105fb1782`. Instale como atualização, preservando os dados do app. A instalação e o uso no aparelho continuam no roteiro de piloto.

Versão **0.2.0**, com coleta compacta, salvamento automático e ícone de espiga: [baixar APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40150872590/artifacts/12582304034). [Execução concluída com sucesso](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40150872590), código `ed67275`. Os 21 testes, lint e TypeScript passaram. O teste em aparelho e com o OneDrive real faz parte do piloto.

Conferidos o digest SHA-256 do ZIP, a estrutura do APK, o bundle embarcado, as bibliotecas ARM 32/64 bits e a igualdade do certificado com o APK GitHub anterior. APK local: `outputs/RegistroBC-GitHub-0.2.0.apk` (ignorado pelo Git). SHA-256: `0aac9c9c0f4d376bac917e0b37460ffbdc15ddf2a889b83896781e64a97da4fa`. A comparação do certificado não substitui o teste de instalação e funcionamento no aparelho.

Primeira execução concluída com sucesso: [ver execução](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40144356972). [Baixar o artefato com o APK](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40144356972/artifacts/12580640662). O pacote gerado foi conferido: integridade do ZIP, estrutura do APK, bloco de assinatura, JavaScript embarcado e bibliotecas ARM de 32/64 bits. A instalação e o teste de campo no aparelho continuam no roteiro do piloto.

## Versão 0.7.0

[Baixar instalador completo](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40683427339/artifacts/12814123776). [Compilação concluída](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40683427339), código `1f066c5`.

Layout adaptável com Data, Observação e Espigas em três colunas iguais; contador à direita, títulos centralizados, cabeçalho maior e navegação também inferior. Duas linhas iniciais por finalidade, ajustáveis entre uma e quatro. + precede − e os limites desabilitam os botões. Ocultar mantém todos os dados e o CSV; uma linha preenchida pede confirmação explicando a preservação. A quantidade de linhas acompanha os próximos baldes e persiste após reiniciar/exportar por coletor e bloco. As avaliações e a terceira linha antiga preenchida são preservadas na atualização.

TypeScript, lint e 44 testes passaram localmente e no GitHub. Conferidos digest do ZIP, CRC do APK, manifesto 0.7.0/código 7, pacote GitHub, certificado igual às versões anteriores, bundle embarcado e bibliotecas ARM 32/64. SHA-256 do APK: `1194c43b251a8dcb6d78ea406c530e88b417a8697db57659412f818631a61d3a`. A instalação e a verificação visual em aparelho físico continuam no roteiro do piloto.

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
