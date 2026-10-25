import solid from 'vite-plugin-solid';
import { defineConfig, loadEnv } from 'vite';
import { sabividaMiniApp } from './sabivida.vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      solid(),
      sabividaMiniApp({
        host: env.SABIVIDA_HOST || 'https://sabivida.com',
        appId: env.MINI_APP_ID || 'your-app-id',
        jwks: env.SABIVIDA_JWKS || undefined,
        sdkUrl: env.SDK_URL || undefined,
      }),
    ],
    server: { port: 4320 },
    preview: { port: 4320 },
  };
});
