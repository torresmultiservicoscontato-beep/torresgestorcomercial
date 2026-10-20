# Quantidade mínima do produto

Campo obrigatório no cadastro e edição de Produtos e no cadastro rápido de Visitas. Valor inicial 1; produtos existentes recebem 1. A unidade (UN, CX, KG etc.) permanece independente. Aceita valor positivo com até três casas decimais, permitindo também produtos vendidos por peso/medida. Limite 999999999.999. A quantidade mínima aparece no catálogo e no seletor de produtos da visita.

O mínimo é uma característica comercial cadastrada; não significa múltiplo de embalagem. Esta alteração não modifica quantidades de pedidos existentes nem acrescenta bloqueio às vendas. A solicitação abrange o cadastro do produto.

A migração acrescenta `representada_produtos.quantidade_minima`, obrigatória, com default e restrição de valor. Os novos RPCs invoker chamam funções privadas que reutilizam as verificações de autorização dos RPCs existentes. Salvamento de todos os campos e do mínimo é transacional. RPCs anteriores permanecem compatíveis e não apagam um mínimo já editado.

Validação: build; teste SQL transacional de cadastro, edição, listagem, mínimos inválidos, compatibilidade e isolamento com rollback; teste de interface com API simulada para cadastro 12, edição 100, rejeição de zero, unidade preservada e recarga. Verificação de segurança sem alertas específicos nas novas funções.
