# Wheat-Crossing-Block
Aplicativo para coleta de espigas disponíveis no BC.

Versão Android 0.3.0, desenvolvida em React Native + Expo SDK 58 e TypeScript. O projeto pode ser aberto diretamente nesta pasta no VS Code.

[Baixar APK 0.3.0](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40155081615/artifacts/12584104042). Extraia o ZIP e instale `RegistroBC-GitHub.apk` como atualização de **Registro de BC (GitHub)**. [Instruções](docs/INSTALAR_ANDROID.md).

## Fluxo implementado

1. Tocar no ícone de usuário e identificar o coletor pelo nome.
2. Importar o cadastro em Configurações e escolher o bloco pelo nome no topo.
3. Navegar pelas setas ou tocar no número para escolher um balde.
4. Preencher até três datas por finalidade, na mesma tela, com contador `↓ número ↑`.
5. As alterações são gravadas automaticamente no aparelho, inclusive sem internet.
6. Tocar no ícone de exportação para atualizar o CSV no destino escolhido.
7. Após gravação confirmada, iniciar nova rodada com datas em branco, espigas zero e observações vazias.

O armazenamento principal do aparelho é SQLite. Cada aparelho tem um CSV acumulado `REGISTRO_BC_[ID_DO_APARELHO].csv`, com todos os seus usuários identificados na coluna `Nome do usuário`. O destino é lembrado para todos os usuários após reiniciar. A exportação reescreve o snapshot completo do aparelho, sem apagar o banco. Aparelhos diferentes geram arquivos diferentes, inclusive quando o coletor é o mesmo. Sucesso de escrita no provedor não confirma sincronização à nuvem ou importação pelo Excel. Não há servidor de sincronização entre aparelhos.

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

Uma avaliação por rodada, coletor, bloco, balde, data e finalidade (a safra legada permanece apenas internamente). Repetir o salvamento sem mudar os dados na mesma rodada não cria cópia. Corrigir quantidade ou observação conserva o identificador e incrementa a versão; o banco mantém as revisões. Recolher na mesma data após iniciar outra rodada gera uma nova avaliação, preservando a anterior. Quantidades vão de zero a 100.000. Linhas sem data e com zero/sem observação não são exportadas.

As datas são sugeridas nos próximos baldes durante a mesma rodada. Exportar com sucesso ou trocar de usuário limpa as seis linhas: datas em branco, espigas zero e observações vazias. Essa limpeza vale para os baldes da nova rodada e persiste após reiniciar. Selecionar uma data pode reabrir uma avaliação da rodada atual; contagens de rodadas anteriores não preenchem a tela. O histórico permanece no banco e no CSV. Não há exclusão de avaliações. A lixeira no pop-up de usuários exclui apenas o nome da lista, com confirmação, preservando suas coletas. Excluir o usuário ativo exige nova identificação.

Cada alteração é enfileirada para gravação local em uma transação. Rascunhos incompletos também são persistidos e recuperados; campos inválidos impedem avançar/exportar até correção. A navegação aguarda a fila de gravação. O rodapé informa gravação ou falha; não há botão de salvar nem histórico. Como em qualquer aplicativo, encerrar à força durante uma escrita ou perder o aparelho pode impedir recuperar o último evento ainda em andamento. Não desinstale nem limpe os dados sem exportar e conferir a cópia no computador.

## CSV e destino de saída

Colunas: `Nome do Bloco;Balde;Data;Propósito;Disponibilidade;Observação;Data de criação;Device ID;Nome do usuário`. UTF-8 com BOM, separador ponto e vírgula, datas de avaliação `DD/MM/AAAA`, criação ISO 8601 UTC e finalidade por extenso. Textos que poderiam ser executados como fórmulas no Excel recebem um apóstrofo de proteção.

Em Configurações, escolha a pasta, ou use **Criar arquivo de saída** / **Escolher CSV existente** com o nome esperado para este aparelho. A permissão persistente é lembrada. Uma pasta escolhida na versão anterior pode ser reutilizada; arquivos por usuário exigem escolher o novo arquivo por aparelho. Os arquivos antigos não são apagados. Uma falha na escrita ou leitura de confirmação mantém os dados e o formulário.

O seletor Android depende dos provedores disponíveis e não representa integração direta com a conta Microsoft. Se o OneDrive não aparecer, use **Enviar cópia (OneDrive…)**, escolha o OneDrive entre os aplicativos disponíveis e confirme o envio nele. Compartilhar não confirma recebimento, não limpa campos e não marca registros como exportados. Você pode exportar para uma pasta local primeiro (gravação confirmada, tela limpa) e depois enviar uma cópia. A pasta escolhida dentro do OneDrive nesse caminho é controlada pelo próprio OneDrive e não pode ser lembrada pelo app de coleta.

## Excel

O novo CSV tem nove colunas. O módulo inicial [excel/ImportarColetasBC.bas](excel/ImportarColetasBC.bas) foi criado para o CSV técnico de 15 colunas da versão 0.1 e **ainda não importa o novo formato**. A macro deverá verificar conflitos entre aparelhos, usuários e rodadas por bloco, balde, data e finalidade. Consulte [docs/EXCEL.md](docs/EXCEL.md). O arquivo original não foi modificado.

## Verificação

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm exec expo export --platform android --output-dir dist-android
```

Os testes usam SQLite real e cobrem persistência ao reabrir, transações, idempotência, correções, zero, datas, CSV e leitura de cadastro Excel. A exportação Android valida o bundle JavaScript/Hermes; não gera um APK nem substitui o teste em aparelho. O GitHub Actions executa as mesmas verificações em cada push/PR.

Dados de pesquisa, planilhas operacionais, CSVs exportados, bancos locais e credenciais são ignorados pelo Git. A licença do template Expo está preservada em `LICENSE`; ela se refere ao material original do template.
