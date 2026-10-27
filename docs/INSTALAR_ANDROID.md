# Instalar a versão de teste no Android

## Versão 0.6 pelo GitHub

Na aba **Actions**, abra a execução bem-sucedida mais recente de **Gerar APK Android**. Baixe **RegistroBC-Android-celular-tablet**, extraia o ZIP e abra `RegistroBC-GitHub.apk`. O nome no celular é **Registro de BC (GitHub)**, agora com uma espiga dourada no ícone. Instale como atualização da variante GitHub que já está no aparelho; não desinstale nem limpe os dados.

1. Toque no usuário no canto superior esquerdo e informe seu nome.
2. Em Configurações → **Importar / atualizar baldes**, selecione o cadastro com `Nome do Bloco` e `Balde`. Atualize quando desejar; a nova lista substitui os baldes de navegação sem apagar avaliações. Não é necessário atualizar o cadastro após exportar.
3. Escolha o BC pelo nome no topo e navegue pelos baldes. O botão discreto de prioridade abaixo do número fica em `#b4bd00` quando ligado. Cada balde mantém sua última escolha, mesmo ao iniciar outra coleta ou reiniciar o app.
4. Escolha até três datas para cada finalidade; os campos vazios dos próximos baldes recebem as últimas datas escolhidas. As avaliações existentes são preservadas. Ajuste as quantidades com `↓ número ↑`. Tocar no número permite digitá-lo; a observação oferece opções e texto livre.
5. As alterações ficam gravadas no aparelho automaticamente; confira o indicador no rodapé. Datas são sugeridas para os próximos baldes e as quantidades começam em zero.
6. Em Configurações → **Escolher destino** / **Alterar destino**, escolha uma pasta, crie o arquivo ou selecione o CSV existente. O destino é compartilhado pelos usuários do aparelho.
7. Exporte para atualizar `REGISTRO_BC_[ID_DO_APARELHO].csv`, com todos os usuários e `Prioridade` (`SIM`/`NÃO`). O pop-up informa o total de registros, os novos desde a última exportação confirmada e pede conferir a sincronização no OneDrive. A gravação confirmada limpa a coleta e volta ao primeiro balde, preservando histórico, prioridades, cadastro e destino.
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
