import test from 'node:test';
import assert from 'node:assert/strict';
import {configuracaoValida,periodoFavorito,selecionarCampos} from '../app/lib/relatoriosFavoritosModelo.ts';
const config={versao:1,tipo:'vendas',colunas:['Cliente','Valor (R$)'],indicadores:[],periodo:{modo:'fixo',inicio:'2026-10-01',fim:'2026-10-31'},filtros:{responsavel:'',busca:'',canal:'',representada:'',rota:'',semVenda:false}};
test('modelo aceita campos selecionados, rejeita configuração vazia ou desconhecida',()=>{
 assert.equal(configuracaoValida(config),true);assert.equal(configuracaoValida({...config,colunas:[]}),false);assert.equal(configuracaoValida({...config,tipo:'usuarios'}),false);assert.equal(configuracaoValida({...config,versao:2}),false);assert.equal(configuracaoValida(null),false);
});
test('períodos reutilizáveis calculam mês e 30 dias inclusivos na reabertura',()=>{
 assert.deepEqual(periodoFavorito({...config.periodo,modo:'mes-atual'},'2028-02-15'),{inicio:'2028-02-01',fim:'2028-02-29'});
 assert.deepEqual(periodoFavorito({...config.periodo,modo:'ultimos-30'},'2026-01-15'),{inicio:'2025-12-17',fim:'2026-01-15'});
 assert.deepEqual(periodoFavorito(config.periodo,'2027-01-01'),{inicio:'2026-10-01',fim:'2026-10-31'});
});
test('prévia e exportação selecionam a mesma coluna e respeitam indicadores removidos',()=>{
 const base={colunas:['Data','Cliente','Valor (R$)'],linhas:[['01/10/2026','Mercado','10,00']],indicadores:[['Total','R$ 10,00'],['Pedidos','1']]};
 assert.deepEqual(selecionarCampos(base,['Cliente','Valor (R$)'],[]),{colunas:['Cliente','Valor (R$)'],linhas:[['Mercado','10,00']],indicadores:[]});
 assert.deepEqual(selecionarCampos(base,null,null),base);
 assert.deepEqual(selecionarCampos(base,['Cliente','Campo revogado'],['Total']).colunas,['Cliente']);
});
