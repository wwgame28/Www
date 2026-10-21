// Единый ввод: клавиатура, мышь (pointer lock), геймпад и экранные кнопки → абстрактные действия.
// Клавиши — по e.code, поэтому WASD работает и в русской раскладке.
import { CONFIG } from '../config.js';

const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  down: ['KeyC', 'ControlLeft', 'ControlRight'],
  fly: ['KeyF'],
  pause: ['Escape', 'KeyP'],
  debug: ['Backquote', 'F3'],
};
const GAME_KEYS = new Set(Object.values(BINDINGS).flat());
const DEAD = 0.18;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedKeys = new Set();
    this.virtualHeld = new Set();
    this.virtualPressed = new Set();
    this.padHeld = new Set();
    this.look = { dx: 0, dy: 0 };
    this.analog = { x: 0, y: 0, run: false };
    this.touchMove = { x: 0, y: 0, run: false };
    this.enabled = false;
    this.locked = false;
    this.sensitivity = 1;
    this.invertY = false;
    this.usingTouch = false;
    this.pad = { prev: [], active: false };
    this.onLockChange = null;
    this.onLockError = null;
    this.onAnyGesture = null;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.onLockError?.());
    const gesture = (e) => {
      if (e.pointerType === 'touch') this.usingTouch = true;
      this.onAnyGesture?.(e);
    };
    window.addEventListener('pointerdown', gesture, { capture: true });
    window.addEventListener('keydown', gesture, { capture: true });
  }

  onKey(e, isDown) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (isDown) {
      if (!this.down.has(e.code)) this.pressedKeys.add(e.code);
      this.down.add(e.code);
      if (!e.repeat) this.usingTouch = false;
    } else {
      this.down.delete(e.code);
    }
    if (this.enabled && GAME_KEYS.has(e.code) && e.code !== 'Escape') e.preventDefault();
  }

  onMouseMove(e) {
    if (!this.enabled || !this.locked) return;
    // защита от известного скачка movementX сразу после захвата курсора
    if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
    const k = CONFIG.player.look.mouse * this.sensitivity;
    this.look.dx += e.movementX * k;
    this.look.dy += e.movementY * k * (this.invertY ? -1 : 1);
  }

  addTouchLook(dx, dy) {
    const k = CONFIG.player.look.touch * this.sensitivity;
    this.look.dx += dx * k;
    this.look.dy += dy * k * (this.invertY ? -1 : 1);
  }

  setVirtual(action, on) {
    if (on && !this.virtualHeld.has(action)) this.virtualPressed.add(action);
    if (on) this.virtualHeld.add(action);
    else this.virtualHeld.delete(action);
  }

  tapVirtual(action) {
    this.virtualPressed.add(action);
  }

  held(action) {
    if (this.virtualHeld.has(action) || this.padHeld.has(action)) return true;
    if (action === 'run' && (this.analog.run || this.touchMove.run)) return true;
    const keys = BINDINGS[action];
    for (let i = 0; i < keys.length; i++) if (this.down.has(keys[i])) return true;
    return false;
  }

  pressed(action) {
    if (this.virtualPressed.has(action)) return true;
    const keys = BINDINGS[action];
    for (let i = 0; i < keys.length; i++) if (this.pressedKeys.has(keys[i])) return true;
    return false;
  }

  // Вектор движения: x — вправо, y — вперёд, длина не больше 1
  moveVector(out) {
    let x = 0;
    let y = 0;
    if (this.held('right')) x += 1;
    if (this.held('left')) x -= 1;
    if (this.held('forward')) y += 1;
    if (this.held('back')) y -= 1;
    x += this.analog.x + this.touchMove.x;
    y += this.analog.y + this.touchMove.y;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    out.x = x;
    out.y = y;
    return out;
  }

  pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) gp = gp || p;
    if (!gp) {
      if (this.pad.active) {
        this.analog.x = this.analog.y = 0;
        this.analog.run = false;
        this.padHeld.clear();
        this.pad.active = false;
      }
      return;
    }
    this.pad.active = true;
    const ax = (i) => {
      const v = gp.axes[i] || 0;
      return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD);
    };
    this.analog.x = ax(0);
    this.analog.y = -ax(1);
    const k = CONFIG.player.look.gamepad * this.sensitivity * dt;
    this.look.dx += ax(2) * k;
    this.look.dy += ax(3) * k * (this.invertY ? -1 : 1);
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const edge = (i) => btn(i) && !this.pad.prev[i];
    this.analog.run = btn(10) || btn(4);
    this.padHeld.clear();
    if (btn(0)) this.padHeld.add('jump');
    if (btn(1) || btn(6)) this.padHeld.add('down');
    if (edge(0)) this.virtualPressed.add('jump');
    if (edge(3)) this.virtualPressed.add('fly');
    if (edge(9)) this.virtualPressed.add('pause');
    if (edge(8)) this.virtualPressed.add('debug');
    for (let i = 0; i < gp.buttons.length; i++) this.pad.prev[i] = btn(i);
  }

  requestLock() {
    if (this.usingTouch || !this.canvas.requestPointerLock) return Promise.resolve(false);
    try {
      const r = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (r && r.catch) {
        return r.then(
          () => true,
          () => {
            // unadjustedMovement поддерживается не везде — пробуем без него
            const r2 = this.canvas.requestPointerLock();
            return r2 && r2.then ? r2.then(() => true, () => false) : true;
          },
        );
      }
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  endFrame() {
    this.pressedKeys.clear();
    this.virtualPressed.clear();
    this.look.dx = 0;
    this.look.dy = 0;
  }

  clear() {
    this.down.clear();
    this.pressedKeys.clear();
    this.virtualHeld.clear();
    this.virtualPressed.clear();
    this.touchMove.x = this.touchMove.y = 0;
    this.touchMove.run = false;
  }
}
