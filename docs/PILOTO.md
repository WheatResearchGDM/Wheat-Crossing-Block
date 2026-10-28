# Piloto Android

- Instalar o APK em celular e tablet. Conferir legibilidade, teclado, calendário, botões e orientação horizontal.
- Importar CSV e XLSX com ao menos dois blocos que compartilhem um número de balde. Conferir a separação.
- Ativar modo avião, salvar emasculação e polinização e fechar/reabrir o aplicativo.
- Verificar a diferença entre zero e campo vazio.
- Conferir duas linhas fixas por finalidade sem rolagem na tela principal; tocar no contador e nas observações abre edição com teclado em uma janela própria.
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

O teste visual da versão 0.9 em aparelho e a integração com o provedor OneDrive real continuam necessários. Os testes usam SQLite real e cobrem recuperação, transações, sequência de gravação, usuários, catálogo substituído, CSV, limpeza de rodadas e exclusão de usuários. O bundle Android não substitui o teste em aparelho.

## Verificações da versão 0.7 em aparelho

- Atualizar sem desinstalar a versão anterior. Abrir baldes com a terceira linha preenchida e conferir dados preservados.
- Usar + e − independentemente em Emasculação e Polinização. Confirmar limites 1–4 e botões mais claros/desabilitados.
- Preencher a última linha, tocar em − e cancelar. Repetir e confirmar Ocultar linha. Usar + para reencontrar os mesmos dados. Exportar com a linha oculta e conferir o registro no CSV.
- Trocar de balde e reiniciar: a quantidade de linhas escolhida continua. Outro coletor/bloco conserva sua própria preferência.
- Conferir as três colunas iguais, setas de espigas à direita do número, títulos centralizados, botões superiores maiores e navegação inferior sem número do balde.
- Conferir duas, três e quatro linhas por finalidade, incluindo combinações assimétricas, em orientação vertical e horizontal. O ajuste depende da área útil disponível; conferir legibilidade e alvos de toque em dispositivos menores.

TypeScript, lint e 44 testes passaram; incluem SQLite persistente, migração e preservação de linhas ocultas, preferências entre baldes/reinício, exportação e cálculo de geometria. A compilação Android e a conferência do APK não confirmam o teste visual no tablet físico.

## Verificações da versão 0.8 em aparelho

- Atualizar sem desinstalar. Conferir duas linhas fixas, sem controles +/−, campos altos, prioridade maior e dimensões após girar o aparelho.
- Conferir os três ícones em coluna à esquerda e o BC no canto superior direito. Conferir que calendário, edições e navegação superior/inferior continuam funcionando.
- Exportar dados de teste das antigas terceira/quarta linhas antes e depois da atualização e comparar os registros no CSV. Abrir uma data antiga no campo visível e conferir o valor preservado. Rascunhos antigos incompletos nas linhas ocultas não devem impedir salvar as duas atuais.
- Na primeira vez, escolher o arquivo original do cadastro. Reiniciar o app e tocar Atualizar sem abrir outro seletor.
- Editar e sincronizar o mesmo CSV/XLSX no OneDrive; tocar Atualizar e conferir inclusões e remoções de baldes apenas na navegação. Avaliações dos baldes removidos devem continuar no CSV.
- Cancelar a seleção; testar arquivo inválido, arquivo acima de 5 MB, arquivo movido ou permissão revogada e falha de conexão. A lista, a data da última importação e o vínculo anterior só devem mudar em uma importação válida concluída.
- Testar arquivo local em modo avião. Em arquivo OneDrive indisponível, o último cadastro deve permanecer; o app não confirma sincronização da edição na nuvem.
- Iniciar novo bloco com dados sintéticos e confirmar que esquece o arquivo de entrada sem excluir o documento externo.

50 testes automatizados, TypeScript e lint passaram. A conferência do APK e a compilação nativa não substituem a validação visual e dos documentos no aparelho.

## Verificações da versão 0.9 em aparelho

- Instalar CrossingBlock.apk por cima da variante GitHub anterior e conferir que o ícone passou a se chamar Crossing Block, com coletas, usuário, cadastro, prioridade e destinos mantidos.
- Conferir o número do balde maior e sem setas laterais. Tocar no número para abrir a seleção, filtrar e escolher outro balde.
- Conferir os botões maiores Anterior/Próximo no rodapé e os limites de navegação, sem repetir o número do balde.
- Conferir as setas maiores de espigas à direita do número, inclusive os limites 0–100000.
- Conferir duas linhas fixas e ausência de rolagem em celular/tablet, orientação vertical e horizontal. Comparar CSV antes/depois da atualização.
