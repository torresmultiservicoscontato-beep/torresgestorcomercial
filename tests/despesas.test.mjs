import test from 'node:test';
import assert from 'node:assert/strict';
import { valorEmCentavos, validarDespesa, resumirDespesas, dataValida } from '../app/lib/despesasModelo.ts';

test('converte reais com precisão e rejeita valores ambíguos ou inválidos', () => {
  for (const [entrada, esperado] of [['35,90',3590],['1.234,56',123456],['1.234',123400],['0,01',1],['0.10',10],['R$ 20,5',2050]]) assert.equal(valorEmCentavos(entrada),esperado);
  for (const entrada of ['0','-10','1,234','2.34.56','1e3','Infinity','', '100000000']) assert.throws(() => valorEmCentavos(entrada));
});

test('pago + pendente = total; vencido é subconjunto de pendente e cancelado fica fora', () => {
  const despesas = [
    {status:'Pago',valor_centavos:1010,vencimento:'2026-10-01'},
    {status:'Pendente',valor_centavos:2020,vencimento:'2026-10-19'},
    {status:'Pendente',valor_centavos:3030,vencimento:'2026-10-20'},
    {status:'Pendente',valor_centavos:4040,vencimento:null},
    {status:'Cancelado',valor_centavos:900000,vencimento:'2026-10-01'},
  ];
  assert.deepEqual(resumirDespesas(despesas,'2026-10-20'),{total:10100,pago:1010,pendente:9090,vencido:2020});
  assert.deepEqual(resumirDespesas([]),{total:0,pago:0,pendente:0,vencido:0});
});

const form = {responsavel_user_id:'test',grupo:'Dia a dia',categoria:'Combustível',descricao:'Abastecimento',valor:'80,50',data:'2026-10-20',status:'Pago',pago_em:'2026-10-20',forma_pagamento:'Pix',vencimento:'',rota_id:'',fornecedor:'',documento:'',observacao:''};
test('valida datas, pagamento e categorias sem aceitar datas normalizadas silenciosamente', () => {
  assert.equal(validarDespesa(form,'2026-10-20'),8050);
  assert.equal(dataValida('2026-02-30'),false);
  assert.equal(dataValida('2024-02-29'),true);
  for (const mudanca of [{data:'2026-02-30'},{pago_em:'2026-10-21'},{pago_em:''},{forma_pagamento:''},{categoria:'Impostos'},{valor:'-1'},{descricao:'   '}]) assert.throws(() => validarDespesa({...form,...mudanca},'2026-10-20'));
  assert.equal(validarDespesa({...form,status:'Pendente',pago_em:'',forma_pagamento:''},'2026-10-20'),8050);
  assert.throws(() => validarDespesa({...form,grupo:'Administrativa',categoria:'Contador',rota_id:'outra-rota'},'2026-10-20'));
});
