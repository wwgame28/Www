// Fixed on-screen joystick plus quick taps anywhere else to fire. Multitouch: one finger can
// steer while another taps.

const TAP_MS = 220;
const TAP_PX = 14;
const STICK_PX = 60;   // knob travel radius
const ZONE = 1.7;      // touches within ZONE × STICK_PX of the center grab the stick

export function createInput(el, getStickCenter) {
  const touches = new Map();
  let stick = null; // { id, x0, y0, x, y } — x0/y0 is the fixed center
  const fires = [];
  let enabled = false;

  const down = (e) => {
    if (!enabled) return;
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    const c = getStickCenter();
    if (!stick && c && Math.hypot(e.clientX - c.x, e.clientY - c.y) < STICK_PX * ZONE) {
      stick = { id: e.pointerId, x0: c.x, y0: c.y, x: e.clientX, y: e.clientY };
      return;
    }
    touches.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false });
  };
  const move = (e) => {
    if (stick && stick.id === e.pointerId) { stick.x = e.clientX; stick.y = e.clientY; return; }
    const t = touches.get(e.pointerId);
    if (t && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > TAP_PX) t.moved = true;
  };
  const up = (e) => {
    if (stick && stick.id === e.pointerId) { stick = null; return; }
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (!t.moved && performance.now() - t.t0 < TAP_MS) fires.push({ x: e.clientX, y: e.clientY });
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
