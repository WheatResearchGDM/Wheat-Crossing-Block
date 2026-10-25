# Wheat-Crossing-Block
Aplicativo para coleta de espigas disponíveis no BC.

Versão Android 0.2.0, desenvolvida em React Native + Expo SDK 58 e TypeScript. O projeto pode ser aberto diretamente nesta pasta no VS Code.

## Fluxo implementado

1. Tocar no ícone de usuário e identificar o coletor pelo nome.
2. Importar o cadastro em Configurações e escolher o bloco pelo nome no topo.
3. Navegar pelas setas ou tocar no número para escolher um balde.
4. Preencher até três datas por finalidade, na mesma tela, com contador `↓ número ↑`.
5. As alterações são gravadas automaticamente no aparelho, inclusive sem internet.
6. Tocar no ícone de exportação para atualizar o CSV no destino escolhido.

O armazenamento principal do aparelho é SQLite. Cada usuário tem seu CSV acumulado `REGISTRO_BC_[NOME DO USUÁRIO].csv`. A pasta ou arquivo selecionado é lembrado após reiniciar. A exportação reescreve o snapshot completo desse usuário/aparelho, sem apagar o banco. O OneDrive sincroniza conforme suas próprias permissões e conexão; sucesso de escrita no provedor não confirma chegada à nuvem ou ao Excel. Não há servidor de sincronização entre aparelhos. Use nomes diferentes para coletores diferentes; o mesmo usuário em dois aparelhos não deve apontar ambos ao mesmo CSV, pois um snapshot substituiria o outro.

## Executar no VS Code

Requisitos: Node.js 24 LTS, pnpm 11 e um aparelho Android. Emulador Android é uma alternativa.

```powershell
git clone https://github.com/WheatResearchGDM/Wheat-Crossing-Block.git
cd Wheat-Crossing-Block
git switch feat/coleta-offline
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm typecheck
```

Para gerar o primeiro APK de teste, use uma conta Expo/EAS autorizada:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

O projeto já está vinculado à conta Expo e possui assinatura Android gerenciada pelo EAS. O perfil `preview` em `eas.json` gera APK para instalação interna e funciona sem o servidor do VS Code. Para desenvolvimento com recarga, instale `expo-dev-client` com `pnpm exec expo install expo-dev-client`, gere/instale uma build com o perfil `development` e execute `pnpm start --dev-client`. Não há dependência do Expo Go no uso final. Consulte o resultado de cada compilação no painel do projeto EAS antes de baixar o APK.

## Cadastro de blocos e baldes

CSV UTF-8 com ponto e vírgula, vírgula ou tabulação, ou Excel `.xlsx`/`.xls`. A primeira linha deve conter os nomes das colunas:

```csv
Nome do Bloco;Balde
BC_SIMPLES_KX26;101
BC_SIMPLES_KX26;102
BC_DUPLO_KX26;101
```

- `Nome do Bloco` e `Balde` são as duas colunas do cadastro. Não é necessário informar safra.
- No Excel, prefira uma aba chamada `CADASTRO`. Se houver apenas uma aba compatível, ela será usada. Os cabeçalhos devem estar na primeira linha, sem títulos acima deles.
- Também são aceitos os cabeçalhos `Bloco`, `BC`, `Bloco de cruzamento` e `Número do balde`. Cadastros antigos com safra continuam legíveis para compatibilidade.
- Baldes são identificadores numéricos de até oito dígitos. Zeros à esquerda são preservados; os identificadores devem coincidir com os usados na planilha de acompanhamento.
- Fórmulas nas colunas de identificação não são aceitas; use valores fixos.
- Limites: arquivo até 5 MB e 10.000 linhas de dados. Arquivos inválidos são rejeitados antes da incorporação.
- O mesmo número pode existir em diferentes blocos. Repetições do mesmo vínculo são ignoradas. A última importação substitui a lista de navegação; as coletas dos catálogos anteriores permanecem no aparelho e no CSV.

O cadastro funciona offline após a importação. Para alterá-lo, importe o arquivo atualizado.

## Regras da coleta

Uma avaliação por coletor, bloco, balde, data e finalidade (a safra legada permanece apenas internamente). Repetir o salvamento sem mudar os dados não cria cópia. Corrigir quantidade ou observação conserva o identificador e incrementa a versão; o banco mantém as revisões. A quantidade aceita inteiros de zero a 100.000 e começa em zero. Baldes ainda não visitados não geram registros. Linhas sem data e com zero/sem observação não são exportadas.

As datas escolhidas são sugeridas nos próximos baldes. Trocar a data de uma linha abre a avaliação dessa data, se já existir, ou começa em zero. Avaliações das datas anteriores permanecem no histórico interno e no CSV. A tela mostra até três datas de cada finalidade; escolher uma data antiga permite reabri-la. Não há exclusão de avaliações nesta versão. Coletores podem alternar no mesmo aparelho; seus dados e destinos de arquivo ficam separados.

Cada alteração é enfileirada para gravação local em uma transação. Rascunhos incompletos também são persistidos e recuperados; campos inválidos impedem avançar/exportar até correção. A navegação aguarda a fila de gravação. O rodapé informa gravação ou falha; não há botão de salvar nem histórico. Como em qualquer aplicativo, encerrar à força durante uma escrita ou perder o aparelho pode impedir recuperar o último evento ainda em andamento. Não desinstale nem limpe os dados sem exportar e conferir a cópia no computador.

## CSV e destino de saída

Colunas: `Nome do Bloco;Balde;Data;Propósito;Disponibilidade;Observação;Data de criação;Device ID`. UTF-8 com BOM, separador ponto e vírgula, datas de avaliação `DD/MM/AAAA`, criação ISO 8601 UTC e finalidade por extenso. Textos que poderiam ser executados como fórmulas no Excel recebem um apóstrofo de proteção.

Em Configurações, escolha a pasta. Se o provedor (por exemplo OneDrive) não permitir selecionar pastas, use **Salvar como / OneDrive** uma única vez para criar o arquivo ou **Escolher CSV existente** para reutilizar um arquivo com o nome esperado. O acesso persistente concedido pelo Android é lembrado. Revogação, mudança do arquivo, indisponibilidade do provedor ou falta de conexão podem exigir nova escolha. A cópia local e o banco são preservados se a exportação falhar. O provedor precisa estar instalado, autenticado e oferecer escrita pelo seletor de documentos Android.

## Excel

O novo CSV tem oito colunas. O módulo inicial [excel/ImportarColetasBC.bas](excel/ImportarColetasBC.bas) foi criado para o CSV técnico de 15 colunas da versão 0.1 e **ainda não importa o novo formato**. A adaptação da macro é uma etapa seguinte; consulte [docs/EXCEL.md](docs/EXCEL.md). O arquivo original não foi modificado.

## Verificação

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm exec expo export --platform android --output-dir dist-android
```

Os testes usam SQLite real e cobrem persistência ao reabrir, transações, idempotência, correções, zero, datas, CSV e leitura de cadastro Excel. A exportação Android valida o bundle JavaScript/Hermes; não gera um APK nem substitui o teste em aparelho. O GitHub Actions executa as mesmas verificações em cada push/PR.

Dados de pesquisa, planilhas operacionais, CSVs exportados, bancos locais e credenciais são ignorados pelo Git. A licença do template Expo está preservada em `LICENSE`; ela se refere ao material original do template.
