# Despesas

O menu `/despesas` registra gastos de campo e administrativos da operação. Cada lançamento tem responsável, grupo/categoria, descrição, valor em centavos, data da despesa e situação. Vencimento, fornecedor, número do comprovante e observações são opcionais. Despesas pagas exigem data e forma de pagamento. Não há upload de comprovantes nesta versão.

Despesas do dia a dia podem apontar para uma rota semanal do mesmo titular e responsável. A data da despesa identifica quando o gasto ocorreu; o vínculo com a rota não é um rateio por visita. A identificação da rota é preservada no lançamento mesmo se o roteiro mudar posteriormente. Rotas sem permissão de consulta não são oferecidas no formulário.

## Consulta

Os filtros combinam período, grupo, categoria, responsável, situação, rota e texto. O período considera a **data da despesa**, inclusive os limites. Os totais incluem todas as páginas dos resultados. O valor vencido é um subconjunto do pendente, com vencimento anterior a hoje. Cancelados permanecem consultáveis e não entram nos totais.

Para corrigir, use **Editar**. Para pagar uma despesa pendente, use **Registrar pagamento**. Para cancelar, edite a situação para **Cancelado** e salve. O responsável e a operação não podem ser transferidos após o cadastro. Alterações concorrentes são detectadas pela versão `updated_at`.

## Acesso e banco

- Representante: consulta e lança despesas próprias e da equipe em sua operação.
- Preposto: somente os próprios lançamentos na operação ativa, respeitando as permissões de visualizar/cadastrar/editar configuradas em **Equipe**.
- Administrador: acompanha a operação escolhida pelo contexto administrativo já existente.
- As restrições são aplicadas no Postgres por RLS, além da interface. Clientes anônimos não acessam a tabela; exclusão física pelo aplicativo não é permitida.

A migração `20261020222906_despesas_operacionais.sql` cria a tabela, índices, políticas e validação privada de vínculos. Acrescenta permissões de despesas aos vínculos que ainda não possuem essa configuração, preservando regras explícitas existentes. A migração já foi aplicada ao projeto Torres Gestor Comercial em 20/10/2026. Não reaplicar manualmente nesse projeto.

O menu de relatórios permanece como etapa seguinte. Os dados de despesas ficam disponíveis para cruzamento por operação, responsável, data, categoria e rota. Recorrência automática, reembolso, anexos e rateio não fazem parte deste módulo.

## Validação

- `npm run build`: compilação e checagem de tipos.
- `node --experimental-strip-types --test tests/despesas.test.mjs` (Node 22.6+): centavos, datas, validação e composição dos totais.
- `tests/despesas-rls.sql`: teste transacional no banco, executado como postgres, com representante, preposto e administrador existentes. Todas as inserções e alterações de permissões são revertidas no final. Confere isolamento, ações por permissão, vínculo da rota, valores, pagamento, cancelamento e bloqueio a anônimos.
- `tests/despesas-ui.cjs`: Playwright com o aplicativo em `localhost:3100`. Intercepta todas as requisições ao Supabase e usa dados fictícios; não autentica nem grava lançamentos reais. Requer Playwright e Chromium disponíveis no ambiente de teste. Pode usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para um Chromium instalado.

## Cliente opcional

Despesas de qualquer grupo podem ser vinculadas a um cliente, independentemente da rota. O formulário lista somente clientes consultáveis da operação e do responsável selecionado, com paginação completa. Trocar o responsável limpa o vínculo. O banco valida a carteira e as permissões de cliente/representada; o nome é preenchido pelo servidor. A consulta permite filtrar por cliente ou sem vínculo e pesquisar pelo nome, com totais acompanhando o filtro.

O nome registrado é preservado em edições para manter o histórico. O vínculo pode ser removido. Clientes vinculados não podem ser excluídos fisicamente enquanto houver referência; remova o vínculo na despesa antes. Despesas anteriores permanecem sem cliente.
