import type { Sport } from '../data/sports';
import { completeMission, markSportPlayed, subscribe, toggleFavorite } from '../progress/progressManager';
import type { ProgressState } from '../progress/types';
import { Footer } from './components/Footer';
import type { GameShellSport } from './components/GameShell';
import { setupGameShell } from './components/GameShell';
import { Header } from './components/Header';
import { BocciaPage } from './pages/BocciaPage';
import { BocciaRulesPage } from './pages/BocciaRulesPage';
import { HomePage } from './pages/HomePage';
import { SportsPage } from './pages/SportsPage';
import { TchoukballPage } from './pages/TchoukballPage';
import { TchoukballRulesPage } from './pages/TchoukballRulesPage';

export interface RenderedApp {
  gameRoot: HTMLElement | null;
  sport: GameShellSport | null;
}

function sportNameById(sports: Sport[], sportId: string | undefined): string {
  if (!sportId) {
    return 'None yet';
  }

  return sports.find((sport) => sport.id === sportId)?.name ?? sportId;
}

function normalizePathname(pathname: string): string {
  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname;
  }

  if (pathname === '/') {
    return '/';
  }

  return `${pathname}/`;
}

function routeContent(pathname: string, sports: Sport[]): { content: string; sport: GameShellSport | null } {
  switch (normalizePathname(pathname)) {
    case '/sports/':
      return { content: SportsPage(sports), sport: null };
    case '/sports/boccia/':
      return { content: BocciaPage(), sport: 'boccia' };
    case '/sports/tchoukball/':
      return { content: TchoukballPage(), sport: 'tchoukball' };
    case '/sports/boccia/rules/':
      return { content: BocciaRulesPage(), sport: null };
    case '/sports/tchoukball/rules/':
      return { content: TchoukballRulesPage(), sport: null };
    case '/':
      return { content: HomePage(sports), sport: null };
    default:
      return {
        content: `
          <section class="page-panel" aria-labelledby="not-found-title">
            <p class="eyebrow">Route not found</p>
            <h1 id="not-found-title">This page is not in the arcade yet.</h1>
            <p>Use the sports list to open a supported dedicated page.</p>
            <a class="button button--primary" href="/sports/">Back to sports</a>
          </section>
        `,
        sport: null,
      };
  }
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
  const playLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-action="play-link"]'));
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

  playLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const sportId = link.dataset.sport;

      if (!sportId) {
        return;
      }

      markSportPlayed(sportId);
      completeMission('first_play');
    });
  });
}

export function renderApp(root: HTMLElement, sports: Sport[]): RenderedApp {
  const route = routeContent(window.location.pathname, sports);

  root.innerHTML = `
    <div class="app-shell">
      ${Header()}
      <main>
        ${route.content}
      </main>
      ${Footer()}
    </div>
  `;

  setupProgressControls(root, sports);

  if (route.sport) {
    setupGameShell(root, route.sport);
  }

  return {
    gameRoot: root.querySelector<HTMLElement>('#game-root'),
    sport: route.sport,
  };
}
