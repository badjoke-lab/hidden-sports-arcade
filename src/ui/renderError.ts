import type { GameShellSport } from './components/GameShell';

function sportLabel(sport: GameShellSport): string {
  return sport === 'tchoukball' ? 'Tchoukball' : 'Boccia';
}

export function renderGameError(gameRoot: HTMLElement, sport: GameShellSport, error: unknown): void {
  console.error(`Game failed to start for ${sportLabel(sport)}.`, error);

  gameRoot.innerHTML = `
    <section class="route-error route-error--game" aria-labelledby="game-error-title" role="alert">
      <p class="eyebrow">Sport: ${sportLabel(sport)}</p>
      <h2 id="game-error-title">Game failed to start.</h2>
      <p>Try reloading this page.</p>
      <a class="button button--primary" href="/sports/">Back to sports</a>
    </section>
  `;
}

export function renderFatalAppError(root: HTMLElement, error: unknown): void {
  console.error('App failed to render.', error);

  root.innerHTML = `
    <main class="app-shell">
      <section class="route-error route-error--fatal" aria-labelledby="fatal-app-error-title" role="alert">
        <p class="eyebrow">Route error</p>
        <h1 id="fatal-app-error-title">This page failed to render.</h1>
        <p>Try reloading this page, or return to the sports list.</p>
        <div class="route-error__actions">
          <a class="button button--primary" href="/sports/">Back to sports</a>
          <a class="button button--secondary" href="/">Home</a>
        </div>
      </section>
    </main>
  `;
}
