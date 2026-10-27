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
- Trocar usuário e voltar ao anterior; conferir que a coleta em andamento de cada um é retomada. Conferir que o histórico continua no CSV por aparelho.
- Excluir usuário ativo e outro usuário pela lixeira; cancelar a confirmação e depois confirmar. Conferir que as coletas continuam no CSV e que excluir o ativo exige nova identificação.
- Importar um novo cadastro com um balde removido; conferir que ele saiu da navegação mas sua coleta continua no CSV.
- Selecionar uma pasta de saída, exportar duas vezes e conferir que o mesmo CSV foi atualizado sem duplicar registros.
- Depois de exportar, navegar para outro balde e reiniciar: o formulário deve ficar limpo. Recolher na mesma data deve preservar a avaliação anterior no CSV.
- Reabrir o app e exportar novamente sem selecionar destino. Repetir após reiniciar o celular.
- Testar OneDrive via pasta ou arquivo, conforme o provedor oferecer. Se estiver ausente, testar Enviar cópia; cancelar o compartilhamento não pode limpar a tela. Confirmar recebimento e sincronização no OneDrive.
- Testar cancelamento do seletor, modo avião, permissão revogada e pasta indisponível; conferir que a falha preserva os dados locais e não é mostrada como exportação concluída.
- Exportar de dois aparelhos com o mesmo nome de usuário; conferir arquivos distintos pelo ID do aparelho e a coluna Nome do usuário em todos os registros.
- Conferir o resumo: primeira exportação conta todos como novos; reexportação sem alterações conta zero; correção não aumenta novos; novas avaliações de outro usuário aumentam total e novos. Falha de escrita não avança a contagem.
- Exportar e reabrir o app sem receber pedido de atualização do cadastro. Atualizar manualmente pela configuração.
- Cancelar Iniciar novo bloco e conferir dados/destinos preservados. Em dados sintéticos, confirmar a limpeza, reiniciar o app e conferir banco, histórico, prioridades e destinos vazios. Preservar nomes de coletores, identidade do aparelho e arquivos externos. Importar outro bloco e conferir primeira exportação com apenas dados novos.
- A adaptação da macro Excel para o novo CSV ainda está pendente.

O teste visual da versão 0.6 em aparelho e a integração com o provedor OneDrive real continuam necessários. Os testes usam SQLite real e cobrem recuperação, transações, sequência de gravação, usuários, catálogo substituído, CSV, limpeza de rodadas e exclusão de usuários. O bundle Android não substitui o teste em aparelho.
