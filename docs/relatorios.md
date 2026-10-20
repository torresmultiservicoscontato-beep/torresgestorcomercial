# Relatórios

O menu `/relatorios` reúne cinco consultas, somente leitura:

- Visitas e atividade: contatos, clientes únicos, distância dos trechos registrados, duração dos atendimentos, horários, ações e retornos indicados. Quando há acesso a vendas, apresenta a proporção de clientes visitados com venda não cancelada no período e permite consultar clientes sem fechamento.
- Vendas: pedidos ativos, valor total, compradores únicos, ticket médio e maior pedido. Cancelados ficam na lista, fora dos indicadores. Cada venda entra uma vez, independentemente do número de representadas. Origem da venda vem da visita vinculada e não é inferida pelo tipo de contato.
- Faturamento e comissões: ordens por representada, faturado, liquidado, comissões previstas/liberadas/recebidas e repasses pagos. O período seleciona **a data da venda**. Os saldos são acumulados atuais desses pedidos, podendo incluir pagamentos posteriores; não representam fluxo de caixa por data de recebimento. Prepostos visualizam somente as próprias comissões, conforme o RPC existente.
- Despesas: totais em centavos, pagas/pendentes/vencidas; canceladas excluídas dos totais. Vínculos de cliente e rota preservados.
- Agenda e retornos: compromissos já gravados no período da data agendada e sua situação atual. Sugestões virtuais por frequência não confirmadas não entram.

## Filtros e saídas

Período aplicado pelo botão Gerar relatório, responsável e pesquisa por cliente (também descrição em despesas/agenda). Tipo de contato em visitas, origem em vendas, representada no financeiro e rota nas despesas. Trocar a consulta limpa filtros específicos. CSV UTF-8 e impressão/PDF contêm todos os registros filtrados e os critérios, não somente a página visível. CSV neutraliza fórmulas em campos de texto. Impressão usa A4 paisagem e repete o cabeçalho da tabela.

O relatório usa paginação explícita de 500 registros e ordenação estável em todas as fontes, sem truncar nos primeiros mil. A interface apresenta 25 linhas por página. Se uma fonte falha, o relatório não apresenta totais parciais nem permite exportar dados antigos. Requisições obsoletas são descartadas.

## Acesso

Exige `relatorios.visualizar` e respeita a operação selecionada e o responsável fixado no contexto. Visitas, vendas, despesas, agenda e clientes são consultados somente quando o usuário possui visualização no módulo correspondente. Consultas diretas mantêm RLS existente. Comissões usam o RPC existente, cujo acesso é disponível aos membros ativos, assim como no módulo Comissões. Não houve alteração de schema, políticas, registros ou permissões de usuários.

## Validação

- `npm run build`.
- `node --experimental-strip-types --test tests/relatorios.test.mjs`.
- `node tests/relatorios-ui.cjs`, com o app em localhost:3100 e Playwright disponível. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite indicar Chromium já instalado.
- Consultas reais de leitura no banco sob papel authenticated: campos, responsáveis, comissões e agenda; isolamento e ocultação de comissões do representante para preposto. Sem gravações.
- Interface com API simulada: cinco consultas, filtros, cancelados, cliente sem fechamento, vendas por origem, 1.001 linhas, CSV completo, impressão completa, celular, falha de consulta, módulos restritos e negação de acesso ao relatório.
