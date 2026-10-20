const {chromium}=require('playwright');const assert=require('node:assert/strict');
const fs=require('node:fs');const userId='11111111-1111-4111-8111-111111111111';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1366,height:1000}});
 const user={id:userId,email:'teste@example.test',user_metadata:{},app_metadata:{},aud:'authenticated',role:'authenticated'};
 const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:userId,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'mock'].join('.');
 await context.addInitScript(({token,user})=>localStorage.setItem('sb-sqlrhvxiluzgeldxcmyf-auth-token',JSON.stringify({access_token:token,refresh_token:'mock',expires_at:Math.floor(Date.now()/1000)+3600,user})),{token,user});

 let excluida=false,writes=0,falhar=false;
 await context.route('https://*.supabase.co/**',async route=>{
 const req=route.request(),p=new URL(req.url()).pathname;let body=[];
 if(p==='/auth/v1/user')body=user;
 else if(p.endsWith('/perfis'))body={user_id:userId,nome:'Teste',papel:'usuario'};
 else if(p.endsWith('/visitas'))body=excluida?[]:[{id:'visita-teste',cliente_id:'cliente-teste',cliente_nome:'Cliente teste',data:'2026-10-20',resultado:'Sem venda',houve_venda:false,valor_venda:0}];
 else if(p.endsWith('/rpc/excluir_visita')){
 writes++;assert.equal(req.postDataJSON().p_visita_id,'visita-teste');
 if(falhar){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Comissão paga: exclusão bloqueada'})});return;}
 excluida=true;body=null;
 }
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();await page.goto('http://localhost:3100/visitas');
 const lixeira=page.getByRole('button',{name:'Excluir visita de Cliente teste',exact:true});
 await lixeira.waitFor();
 page.once('dialog',dialog=>dialog.dismiss());await lixeira.click();assert.equal(writes,0);assert.equal(await lixeira.count(),1);
 falhar=true;page.once('dialog',dialog=>dialog.accept());await lixeira.click();await page.getByText(/Falha ao excluir visita:/).waitFor();assert.equal(await lixeira.count(),1);
 falhar=false;page.once('dialog',dialog=>{assert.match(dialog.message(),/também serão excluídos/);return dialog.accept()});await lixeira.click();
 await page.getByText('Visita excluída com sucesso.',{exact:true}).waitFor();assert.equal(await lixeira.count(),0);assert.equal(writes,2);
 await page.reload();await page.getByText('Ainda não há visitas registradas.',{exact:true}).waitFor();
 await browser.close();console.log('OK: lixeira, cancelar sem requisição, erro preserva visita, confirmação, remoção e recarga. API simulada.');
})().catch(e=>{console.error(e);process.exit(1)});
