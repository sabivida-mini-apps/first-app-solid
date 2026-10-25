// Cloudflare Worker: serves the built app and verifies launch tokens on
// POST /session. Configure SABIVIDA_HOST and MINI_APP_ID in wrangler.jsonc.
import { frameAncestors, handleSession } from '../server/session';

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SABIVIDA_HOST: string;
  MINI_APP_ID: string;
  SABIVIDA_JWKS?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config = { host: env.SABIVIDA_HOST, appId: env.MINI_APP_ID, jwks: env.SABIVIDA_JWKS || undefined };
    const { pathname } = new URL(request.url);
    const response =
      request.method === 'POST' && pathname === '/session'
        ? await handleSession(request, config)
        : await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', frameAncestors(config.host));
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  },
};
