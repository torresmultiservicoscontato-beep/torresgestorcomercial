alter table public.planos_assinatura
  add column if not exists modulos_incluidos text[] not null default '{}'::text[],
  add column if not exists limite_representantes integer not null default 1,
  add column if not exists limite_prepostos integer not null default 0;

alter table public.planos_assinatura
  add constraint planos_modulos_validos check (
    modulos_incluidos <@ array[
      'inicio','clientes','representadas','produtos','rotas','visitas',
      'vendas','comissoes','despesas','agenda','relatorios',
      'equipe','configuracoes','historico'
    ]::text[]
  ),
  add constraint planos_limite_representantes_check check (limite_representantes >= 0),
  add constraint planos_limite_prepostos_check check (limite_prepostos >= 0);
