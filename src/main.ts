import './styles/global.css';
import type Phaser from 'phaser';
import { sports } from './data/sports';
import { createGame } from './game/createGame';
import { renderApp } from './ui/renderApp';
import { renderFatalAppError, renderGameError } from './ui/renderError';

const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('App root element is missing.');
}

const appRoot = app;
let currentGame: Phaser.Game | null = null;

function destroyCurrentGame(): void {
  if (!currentGame) {
    return;
  }

  try {
    currentGame.destroy(true);
  } catch (destroyError) {
    console.error('Existing game failed to destroy before route remount.', destroyError);
  } finally {
    currentGame = null;
  }
}

function mountApp(): void {
  destroyCurrentGame();

  try {
    const renderedApp = renderApp(appRoot, sports);

    if (renderedApp.gameRoot && renderedApp.sport) {
      try {
        currentGame = createGame(renderedApp.gameRoot, renderedApp.sport);
      } catch (gameError) {
        currentGame = null;
        renderGameError(renderedApp.gameRoot, renderedApp.sport, gameError);
      }
    }
  } catch (appError) {
    renderFatalAppError(appRoot, appError);
  }
}

function navigateTo(url: URL): void {
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    history.pushState({}, '', nextUrl);
  }

  mountApp();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

window.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');

  if (!link || link.target || link.hasAttribute('download')) {
    return;
  }

  const url = new URL(link.href);

  if (url.origin !== window.location.origin) {
    return;
  }

  event.preventDefault();
  navigateTo(url);
});

window.addEventListener('popstate', mountApp);

mountApp();
