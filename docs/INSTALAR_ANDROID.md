# Instalar a versão de teste no Android

## Versão 0.9.1 pelo GitHub

Na aba **Actions**, abra a execução bem-sucedida mais recente de **Gerar APK Android**. Baixe **CrossingBlock-Android-celular-tablet**, extraia o ZIP e abra `CrossingBlock.apk`. O nome no celular é **Crossing Block**, agora com uma espiga dourada no ícone. Instale como atualização da variante GitHub que já está no aparelho; não desinstale nem limpe os dados.

1. Toque no usuário no canto superior esquerdo e informe seu nome.
2. Em Configurações → **Escolher arquivo**, selecione o cadastro com `Nome do Bloco` e `Balde`. Atualize quando desejar; a nova lista substitui os baldes de navegação sem apagar avaliações. Não é necessário atualizar o cadastro após exportar.
3. Escolha o BC pelo nome no topo e navegue pelos baldes. O botão discreto de prioridade abaixo do número fica em `#b4bd00` quando ligado. Cada balde mantém sua última escolha, mesmo ao iniciar outra coleta ou reiniciar o app.
4. Escolha duas datas para cada finalidade; os campos vazios dos próximos baldes recebem as últimas datas escolhidas. As avaliações existentes são preservadas. Ajuste as quantidades com número com as setas à direita. Tocar no número permite digitá-lo; a observação oferece opções e texto livre.
5. As alterações ficam gravadas no aparelho automaticamente; confira o indicador no rodapé. Datas são sugeridas para os próximos baldes e as quantidades começam em zero.
6. Em Configurações → **Escolher destino** / **Alterar destino**, escolha uma pasta, crie o arquivo ou selecione o CSV existente. O destino é compartilhado pelos usuários do aparelho.
7. Somente linhas com pelo menos uma espiga entram no CSV; linhas com zero, mesmo com data ou observação, ficam apenas no histórico interno. Se todas as linhas tiverem zero, o app avisa e preserva a coleta. Exporte para atualizar `REGISTRO_BC_[ID_DO_APARELHO].csv`, com todos os usuários e `Prioridade` (`SIM`/`NÃO`). O pop-up informa o total de registros, os novos desde a última exportação confirmada e pede conferir a sincronização no OneDrive. A gravação confirmada limpa a coleta e volta ao primeiro balde, preservando histórico, prioridades, cadastro e destino.
8. Trocar de usuário preserva a coleta em andamento de cada usuário. Somente a exportação confirmada limpa os campos. A lixeira no pop-up exclui o nome da lista, com confirmação, preservando as avaliações. Excluir o usuário ativo exige nova identificação.
9. Se o OneDrive não aparecer no seletor, use **Enviar cópia dos dados** e confirme o envio no próprio OneDrive, se disponível. Esse recurso também gera novamente o CSV acumulado com os dados internos. Compartilhar não confirma recebimento e não limpa a tela. É possível exportar para uma pasta local antes de enviar a cópia.

10. Para iniciar outro BC do zero, use Configurações → **Iniciar novo bloco de cruzamento** e leia o aviso antes de confirmar **Limpar e iniciar**. A limpeza apaga o histórico e as cópias internas de todos os usuários, mas preserva arquivos originais e CSVs externos. Importe o novo cadastro e escolha outro destino.

A atualização preserva o banco quando Android reconhece o mesmo pacote e assinatura. Se o Android informar incompatibilidade de assinatura, mantenha o app antigo instalado e exporte/confira seus dados antes de qualquer reinstalação. O teste de escrita e sincronização com o OneDrive da organização deve ser feito no aparelho.

## Versão inicial pelo Expo (0.1)

Compilação inicial: [abrir no Expo](https://expo.dev/accounts/leo_cantoni/projects/wheat-crossing-block/builds/d7cca225-e76a-45c1-8119-9ec72144a551).

1. Abra a página da compilação no celular e aguarde o estado de conclusão bem-sucedida.
2. Use o botão de instalação/download para baixar o arquivo `.apk`.
3. Abra o arquivo baixado. Se o Android solicitar, permita que esse navegador ou gerenciador de arquivos instale aplicativos dessa origem.
4. Toque em Instalar e depois em Abrir. O nome exibido é **Registro de BC**.
5. Na versão inicial, informe o coletor e importe o cadastro CSV/Excel com Safra, Bloco e Balde. Selecione o contexto e salve a configuração.
6. Faça uma coleta de teste, salve, feche/reabra o app e exporte o CSV para conferir o fluxo completo.

Os APKs funcionam sem o VS Code ou um servidor de desenvolvimento aberto. A coleta funciona sem internet após importar o cadastro. A disponibilidade do destino online e a sincronização dependem do provedor e da conexão.

Para atualizações, use um novo APK com o mesmo identificador e a mesma assinatura. Evite desinstalar ou limpar os dados entre versões: isso remove o banco local. Antes de qualquer reinstalação, exporte as coletas e confira a cópia no computador.

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
