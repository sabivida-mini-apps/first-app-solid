// Typed access to the SabiVida SDK (protocol 1), which index.html loads from
// SabiVida. Guide: https://github.com/sabivida-mini-apps/partner-kit
export type MiniAppContext = {
  appId: string;
  locale: string;
  colorScheme: 'light' | 'dark';
  startParam: string | null;
  platform: 'web' | 'ios' | 'android';
  protocol: 1;
  features: string[];
};

export type TaskOutcome = 'added' | 'declined' | 'unavailable';

export type Member = { subject: string; name: string | null };

type Sdk = {
  ready(options?: { timeout?: number }): Promise<{ token: string; context: MiniAppContext }>;
  context(): MiniAppContext | null;
  supports(feature: string): boolean;
  addTask(task: { title: string; dueDate?: string | null }): Promise<TaskOutcome>;
  close(): void;
  isEmbedded(): boolean;
};

declare global {
  interface Window {
    SabiVida?: Sdk;
  }
}

export function sabivida(): Sdk | null {
  return typeof window === 'undefined' ? null : (window.SabiVida ?? null);
}

// Signs the member in: asks SabiVida for a launch token (valid 60 seconds) and
// trades it at once for your own session. The context is a display hint; only
// the verified token proves who the member is.
export async function signIn(sessionUrl = '/session') {
  const sdk = sabivida();
  if (!sdk || !sdk.isEmbedded()) throw new Error('not_embedded');
  const { token, context } = await sdk.ready();
  const response = await fetch(sessionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error('session');
  return { member: (await response.json()) as Member, context };
}
