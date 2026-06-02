import './styles/global.css';
import { sports } from './data/sports';
import { createGame } from './game/createGame';
import { renderApp } from './ui/renderApp';

const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('App root element is missing.');
}

const renderedApp = renderApp(app, sports);

if (renderedApp.gameRoot && renderedApp.sport) {
  createGame(renderedApp.gameRoot, renderedApp.sport);
}
