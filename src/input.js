// Touch controls. A fixed joystick steers in both views.
// Top-down: any other touch aims (hold to see the trajectory) and fires on release.
// Third person: a fixed fire button aims/fires (dragging it also turns the camera); any other
// touch drags to turn the camera.

const AIM_MS = 120;  // a touch held this long shows the aim line
const STICK_PX = 60; // knob travel radius
const ZONE = 1.7;    // touches within ZONE × radius of a control's center grab it

export function createInput(el, { stickCenter, fireCenter, mode }) {
  const touches = new Map(); // free touches: { x, y, t0 }
  let stick = null;          // { id, x0, y0, x, y } — x0/y0 is the fixed center
  let fire = null;           // { id, t0 } — third-person fire button
  const fires = [];
  let lookDx = 0;
  let enabled = false;

  const near = (c, e) => c && Math.hypot(e.clientX - c.x, e.clientY - c.y) < STICK_PX * ZONE;

  const down = (e) => {
    if (!enabled) return;
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    if (!stick && near(stickCenter(), e)) {
      const c = stickCenter();
      stick = { id: e.pointerId, x0: c.x, y0: c.y, x: e.clientX, y: e.clientY };
      return;
    }
    if (mode() === 'tps' && !fire && near(fireCenter(), e)) {
      fire = { id: e.pointerId, t0: performance.now(), x: e.clientX };
      return;
    }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY, t0: performance.now() });
  };
  const move = (e) => {
    if (stick && stick.id === e.pointerId) { stick.x = e.clientX; stick.y = e.clientY; return; }
    if (fire && fire.id === e.pointerId) { lookDx += e.clientX - fire.x; fire.x = e.clientX; return; }
    const t = touches.get(e.pointerId);
    if (!t) return;
    if (mode() === 'tps') lookDx += e.clientX - t.x;
    t.x = e.clientX; t.y = e.clientY;
  };
  const up = (e) => {
    if (stick && stick.id === e.pointerId) { stick = null; return; }
    if (fire && fire.id === e.pointerId) { fire = null; fires.push({ forward: true }); return; }
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (mode() !== 'tps') fires.push({ x: e.clientX, y: e.clientY });
  };
  const cancel = (e) => {
    touches.delete(e.pointerId);
    if (stick?.id === e.pointerId) stick = null;
    if (fire?.id === e.pointerId) fire = null;
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);

  return {
    setEnabled(on) { enabled = on; if (!on) { touches.clear(); stick = null; fire = null; fires.length = 0; lookDx = 0; } },
    // Stick in screen terms: x right, z down, length 0..1.
    move() {
      if (!stick) return { x: 0, z: 0 };
      let dx = (stick.x - stick.x0) / STICK_PX, dz = (stick.y - stick.y0) / STICK_PX;
      const l = Math.hypot(dx, dz);
      if (l > 1) { dx /= l; dz /= l; }
      return { x: dx, z: dz };
    },
    takeFire: () => fires.shift() || null,
    // Horizontal camera drag since the last call, in pixels (third person).
    takeLook() { const d = lookDx; lookDx = 0; return d; },
    // Top-down: the newest free touch held long enough to aim. Third person: the held fire button.
    aim() {
      const now = performance.now();
      if (mode() === 'tps') return fire && now - fire.t0 >= AIM_MS ? { forward: true } : null;
      let best = null;
      for (const t of touches.values()) if (now - t.t0 >= AIM_MS && (!best || t.t0 > best.t0)) best = t;
      return best && { x: best.x, y: best.y };
    },
    stick: () => stick,
    firing: () => !!fire,
  };
}
