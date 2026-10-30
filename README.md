<p><img src="https://raw.githubusercontent.com/sabivida-mini-apps/.github/main/assets/social-starter-solid.png" alt="SabiVida mini app starter with Solid: SabiVida sign-in and a local stand-in for SabiVida." width="100%"></p>

# SabiVida mini app starter, with Solid

A Solid + Vite + TypeScript template for a [SabiVida mini app](https://github.com/sabivida-mini-apps/partner-kit). The page signs the member in through SabiVida, and a small server verifies the launch token. Click **Use this template** to start your own.

## Try it without SabiVida

```sh
npm install
npm run dev:mock
```

Open http://localhost:4398. A local stand-in for SabiVida frames your app the way SabiVida does:
- It signs a test member in with its own key. Add `?name=…` or `?start=…` to the address to change the launch.
- It asks you to confirm each step your app suggests.

It's for development only; real launch tokens come from SabiVida.

## Run it against SabiVida

```sh
cp .env.example .env     # set MINI_APP_ID to the id SabiVida gave you
npm run dev
```

SabiVida only frames your registered HTTPS origin, so you test inside SabiVida once your app is deployed and registered.

## Deploy to Cloudflare Workers

Set `name` and `MINI_APP_ID` in `wrangler.jsonc` (keep `SABIVIDA_HOST` at `https://app.sabivida.com`), then run `npm run deploy`. The Worker serves the built app and answers `POST /session`. Every response carries `Content-Security-Policy: frame-ancestors https://app.sabivida.com https://sabivida.com`: SabiVida may frame your app from either host, and launch tokens keep the `https://sabivida.com` issuer.

## What's inside

| File | Role |
| --- | --- |
| `src/App.tsx` | The page: signs in, shows the member, suggests a plan step, closes |
| `src/sabivida.ts` | Typed access to the SDK, plus `signIn()`, which trades the launch token at `/session` |
| `server/session.ts` | Verifies the token (issuer, your app id, type, EdDSA, 60 seconds, used once) with `jose` |
| `sabivida.vite.ts` | Vite plugin: loads the SDK and serves `/session` in `dev` and `preview` |
| `worker/index.ts`, `wrangler.jsonc` | Production on Cloudflare Workers |
| `scripts/dev-mock.mjs` | The local stand-in behind `npm run dev:mock` |

## Before you go live

- **Replays:** keep used token ids (`jti`) in your database instead of memory, so every server rejects a replay.
- **Your own session:** open it in `/session` once the token checks out. The launch token is proof of sign-in, not a session.
- **Requirements:** follow the requirements in the [developer guide](https://github.com/sabivida-mini-apps/partner-kit/blob/main/docs/developer-guide.md): no trackers, no requests for SabiVida credentials, a privacy policy.
