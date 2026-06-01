import { inputManager } from '../../input/inputManager';
import type { InputAction } from '../../input/types';

const virtualButtons: ReadonlyArray<{ action: InputAction; label: string; ariaLabel: string }> = [
  { action: 'aim_left', label: 'Aim Left', ariaLabel: 'Hold to aim left' },
  { action: 'aim_right', label: 'Aim Right', ariaLabel: 'Hold to aim right' },
  { action: 'primary', label: 'Primary', ariaLabel: 'Hold primary action' },
  { action: 'secondary', label: 'Secondary', ariaLabel: 'Hold secondary action placeholder' },
  { action: 'pause', label: 'Pause', ariaLabel: 'Hold pause action' },
];

export function VirtualControls(): string {
  return `
    <div class="virtual-controls" role="group" aria-label="Mobile virtual gameplay controls">
      ${virtualButtons
        .map(
          ({ action, label, ariaLabel }) => `
            <button
              class="virtual-controls__button"
              type="button"
              data-virtual-input-action="${action}"
              aria-label="${ariaLabel}"
            >
              ${label}
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}

export function setupVirtualControls(root: HTMLElement): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-virtual-input-action]'));

  buttons.forEach((button) => {
    const action = button.dataset.virtualInputAction as InputAction | undefined;

    if (!action) {
      return;
    }

    const setPressed = (active: boolean): void => {
      button.classList.toggle('virtual-controls__button--pressed', active);
      button.setAttribute('aria-pressed', String(active));
      inputManager.setVirtualAction(action, active);
    };

    button.setAttribute('aria-pressed', 'false');

    button.addEventListener('pointerdown', (event) => {
      button.setPointerCapture(event.pointerId);
      setPressed(true);
    });

    button.addEventListener('pointerup', () => {
      setPressed(false);
    });

    button.addEventListener('pointercancel', () => {
      setPressed(false);
    });

    button.addEventListener('pointerleave', (event) => {
      if (event.buttons > 0) {
        setPressed(false);
      }
    });

    button.addEventListener('blur', () => {
      setPressed(false);
    });
  });
}
