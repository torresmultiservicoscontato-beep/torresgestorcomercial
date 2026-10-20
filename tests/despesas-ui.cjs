// Executar com o app em http://localhost:3100. Todas as chamadas ao Supabase
// são interceptadas: estes testes não autenticam nem gravam dados reais.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const userId = '11111111-1111-4111-8111-111111111111';
const prepostoId = '22222222-2222-4222-8222-222222222222';
const rotaId = '33333333-3333-4333-8333-333333333333';
const hoje = new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const inicio = hoje.slice(0,7)+'-01';
const user = {id:userId,aud:'authenticated',role:'authenticated',email:'teste@example.test',user_metadata:{},app_metadata:{},created_at:new Date().toISOString()};
let stamp = 0;
const base = {titular_user_id:userId,responsavel_user_id:userId,responsavel_nome:'Representante de teste',grupo:'Dia a dia',categoria:'Combustível',descricao:'Abastecimento da rota',valor_centavos:15050,data:hoje,vencimento:null,status:'Pago',pago_em:hoje,forma_pagamento:'Pix',fornecedor:'Posto de teste',documento:'NF-1',observacao:'Visitas da manhã',cliente_id:null,cliente_nome:'',rota_id:rotaId,rota_nome:'Domingo • Magé',criado_por_user_id:userId,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'};
let rows = [
 {...base,id:'expense-1'},
 {...base,id:'expense-2',grupo:'Administrativa',categoria:'Contador',descricao:'Honorários de contabilidade',valor_centavos:30000,status:'Pendente',pago_em:null,forma_pagamento:null,rota_id:null,rota_nome:'',vencimento:inicio},
 {...base,id:'expense-3',descricao:'Almoço nas visitas',categoria:'Almoço',valor_centavos:3500,responsavel_user_id:prepostoId,responsavel_nome:'Preposto de teste',rota_id:null,rota_nome:''},
 {...base,id:'expense-4',descricao:'Lançamento cancelado',valor_centavos:100000,status:'Cancelado',pago_em:null,forma_pagamento:null},
];
let writes=0;
let falharConsulta=false;
(async()=>{
 const browser=await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
 const context=await browser.newContext({viewport:{width:1440,height:1050},timezoneId:'America/Sao_Paulo'});
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:userId,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'mock-only'].join('.');
 await context.addInitScript(({token,user})=>localStorage.setItem('sb-sqlrhvxiluzgeldxcmyf-auth-token',JSON.stringify({access_token:token,refresh_token:'mock-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{token,user});
 await context.route('https://*.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url());let body;
  if(u.pathname==='/auth/v1/user') body=user;
  else if(u.pathname.endsWith('/perfis')) body={user_id:userId,nome:'Representante de teste',nome_representacao:'Operação de teste',papel:'usuario'};
  else if(u.pathname.endsWith('/perfil_representadas')) body=[];
  else if(u.pathname.endsWith('/rpc/listar_responsaveis_agenda')) body=[{user_id:userId,nome:'Representante de teste',tipo:'representante'},{user_id:prepostoId,nome:'Preposto de teste',tipo:'preposto'}];
  else if(u.pathname.endsWith('/clientes')) body=[{id:'cliente-teste',nome:'Mercado de teste',cidade:'Magé',bairro:'Centro'}];
  else if(u.pathname.endsWith('/rotas_semanais')) body=[{id:rotaId,responsavel_user_id:userId,dia_semana:7,municipio:'Magé',bairros:['Centro']}];
  else if(u.pathname.endsWith('/despesas')) {
   if(falharConsulta && req.method()==='GET') return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Falha simulada na consulta'})});
   if(req.method()==='POST'){
    writes++;const input=req.postDataJSON();body={...base,...input,id:crypto.randomUUID(),responsavel_nome:input.responsavel_user_id===userId?'Representante de teste':'Preposto de teste',rota_nome:input.rota_id?'Domingo • Magé':'',updated_at:`2026-10-20T12:00:${String(++stamp).padStart(2,'0')}Z`};body.cliente_nome=input.cliente_id?'Mercado de teste':'';rows.push(body);
   }else if(req.method()==='PATCH'){
    writes++;const id=u.searchParams.get('id').slice(3),old=rows.find(r=>r.id===id);assert.equal(u.searchParams.get('updated_at'),'eq.'+old.updated_at);body={...old,...req.postDataJSON(),updated_at:`2026-10-20T12:01:${String(++stamp).padStart(2,'0')}Z`};body.cliente_nome=body.cliente_id?'Mercado de teste':'';rows=rows.map(r=>r.id===id?body:r);
   }else{
    body=rows.filter(r=>u.searchParams.getAll('data').every(d=>d.startsWith('gte.')?r.data>=d.slice(4):r.data<=d.slice(4)));
    const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||500);body=body.slice(offset,offset+limit);
   }
  }else throw new Error('Requisição inesperada: '+u.pathname);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3100/despesas');
 await page.getByText('4 despesas encontradas',{exact:true}).waitFor();
 await page.getByText('R$ 485,50',{exact:true}).waitFor();
 fs.mkdirSync('/tmp/torres-despesas-qa',{recursive:true});
 await page.screenshot({path:'/tmp/torres-despesas-qa/desktop.png',fullPage:true});
 const filtros=page.getByRole('region',{name:'Filtros de despesas'});
 await filtros.getByLabel(/^Grupo/).selectOption('Administrativa');
 await page.getByText('1 despesa encontrada',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Limpar filtros'}).click();
 await page.getByRole('button',{name:'Nova despesa',exact:true}).first().click();
 let form=page.getByRole('region',{name:'Nova despesa',exact:true});
 await form.getByLabel('Descrição',{exact:true}).fill('Estacionamento da tarde');
 await form.getByLabel(/^Categoria/).selectOption('Estacionamento');
 await form.getByLabel('Valor (R$)',{exact:true}).fill('20,90');
 await form.getByLabel(/^Situação/).selectOption('Pendente');
 await form.getByLabel(/^Rota/).selectOption(rotaId);
 await form.getByLabel(/^Cliente/).selectOption('cliente-teste');
 await form.getByRole('button',{name:'Salvar despesa',exact:true}).click();
 await page.getByText('Despesa cadastrada com sucesso.',{exact:true}).waitFor();
 assert.equal(writes,1);assert.equal(rows.at(-1).valor_centavos,2090);assert.equal(rows.at(-1).pago_em,null);
 assert.equal(rows.at(-1).cliente_id,'cliente-teste');
 await filtros.getByLabel(/^Cliente/).selectOption('cliente-teste');
 await page.getByText('1 despesa encontrada',{exact:true}).waitFor();
 await filtros.getByLabel(/^Cliente/).selectOption('');
 const card=page.locator('article').filter({has:page.getByText('Estacionamento da tarde',{exact:true})});
 await card.getByRole('button',{name:'Registrar pagamento'}).click();
 form=page.getByRole('region',{name:'Editar despesa',exact:true});
 await form.getByRole('button',{name:'Salvar despesa',exact:true}).click();
 await page.getByText('Despesa atualizada com sucesso.',{exact:true}).waitFor();
 assert.equal(rows.at(-1).status,'Pago');assert.equal(writes,2);
 await card.getByRole('button',{name:'Editar',exact:true}).click();
 form=page.getByRole('region',{name:'Editar despesa',exact:true});
 assert.equal(await form.getByLabel(/^Cliente/).inputValue(),'cliente-teste');
 await form.getByLabel(/^Cliente/).selectOption('');
 await form.getByLabel(/^Situação/).selectOption('Cancelado');
 await form.getByRole('button',{name:'Salvar cancelamento'}).click();
 await page.getByText('Despesa atualizada com sucesso.',{exact:true}).waitFor();
 assert.equal(rows.at(-1).cliente_id,null);assert.equal(rows.at(-1).cliente_nome,'');
 assert.equal(rows.at(-1).status,'Cancelado');assert.equal(writes,3);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/torres-despesas-qa/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'overflow no celular');
 await page.getByRole('button',{name:'Nova despesa',exact:true}).first().click();
 form=page.getByRole('region',{name:'Nova despesa',exact:true});
 await form.getByLabel(/^Grupo/).selectOption('Administrativa');
 await form.getByLabel(/^Categoria/).selectOption('CORE / Conselho');
 assert.equal(await form.getByLabel(/^Rota/).count(),0);
 assert.equal(await form.getByLabel(/^Cliente/).count(),1);
 await page.screenshot({path:'/tmp/torres-despesas-qa/mobile-form.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'overflow no formulário');
 await form.getByLabel('Descrição',{exact:true}).fill('Anuidade CORE');
 await form.getByLabel('Valor (R$)',{exact:true}).fill('-10');
 await form.getByRole('button',{name:'Salvar despesa',exact:true}).click();
 await form.getByRole('alert').waitFor();assert.equal(writes,3,'valor inválido enviado ao banco');
 await form.getByRole('button',{name:'Fechar formulário'}).click();
 rows=Array.from({length:1001},(_,i)=>({...base,id:'bulk-'+i,valor_centavos:100}));
 await page.getByRole('button',{name:'Atualizar',exact:true}).click();
 await page.getByText('1001 despesas encontradas',{exact:true}).waitFor();
 await page.getByText('R$ 1.001,00',{exact:true}).first().waitFor();
 await page.getByText('Página 1 de 51',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Próxima página'}).click();
 await page.getByText('Página 2 de 51',{exact:true}).waitFor();
 falharConsulta=true;
 await page.getByRole('button',{name:'Atualizar',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Falha simulada'}).waitFor();
 assert.equal(await page.getByText('R$ 1.001,00',{exact:true}).count(),0,'totais antigos em consulta com erro');
 assert.deepEqual(errors,[]);
 await browser.close();console.log('OK: totais, filtros, cadastro, pagamento, cancelamento, validação, paginação de 1.001 registros, erro de consulta e celular. API simulada; nenhum dado real alterado.');
})().catch(e=>{console.error(e);process.exit(1)});
