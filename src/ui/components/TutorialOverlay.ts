import type { TutorialStep } from '../../game/sports/boccia/bocciaTutorial';

interface TutorialOverlayOptions {
  steps: TutorialStep[];
  sportName: string;
  onFinish: () => void;
  onSkip: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setTutorialBlocking(isOpen: boolean): void {
  document.body.toggleAttribute('data-tutorial-open', isOpen);
  window.dispatchEvent(new CustomEvent('tutorial:visibility', { detail: { isOpen } }));
}

export function showTutorialOverlay(options: TutorialOverlayOptions): void {
  if (options.steps.length === 0) {
    options.onFinish();
    return;
  }

  document.querySelector('[data-tutorial-overlay]')?.remove();

  let stepIndex = 0;
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';
  overlay.dataset.tutorialOverlay = 'true';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tutorial-overlay-title');
  overlay.setAttribute('aria-describedby', 'tutorial-overlay-body');

  function close(callback: () => void): void {
    overlay.remove();
    setTutorialBlocking(false);
    callback();
  }

  function render(): void {
    const step = options.steps[stepIndex];
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === options.steps.length - 1;

    overlay.innerHTML = `
      <div class="tutorial-overlay__backdrop" aria-hidden="true"></div>
      <section class="tutorial-overlay__card">
        <p class="tutorial-overlay__eyebrow">${escapeHtml(options.sportName)} tutorial</p>
        <div class="tutorial-overlay__header">
          <h2 id="tutorial-overlay-title">${escapeHtml(step.title)}</h2>
          <span class="tutorial-overlay__count">Step ${stepIndex + 1} / ${options.steps.length}</span>
        </div>
        <p id="tutorial-overlay-body" class="tutorial-overlay__body">${escapeHtml(step.body)}</p>
        <div class="tutorial-overlay__actions">
          <button class="button button--icon" type="button" data-tutorial-action="skip">Skip</button>
          <button class="button button--secondary" type="button" data-tutorial-action="back" ${isFirst ? 'disabled' : ''}>Back</button>
          <button class="button button--primary" type="button" data-tutorial-action="next">${isLast ? 'Finish' : 'Next'}</button>
        </div>
      </section>
    `;

    overlay.querySelector<HTMLButtonElement>('[data-tutorial-action="skip"]')?.addEventListener('click', () => {
      close(options.onSkip);
    });

    overlay.querySelector<HTMLButtonElement>('[data-tutorial-action="back"]')?.addEventListener('click', () => {
      stepIndex = Math.max(0, stepIndex - 1);
      render();
    });

    overlay.querySelector<HTMLButtonElement>('[data-tutorial-action="next"]')?.addEventListener('click', () => {
      if (isLast) {
        close(options.onFinish);
        return;
      }

      stepIndex += 1;
      render();
    });

    overlay.querySelector<HTMLButtonElement>('[data-tutorial-action="next"]')?.focus();
  }

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(options.onSkip);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepIndex = Math.max(0, stepIndex - 1);
      render();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (stepIndex === options.steps.length - 1) {
        close(options.onFinish);
        return;
      }

      stepIndex += 1;
      render();
    }
  });

  setTutorialBlocking(true);
  document.body.append(overlay);
  render();
}
