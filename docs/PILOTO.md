# Piloto Android

- Instalar o APK em celular e tablet. Conferir legibilidade, teclado, calendário, botões e orientação horizontal.
- Importar CSV e XLSX com ao menos dois blocos que compartilhem um número de balde. Conferir a separação.
- Ativar modo avião, salvar emasculação e polinização e fechar/reabrir o aplicativo.
- Verificar a diferença entre zero e campo vazio.
- Conferir as seis linhas sem rolagem na tela principal; tocar no contador e nas observações abre edição com teclado em uma janela própria.
- Corrigir quantidade e observação diretamente no balde; trocar datas, voltar a uma data anterior e conferir o valor preservado.
- Alterar várias quantidades rapidamente, navegar e conferir que cada valor ficou no balde correto.
- Interromper durante uma observação e durante uma quantidade temporariamente vazia; reabrir e conferir recuperação do rascunho.
- Verificar as datas sugeridas e zeros em um novo balde; confirmar que baldes não visitados não foram exportados.
- Trocar usuário e conferir separação das coletas e retorno aos valores do usuário anterior.
- Importar um novo cadastro com um balde removido; conferir que ele saiu da navegação mas sua coleta continua no CSV.
- Selecionar uma pasta de saída, exportar duas vezes e conferir que o mesmo CSV foi atualizado sem duplicar registros.
- Reabrir o app e exportar novamente sem selecionar destino. Repetir após reiniciar o celular.
- Testar OneDrive via pasta ou via Salvar como, conforme as opções que o provedor oferecer. Confirmar o arquivo completo e a sincronização no OneDrive.
- Testar cancelamento do seletor, modo avião, permissão revogada e pasta indisponível; conferir que a falha preserva os dados locais e não é mostrada como exportação concluída.
- Não usar dois aparelhos com o mesmo nome de usuário e mesmo CSV de destino: snapshots não são mesclados automaticamente.
- A adaptação da macro Excel para o novo CSV ainda está pendente.

O teste visual da versão 0.2 em aparelho e a integração com o provedor OneDrive real continuam necessários. Os testes de núcleo usam SQLite real e cobrem recuperação, transações, sequência de gravação, usuários, catálogo substituído e CSV. O bundle Android não substitui o teste em aparelho.
