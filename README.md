# Wheat-Crossing-Block
Aplicativo para coleta de espigas disponíveis no BC.

Primeira versão Android, desenvolvida em React Native + Expo SDK 58 e TypeScript. O projeto pode ser aberto diretamente nesta pasta no VS Code.

## Fluxo implementado

1. Configurar o nome do coletor e importar um cadastro CSV ou Excel.
2. Selecionar a safra e o bloco de cruzamento.
3. Localizar um balde pelo número ou usar anterior/próximo.
4. Registrar data, quantidade e observação para emasculação e polinização.
5. Salvar no próprio aparelho, inclusive sem internet.
6. Exportar o CSV acumulado e transferi-lo para o computador.

O armazenamento principal do aparelho é SQLite. O CSV é uma cópia acumulada para transferência, com nome fixo por identidade do coletor/aparelho. Exportar novamente não apaga coletas do banco. A chegada ao computador e a importação pelo Excel ainda exigem ação do usuário. Não há servidor ou sincronização automática nesta versão.

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
Safra;Bloco;Balde
2026;BC-EXEMPLO-A;101
2026;BC-EXEMPLO-A;102
2026;BC-EXEMPLO-B;101
```

- `Bloco` e `Balde` são obrigatórios. `Safra` é recomendada; se a coluna não existir, vale a safra preenchida no formulário.
- No Excel, prefira uma aba chamada `CADASTRO`. Se houver apenas uma aba compatível, ela será usada. Os cabeçalhos devem estar na primeira linha, sem títulos acima deles.
- Também são aceitos `Ciclo`, `BC`, `Bloco de cruzamento` e `Número do balde`.
- Baldes são identificadores numéricos de até oito dígitos. Zeros à esquerda são preservados; os identificadores devem coincidir com os usados na planilha de acompanhamento.
- Fórmulas nas colunas de identificação não são aceitas; use valores fixos.
- Limites: arquivo até 5 MB e 10.000 linhas de dados. Arquivos inválidos são rejeitados antes da incorporação.
- O mesmo número pode existir em diferentes blocos ou safras. Repetições do mesmo vínculo são ignoradas. Reimportar adiciona novos vínculos e preserva os existentes e todas as coletas.

Na configuração também é possível adicionar baldes manualmente ao contexto selecionado. O cadastro funciona offline após a importação.

## Regras da coleta

Uma avaliação por coletor, safra, bloco, balde, data e finalidade. Repetir o salvamento sem mudar os dados não cria cópia. Corrigir quantidade ou observação conserva o identificador e incrementa a versão; o banco mantém as revisões. A quantidade aceita inteiros de zero a 100.000. Vazio significa não informado e nunca vira zero automaticamente.

Datas de avaliações já salvas ficam fixas nesta primeira versão. Não há exclusão de registros ou troca de coletor no mesmo aparelho. Para corrigir data/finalidade ou cancelar um registro, será necessário implementar o fluxo de retificação antes do uso em produção. Alterar o nome do perfil apenas corrige o nome de exibição da mesma identidade.

Os formulários exigem o botão **Salvar registros**. Há avisos antes de navegar com alterações pendentes. O aplicativo não promete preservar digitação ainda não salva se for encerrado pelo sistema. Não desinstale o app nem limpe seus dados sem exportar e conferir a cópia no computador.

## Excel

O módulo inicial está em [excel/ImportarColetasBC.bas](excel/ImportarColetasBC.bas). As instruções e limites estão em [docs/EXCEL.md](docs/EXCEL.md). A macro deve ser validada em uma cópia do `.xlsm` antes de uso operacional. O arquivo original não foi modificado.

## Verificação

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm exec expo export --platform android --output-dir dist-android
```

Os testes usam SQLite real e cobrem persistência ao reabrir, transações, idempotência, correções, zero, datas, CSV e leitura de cadastro Excel. A exportação Android valida o bundle JavaScript/Hermes; não gera um APK nem substitui o teste em aparelho. O GitHub Actions executa as mesmas verificações em cada push/PR.

Dados de pesquisa, planilhas operacionais, CSVs exportados, bancos locais e credenciais são ignorados pelo Git. A licença do template Expo está preservada em `LICENSE`; ela se refere ao material original do template.
