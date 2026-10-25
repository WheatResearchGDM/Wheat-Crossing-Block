# Integração com o Excel

**Versão 0.3:** um `REGISTRO_BC_[ID_DO_APARELHO].csv` acumulado por aparelho, com nove colunas: Nome do Bloco, Balde, Data, Propósito, Disponibilidade, Observação, Data de criação, Device ID e Nome do usuário. Coletas de usuários e rodadas diferentes permanecem separadas, mesmo para a mesma data e balde. A macro deverá verificar conflitos por bloco, balde, data e propósito. O módulo VBA abaixo continua como protótipo para o formato técnico de 15 colunas da versão 0.1 e recusará o novo CSV. É necessário adaptar a importação por snapshot antes de utilizá-lo com a versão 0.3. As instruções seguintes descrevem apenas o protótipo legado. O arquivo operacional não foi alterado.

## Estrutura de destino

Na aba `DISPONIBILIDADE`, a estrutura identificada é:

- Linha 1: datas reais do Excel.
- Linha 2: `Status` em A, `Balde` em B e finalidade `Emasc`/`Poli` de C em diante.
- Linha 3 em diante: um balde por linha.
- Coluna A: fórmulas de Status, preservadas pela importação.

O cadastro do aplicativo identifica safra e bloco. Como a grade atual da DISPONIBILIDADE não contém esses campos, **cada arquivo de acompanhamento representa uma única combinação de safra e bloco**. A macro pede o contexto na primeira importação bem-sucedida e o guarda em `APP_CONTEXTO`. Não misture contextos na mesma grade. Use uma cópia separada para cada contexto.

## Instalar o módulo inicial

1. Faça uma cópia local do `ACOMPANHAMENTO_BC_LISTA_EMASCULAÇÃO.xlsm` e abra a cópia no Excel desktop para Windows.
2. Pressione Alt+F11. No editor VBA, use Arquivo → Importar arquivo e selecione `excel/ImportarColetasBC.bas`.
3. Execute Depurar → Compilar VBAProject e salve o `.xlsm`.
4. Execute `ImportarColetasBC` (Alt+F8). Selecione a pasta com os CSVs `coletas_*.csv` gerados pelos aparelhos.

O módulo usa apenas recursos do Excel/VBA e dicionários via late binding. Não exige bibliotecas adicionais nem Python. O módulo fonte usa caracteres ASCII para evitar problemas de codificação ao importá-lo no editor VBA.

**Estado:** módulo inicial preparado e revisado em código. O teste nativo completo ainda não foi realizado. A automação local não disponibilizou o acesso ao projeto VBA para carregar o módulo de teste; nenhuma configuração de segurança do Office foi alterada. Não foi instalado no arquivo original.

## Comportamento

- Lê CSV UTF-8 com ponto e vírgula e colunas em ordem fixa, conforme `src/core/model.ts`.
- Importa todas as colunas como texto antes da validação. Quantidades são convertidas explicitamente para inteiros.
- Une o histórico já existente em `APP_COLETAS` e os snapshots recebidos. Identificador + versão é a chave de deduplicação.
- Considera a maior versão de cada registro, independentemente da ordem dos arquivos ou do relógio do aparelho.
- Versões antigas não desfazem correções novas. O mesmo ID/versão com conteúdo diferente interrompe a importação.
- Observações, autoria e revisões permanecem em `APP_COLETAS`; apenas quantidades vão para a DISPONIBILIDADE.
- Mapeia pelo número exato do balde, data e finalidade; não usa a ordem das linhas do CSV.
- Acrescenta colunas de data/finalidade à direita quando ainda não existem.
- Não soma avaliações de datas diferentes. Cada célula representa o valor daquela data/finalidade.
- Recusa balde ausente, cabeçalho duplicado ou célula de destino com fórmula.
- Cria um backup completo `backup_app_*.xlsm` junto da planilha antes de modificar as abas auxiliares ou a grade. A pasta precisa permitir gravação e a planilha precisa estar salva.

O botão de confirmação informa que os valores das células correspondentes serão substituídos. As demais células são preservadas. O Excel é salvo ao concluir. Em caso de erro durante a escrita, a macro informa a falha e o caminho do backup; feche sem salvar e restaure a cópia. A escrita da grade não é uma transação de banco de dados.

## Conflitos entre coletores

Se IDs diferentes corresponderem à mesma safra, bloco, balde, data e finalidade, a macro não escolhe o último usuário nem soma as quantidades. Ela atualiza o histórico recebido e gera `APP_CONFLITOS`, sem atualizar a grade nessa execução.

Para resolver, preencha `APP_ESCOLHAS` com `cycle`, `block`, `bucket`, `date` (YYYY-MM-DD), `purpose` (EMASC/POLI) e `record_id` escolhido. Copie os valores do relatório e execute novamente. A escolha só vale para um dos IDs presentes naquela avaliação. As revisões do ID escolhido continuarão sendo aplicadas.

Se uma divergência surgir depois de uma coleta já ter sido aplicada, os valores anteriores da DISPONIBILIDADE permanecem até a resolução. O aviso de conflitos indica que a grade ainda não foi atualizada. Não utilize essa execução como atualização concluída.

## Roteiro do piloto

1. Importar um CSV com quantidade zero, observação com acento/ponto e vírgula e outra finalidade/data.
2. Importar o mesmo arquivo duas vezes e verificar ausência de duplicação em APP_COLETAS.
3. Corrigir uma quantidade no aparelho, exportar e confirmar versão maior no histórico e novo valor na grade.
4. Apresentar uma versão antiga e confirmar que a correção permanece.
5. Importar dois coletores na mesma avaliação e testar a resolução por APP_ESCOLHAS.
6. Verificar fórmulas de Status e resultados dependentes em LISTA_EMASCULAÇÃO, inclusive com cálculo manual do Excel.
7. Conferir novas colunas, backup, arquivo bloqueado/somente leitura e falha de gravação antes de validar para produção.
