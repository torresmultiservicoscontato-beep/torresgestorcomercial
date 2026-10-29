// API inteiramente simulada; não cria usuários nem acessa bancos reais.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
  try {
    const context = await browser.newContext();
    const user = {id:'11111111-1111-4111-8111-111111111111',email:'schema@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
    const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'mock'].join('.');
    await context.addInitScript(({token,user})=>localStorage.setItem('sb-bwoxqsbqbtrkfvrsswrq-auth-token',JSON.stringify({access_token:token,refresh_token:'mock',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user})),{token,user});
    let writes=0;
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(['localhost','127.0.0.1'].includes(url.hostname)) return route.continue();
      assert.equal(url.hostname,'bwoxqsbqbtrkfvrsswrq.supabase.co','produção ou rede externa inesperada');
      if(!['GET','OPTIONS'].includes(req.method())) writes++;
      if(url.pathname==='/auth/v1/user') return route.fulfill({json:user});
      if(url.pathname.endsWith('/perfis') || url.pathname.endsWith('/preposto_perfis')) return route.fulfill({status:404,json:{code:'PGRST205',message:"Could not find the table in the schema cache"}});
      return route.fulfill({json:[]});
    });
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const path of ['/','/primeiro-acesso','/preposto/cadastro']) {
      await page.goto('http://localhost:3100'+path);
      await page.getByRole('alert').filter({hasText:'schema cache'}).waitFor();
      assert.equal(new URL(page.url()).pathname,path,'falha de banco não deve redirecionar para login/cadastro');
      assert.equal(await page.locator('form').count(),0,'não apresentar formulário antes de verificar schema/perfil');
      await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
      await page.getByRole('alert').filter({hasText:'schema cache'}).waitFor();
      assert.ok(await page.evaluate(()=>localStorage.getItem('sb-bwoxqsbqbtrkfvrsswrq-auth-token')),'sessão deve ser preservada');
    }
    assert.equal(writes,0,'não efetuar signOut ou mutações na falha');
    assert.deepEqual(errors,[]);
    console.log('OK: falhas de schema bloqueiam painel e dois cadastros, preservam sessão e permitem repetir; sem mutações ou JavaScript não tratado. APIs simuladas.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
