export type InputAction = 'aim_left' | 'aim_right' | 'primary' | 'secondary' | 'pause';

export type InputSource = 'keyboard' | 'virtual';

export interface InputState {
  aimLeft: boolean;
  aimRight: boolean;
  primary: boolean;
  secondary: boolean;
  pause: boolean;
  lastSource: InputSource | null;
}
