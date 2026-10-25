import { createSignal, Match, onMount, Show, Switch } from 'solid-js';
import { sabivida, signIn, type Member, type MiniAppContext, type TaskOutcome } from './sabivida';

type State =
  | { kind: 'loading' }
  | { kind: 'outside' }
  | { kind: 'failed' }
  | { kind: 'ready'; member: Member; context: MiniAppContext };

const OUTCOME: Record<TaskOutcome, string> = {
  added: 'Added to the household plans.',
  declined: 'Not added: the member declined.',
  unavailable: 'SabiVida cannot add steps right now.',
};

export function App() {
  const [state, setState] = createSignal<State>({ kind: 'loading' });
  const [outcome, setOutcome] = createSignal<TaskOutcome | null>(null);
  const [asking, setAsking] = createSignal(false);
  const sdk = sabivida();

  // A launch token is accepted once: sign in once, when the app mounts.
  onMount(async () => {
    try {
      const { member, context } = await signIn();
      setState({ kind: 'ready', member, context });
    } catch (error) {
      setState({ kind: (error as Error).message === 'not_embedded' ? 'outside' : 'failed' });
    }
  });

  async function addStep() {
    setAsking(true);
    // SabiVida shows the member this exact text before anything is added.
    setOutcome((await sdk?.addTask({ title: 'Book a consular appointment', dueDate: null })) ?? 'unavailable');
    setAsking(false);
  }

  const ready = () => {
    const current = state();
    return current.kind === 'ready' ? current : null;
  };

  return (
    <main>
      <Switch>
        <Match when={state().kind === 'loading'}>
          <p class="muted">Signing in with SabiVida…</p>
        </Match>
        <Match when={state().kind === 'outside'}>
          <h1>Open this app from SabiVida</h1>
          <p class="muted">It signs members in through SabiVida, so it only works inside SabiVida.</p>
        </Match>
        <Match when={state().kind === 'failed'}>
          <h1>Sign-in failed</h1>
          <p class="muted">Your server refused the launch token. Check SABIVIDA_HOST and MINI_APP_ID.</p>
        </Match>
        <Match when={ready()}>
          {(current) => (
            <>
              <h1>Hello, {current().member.name ?? 'SabiVida member'}</h1>
              <div class="card">
                <p>
                  Your member id for this app: <code>{current().member.subject.slice(0, 12)}…</code>
                </p>
                <p class="muted">
                  Language {current().context.locale} · on {current().context.platform}
                  {current().context.startParam ? ` · opened with “${current().context.startParam}”` : ''}
                </p>
              </div>
              <div class="actions">
                <Show when={sdk?.supports('add_task')}>
                  <button class="primary" disabled={asking()} onClick={() => void addStep()}>
                    Add a step to my plans
                  </button>
                </Show>
                <button onClick={() => sdk?.close()}>Close</button>
              </div>
              <Show when={outcome()}>{(value) => <p role="status">{OUTCOME[value()]}</p>}</Show>
            </>
          )}
        </Match>
      </Switch>
    </main>
  );
}
