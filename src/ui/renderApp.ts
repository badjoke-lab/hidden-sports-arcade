import type { Sport } from '../data/sports';
import { completeMission, markSportPlayed, subscribe, toggleFavorite } from '../progress/progressManager';
import type { ProgressState } from '../progress/types';
import { Footer } from './components/Footer';
import { GameShell, setupGameShell } from './components/GameShell';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { SportsGrid } from './components/SportsGrid';

function sportNameById(sports: Sport[], sportId: string | undefined): string {
  if (!sportId) {
    return 'None yet';
  }

  return sports.find((sport) => sport.id === sportId)?.name ?? sportId;
}

function updateFavoriteButton(button: HTMLButtonElement, sports: Sport[], progress: ProgressState): void {
  const sportId = button.dataset.sport;

  if (!sportId) {
    return;
  }

  const favorite = progress.favorites.includes(sportId);
  const sportName = sportNameById(sports, sportId);
  const icon = button.querySelector<HTMLElement>('[data-favorite-icon]');
  const label = button.querySelector<HTMLElement>('[data-favorite-label]');

  button.classList.toggle('sport-card__favorite--active', favorite);
  button.setAttribute('aria-pressed', String(favorite));
  button.setAttribute('aria-label', favorite ? `Remove ${sportName} from favorites` : `Save ${sportName} as a favorite`);

  if (icon) {
    icon.textContent = favorite ? '♥' : '♡';
  }

  if (label) {
    label.textContent = favorite ? 'Favorited' : 'Favorite';
  }
}

function setupProgressControls(root: HTMLElement, sports: Sport[]): void {
  const favoriteButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action="favorite"]'));
  const playButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action="play"]'));
  const rulesButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action="rules"]'));
  const favoriteCount = root.querySelector<HTMLElement>('[data-progress-favorite-count]');
  const homeRecent = root.querySelector<HTMLElement>('[data-progress-recent-home]');

  subscribe((progress) => {
    favoriteCount && (favoriteCount.textContent = String(progress.favorites.length));
    homeRecent && (homeRecent.textContent = sportNameById(sports, progress.recentSports[0]));
    favoriteButtons.forEach((button) => updateFavoriteButton(button, sports, progress));
  });

  favoriteButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sportId = button.dataset.sport;

      if (!sportId) {
        return;
      }

      const favorite = toggleFavorite(sportId);

      if (favorite) {
        completeMission('first_favorite');
      }
    });
  });

  playButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sportId = button.dataset.sport;

      if (!sportId) {
        return;
      }

      markSportPlayed(sportId);
      completeMission('first_play');
      document.querySelector('#play')?.scrollIntoView({ behavior: 'smooth' });

      if (sportId === 'tchoukball') {
        window.dispatchEvent(new CustomEvent('sport-preview:show', { detail: { sportId: 'tchoukball' } }));
      } else if (sportId === 'boccia') {
        window.dispatchEvent(new CustomEvent('sport-preview:show', { detail: { sportId: 'boccia' } }));
      }
    });
  });

  rulesButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sportId = button.dataset.sport;

      if (!sportId) {
        return;
      }

      document.querySelector(`#${sportId}-rules`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

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
  setupProgressControls(root, sports);

  const gameRoot = root.querySelector<HTMLElement>('#game-root');

  if (!gameRoot) {
    throw new Error('Game root element was not rendered.');
  }

  return gameRoot;
}
