# Paginação das listas

Clientes, visitas e vendas exibem 25 registros por página, com opções de 10 e 50, contador e botões Anterior/Próxima. Alterar a busca ou os filtros volta à primeira página; exclusões ajustam a página quando necessário.

A paginação ocorre sobre os registros já carregados. Os filtros são aplicados antes do recorte, a ordenação existente é preservada e os resumos de vendas continuam usando todos os registros carregados, independentemente da página visível.

Esta mudança não altera consultas, permissões ou banco de dados. Não elimina limites de retorno do Supabase nem reduz o volume inicial carregado. Paginação no servidor exige também adaptar filtros, totais e cálculos que dependem do histórico completo.

Validação: npm test, npm run build. Os testes de paginação cobrem navegação sem perda/repetição, tamanhos de página, lista vazia e exclusão na última página.
