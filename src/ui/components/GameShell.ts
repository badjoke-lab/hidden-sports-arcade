import { audioManager } from '../../audio/audioManager';
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
  subscribe as subscribeMatch,
} from '../../game/match/matchManager';
import type { Difficulty, MatchMode, MatchParticipant, MatchState, MatchStatus } from '../../game/types';
import { inputManager } from '../../input/inputManager';
import { BOCCIA_PLACEHOLDERS } from '../../game/sports/boccia/bocciaConfig';
import { bocciaRuleSections } from '../../game/sports/boccia/bocciaRules';
import { bocciaTutorialSteps } from '../../game/sports/boccia/bocciaTutorial';
import { missions } from '../../progress/missions';
import {
  completeMission,
  getProgressState,
  isTutorialSeen,
  markSportPlayed,
  markTutorialSeen,
  resetProgress,
  subscribe as subscribeProgress,
} from '../../progress/progressManager';
import type { ProgressState } from '../../progress/types';
import type { InputState } from '../../input/types';
import { setupVirtualControls, VirtualControls } from './VirtualControls';
import { showTutorialOverlay } from './TutorialOverlay';

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
  ready: 'Scoring preview ready',
  playing: 'Scoring preview active',
  paused: 'Paused',
  finished: 'Preview complete',
};

function participantLabel(mode: MatchMode, participant: MatchParticipant): string {
  if (participant === 'player') {
    return 'P1';
  }

  return mode === 'local_2p' ? 'P2' : 'CPU';
}

const controlHints = [
  ['Aim', 'A / D or Arrow Keys'],
  ['Charge', 'Hold Space / Enter'],
  ['Throw', 'Release Space / Enter'],
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

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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


function sportLabel(sportId: string | undefined): string {
  if (!sportId) {
    return 'None yet';
  }

  return sportId === 'boccia' ? 'Boccia' : sportId;
}

function completedMissionCount(progress: ProgressState): number {
  return missions.filter((mission) => progress.missions[mission.id]).length;
}

function latestMissionTitle(progress: ProgressState): string {
  const latestMission = missions.find((mission) => mission.id === progress.latestMissionId);

  return latestMission?.title ?? 'None yet';
}

function renderProgressPanel(): string {
  const progress = getProgressState();

  return `
    <section class="game-shell__panel game-shell__panel--progress" aria-labelledby="progress-title">
      <p id="progress-title" class="game-shell__panel-label">Progress</p>
      <dl class="game-shell__progress-details" aria-live="polite">
        <div>
          <dt>Favorites</dt>
          <dd data-progress-favorites>${progress.favorites.length}</dd>
        </div>
        <div>
          <dt>Recent</dt>
          <dd data-progress-recent>${sportLabel(progress.recentSports[0])}</dd>
        </div>
        <div>
          <dt>Missions</dt>
          <dd><span data-progress-missions-completed>${completedMissionCount(progress)}</span> / <span data-progress-missions-total>${missions.length}</span> complete</dd>
        </div>
        <div>
          <dt>Latest</dt>
          <dd data-progress-latest-mission>${latestMissionTitle(progress)}</dd>
        </div>
      </dl>
      <button class="button button--icon game-shell__reset-progress" type="button" data-progress-reset>Reset progress</button>
    </section>
  `;
}


function renderBocciaRulesPanel(): string {
  return `
    <section id="boccia-rules" class="game-shell__panel game-shell__panel--rules" aria-labelledby="boccia-rules-title" tabindex="-1">
      <div class="game-shell__panel-heading">
        <div>
          <p class="game-shell__panel-label">Rules</p>
          <h3 id="boccia-rules-title">Boccia rules for this arcade preview</h3>
        </div>
        <button class="button button--secondary" type="button" data-boccia-replay-tutorial>Replay tutorial</button>
      </div>
      <p class="game-shell__rules-note">This is a simplified arcade version designed to teach the core idea of Boccia. It is not a full simulation of official Boccia rules.</p>
      <div class="game-shell__rules-grid">
        ${bocciaRuleSections
          .map(
            (section) => `
              <article class="game-shell__rule-section" aria-labelledby="boccia-rule-${section.id}">
                <h4 id="boccia-rule-${section.id}">${section.title}</h4>
                ${section.body.map((paragraph) => `<p>${paragraph}</p>`).join('')}
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function completeBocciaTutorial(): void {
  markTutorialSeen('boccia');
  completeMission('boccia_complete_tutorial');
}

function renderAudioPanel(): string {
  const settings = audioManager.getSettings();

  return `
    <section class="game-shell__panel game-shell__panel--audio" aria-labelledby="audio-title">
      <div class="game-shell__panel-heading">
        <p id="audio-title" class="game-shell__panel-label">Audio</p>
        <label class="audio-panel__mute">
          <input type="checkbox" data-audio-muted ${settings.muted ? 'checked' : ''} />
          <span>Mute</span>
        </label>
      </div>

      <label class="audio-panel__slider">
        <span>BGM <output data-audio-bgm-value>${formatPercent(settings.bgmVolume)}</output></span>
        <input type="range" min="0" max="1" step="0.05" value="${settings.bgmVolume}" data-audio-bgm-volume />
      </label>

      <label class="audio-panel__slider">
        <span>SE <output data-audio-se-value>${formatPercent(settings.seVolume)}</output></span>
        <input type="range" min="0" max="1" step="0.05" value="${settings.seVolume}" data-audio-se-volume />
      </label>

      <div class="audio-panel__actions">
        <button class="button button--secondary" type="button" data-audio-test-se>
          Test SE
        </button>
        <button class="button button--icon" type="button" data-audio-stop-bgm>
          Stop BGM
        </button>
      </div>
      <p class="audio-panel__note">BGM starts only from a user action such as Start.</p>
    </section>
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
        <div class="section-heading__actions">
          <p class="section-heading__note">Boccia now supports one-ball VS CPU and Local 2P scoring previews.</p>
          <button class="button button--secondary" type="button" data-boccia-rules-button>Rules</button>
          <button class="button button--icon" type="button" data-boccia-replay-tutorial>Replay tutorial</button>
        </div>
      </div>

      <div class="game-shell__layout">
        <div class="game-shell__stage" aria-label="Boccia Phaser stage placeholder">
          <div class="game-shell__frame">
            <div id="game-root" class="game-shell__canvas" aria-label="Hidden Sports Arcade Phaser shell canvas"></div>
          </div>
        </div>

        <aside class="game-shell__hud" aria-label="Boccia match heads-up display placeholder">
          <div class="game-shell__panel game-shell__panel--score">
            <p class="game-shell__panel-label">Boccia preview score</p>
            <div class="game-shell__score" aria-live="polite">
              <span>P1 <strong data-game-shell-player-score>${matchState.score.player}</strong></span>
              <span><span data-game-shell-opponent-score-label>${matchState.mode === 'local_2p' ? 'P2' : 'CPU'}</span> <strong data-game-shell-opponent-score>${matchState.score.opponent}</strong></span>
            </div>
          </div>

          <div class="game-shell__panel game-shell__panel--match">
            <p class="game-shell__panel-label">Match state foundation</p>
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
                <dd data-game-shell-current-turn>${participantLabel(matchState.mode, matchState.turn.currentPlayer)}</dd>
              </div>
              <div>
                <dt>Turn number</dt>
                <dd data-game-shell-turn-number>${matchState.turn.turnNumber}</dd>
              </div>
            </dl>
          </div>

          <div class="game-shell__panel game-shell__panel--boccia">
            <p class="game-shell__panel-label">Boccia HUD</p>
            <dl class="game-shell__match-details" aria-live="polite">
              <div>
                <dt>Round</dt>
                <dd>${BOCCIA_PLACEHOLDERS.round}</dd>
              </div>
              <div>
                <dt>Balls</dt>
                <dd>${BOCCIA_PLACEHOLDERS.balls}</dd>
              </div>
              <div>
                <dt>Current phase</dt>
                <dd data-boccia-phase>${BOCCIA_PLACEHOLDERS.phase}</dd>
              </div>
              <div>
                <dt>Scoring preview</dt>
                <dd data-boccia-scoring-preview>${BOCCIA_PLACEHOLDERS.scoringPreview}</dd>
              </div>
              <div>
                <dt>Closest ball</dt>
                <dd data-boccia-closest-side>${BOCCIA_PLACEHOLDERS.closestSide}</dd>
              </div>
              <div>
                <dt>CPU difficulty</dt>
                <dd data-boccia-cpu-difficulty>${difficultyLabels[matchState.difficulty]}</dd>
              </div>
              <div>
                <dt>CPU note</dt>
                <dd data-boccia-cpu-note>${matchState.mode === 'local_2p' ? 'Local 2P waits for P1 to throw.' : 'CPU waits for the player throw.'}</dd>
              </div>
              <div>
                <dt>Note</dt>
                <dd>${BOCCIA_PLACEHOLDERS.note}</dd>
              </div>
            </dl>
          </div>

          <div class="game-shell__panel">
            <p class="game-shell__panel-label">Match mode</p>
            <div class="game-shell__options" role="group" aria-label="Match mode selector">
              ${(Object.keys(modeLabels) as MatchMode[])
                .map((mode) => renderSegmentedButton(mode, modeLabels[mode], mode === matchState.mode, 'mode'))
                .join('')}
            </div>
          </div>

          <div class="game-shell__panel">
            <p class="game-shell__panel-label">CPU difficulty</p>
            <div class="game-shell__options" role="group" aria-label="CPU difficulty selector">
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
          <p id="objective-title" class="game-shell__panel-label">Boccia objective</p>
          <p class="game-shell__objective">Objective: <span data-game-shell-objective>${matchState.objective}</span><br /><span class="game-shell__note">${BOCCIA_PLACEHOLDERS.note}</span></p>
        </section>

        <section class="game-shell__panel" aria-labelledby="controls-title">
          <p id="controls-title" class="game-shell__panel-label">Control hints</p>
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

        ${renderAudioPanel()}

        ${renderProgressPanel()}

        ${renderBocciaRulesPanel()}

        <section class="game-shell__panel game-shell__panel--result" aria-labelledby="result-title">
          <p id="result-title" class="game-shell__panel-label">Result preview</p>
          <p>Preview result: <span data-game-shell-result>${resultText(matchState)}</span></p>
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
  const opponentScoreLabel = root.querySelector<HTMLElement>('[data-game-shell-opponent-score-label]');
  const turnNumber = root.querySelector<HTMLElement>('[data-game-shell-turn-number]');
  const result = root.querySelector<HTMLElement>('[data-game-shell-result]');
  const bocciaCpuDifficulty = root.querySelector<HTMLElement>('[data-boccia-cpu-difficulty]');
  const modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-game-shell-mode]'));
  const difficultyButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-game-shell-difficulty]'));
  const actionButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-game-shell-action]'));
  const bgmVolumeInput = root.querySelector<HTMLInputElement>('[data-audio-bgm-volume]');
  const seVolumeInput = root.querySelector<HTMLInputElement>('[data-audio-se-volume]');
  const mutedInput = root.querySelector<HTMLInputElement>('[data-audio-muted]');
  const testSeButton = root.querySelector<HTMLButtonElement>('[data-audio-test-se]');
  const stopBgmButton = root.querySelector<HTMLButtonElement>('[data-audio-stop-bgm]');
  const bgmVolumeValue = root.querySelector<HTMLOutputElement>('[data-audio-bgm-value]');
  const seVolumeValue = root.querySelector<HTMLOutputElement>('[data-audio-se-value]');
  const progressFavorites = root.querySelector<HTMLElement>('[data-progress-favorites]');
  const progressMissionsCompleted = root.querySelector<HTMLElement>('[data-progress-missions-completed]');
  const progressRecent = root.querySelector<HTMLElement>('[data-progress-recent]');
  const progressLatestMission = root.querySelector<HTMLElement>('[data-progress-latest-mission]');
  const progressResetButton = root.querySelector<HTMLButtonElement>('[data-progress-reset]');
  const rulesPanel = root.querySelector<HTMLElement>('#boccia-rules');
  const rulesButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-boccia-rules-button]'));
  const replayTutorialButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-boccia-replay-tutorial]'));
  const inputStateFields = {
    aimLeft: root.querySelector<HTMLElement>('[data-input-state="aimLeft"]'),
    aimRight: root.querySelector<HTMLElement>('[data-input-state="aimRight"]'),
    primary: root.querySelector<HTMLElement>('[data-input-state="primary"]'),
    secondary: root.querySelector<HTMLElement>('[data-input-state="secondary"]'),
    pause: root.querySelector<HTMLElement>('[data-input-state="pause"]'),
    lastSource: root.querySelector<HTMLElement>('[data-input-state="lastSource"]'),
  };

  setupVirtualControls(root);
  audioManager.preload();
  markSportPlayed('boccia');
  completeMission('boccia_shell_visit');
  completeMission('first_play');

  if (isTutorialSeen('boccia')) {
    completeMission('boccia_complete_tutorial');
  }

  function openBocciaTutorial(): void {
    showTutorialOverlay({
      steps: bocciaTutorialSteps,
      sportName: 'Boccia',
      onFinish: completeBocciaTutorial,
      onSkip: completeBocciaTutorial,
    });
  }

  if (!isTutorialSeen('boccia')) {
    window.setTimeout(openBocciaTutorial, 0);
  }

  rulesButtons.forEach((button) => {
    button.addEventListener('click', () => {
      audioManager.playSe('select');
      rulesPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      rulesPanel?.focus({ preventScroll: true });
    });
  });

  replayTutorialButtons.forEach((button) => {
    button.addEventListener('click', () => {
      audioManager.playSe('select');
      openBocciaTutorial();
    });
  });

  subscribeProgress((progress) => {
    progressFavorites && (progressFavorites.textContent = String(progress.favorites.length));
    progressRecent && (progressRecent.textContent = sportLabel(progress.recentSports[0]));
    progressMissionsCompleted && (progressMissionsCompleted.textContent = String(completedMissionCount(progress)));
    progressLatestMission && (progressLatestMission.textContent = latestMissionTitle(progress));
  });

  audioManager.subscribe((settings) => {
    if (bgmVolumeInput) {
      bgmVolumeInput.value = String(settings.bgmVolume);
    }

    if (seVolumeInput) {
      seVolumeInput.value = String(settings.seVolume);
    }

    if (mutedInput) {
      mutedInput.checked = settings.muted;
    }

    if (bgmVolumeValue) {
      bgmVolumeValue.value = formatPercent(settings.bgmVolume);
      bgmVolumeValue.textContent = formatPercent(settings.bgmVolume);
    }

    if (seVolumeValue) {
      seVolumeValue.value = formatPercent(settings.seVolume);
      seVolumeValue.textContent = formatPercent(settings.seVolume);
    }
  });


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
    bocciaCpuDifficulty && (bocciaCpuDifficulty.textContent = difficultyLabels[state.difficulty]);
    playerScore && (playerScore.textContent = String(state.score.player));
    opponentScore && (opponentScore.textContent = String(state.score.opponent));
    opponentScoreLabel && (opponentScoreLabel.textContent = state.mode === 'local_2p' ? 'P2' : 'CPU');
    currentTurn && (currentTurn.textContent = participantLabel(state.mode, state.turn.currentPlayer));
    turnNumber && (turnNumber.textContent = String(state.turn.turnNumber));
    result && (result.textContent = resultText(state));
    updatePressed(modeButtons, 'gameShellMode', state.mode);
    updatePressed(difficultyButtons, 'gameShellDifficulty', state.difficulty);
  }

  subscribeMatch(renderMatchState);

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.gameShellMode as MatchMode | undefined;

      if (!mode) {
        return;
      }

      audioManager.playSe('select');
      setMode(mode);
      if (mode === 'local_2p') {
        completeMission('boccia_try_local_2p');
      }
      window.dispatchEvent(new CustomEvent('boccia:retry'));
    });
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const difficulty = button.dataset.gameShellDifficulty as Difficulty | undefined;

      if (!difficulty) {
        return;
      }

      audioManager.playSe('select');
      setDifficulty(difficulty);
    });
  });

  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.gameShellAction;

      if (action === 'start') {
        audioManager.playSe('start');
        audioManager.playBgm('match');
        startMatch();
        markSportPlayed('boccia');
        completeMission('first_start');
      }

      if (action === 'pause') {
        const state = getMatchState();

        audioManager.playSe('select');

        if (state.status === 'paused') {
          resumeMatch();
        } else {
          pauseMatch();
        }
      }

      if (action === 'turn') {
        advanceTurnPlaceholder();
      }

      if (action === 'retry') {
        audioManager.playSe('select');
        retryMatch();
        window.dispatchEvent(new CustomEvent('boccia:retry'));
      }

      if (action === 'finish') {
        audioManager.playSe('whistle');
        finishMatchPlaceholder();
      }
    });
  });

  bgmVolumeInput?.addEventListener('input', () => {
    audioManager.setBgmVolume(Number(bgmVolumeInput.value));
  });

  seVolumeInput?.addEventListener('input', () => {
    audioManager.setSeVolume(Number(seVolumeInput.value));
  });

  mutedInput?.addEventListener('change', () => {
    audioManager.setMuted(mutedInput.checked);
  });

  testSeButton?.addEventListener('click', () => {
    audioManager.playSe('select');
    completeMission('first_audio_test');
  });

  progressResetButton?.addEventListener('click', () => {
    audioManager.playSe('cancel');
    resetProgress();
  });

  stopBgmButton?.addEventListener('click', () => {
    audioManager.stopBgm();
  });
}
