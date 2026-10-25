// Develop without SabiVida: `npm run dev:mock` starts a local stand-in for
// SabiVida on http://localhost:4398 with its own signing key, runs your app
// against it, and frames your app the way SabiVida does: it answers `ready`
// with a signed launch token for a test member and `add_task` with a choice.
// For development only; real launch tokens come from SabiVida.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT } from 'jose';

const HOST_PORT = 4398;
const HOST = `http://localhost:${HOST_PORT}`;
const APP_ID = process.env.MINI_APP_ID || 'your-app-id';
const [appUrl, ...command] = process.argv.slice(2);

const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
const jwk = await exportJWK(publicKey);
const kid = await calculateJwkThumbprint(jwk);
const jwks = JSON.stringify({ keys: [{ ...jwk, kid, alg: 'EdDSA', use: 'sig' }] });
const sdk = await fetch('https://sabivida.com/mini-apps/sdk/v1.js').then((r) => (r.ok ? r.text() : Promise.reject(new Error(`SDK download failed: ${r.status}`))));

const html = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const page = (start, name) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SabiVida (local stand-in)</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#003893;color:#fff;display:grid;place-items:center;min-height:100vh}
.phone{width:390px;height:760px;background:#fff;border-radius:28px;overflow:hidden;display:flex;flex-direction:column;color:#172033}
.bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #d8deea;font-size:14px}.bar small{color:#5f6b80}
iframe{flex:1;border:0}p{max-width:390px;font-size:13px;opacity:.85}</style>
<div><div class="phone"><div class="bar">✕ <b>Your app</b> <small>${html(new URL(appUrl).host)} · local stand-in</small></div>
<iframe id="app" src="${html(appUrl)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" allow=""></iframe></div>
<p>Local stand-in for SabiVida. Test member: ${html(name)}. Add <code>?start=…</code> or <code>?name=…</code> to this address to change the launch.</p></div>
<script>
const origin = new URL(${js(appUrl)}).origin, frame = document.getElementById('app');
addEventListener('message', async (event) => {
  if (event.source !== frame.contentWindow || event.origin !== origin || event.data?.sabivida !== 1) return;
  const reply = (message) => frame.contentWindow.postMessage({ sabivida: 1, ...message }, origin);
  if (event.data.type === 'ready') {
    const { token } = await (await fetch('/token?' + new URLSearchParams({ start: ${js(start)}, name: ${js(name)} }))).json();
    reply({ type: 'launch', token, context: { appId: ${js(APP_ID)}, locale: 'en', colorScheme: 'light', startParam: ${js(start || null)}, platform: 'web', protocol: 1, features: ['add_task'] } });
  } else if (event.data.type === 'add_task') {
    const ok = confirm('SabiVida would ask the member:\\n\\nAdd "' + event.data.title + '"' + (event.data.dueDate ? ' (due ' + event.data.dueDate + ')' : '') + ' to the household plans?');
    reply({ type: 'task_result', requestId: event.data.requestId, status: ok ? 'added' : 'declined' });
  } else if (event.data.type === 'close') {
    alert('The app asked SabiVida to close it.');
  }
});
</script></html>`;

createServer(async (request, response) => {
  const url = new URL(request.url, HOST);
  if (url.pathname === '/mini-apps/sdk/v1.js') return response.writeHead(200, { 'Content-Type': 'text/javascript' }).end(sdk);
  if (url.pathname === '/api/mini-apps/jwks.json') return response.writeHead(200, { 'Content-Type': 'application/json' }).end(jwks);
  if (url.pathname === '/token') {
    const start = url.searchParams.get('start');
    const token = await new SignJWT({ scope: 'profile', locale: 'en', name: url.searchParams.get('name') || 'Test Member', ...(start ? { start_param: start } : {}) })
      .setProtectedHeader({ alg: 'EdDSA', kid, typ: 'sabivida-launch+jwt' })
      .setIssuer(HOST).setAudience(APP_ID).setSubject('local-test-member-'.padEnd(43, '0'))
      .setIssuedAt().setExpirationTime('60s').setJti(crypto.randomUUID()).sign(privateKey);
    return response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ token }));
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page(url.searchParams.get('start') || '', url.searchParams.get('name') || 'Test Member'));
}).listen(HOST_PORT, 'localhost');

const app = spawn(command[0], command.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, SABIVIDA_HOST: HOST, NEXT_PUBLIC_SABIVIDA_HOST: HOST, MINI_APP_ID: APP_ID, SABIVIDA_JWKS: jwks },
});
app.on('exit', (code) => process.exit(code ?? 0));
console.log(`\n  SabiVida stand-in: ${HOST}  (frames ${appUrl})\n`);
