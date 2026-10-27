# Exclusão de rotas com histórico preservado

A lixeira aparece em cada rota cadastrada no menu Rotas, ao lado dos dados do responsável. Há confirmação antes da exclusão.

A exclusão retira a rota do planejamento ativo e das opções de novos vínculos. O registro original, suas representadas, clientes associados e despesas permanecem no banco. Visitas e vendas não são apagadas. A ação registra data e autor e aparece no Histórico como alteração da rota (excluida_em/excluida_por).

Uma nova rota no mesmo dia recebe outro identificador. Os clientes da rota antiga não são transferidos automaticamente: o usuário pode escolher uma rota ativa no cadastro do cliente. Editar cliente ou despesa sem trocar a rota mantém o vínculo histórico.

Titulares e administradores podem excluir as rotas da operação que administram. Prepostos precisam de vínculo ativo e da permissão Rotas → Excluir em Equipe; só podem excluir as próprias rotas. Editar não concede exclusão. Permissão ausente equivale a negar.

Validação: tests/excluir-rota.sql testa isolamento entre operações, preposto sem permissão, preposto autorizado, inativo, administrador e anônimo; preservação de vínculos e representadas; auditoria; repetição da exclusão; nova rota no mesmo dia; bloqueio de novos vínculos à rota excluída. Todos os dados de teste são revertidos.
