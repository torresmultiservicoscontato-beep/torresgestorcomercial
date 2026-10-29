// App na porta 3100. Todas as APIs externas são interceptadas; usuários fictícios.
// Build com NEXT_PUBLIC_APP_ENV=test e chave fictícia não vazia para exercitar Auth.
// LOGIN_EXPECT_UNCONFIGURED=1 valida alternativamente o build sem configuração.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}) });
  try {
    const context = await browser.newContext();
    const page = await context.newPage(), errors = [], requests = [];
    let mode = 'invalid';
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'login@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        if (url.pathname === '/' && req.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<h1>Destino autenticado de teste</h1>' });
        return route.continue();
      }
      requests.push({ host: url.hostname, path: url.pathname, method: req.method() });
      if (url.hostname !== 'bwoxqsbqbtrkfvrsswrq.supabase.co') return route.abort();
      if (url.pathname === '/auth/v1/token') {
        assert.equal(url.searchParams.get('grant_type'), 'password');
        assert.equal(req.postDataJSON().email, user.email);
        if (mode === 'network') return route.abort('failed');
        if (mode === 'invalid') return route.fulfill({ status: 400, json: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
        if (mode === 'key') return route.fulfill({ status: 401, json: { message: 'Invalid API key' } });
        const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'mock-only'].join('.');
        return route.fulfill({ json: { access_token: token, refresh_token: 'mock-only', token_type: 'bearer', expires_in: 3600, user } });
      }
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.pathname.endsWith('/preposto_perfis')) return mode === 'profile'
        ? route.fulfill({ status: 403, json: { message: 'Perfil de testes indisponível' } })
        : route.fulfill({ json: null });
      if (url.pathname.endsWith('/perfis')) return route.fulfill({ json: { user_id: user.id, papel: 'usuario', nome: 'Usuário fictício', nome_representacao: 'Teste' } });
      if (url.pathname.endsWith('/perfil_representadas')) return route.fulfill({ json: [] });
      throw new Error('Requisição inesperada: '+url.pathname);
    });
    await page.goto('http://localhost:3100/login');
    const submit = page.getByRole('button', { name: 'Entrar', exact: true });
    if (process.env.LOGIN_EXPECT_UNCONFIGURED === '1') {
      await page.getByRole('alert').filter({ hasText: /configure|configuração|corresponde/i }).waitFor();
      assert.equal(await submit.isDisabled(), true);
      assert.equal(requests.length, 0);
    } else {
      await page.getByLabel('E-mail', { exact: true }).fill(user.email);
      await page.getByLabel('Senha', { exact: true }).fill('senha-ficticia');
      for (const [scenario, expected] of [['invalid', /E-mail ou senha inválidos/], ['key', /Invalid API key/], ['network', /Não foi possível conectar/], ['profile', /Perfil de testes indisponível/]]) {
        mode = scenario;
        await submit.click();
        await page.getByRole('alert').filter({ hasText: expected }).waitFor({ timeout: 20000 });
        assert.equal(await submit.isEnabled(), true);
      }
      mode = 'success';
      await submit.click();
      await page.waitForURL('http://localhost:3100/');
      await page.getByRole('heading', { name: 'Destino autenticado de teste' }).waitFor();
      assert.ok(requests.some(r => r.path === '/auth/v1/token'));
      assert.ok(requests.every(r => r.host === 'bwoxqsbqbtrkfvrsswrq.supabase.co'));
    }
    assert.deepEqual(errors, []);
    console.log('OK: login '+(process.env.LOGIN_EXPECT_UNCONFIGURED ? 'sem configuração informa erro e bloqueia envio' : 'trata credenciais inválidas, chave inválida, rede, falha de perfil e sucesso com redirecionamento')+'; sem produção ou erros JavaScript.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
