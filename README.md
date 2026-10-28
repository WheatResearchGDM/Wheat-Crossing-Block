# Crossing Block
Aplicativo para coleta de espigas disponíveis no BC.

Versão Android 0.9.0, desenvolvida em React Native + Expo SDK 58 e TypeScript. O projeto pode ser aberto diretamente nesta pasta no VS Code.

[Baixar APK 0.8.0](https://github.com/WheatResearchGDM/Wheat-Crossing-Block/actions/runs/40708054126/artifacts/12824938533). Extraia o ZIP e instale `RegistroBC-GitHub.apk` como atualização de **Registro de BC (GitHub)**. [Instruções](docs/INSTALAR_ANDROID.md).

## Fluxo implementado

1. Tocar no ícone de usuário e identificar o coletor pelo nome.
2. Em Configurações → Escolher arquivo / Atualizar, selecionar o cadastro inicial ou atualizá-lo quando desejar. Exportar não solicita uma nova importação. Escolher o bloco pelo nome no topo.
3. Navegar pelas setas ou tocar no número para escolher um balde. O controle discreto de prioridade fica abaixo do número e usa `#b4bd00` quando ligado.
4. Selecionar duas datas por finalidade no início da coleta; os campos de data vazios dos próximos baldes recebem as últimas datas selecionadas. Avaliações existentes são preservadas. Usar o contador número com as setas à direita.
5. As alterações são gravadas automaticamente no aparelho, inclusive sem internet.
6. Tocar no ícone de exportação para atualizar o CSV no destino escolhido.
7. Após gravação confirmada, iniciar nova rodada no primeiro balde do bloco, com datas em branco, espigas zero e observações vazias. A prioridade de cada balde mantém a última escolha, ligada ou desligada.

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

O cadastro funciona offline após a importação. Para alterá-lo, use Configurações → Escolher arquivo / Atualizar. A nova lista substitui a navegação, inclusive removendo baldes ausentes no arquivo, sem apagar avaliações anteriores. Não há solicitação de cadastro ao exportar nem ao iniciar outra coleta com um cadastro existente.

## Regras da coleta

Uma avaliação por rodada, coletor, bloco, balde, data e finalidade (a safra legada permanece apenas internamente). Repetir o salvamento sem mudar os dados na mesma rodada não cria cópia. Corrigir quantidade ou observação conserva o identificador e incrementa a versão; o banco mantém as revisões. Recolher na mesma data após iniciar outra rodada gera uma nova avaliação, preservando a anterior. Quantidades vão de zero a 100.000. Linhas sem data e com zero/sem observação não são exportadas.

As últimas datas selecionadas preenchem os campos vazios dos próximos baldes, inclusive baldes visitados antes de escolher as datas. Visitar uma avaliação antiga não altera essas sugestões. Trocar de usuário preserva a coleta de cada usuário e permite retomá-la. Somente exportar com sucesso limpa os campos de todas as linhas, inclusive as ocultas: datas em branco, espigas zero e observações vazias. Essa limpeza vale para os baldes da nova rodada e persiste após reiniciar. Selecionar outra data mantém a quantidade e a observação digitadas, ou reabre a avaliação dessa data quando existente na rodada atual. Contagens de rodadas anteriores não preenchem a tela. O histórico permanece no banco e no CSV. A exclusão completa de avaliações e revisões só ocorre ao confirmar Iniciar novo bloco de cruzamento. A lixeira no pop-up de usuários exclui apenas o nome da lista, com confirmação, preservando suas coletas. Excluir o usuário ativo exige nova identificação.

Cada alteração é enfileirada para gravação local em uma transação. Rascunhos incompletos também são persistidos e recuperados; campos inválidos impedem avançar/exportar até correção. A navegação aguarda a fila de gravação. O rodapé informa gravação ou falha; não há botão de salvar nem histórico. Como em qualquer aplicativo, encerrar à força durante uma escrita ou perder o aparelho pode impedir recuperar o último evento ainda em andamento. Não desinstale nem limpe os dados sem exportar e conferir a cópia no computador.

## Iniciar outro bloco de cruzamento

Configurações → Iniciar novo bloco de cruzamento apresenta o aviso de limpeza e exige **Limpar e iniciar**. Cancelar ou fechar o aviso não altera os dados. A confirmação apaga coletas de todos os usuários, revisões, prioridades, rascunhos, sugestões de datas, cadastro, metadados de exportação, locais de entrada/saída e cópias internas do CSV/cache. A identidade do aparelho e a lista de coletores permanecem. O usuário deve importar outro cadastro e escolher um novo destino.

O arquivo original de cadastro, pastas externas e CSVs já exportados não são excluídos. Não há backup automático da limpeza. Falha na remoção dos arquivos internos impede apagar o banco; falha na transação de limpeza preserva as avaliações no banco. A fila de gravação é drenada antes da limpeza, e novas rodadas recusam rascunhos atrasados do bloco anterior.

## CSV e destino de saída

Após exportar com confirmação de escrita, o pop-up informa **Total de registros no arquivo** e **Novos desde a última exportação**, e pede conferir a sincronização no OneDrive. Novos são IDs que não estavam na última exportação confirmada; correções, alterações de prioridade e reenvios não aumentam esse número. A primeira exportação de um bloco conta todas as avaliações como novas. Falhas ou envio por compartilhamento não avançam a contagem.

Colunas: `Nome do Bloco;Balde;Data;Propósito;Disponibilidade;Observação;Prioridade;Nome do usuário;Data de criação;Device ID`. UTF-8 com BOM, separador ponto e vírgula, datas de avaliação `DD/MM/AAAA`, criação ISO 8601 UTC e finalidade por extenso. Textos que poderiam ser executados como fórmulas no Excel recebem um apóstrofo de proteção.

`Prioridade` contém `SIM` ou `NÃO`, conforme a última escolha do balde naquele bloco e safra interna. A escolha é compartilhada pelos usuários do aparelho, persiste após reiniciar e não é limpa nas novas rodadas. Alterá-la atualiza esse dado nas avaliações existentes do balde, mantendo IDs, quantidades, datas e autoria; as versões anteriores ficam nas revisões internas. Registros legados começam sem prioridade. Marcar apenas a prioridade, sem avaliação datada, não cria uma linha fictícia de disponibilidade. O aplicativo coleta e exporta essa informação; não recomenda cruzas.

Em Configurações, use **Escolher destino** / **Alterar destino** para escolher a pasta, criar o arquivo ou selecionar um CSV existente com o nome esperado para este aparelho. A permissão persistente é lembrada. Uma pasta escolhida na versão anterior pode ser reutilizada; arquivos por usuário exigem escolher o novo arquivo por aparelho. Os arquivos antigos não são apagados. Uma falha na escrita ou leitura de confirmação mantém os dados e o formulário.

O seletor Android depende dos provedores disponíveis e não representa integração direta com a conta Microsoft. Se o OneDrive não aparecer, use **Enviar cópia dos dados**, escolha o OneDrive entre os aplicativos disponíveis e confirme o envio nele. Compartilhar não confirma recebimento, não limpa campos e não marca registros como exportados. Você pode exportar para uma pasta local primeiro (gravação confirmada, tela limpa) e depois enviar uma cópia. A pasta escolhida dentro do OneDrive nesse caminho é controlada pelo próprio OneDrive e não pode ser lembrada pelo app de coleta.

O banco interno mantém todas as avaliações salvas e suas revisões após exportar, até uma limpeza explícita para novo bloco. Antes de cada exportação ou envio de cópia, o app também grava um CSV acumulado interno, substituindo a cópia anterior. É possível gerar novamente o CSV acumulado a partir do banco com **Enviar cópia dos dados**. Não há restauração de revisões pela interface nem backup externo automático: perder o aparelho, desinstalar ou limpar os dados pode remover o armazenamento interno.

## Excel

O novo CSV tem dez colunas. O módulo inicial [excel/ImportarColetasBC.bas](excel/ImportarColetasBC.bas) foi criado para o CSV técnico de 15 colunas da versão 0.1 e **ainda não importa o novo formato**. A macro deverá verificar conflitos entre aparelhos, usuários e rodadas por bloco, balde, data e finalidade. Consulte [docs/EXCEL.md](docs/EXCEL.md). O arquivo original não foi modificado.

## Verificação

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm exec expo export --platform android --output-dir dist-android
```

Os testes usam SQLite real e cobrem persistência ao reabrir, transações, idempotência, correções, zero, datas, CSV e leitura de cadastro Excel. A exportação Android valida o bundle JavaScript/Hermes; não gera um APK nem substitui o teste em aparelho. O GitHub Actions executa as mesmas verificações em cada push/PR.

Dados de pesquisa, planilhas operacionais, CSVs exportados, bancos locais e credenciais são ignorados pelo Git. A licença do template Expo está preservada em `LICENSE`; ela se refere ao material original do template.

## Layout e cadastro da versão 0.8

A tela mostra duas linhas fixas de Emasculação e duas de Polinização. Não há +/− para linhas. Os campos mais altos ocupam a área disponível sem rolagem na tela de coleta; em horizontal com largura suficiente, as finalidades ficam lado a lado. As colunas Data, Observação e Espigas têm a mesma largura e as setas de espigas ficam juntas à direita do número. Usuário, configurações e exportação ficam em coluna no canto superior esquerdo; a seleção de BC fica no canto superior direito. O controle de prioridade é maior e mantém a última escolha.

Dados e rascunhos das antigas terceira e quarta linhas são preservados. Suas avaliações já coletadas permanecem no CSV; os registros históricos não são excluídos pela mudança de layout.

No cadastro de baldes, **Escolher arquivo** seleciona o documento original. **Atualizar**, ao lado, relê o mesmo documento sem abrir o seletor e registra a última importação. A fonte e a lista só são substituídas depois da leitura e validação completas. Se o documento estiver sem acesso ou inválido, o cadastro anterior e as avaliações são preservados. A importação continua manual; exportar ou iniciar outra coleta não relê o arquivo sozinho.

Na primeira utilização depois de atualizar uma versão antiga, use **Escolher arquivo** uma vez para autorizar o acesso ao documento original. Antes disso, **Atualizar** fica desabilitado, mas o último cadastro já importado continua disponível offline. Se o provedor perder o vínculo (arquivo movido/substituído ou permissão revogada), escolha o arquivo novamente. Em arquivos do OneDrive, a leitura depende do conteúdo disponibilizado pelo provedor; confira que a edição foi sincronizada.

O novo bloco, após confirmação de limpeza, também esquece o vínculo com o arquivo de entrada. Os arquivos externos não são excluídos.

## Versão 0.9 — Crossing Block

O nome exibido passa a ser **Crossing Block**. O identificador Android, o banco, o nome dos arquivos CSV e a assinatura da variante GitHub são preservados, permitindo instalar por cima da versão anterior. O instalador passa a se chamar `CrossingBlock.apk`.

O número do balde é maior, sem setas ao lado; tocar no número continua abrindo a escolha de balde. A navegação fica nos botões maiores Anterior e Próximo do rodapé, sem repetir o número. As setas de espigas são maiores, permanecendo à direita da caixa numérica. Continuam duas linhas fixas por finalidade, o controle de prioridade e o cabeçalho vertical, com BC no canto superior direito. A altura dos campos se ajusta à área disponível.

O cadastro continua com Escolher arquivo e Atualizar. A opção Escolher CSV existente pode permitir selecionar um arquivo no OneDrive mesmo quando Criar arquivo ou Escolher pasta só mostram locais internos. A possibilidade de atualizar esse CSV depende de o provedor conceder escrita, e o app verifica o conteúdo gravado. Downloads não sincroniza automaticamente com OneDrive.
