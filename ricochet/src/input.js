// Floating joystick (touch + drag anywhere) and quick taps to fire. Multitouch: one finger
// can steer while another taps.

const TAP_MS = 220;
const TAP_PX = 14;
const STICK_PX = 60;

export function createInput(el) {
  const touches = new Map();
  let stick = null; // { id, x0, y0, x, y }
  const fires = [];
  let enabled = false;

  const down = (e) => {
    if (!enabled) return;
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    touches.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false });
  };
  const move = (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const dx = e.clientX - t.x0, dy = e.clientY - t.y0;
    if (!t.moved && Math.hypot(dx, dy) > TAP_PX) {
      t.moved = true;
      if (!stick) stick = { id: e.pointerId, x0: t.x0, y0: t.y0, x: e.clientX, y: e.clientY };
    }
    if (stick && stick.id === e.pointerId) { stick.x = e.clientX; stick.y = e.clientY; }
  };
  const up = (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (stick && stick.id === e.pointerId) stick = null;
    else if (!t.moved && performance.now() - t.t0 < TAP_MS) fires.push({ x: e.clientX, y: e.clientY });
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', (e) => { touches.delete(e.pointerId); if (stick?.id === e.pointerId) stick = null; });

  return {
    setEnabled(on) { enabled = on; if (!on) { touches.clear(); stick = null; fires.length = 0; } },
    // Screen right → world +x, screen down → world +z (the camera never rotates around y).
    move() {
      if (!stick) return { x: 0, z: 0 };
      let dx = (stick.x - stick.x0) / STICK_PX, dz = (stick.y - stick.y0) / STICK_PX;
      const l = Math.hypot(dx, dz);
      if (l > 1) { dx /= l; dz /= l; }
      return { x: dx, z: dz };
    },
    takeFire: () => fires.shift() || null,
    stick: () => stick,
  };
}
