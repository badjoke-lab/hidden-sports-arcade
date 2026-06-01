import {
  advanceTurnPlaceholder,
  finishMatchPlaceholder,
  getMatchState,
  pauseMatch,
  resumeMatch,
  retryMatch,
  setDifficulty,
  setMode,
  startMatch,
  subscribe,
} from '../../game/match/matchManager';
import type { Difficulty, MatchMode, MatchParticipant, MatchState, MatchStatus } from '../../game/types';
import { inputManager } from '../../input/inputManager';
import type { InputState } from '../../input/types';
import { setupVirtualControls, VirtualControls } from './VirtualControls';

const modeLabels: Record<MatchMode, string> = {
  vs_cpu: 'VS CPU',
  local_2p: 'Local 2P',
};

const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

const statusLabels: Record<MatchStatus, string> = {
  ready: 'Ready',
  playing: 'Playing',
  paused: 'Paused',
  finished: 'Finished placeholder',
};

const participantLabels: Record<MatchParticipant, string> = {
  player: 'Player',
  opponent: 'Opponent',
};

const controlHints = [
  ['Aim', 'A / D or Arrow Keys'],
  ['Primary', 'Space / Enter'],
  ['Secondary', 'Shift / K'],
  ['Pause', 'Esc / P'],
] as const;

function inputValue(active: boolean): string {
  return active ? 'on' : 'off';
}

function resultText(state: MatchState): string {
  return state.result.reason;
}

function renderInputDebugPanel(state: InputState): string {
  return `
    <section class="game-shell__panel game-shell__panel--input" aria-labelledby="input-debug-title">
      <p id="input-debug-title" class="game-shell__panel-label">Input debug</p>
      <dl class="game-shell__input-debug" aria-live="polite">
        <div>
          <dt>Left</dt>
          <dd data-input-state="aimLeft">${inputValue(state.aimLeft)}</dd>
        </div>
        <div>
          <dt>Right</dt>
          <dd data-input-state="aimRight">${inputValue(state.aimRight)}</dd>
        </div>
        <div>
          <dt>Primary</dt>
          <dd data-input-state="primary">${inputValue(state.primary)}</dd>
        </div>
        <div>
          <dt>Secondary</dt>
          <dd data-input-state="secondary">${inputValue(state.secondary)}</dd>
        </div>
        <div>
          <dt>Pause</dt>
          <dd data-input-state="pause">${inputValue(state.pause)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd data-input-state="lastSource">${state.lastSource ?? 'none'}</dd>
        </div>
      </dl>
    </section>
  `;
}

function renderSegmentedButton(value: string, label: string, active: boolean, group: string): string {
  return `
    <button
      class="game-shell__option ${active ? 'game-shell__option--active' : ''}"
      type="button"
      data-game-shell-${group}="${value}"
      aria-pressed="${active}"
    >
      ${label}
    </button>
  `;
}

export function GameShell(): string {
  const matchState = getMatchState();

  return `
    <section id="play" class="game-shell" aria-labelledby="game-shell-title">
      <div class="section-heading section-heading--split">
        <div>
          <p class="eyebrow">Game shell</p>
          <h2 id="game-shell-title">Boccia</h2>
        </div>
        <p class="section-heading__note">Reusable Play mode shell. Boccia gameplay starts in a later PR.</p>
      </div>

      <div class="game-shell__layout">
        <div class="game-shell__stage" aria-label="Boccia Phaser stage placeholder">
          <div class="game-shell__frame">
            <div id="game-root" class="game-shell__canvas" aria-label="Hidden Sports Arcade Phaser shell canvas"></div>
          </div>
        </div>

        <aside class="game-shell__hud" aria-label="Boccia match heads-up display placeholder">
          <div class="game-shell__panel game-shell__panel--score">
            <p class="game-shell__panel-label">Score placeholder</p>
            <div class="game-shell__score" aria-live="polite">
              <span>Player <strong data-game-shell-player-score>${matchState.score.player}</strong></span>
              <span>Opponent <strong data-game-shell-opponent-score>${matchState.score.opponent}</strong></span>
            </div>
          </div>

          <div class="game-shell__panel game-shell__panel--match">
            <p class="game-shell__panel-label">Match state placeholder</p>
            <dl class="game-shell__match-details" aria-live="polite">
              <div>
                <dt>Status</dt>
                <dd data-game-shell-status>${statusLabels[matchState.status]}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd data-game-shell-mode-label>${modeLabels[matchState.mode]}</dd>
              </div>
              <div>
                <dt>Difficulty</dt>
                <dd data-game-shell-difficulty-label>${difficultyLabels[matchState.difficulty]}</dd>
              </div>
              <div>
                <dt>Current turn</dt>
                <dd data-game-shell-current-turn>${participantLabels[matchState.turn.currentPlayer]}</dd>
              </div>
              <div>
                <dt>Turn number</dt>
                <dd data-game-shell-turn-number>${matchState.turn.turnNumber}</dd>
              </div>
            </dl>
          </div>

          <div class="game-shell__panel">
            <p class="game-shell__panel-label">Mode placeholder</p>
            <div class="game-shell__options" role="group" aria-label="Match mode placeholder selector">
              ${(Object.keys(modeLabels) as MatchMode[])
                .map((mode) => renderSegmentedButton(mode, modeLabels[mode], mode === matchState.mode, 'mode'))
                .join('')}
            </div>
          </div>

          <div class="game-shell__panel">
            <p class="game-shell__panel-label">Difficulty placeholder</p>
            <div class="game-shell__options" role="group" aria-label="Difficulty placeholder selector">
              ${(Object.keys(difficultyLabels) as Difficulty[])
                .map((difficulty) =>
                  renderSegmentedButton(
                    difficulty,
                    difficultyLabels[difficulty],
                    difficulty === matchState.difficulty,
                    'difficulty',
                  ),
                )
                .join('')}
            </div>
          </div>
        </aside>
      </div>

      <section class="game-shell__panel game-shell__panel--virtual" aria-labelledby="virtual-controls-title">
        <p id="virtual-controls-title" class="game-shell__panel-label">Virtual controls</p>
        ${VirtualControls()}
      </section>

      <div class="game-shell__lower-grid">
        <section class="game-shell__panel" aria-labelledby="objective-title">
          <p id="objective-title" class="game-shell__panel-label">Objective placeholder</p>
          <p class="game-shell__objective">Objective: <span data-game-shell-objective>${matchState.objective}</span></p>
        </section>

        <section class="game-shell__panel" aria-labelledby="controls-title">
          <p id="controls-title" class="game-shell__panel-label">Control hints placeholder</p>
          <dl class="game-shell__hints">
            ${controlHints
              .map(
                ([action, hint]) => `
                  <div>
                    <dt>${action}</dt>
                    <dd>${hint}</dd>
                  </div>
                `,
              )
              .join('')}
          </dl>
        </section>

        <section class="game-shell__panel" aria-labelledby="actions-title">
          <p id="actions-title" class="game-shell__panel-label">Shell status flow</p>
          <div class="game-shell__actions" aria-label="Match placeholder controls">
            <button class="button button--primary" type="button" data-game-shell-action="start">Start</button>
            <button class="button button--secondary" type="button" data-game-shell-action="pause">Pause</button>
            <button class="button button--secondary" type="button" data-game-shell-action="turn">Next turn</button>
            <button class="button button--icon" type="button" data-game-shell-action="retry">Retry</button>
            <button class="button button--icon" type="button" data-game-shell-action="finish">Finish</button>
          </div>
        </section>

        ${renderInputDebugPanel(inputManager.getInputState())}

        <section class="game-shell__panel game-shell__panel--result" aria-labelledby="result-title">
          <p id="result-title" class="game-shell__panel-label">Result panel placeholder</p>
          <p>Result: <span data-game-shell-result>${resultText(matchState)}</span></p>
        </section>
      </div>
    </section>
  `;
}

export function setupGameShell(root: HTMLElement): void {
  const status = root.querySelector<HTMLElement>('[data-game-shell-status]');
  const modeLabel = root.querySelector<HTMLElement>('[data-game-shell-mode-label]');
  const difficultyLabel = root.querySelector<HTMLElement>('[data-game-shell-difficulty-label]');
  const playerScore = root.querySelector<HTMLElement>('[data-game-shell-player-score]');
  const opponentScore = root.querySelector<HTMLElement>('[data-game-shell-opponent-score]');
  const currentTurn = root.querySelector<HTMLElement>('[data-game-shell-current-turn]');
  const turnNumber = root.querySelector<HTMLElement>('[data-game-shell-turn-number]');
  const result = root.querySelector<HTMLElement>('[data-game-shell-result]');
  const modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-game-shell-mode]'));
  const difficultyButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-game-shell-difficulty]'));
  const actionButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-game-shell-action]'));
  const inputStateFields = {
    aimLeft: root.querySelector<HTMLElement>('[data-input-state="aimLeft"]'),
    aimRight: root.querySelector<HTMLElement>('[data-input-state="aimRight"]'),
    primary: root.querySelector<HTMLElement>('[data-input-state="primary"]'),
    secondary: root.querySelector<HTMLElement>('[data-input-state="secondary"]'),
    pause: root.querySelector<HTMLElement>('[data-input-state="pause"]'),
    lastSource: root.querySelector<HTMLElement>('[data-input-state="lastSource"]'),
  };

  setupVirtualControls(root);

  inputManager.subscribe((inputState) => {
    inputStateFields.aimLeft && (inputStateFields.aimLeft.textContent = inputValue(inputState.aimLeft));
    inputStateFields.aimRight && (inputStateFields.aimRight.textContent = inputValue(inputState.aimRight));
    inputStateFields.primary && (inputStateFields.primary.textContent = inputValue(inputState.primary));
    inputStateFields.secondary && (inputStateFields.secondary.textContent = inputValue(inputState.secondary));
    inputStateFields.pause && (inputStateFields.pause.textContent = inputValue(inputState.pause));
    inputStateFields.lastSource && (inputStateFields.lastSource.textContent = inputState.lastSource ?? 'none');
  });

  function updatePressed<T extends MatchMode | Difficulty>(
    buttons: HTMLButtonElement[],
    attribute: string,
    value: T,
  ): void {
    buttons.forEach((button) => {
      const isActive = button.dataset[attribute] === value;
      button.classList.toggle('game-shell__option--active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function renderMatchState(state: MatchState): void {
    status && (status.textContent = statusLabels[state.status]);
    modeLabel && (modeLabel.textContent = modeLabels[state.mode]);
    difficultyLabel && (difficultyLabel.textContent = difficultyLabels[state.difficulty]);
    playerScore && (playerScore.textContent = String(state.score.player));
    opponentScore && (opponentScore.textContent = String(state.score.opponent));
    currentTurn && (currentTurn.textContent = participantLabels[state.turn.currentPlayer]);
    turnNumber && (turnNumber.textContent = String(state.turn.turnNumber));
    result && (result.textContent = resultText(state));
    updatePressed(modeButtons, 'gameShellMode', state.mode);
    updatePressed(difficultyButtons, 'gameShellDifficulty', state.difficulty);
  }

  subscribe(renderMatchState);

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.gameShellMode as MatchMode | undefined;

      if (!mode) {
        return;
      }

      setMode(mode);
    });
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const difficulty = button.dataset.gameShellDifficulty as Difficulty | undefined;

      if (!difficulty) {
        return;
      }

      setDifficulty(difficulty);
    });
  });

  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.gameShellAction;

      if (action === 'start') {
        startMatch();
      }

      if (action === 'pause') {
        const state = getMatchState();
        state.status === 'paused' ? resumeMatch() : pauseMatch();
      }

      if (action === 'turn') {
        advanceTurnPlaceholder();
      }

      if (action === 'retry') {
        retryMatch();
      }

      if (action === 'finish') {
        finishMatchPlaceholder();
      }
    });
  });
}
