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
import { tchoukballRuleSections, tchoukballRulesNotice } from '../../game/sports/tchoukball/tchoukballRules';
import { tchoukballTutorialSteps } from '../../game/sports/tchoukball/tchoukballTutorial';
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
    <details class="game-shell__panel game-shell__panel--input game-shell__details">
      <summary class="game-shell__details-summary">
        <span class="game-shell__panel-label">Debug input</span>
        <span>Show live input state</span>
      </summary>
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
    </details>
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

  const labels: Record<string, string> = {
    boccia: 'Boccia',
    tchoukball: 'Tchoukball',
  };

  return labels[sportId] ?? sportId;
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
    <details class="game-shell__panel game-shell__panel--progress game-shell__details">
      <summary class="game-shell__details-summary">
        <span id="progress-title" class="game-shell__panel-label">Progress</span>
        <span><span data-progress-missions-completed>${completedMissionCount(progress)}</span> / <span data-progress-missions-total>${missions.length}</span> missions complete</span>
      </summary>
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
    </details>
  `;
}


function renderBocciaRulesPanel(): string {
  return `
    <details id="boccia-rules" class="game-shell__panel game-shell__panel--rules game-shell__details" tabindex="-1">
      <summary class="game-shell__details-summary game-shell__details-summary--rules">
        <span>
          <span class="game-shell__panel-label">Boccia rules</span>
          <strong id="boccia-rules-title">Simplified arcade rules</strong>
        </span>
        <span class="game-shell__summary-note">Simplified, not official full Boccia rules</span>
      </summary>
      <div class="game-shell__panel-heading game-shell__panel-heading--inside-details">
        <p class="game-shell__rules-note">This is a simplified arcade version designed to teach the core idea of Boccia. It is not a full simulation of official Boccia rules.</p>
        <button class="button button--secondary" type="button" data-boccia-replay-tutorial>Replay tutorial</button>
      </div>
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
    </details>
  `;
}

function renderTchoukballRulesPanel(): string {
  return `
    <details id="tchoukball-rules" class="game-shell__panel game-shell__panel--rules game-shell__details" tabindex="-1">
      <summary class="game-shell__details-summary game-shell__details-summary--rules">
        <span>
          <span class="game-shell__panel-label">Tchoukball rules</span>
          <strong id="tchoukball-rules-title">Simplified arcade rules</strong>
        </span>
        <span class="game-shell__summary-note">Simplified, not official full Tchoukball rules</span>
      </summary>
      <p class="game-shell__rules-note">${tchoukballRulesNotice}</p>
      <div class="game-shell__rules-grid">
        ${tchoukballRuleSections
          .map(
            (section) => `
              <article class="game-shell__rule-section" aria-labelledby="tchoukball-rule-${section.id}">
                <h4 id="tchoukball-rule-${section.id}">${section.title}</h4>
                ${section.body.map((paragraph) => `<p>${paragraph}</p>`).join('')}
              </article>
            `,
          )
          .join('')}
      </div>
    </details>
  `;
}

function renderTchoukballFoundationPanel(): string {
  return `
    <section class="game-shell__panel game-shell__panel--tchoukball" aria-labelledby="tchoukball-foundation-title">
      <p id="tchoukball-foundation-title" class="game-shell__panel-label">Learn Tchoukball</p>
      <p class="game-shell__learning-copy">Try one rebound shot, watch a compact demo, or open guided steps. This preview teaches the frame + landing idea only.</p>
      <div class="game-shell__learning-actions game-shell__learning-actions--foundation" aria-label="Tchoukball foundation controls">
        <button class="button button--primary" type="button" data-tchoukball-preview>Preview foundation</button>
        <button class="button button--secondary" type="button" data-tchoukball-watch-demo>Watch demo</button>
        <button class="button button--secondary" type="button" data-tchoukball-slow-demo>Slow demo</button>
        <button class="button button--icon" type="button" data-tchoukball-stop-demo disabled>Stop demo</button>
        <button class="button button--primary" type="button" data-tchoukball-guided-steps>Guided steps</button>
        <button class="button button--secondary" type="button" data-tchoukball-rules-button>Tchoukball rules</button>
        <button class="button button--icon" type="button" data-boccia-preview-return>Back to Boccia</button>
      </div>
      <p class="game-shell__learning-status" data-foundation-preview-status aria-live="polite">Ready: choose Watch demo, Slow demo, or Guided steps. Demo graphics do not change the real preview score.</p>
    </section>
  `;
}

function completeBocciaTutorial(): void {
  markTutorialSeen('boccia');
  completeMission('boccia_complete_tutorial');
}

function renderBocciaLearningPanel(): string {
  return `
    <section class="game-shell__panel game-shell__panel--learning" aria-labelledby="boccia-learning-title">
      <p id="boccia-learning-title" class="game-shell__panel-label">Learn Boccia</p>
      <p class="game-shell__learning-copy">You can read the steps, watch a demo, or try the guided tutorial.</p>
      <div class="game-shell__learning-actions" aria-label="Boccia tutorial controls">
        <button class="button button--secondary" type="button" data-boccia-watch-demo>Watch demo</button>
        <button class="button button--secondary" type="button" data-boccia-slow-demo>Slow demo</button>
        <button class="button button--icon" type="button" data-boccia-stop-demo disabled>Stop demo</button>
        <button class="button button--primary" type="button" data-boccia-guided-start>Guided tutorial</button>
      </div>
      <p class="game-shell__learning-status" data-boccia-learning-status aria-live="polite">Ready: choose Watch demo or Guided tutorial.</p>
    </section>
  `;
}

function renderAudioPanel(): string {
  const settings = audioManager.getSettings();

  return `
    <details class="game-shell__panel game-shell__panel--audio game-shell__details">
      <summary class="game-shell__details-summary">
        <span id="audio-title" class="game-shell__panel-label">Settings / Audio</span>
        <span>${settings.muted ? 'Muted' : 'Sound on'}</span>
      </summary>
      <div class="game-shell__panel-heading game-shell__panel-heading--inside-details">
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
    </details>
  `;
}

export function GameShell(): string {
  const matchState = getMatchState();

  return `
    <section id="play" class="game-shell" aria-labelledby="game-shell-title">
      <div class="section-heading section-heading--split game-shell__heading">
        <div>
          <p class="eyebrow">Play Boccia</p>
          <h2 id="game-shell-title">Boccia</h2>
        </div>
        <div class="section-heading__actions">
          <p class="section-heading__note">One-ball VS CPU and Local 2P arcade scoring preview.</p>
          <button class="button button--secondary" type="button" data-boccia-rules-button>Boccia rules</button>
          <button class="button button--icon" type="button" data-boccia-replay-tutorial>Replay tutorial</button>
          <button class="button button--secondary" type="button" data-tchoukball-preview>Preview Tchoukball</button>
        </div>
      </div>

      <div class="game-shell__layout">
        <div class="game-shell__stage" aria-label="Boccia play area">
          <div class="game-shell__frame">
            <div id="game-root" class="game-shell__canvas" aria-label="Hidden Sports Arcade Boccia game canvas"></div>
          </div>
        </div>

        <section class="game-shell__panel game-shell__panel--virtual" aria-labelledby="virtual-controls-title">
          <p id="virtual-controls-title" class="game-shell__panel-label">Virtual controls</p>
          ${VirtualControls()}
        </section>

        <aside class="game-shell__hud" aria-label="Boccia match heads-up display">
          <div class="game-shell__panel game-shell__panel--score">
            <p class="game-shell__panel-label">Preview score</p>
            <div class="game-shell__score" aria-live="polite">
              <span>P1 <strong data-game-shell-player-score>${matchState.score.player}</strong></span>
              <span><span data-game-shell-opponent-score-label>${matchState.mode === 'local_2p' ? 'P2' : 'CPU'}</span> <strong data-game-shell-opponent-score>${matchState.score.opponent}</strong></span>
            </div>
          </div>

          <div class="game-shell__panel game-shell__panel--match">
            <p class="game-shell__panel-label">Match</p>
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
            <p class="game-shell__panel-label">Current phase</p>
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
                <dt>Phase</dt>
                <dd data-boccia-phase>${BOCCIA_PLACEHOLDERS.phase}</dd>
              </div>
              <div>
                <dt>Scoring</dt>
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
            </dl>
          </div>

          <section class="game-shell__panel game-shell__panel--result" aria-labelledby="result-title">
            <p id="result-title" class="game-shell__panel-label">Preview result</p>
            <p><span data-game-shell-result>${resultText(matchState)}</span></p>
          </section>

          <section class="game-shell__panel game-shell__panel--actions" aria-labelledby="actions-title">
            <p id="actions-title" class="game-shell__panel-label">Actions</p>
            <div class="game-shell__actions" aria-label="Match controls">
              <button class="button button--primary" type="button" data-game-shell-action="start">Start</button>
              <button class="button button--secondary" type="button" data-game-shell-action="pause">Pause</button>
              <button class="button button--secondary" type="button" data-game-shell-action="turn">Next turn</button>
              <button class="button button--icon" type="button" data-game-shell-action="retry">Retry</button>
              <button class="button button--icon" type="button" data-game-shell-action="finish">Finish</button>
            </div>
          </section>

          <div class="game-shell__panel game-shell__panel--mode">
            <p class="game-shell__panel-label">Mode</p>
            <div class="game-shell__options" role="group" aria-label="Match mode selector">
              ${(Object.keys(modeLabels) as MatchMode[])
                .map((mode) => renderSegmentedButton(mode, modeLabels[mode], mode === matchState.mode, 'mode'))
                .join('')}
            </div>
          </div>

          <div class="game-shell__panel game-shell__panel--difficulty">
            <p class="game-shell__panel-label">Difficulty</p>
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

        ${renderBocciaLearningPanel()}

        ${renderTchoukballFoundationPanel()}
      </div>

      <div class="game-shell__lower-grid" aria-label="Boccia secondary panels">
        <section class="game-shell__panel" aria-labelledby="objective-title">
          <p id="objective-title" class="game-shell__panel-label">Objective</p>
          <p class="game-shell__objective"><span data-game-shell-objective>${matchState.objective}</span><br /><span class="game-shell__note">${BOCCIA_PLACEHOLDERS.note}</span></p>
        </section>

        <details class="game-shell__panel game-shell__details game-shell__panel--hints">
          <summary class="game-shell__details-summary">
            <span id="controls-title" class="game-shell__panel-label">Control hints</span>
            <span>Keyboard shortcuts</span>
          </summary>
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
        </details>

        ${renderBocciaRulesPanel()}

        ${renderTchoukballRulesPanel()}

        ${renderAudioPanel()}

        ${renderProgressPanel()}

        ${renderInputDebugPanel(inputManager.getInputState())}
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
  const progressMissionsCompleted = Array.from(root.querySelectorAll<HTMLElement>('[data-progress-missions-completed]'));
  const progressRecent = root.querySelector<HTMLElement>('[data-progress-recent]');
  const progressLatestMission = root.querySelector<HTMLElement>('[data-progress-latest-mission]');
  const progressResetButton = root.querySelector<HTMLButtonElement>('[data-progress-reset]');
  const rulesPanel = root.querySelector<HTMLDetailsElement>('#boccia-rules');
  const tchoukballRulesPanel = root.querySelector<HTMLDetailsElement>('#tchoukball-rules');
  const rulesButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-boccia-rules-button]'));
  const replayTutorialButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-boccia-replay-tutorial]'));
  const tchoukballPreviewButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tchoukball-preview]'));
  const tchoukballRulesButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tchoukball-rules-button]'));
  const tchoukballWatchDemoButton = root.querySelector<HTMLButtonElement>('[data-tchoukball-watch-demo]');
  const tchoukballSlowDemoButton = root.querySelector<HTMLButtonElement>('[data-tchoukball-slow-demo]');
  const tchoukballStopDemoButton = root.querySelector<HTMLButtonElement>('[data-tchoukball-stop-demo]');
  const tchoukballGuidedStepsButton = root.querySelector<HTMLButtonElement>('[data-tchoukball-guided-steps]');
  const bocciaPreviewReturnButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-boccia-preview-return]'));
  const foundationPreviewStatus = root.querySelector<HTMLElement>('[data-foundation-preview-status]');
  const guidedStartButton = root.querySelector<HTMLButtonElement>('[data-boccia-guided-start]');
  const watchDemoButton = root.querySelector<HTMLButtonElement>('[data-boccia-watch-demo]');
  const slowDemoButton = root.querySelector<HTMLButtonElement>('[data-boccia-slow-demo]');
  const stopDemoButton = root.querySelector<HTMLButtonElement>('[data-boccia-stop-demo]');
  const learningStatus = root.querySelector<HTMLElement>('[data-boccia-learning-status]');
  const virtualButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-virtual-input-action]'));
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

  function openTchoukballGuidedSteps(): void {
    showTutorialOverlay({
      steps: tchoukballTutorialSteps,
      sportName: 'Tchoukball',
      onFinish: () => markTutorialSeen('tchoukball'),
      onSkip: () => markTutorialSeen('tchoukball'),
    });
  }

  if (!isTutorialSeen('boccia')) {
    window.setTimeout(openBocciaTutorial, 0);
  }

  let guidedActive = false;

  function setLearningStatus(text: string): void {
    if (learningStatus) {
      learningStatus.textContent = text;
    }
  }

  function setControlHighlight(highlight: 'aim' | 'primary' | 'preview' | null): void {
    root.dataset.bocciaGuidedHighlight = highlight ?? '';
    virtualButtons.forEach((button) => {
      const action = button.dataset.virtualInputAction;
      const active =
        (highlight === 'aim' && (action === 'aim_left' || action === 'aim_right')) ||
        (highlight === 'primary' && action === 'primary');
      button.classList.toggle('virtual-controls__button--guided', active);
    });
  }

  guidedStartButton?.addEventListener('click', () => {
    audioManager.playSe('start');
    guidedActive = true;
    setControlHighlight('aim');
    watchDemoButton && (watchDemoButton.disabled = false);
    slowDemoButton && (slowDemoButton.disabled = false);
    stopDemoButton && (stopDemoButton.disabled = true);
    window.dispatchEvent(new CustomEvent('boccia:demo-stop'));
    window.dispatchEvent(new CustomEvent('boccia:guided-start'));
  });

  watchDemoButton?.addEventListener('click', () => {
    audioManager.playSe('select');
    guidedActive = false;
    setControlHighlight(null);
    window.dispatchEvent(new CustomEvent('boccia:guided-stop'));
    window.dispatchEvent(new CustomEvent('boccia:demo-start', { detail: { slow: false } }));
  });

  slowDemoButton?.addEventListener('click', () => {
    audioManager.playSe('select');
    guidedActive = false;
    setControlHighlight(null);
    window.dispatchEvent(new CustomEvent('boccia:guided-stop'));
    window.dispatchEvent(new CustomEvent('boccia:demo-start', { detail: { slow: true } }));
  });

  stopDemoButton?.addEventListener('click', () => {
    audioManager.playSe('cancel');
    window.dispatchEvent(new CustomEvent('boccia:demo-stop'));
  });

  window.addEventListener('boccia:guided-status', (event) => {
    const detail = (event as CustomEvent<{ active: boolean; step: string | null; copy?: { title: string; body: string; highlight: string } | null }>).detail;
    guidedActive = detail.active;

    if (!detail.active || !detail.step || !detail.copy) {
      setControlHighlight(null);
      setLearningStatus('Ready: choose Watch demo or Guided tutorial.');
      return;
    }

    if (detail.step === 'aim') {
      setControlHighlight('aim');
    } else if (detail.step === 'charge' || detail.step === 'release') {
      setControlHighlight('primary');
    } else if (detail.step === 'preview_result' || detail.step === 'complete') {
      setControlHighlight('preview');
    } else {
      setControlHighlight(null);
    }

    setLearningStatus(`${detail.copy.title}: ${detail.copy.body}`);

    if (detail.step === 'complete') {
      completeBocciaTutorial();
    }
  });

  window.addEventListener('boccia:demo-status', (event) => {
    const detail = (event as CustomEvent<{ active: boolean; step: string; stepIndex: number; totalSteps: number; title: string; status: string; slow: boolean }>).detail;
    watchDemoButton && (watchDemoButton.disabled = detail.active);
    slowDemoButton && (slowDemoButton.disabled = detail.active);
    stopDemoButton && (stopDemoButton.disabled = !detail.active);

    if (!detail.active) {
      setLearningStatus(guidedActive ? 'Guided tutorial is active.' : 'Ready: choose Watch demo or Guided tutorial.');
      return;
    }

    const speedLabel = detail.slow ? 'Slow demo' : 'Demo running';
    setLearningStatus(`${speedLabel}: Step ${detail.stepIndex} / ${detail.totalSteps} — ${detail.status}. Ghost graphics do not change the real score.`);
  });

  tchoukballWatchDemoButton?.addEventListener('click', () => {
    audioManager.playSe('select');
    window.dispatchEvent(new CustomEvent('boccia:demo-stop'));
    window.dispatchEvent(new CustomEvent('sport-preview:show', { detail: { sportId: 'tchoukball' } }));
    window.dispatchEvent(new CustomEvent('tchoukball:demo-start', { detail: { slow: false } }));
    markSportPlayed('tchoukball');
    completeMission('tchoukball_watch_demo');
  });

  tchoukballSlowDemoButton?.addEventListener('click', () => {
    audioManager.playSe('select');
    window.dispatchEvent(new CustomEvent('boccia:demo-stop'));
    window.dispatchEvent(new CustomEvent('sport-preview:show', { detail: { sportId: 'tchoukball' } }));
    window.dispatchEvent(new CustomEvent('tchoukball:demo-start', { detail: { slow: true } }));
    markSportPlayed('tchoukball');
    completeMission('tchoukball_watch_demo');
  });

  tchoukballStopDemoButton?.addEventListener('click', () => {
    audioManager.playSe('cancel');
    window.dispatchEvent(new CustomEvent('tchoukball:demo-stop'));
  });

  tchoukballGuidedStepsButton?.addEventListener('click', () => {
    audioManager.playSe('select');
    window.dispatchEvent(new CustomEvent('tchoukball:demo-stop'));
    window.dispatchEvent(new CustomEvent('sport-preview:show', { detail: { sportId: 'tchoukball' } }));
    openTchoukballGuidedSteps();
    markSportPlayed('tchoukball');
    foundationPreviewStatus && (foundationPreviewStatus.textContent = 'Guided steps opened: follow the compact Tchoukball frame, charge, rebound, and landing explanation.');
  });

  window.addEventListener('tchoukball:demo-status', (event) => {
    const detail = (event as CustomEvent<{ active: boolean; stepIndex: number; totalSteps: number; title: string; status: string; slow: boolean }>).detail;
    tchoukballWatchDemoButton && (tchoukballWatchDemoButton.disabled = detail.active);
    tchoukballSlowDemoButton && (tchoukballSlowDemoButton.disabled = detail.active);
    tchoukballStopDemoButton && (tchoukballStopDemoButton.disabled = !detail.active);

    if (!detail.active) {
      foundationPreviewStatus && (foundationPreviewStatus.textContent = 'Ready: choose Watch demo, Slow demo, or Guided steps. Demo graphics do not change the real preview score.');
      return;
    }

    foundationPreviewStatus && (foundationPreviewStatus.textContent = `${detail.slow ? 'Slow demo' : 'Demo running'}: Step ${detail.stepIndex} / ${detail.totalSteps} — ${detail.status}. Ghost graphics do not change the real preview score.`);
  });

  rulesButtons.forEach((button) => {
    button.addEventListener('click', () => {
      audioManager.playSe('select');
      if (rulesPanel) {
        rulesPanel.open = true;
        rulesPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        rulesPanel.focus({ preventScroll: true });
      }
    });
  });

  replayTutorialButtons.forEach((button) => {
    button.addEventListener('click', () => {
      audioManager.playSe('select');
      openBocciaTutorial();
    });
  });

  tchoukballPreviewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      audioManager.playSe('select');
      window.dispatchEvent(new CustomEvent('boccia:demo-stop'));
      window.dispatchEvent(new CustomEvent('tchoukball:demo-stop'));
      window.dispatchEvent(new CustomEvent('sport-preview:show', { detail: { sportId: 'tchoukball' } }));
      markSportPlayed('tchoukball');
      completeMission(getMatchState().mode === 'local_2p' ? 'tchoukball_try_local_2p' : 'tchoukball_try_vs_cpu');
      foundationPreviewStatus && (foundationPreviewStatus.textContent = 'Showing Tchoukball foundation preview: VS CPU uses an automatic reply, while Local 2P lets P2 take the reply; no full match flow yet.');
      document.querySelector('#play')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  bocciaPreviewReturnButtons.forEach((button) => {
    button.addEventListener('click', () => {
      audioManager.playSe('select');
      window.dispatchEvent(new CustomEvent('sport-preview:show', { detail: { sportId: 'boccia' } }));
      foundationPreviewStatus && (foundationPreviewStatus.textContent = 'Back to Boccia. Tchoukball remains a lightweight VS CPU / Local 2P foundation preview without full match flow.');
    });
  });

  tchoukballRulesButtons.forEach((button) => {
    button.addEventListener('click', () => {
      audioManager.playSe('select');
      if (tchoukballRulesPanel) {
        tchoukballRulesPanel.open = true;
        tchoukballRulesPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        tchoukballRulesPanel.focus({ preventScroll: true });
      }
    });
  });

  subscribeProgress((progress) => {
    progressFavorites && (progressFavorites.textContent = String(progress.favorites.length));
    progressRecent && (progressRecent.textContent = sportLabel(progress.recentSports[0]));
    progressMissionsCompleted.forEach((item) => (item.textContent = String(completedMissionCount(progress))));
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
      guidedActive = false;
      setControlHighlight(null);
      window.dispatchEvent(new CustomEvent('boccia:guided-stop'));
      window.dispatchEvent(new CustomEvent('boccia:demo-stop'));
      window.dispatchEvent(new CustomEvent('tchoukball:demo-stop'));
      setMode(mode);
      if (mode === 'local_2p') {
        completeMission('boccia_try_local_2p');
      }
      window.dispatchEvent(new CustomEvent('boccia:retry'));
      window.dispatchEvent(new CustomEvent('tchoukball:retry'));
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

      if (guidedActive && (action === 'start' || action === 'turn' || action === 'retry' || action === 'finish')) {
        setLearningStatus('Guided tutorial is active: use the highlighted controls to continue.');
        audioManager.playSe('cancel');
        return;
      }

      if (action === 'start') {
        window.dispatchEvent(new CustomEvent('boccia:demo-stop'));
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
        window.dispatchEvent(new CustomEvent('boccia:demo-stop'));
        window.dispatchEvent(new CustomEvent('tchoukball:demo-stop'));
        audioManager.playSe('select');
        retryMatch();
        window.dispatchEvent(new CustomEvent('boccia:retry'));
        window.dispatchEvent(new CustomEvent('tchoukball:retry'));
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
