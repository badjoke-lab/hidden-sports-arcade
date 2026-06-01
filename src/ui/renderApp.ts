import type { Sport } from '../data/sports';
import { Footer } from './components/Footer';
import { GameShell, setupGameShell } from './components/GameShell';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { SportsGrid } from './components/SportsGrid';

export function renderApp(root: HTMLElement, sports: Sport[]): HTMLElement {
  root.innerHTML = `
    <div class="app-shell">
      ${Header()}
      <main>
        ${Hero()}
        ${GameShell()}
        ${SportsGrid(sports)}
      </main>
      ${Footer()}
    </div>
  `;

  setupGameShell(root);

  const gameRoot = root.querySelector<HTMLElement>('#game-root');

  if (!gameRoot) {
    throw new Error('Game root element was not rendered.');
  }

  return gameRoot;
}
