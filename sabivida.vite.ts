// Vite plugin for a SabiVida mini app: loads the SDK from SabiVida, answers
// POST /session in `vite dev` and `vite preview`, and sends the framing policy.
// In production the Worker (worker/index.ts) does the same.
import type { Connect, Plugin } from 'vite';
import { frameAncestors, handleSession, sdkHost, type SessionConfig } from './server/session';

export function sabividaMiniApp(config: SessionConfig & { sdkUrl?: string }): Plugin {
  const sdk = config.sdkUrl || new URL('/mini-apps/sdk/v1.js', config.host).href;
  const parent = sdkHost(config.host);
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    res.setHeader('Content-Security-Policy', frameAncestors(config.host));
    if (req.method !== 'POST' || req.url !== '/session') return next();
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) chunks.push(chunk as Uint8Array);
    const response = await handleSession(
      new Request('http://localhost/session', { method: 'POST', body: Buffer.concat(chunks) }),
      config,
    );
    res.statusCode = response.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(await response.text());
  };
  return {
    name: 'sabivida-mini-app',
    transformIndexHtml: () => [
      {
        tag: 'script',
        attrs: parent ? { src: sdk, 'data-sabivida-host': parent } : { src: sdk },
        injectTo: 'head-prepend',
      },
    ],
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}
