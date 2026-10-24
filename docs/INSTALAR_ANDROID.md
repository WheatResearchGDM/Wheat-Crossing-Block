# Instalar a versão de teste no Android

Compilação inicial: [abrir no Expo](https://expo.dev/accounts/leo_cantoni/projects/wheat-crossing-block/builds/d7cca225-e76a-45c1-8119-9ec72144a551).

1. Abra a página da compilação no celular e aguarde o estado de conclusão bem-sucedida.
2. Use o botão de instalação/download para baixar o arquivo `.apk`.
3. Abra o arquivo baixado. Se o Android solicitar, permita que esse navegador ou gerenciador de arquivos instale aplicativos dessa origem.
4. Toque em Instalar e depois em Abrir. O nome exibido é **Registro de BC**.
5. Informe o coletor e importe o cadastro CSV/Excel com Safra, Bloco e Balde. Selecione o contexto e salve a configuração.
6. Faça uma coleta de teste, salve, feche/reabra o app e exporte o CSV para conferir o fluxo completo.

O APK preview funciona sem o VS Code ou um servidor de desenvolvimento aberto. A coleta funciona sem internet após importar o cadastro. Transferir o CSV por um serviço online dependerá da conexão e do aplicativo escolhido para compartilhar.

Para atualizações, use um novo APK com o mesmo identificador e a mesma assinatura. Evite desinstalar ou limpar os dados entre versões: isso remove o banco local. Antes de qualquer reinstalação, exporte as coletas e confira a cópia no computador.
