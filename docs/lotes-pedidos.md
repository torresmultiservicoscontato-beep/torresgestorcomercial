# Lote preservado no pedido

Cada item novo selecionado no catálogo conserva tamanhoLote e quantidadeLotes, além da quantidade total. O banco guarda tamanho_lote e quantidade_lotes em venda_itens. Alterar a quantidade mínima do produto depois não altera esses valores históricos.

Exemplo: 2 lotes de 88 são 176 unidades. Se o cadastro passar a lote de 100, reabrir o pedido mantém 88; editar para 3 lotes resulta em 264 unidades. O preço continua sendo por unidade.

Visitas reabre os dados salvos e Vendas mostra a composição dos lotes. As duas funções de gravação preservam os campos. O banco exige lote positivo, número inteiro positivo de lotes e quantidade total consistente (arredondamento de três casas, igual à quantidade armazenada).

Itens antigos sem registro do lote permanecem com os dois campos nulos: não é possível reconstruir o lote original com segurança a partir do catálogo atual. Esses itens continuam permitindo edição por quantidade total.

Validação: testes de cálculo, serialização/reabertura e lote fracionário em tests/pedido-lotes.cjs; teste transacional no banco em tests/pedido-lotes.sql confirma alteração do catálogo, reedição, as duas funções de gravação, rejeição de valores inconsistentes, rollback e itens antigos sem inferência. Dados de teste revertidos. Build e 16 testes existentes aprovados.
