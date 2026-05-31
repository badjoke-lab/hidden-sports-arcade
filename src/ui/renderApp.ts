import type { Sport } from '../data/sports';

function renderTags(tags: string[]): string {
  return tags.map((tag) => `<span class="sport-card__tag">${tag}</span>`).join('');
}

function renderSportCard(sport: Sport): string {
  const isActive = sport.status === 'active';
  const actionMarkup = isActive
    ? `<div class="sport-card__actions" aria-label="${sport.name} actions">
        <button class="button button--primary" type="button" data-action="play" data-sport="${sport.id}">Play</button>
        <button class="button button--secondary" type="button" data-action="rules" data-sport="${sport.id}">Rules</button>
      </div>`
    : `<p class="sport-card__soon">Coming soon</p>`;

  return `
    <article class="sport-card ${isActive ? 'sport-card--active' : 'sport-card--soon'}">
      <div class="sport-card__header">
        <h3>${sport.name}</h3>
        ${isActive ? '<span class="sport-card__status">Playable shell</span>' : ''}
      </div>
      <p>${sport.summary}</p>
      <div class="sport-card__tags" aria-label="${sport.name} tags">
        ${renderTags(sport.tags)}
      </div>
      ${actionMarkup}
    </article>
  `;
}

export function renderApp(root: HTMLElement, sports: Sport[]): HTMLElement {
  root.innerHTML = `
    <main class="app-shell">
      <header class="hero">
        <p class="eyebrow">Zero-cost static arcade</p>
        <h1>Hidden Sports Arcade</h1>
        <p class="hero__copy">
          Play approachable browser versions of hidden and lesser-known sports, built as a lightweight
          arcade that can grow one sport at a time.
        </p>
      </header>

      <section class="game-shell" aria-labelledby="game-shell-title">
        <div class="section-heading">
          <p class="eyebrow">Phaser check</p>
          <h2 id="game-shell-title">Game canvas</h2>
        </div>
        <div class="game-shell__frame">
          <div id="game-root" class="game-shell__canvas" aria-label="Hidden Sports Arcade Phaser canvas"></div>
        </div>
      </section>

      <section class="sports" aria-labelledby="sports-title">
        <div class="section-heading">
          <p class="eyebrow">Sports list</p>
          <h2 id="sports-title">Choose a sport</h2>
        </div>
        <div class="sports__grid">
          ${sports.map(renderSportCard).join('')}
        </div>
      </section>
    </main>
  `;

  const gameRoot = root.querySelector<HTMLElement>('#game-root');

  if (!gameRoot) {
    throw new Error('Game root element was not rendered.');
  }

  return gameRoot;
}
