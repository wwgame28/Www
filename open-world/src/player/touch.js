// Сенсорное управление: плавающий джойстик слева, свайп справа — камера, кнопки прыжка и полёта.
const STICK_R = 56; // px, ход ручки джойстика
const RUN_AT = 0.92; // ручка у самого края — бег

export class TouchControls {
  constructor(root, input) {
    this.root = root;
    this.input = input;
    this.surface = root.querySelector('#touch-surface');
    this.stick = root.querySelector('#stick');
    this.knob = root.querySelector('#stick-knob');
    this.btnJump = root.querySelector('#btn-jump');
    this.btnFly = root.querySelector('#btn-fly');
    this.btnDown = root.querySelector('#btn-down');
    this.home = root.querySelector('#stick-home');
    this.stickId = null;
    this.stickOrigin = { x: 0, y: 0 };
    this.looks = new Map();
    this.visible = false;
    this.onFirstUse = null;

    this.surface.addEventListener('pointerdown', (e) => this.onDown(e));
    this.surface.addEventListener('pointermove', (e) => this.onMove(e));
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.surface.addEventListener(t, (e) => this.onUp(e));
    }
    this.hold(this.btnJump, 'jump');
    this.hold(this.btnDown, 'down');
    this.btnFly.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.tapVirtual('fly');
      this.buzz();
    });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resetStick();
  }

  hold(el, action) {
    const on = (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('held');
      this.input.setVirtual(action, true);
      this.buzz();
    };
    const off = () => {
      el.classList.remove('held');
      this.input.setVirtual(action, false);
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
  }

  buzz() {
    if (navigator.vibrate) navigator.vibrate(8);
  }

  setVisible(v) {
    this.visible = v;
    this.root.hidden = !v;
    if (!v) this.releaseAll();
  }

  setFlying(f) {
    this.btnDown.hidden = !f;
    this.btnJump.querySelector('.tbtn-label').textContent = f ? 'Вверх' : 'Прыжок';
    this.btnFly.classList.toggle('on', f);
  }

  onDown(e) {
    e.preventDefault();
    this.surface.setPointerCapture?.(e.pointerId);
    const w = window.innerWidth;
    if (this.stickId === null && e.clientX < w * 0.45) {
      this.stickId = e.pointerId;
      const pad = STICK_R + 12;
      this.stickOrigin.x = Math.max(pad, Math.min(w * 0.45, e.clientX));
      this.stickOrigin.y = Math.max(pad, Math.min(window.innerHeight - pad, e.clientY));
      this.stick.style.transform = `translate(${this.stickOrigin.x}px, ${this.stickOrigin.y}px)`;
      this.stick.classList.add('active');
      this.updateStick(e.clientX, e.clientY);
    } else {
      this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }

  onMove(e) {
    if (e.pointerId === this.stickId) {
      this.updateStick(e.clientX, e.clientY);
      return;
    }
    const last = this.looks.get(e.pointerId);
    if (!last) return;
    this.input.addTouchLook(e.clientX - last.x, e.clientY - last.y);
    last.x = e.clientX;
    last.y = e.clientY;
  }

  onUp(e) {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.resetStick();
    }
    this.looks.delete(e.pointerId);
  }

  updateStick(x, y) {
    let dx = x - this.stickOrigin.x;
    let dy = y - this.stickOrigin.y;
    const l = Math.hypot(dx, dy);
    if (l > STICK_R) {
      dx *= STICK_R / l;
      dy *= STICK_R / l;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = this.input.touchMove;
    m.x = dx / STICK_R;
    m.y = -dy / STICK_R;
    m.run = Math.hypot(m.x, m.y) > RUN_AT;
    this.stick.classList.toggle('run', m.run);
  }

  resetStick() {
    const m = this.input.touchMove;
    m.x = m.y = 0;
    m.run = false;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.stick.classList.remove('active', 'run');
    // в покое джойстик стоит на месте-подсказке (с учётом safe-area, её задаёт CSS)
    const r = this.home.getBoundingClientRect();
    const x = r.width ? r.left + r.width / 2 : 110;
    const y = r.height ? r.top + r.height / 2 : window.innerHeight - 130;
    this.stick.style.transform = `translate(${x}px, ${y}px)`;
  }

  releaseAll() {
    this.stickId = null;
    this.looks.clear();
    this.resetStick();
    this.input.setVirtual('jump', false);
    this.input.setVirtual('down', false);
    for (const b of [this.btnJump, this.btnDown]) b.classList.remove('held');
  }
}
