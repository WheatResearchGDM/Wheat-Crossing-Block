# Instalar a versão de teste no Android

## Versão 0.3 pelo GitHub

Na aba **Actions**, abra a execução bem-sucedida mais recente de **Gerar APK Android**. Baixe **RegistroBC-Android-celular-tablet**, extraia o ZIP e abra `RegistroBC-GitHub.apk`. O nome no celular é **Registro de BC (GitHub)**, agora com uma espiga dourada no ícone. Instale como atualização da variante GitHub que já está no aparelho; não desinstale nem limpe os dados.

1. Toque no usuário no canto superior esquerdo e informe seu nome.
2. Em Configurações, importe o cadastro com `Nome do Bloco` e `Balde`.
3. Escolha o BC pelo nome no topo e navegue pelos baldes.
4. Escolha até três datas para cada finalidade e ajuste as quantidades com `↓ número ↑`. Tocar no número permite digitá-lo; a observação oferece opções e texto livre.
5. As alterações ficam gravadas no aparelho automaticamente; confira o indicador no rodapé. Datas são sugeridas para os próximos baldes e as quantidades começam em zero.
6. Escolha a pasta de saída em Configurações, ou use **Criar arquivo de saída** / **Escolher CSV existente**. O destino é compartilhado pelos usuários do aparelho.
7. Exporte para atualizar `REGISTRO_BC_[ID_DO_APARELHO].csv`, com todos os usuários. A gravação confirmada limpa datas, espigas e observações, preservando o histórico.
8. Trocar de usuário inicia outra rodada em branco. A lixeira no pop-up exclui o nome da lista, com confirmação, preservando as coletas. Excluir o usuário ativo exige nova identificação.
9. Se o OneDrive não aparecer no seletor, use **Enviar cópia (OneDrive…)** e confirme o envio no próprio OneDrive, se disponível. Compartilhar não confirma recebimento e não limpa a tela. É possível exportar para uma pasta local antes de enviar a cópia.

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
