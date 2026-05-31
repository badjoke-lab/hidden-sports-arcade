import './styles/global.css';
import { sports } from './data/sports';
import { createGame } from './game/createGame';
import { renderApp } from './ui/renderApp';

const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('App root element is missing.');
}

const gameRoot = renderApp(app, sports);

createGame(gameRoot);
