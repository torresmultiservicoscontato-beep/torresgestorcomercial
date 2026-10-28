## Objetivo
Descreva a alteração e o resultado esperado.

## Verificações obrigatórias
- [ ] CI passou: testes unitários, testes de interface, tipos, lint, isolamento entre ambientes e build.
- [ ] Mudança foi testada em `develop` com o Supabase de testes.
- [ ] Nenhum segredo ou dado real foi incluído no commit.
- [ ] Migrations SQL foram revisadas e executadas no banco de testes antes de produção (quando aplicável).
- [ ] Mudança em Storage/RLS/Auth foi testada com usuário de menor privilégio (quando aplicável).
- [ ] Há plano de reversão para mudanças destrutivas (quando aplicável).
- [ ] Backup de produção foi validado antes de alterações destrutivas.

## Evidências
Informe link para execução do CI e resultados de homologação.

## Risco de publicação e plano de reversão
Descreva ou indique "não se aplica".

> Marcar as caixas não substitui a proteção da branch `main`. A publicação em produção requer aprovação humana e checks obrigatórios configurados no GitHub.
