import type { InputAction, InputSource, InputState } from './types';

type InputListener = (state: InputState) => void;

const actionToStateKey: Record<InputAction, keyof Omit<InputState, 'lastSource'>> = {
  aim_left: 'aimLeft',
  aim_right: 'aimRight',
  primary: 'primary',
  secondary: 'secondary',
  pause: 'pause',
};

const keyBindings: Record<string, InputAction> = {
  a: 'aim_left',
  arrowleft: 'aim_left',
  d: 'aim_right',
  arrowright: 'aim_right',
  ' ': 'primary',
  spacebar: 'primary',
  enter: 'primary',
  shift: 'secondary',
  k: 'secondary',
  escape: 'pause',
  p: 'pause',
};

const inputActions: InputAction[] = ['aim_left', 'aim_right', 'primary', 'secondary', 'pause'];

const initialInputState: InputState = {
  aimLeft: false,
  aimRight: false,
  primary: false,
  secondary: false,
  pause: false,
  lastSource: null,
};

function cloneInputState(state: InputState): InputState {
  return { ...state };
}

class InputManager {
  private readonly keyboardKeysByAction = new Map<InputAction, Set<string>>(
    inputActions.map((action) => [action, new Set<string>()]),
  );

  private readonly listeners = new Set<InputListener>();

  private readonly state: InputState = cloneInputState(initialInputState);

  private readonly virtualActions = new Set<InputAction>();

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.updateKeyboardAction(event, true);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.updateKeyboardAction(event, false);
  };

  private readonly handleWindowBlur = (): void => {
    this.keyboardKeysByAction.forEach((keys) => {
      keys.clear();
    });
    this.virtualActions.clear();
    this.refreshState('keyboard');
  };

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  getInputState(): InputState {
    return cloneInputState(this.state);
  }

  subscribe(listener: InputListener): () => void {
    this.listeners.add(listener);
    listener(this.getInputState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  setVirtualAction(action: InputAction, active: boolean): void {
    if (active) {
      this.virtualActions.add(action);
    } else {
      this.virtualActions.delete(action);
    }

    this.refreshState('virtual');
  }

  cleanup(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.listeners.clear();
  }

  private updateKeyboardAction(event: KeyboardEvent, active: boolean): void {
    const normalizedKey = event.key.toLowerCase();
    const action = keyBindings[normalizedKey];

    if (!action) {
      return;
    }

    event.preventDefault();

    const keys = this.keyboardKeysByAction.get(action);

    if (!keys) {
      return;
    }

    if (active) {
      keys.add(normalizedKey);
    } else {
      keys.delete(normalizedKey);
    }

    this.refreshState('keyboard');
  }

  private refreshState(source: InputSource): void {
    const nextState = this.getInputState();

    inputActions.forEach((action) => {
      const stateKey = actionToStateKey[action];
      nextState[stateKey] = this.isActionActive(action);
    });

    nextState.lastSource = source;

    const changed = (Object.keys(nextState) as Array<keyof InputState>).some(
      (key) => nextState[key] !== this.state[key],
    );

    if (!changed) {
      return;
    }

    Object.assign(this.state, nextState);
    this.notify();
  }

  private isActionActive(action: InputAction): boolean {
    return this.virtualActions.has(action) || (this.keyboardKeysByAction.get(action)?.size ?? 0) > 0;
  }

  private notify(): void {
    const snapshot = this.getInputState();

    this.listeners.forEach((listener) => {
      listener(snapshot);
    });
  }
}

export const inputManager = new InputManager();
