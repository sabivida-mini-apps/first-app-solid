// Verifies SabiVida launch tokens. Runs on Node, Cloudflare Workers and any
// runtime with the Fetch API. Check everything, or reject the token.
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type SessionConfig = {
  // The SabiVida origin that frames you: https://sabivida.com in production.
  host: string;
  // Your app id, the token's audience.
  appId: string;
  // Public keys as JSON, only for a SabiVida host behind an access gate (staging).
  jwks?: string;
};

export type Member = { subject: string; name: string | null };

let keys: { id: string; get: JWTVerifyGetKey } | null = null;
function keysFor(config: SessionConfig) {
  const id = `${config.host}|${config.jwks ?? ''}`;
  if (keys?.id !== id)
    keys = {
      id,
      get: config.jwks
        ? createLocalJWKSet(JSON.parse(config.jwks))
        : createRemoteJWKSet(new URL('/api/mini-apps/jwks.json', config.host)),
    };
  return keys.get;
}

// Token ids already accepted, until they expire. One process only: in
// production keep them in your database or a cache shared by your servers.
const used = new Map<string, number>();

export async function verifyLaunch(token: unknown, config: SessionConfig): Promise<Member> {
  if (typeof token !== 'string') throw new Error('token');
  const { payload } = await jwtVerify(token, keysFor(config), {
    issuer: config.host,
    audience: config.appId,
    typ: 'sabivida-launch+jwt',
    algorithms: ['EdDSA'],
    maxTokenAge: '60s',
  });
  const now = Date.now();
  for (const [id, expiry] of used) if (expiry < now) used.delete(id);
  if (!payload.jti || used.has(payload.jti)) throw new Error('replayed');
  used.set(payload.jti, Number(payload.exp) * 1000);
  // `sub` is this member's id for your app only; `name` only with their consent.
  return { subject: String(payload.sub), name: typeof payload.name === 'string' ? payload.name : null };
}

// POST { token } → your member, or 401. Open your own session here.
export async function handleSession(request: Request, config: SessionConfig): Promise<Response> {
  try {
    const raw = await request.text();
    if (raw.length > 8192) throw new Error('too large');
    const member = await verifyLaunch((JSON.parse(raw) as { token?: unknown }).token, config);
    return Response.json(member, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'invalid launch token' }, { status: 401 });
  }
}

// Only SabiVida may frame your app.
export const frameAncestors = (host: string) => `frame-ancestors ${host}`;
