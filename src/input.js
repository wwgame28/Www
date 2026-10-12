// Touch controls. A fixed joystick steers in both views.
// Top-down: any other touch aims (hold to see the trajectory) and fires on release.
// Third person: a fixed fire button aims/fires (dragging it sideways also turns the camera, dragging
// it down cancels the shot); any other touch drags to turn the camera.

const AIM_MS = 120;   // a touch held this long shows the aim line
const STICK_PX = 60;  // knob travel radius
const ZONE = 1.7;     // touches within ZONE × radius of the stick's center grab it
const DEAD_PX = 8;    // stick dead zone…
const FULL_PX = 42;   // …and the deflection that already means full speed
const FIRE_GRAB = 70; // fire button grab radius (smaller than before: fewer shots by accident)
const CANCEL_PX = 80; // dragging the fire button this far down cancels the shot (back up re-arms it)
const EDGE_PX = 28;   // a turning finger held this close to a screen edge keeps turning
// Turning gets faster with finger speed: precise when slow, a quick flick turns around.
const LOOK_SLOW = 0.005, LOOK_FAST = 0.011; // rad per px at ≤ 400 px/s and ≥ 1600 px/s

// toLocal maps a touch's screen point into the game's frame and size() gives that frame (they differ
// from the screen while orient.js keeps the game upright on a phone turned sideways).
export function createInput(el, { stickCenter, fireCenter, recallCenter = () => null, mode, toLocal = (x, y) => ({ x, y }), size = () => ({ w: innerWidth, h: innerHeight }) }) {
  const touches = new Map(); // free touches: { x, y, x0, t0, tm }
  let stick = null;          // { id, x0, y0, x, y } — x0/y0 is the fixed center
  let fire = null;           // { id, t0, tm, x, x0, y0, cancel } — third-person fire button
  const fires = [];
  let look = 0;              // camera turn since the last takeLook(), radians
  let recallId = null, recalls = 0; // top-down ↩ button
  let enabled = false;

  const at = (e) => toLocal(e.clientX, e.clientY);
  const near = (c, q, r) => c && Math.hypot(q.x - c.x, q.y - c.y) < r;
  function turn(dx, now, before) {
    const k = Math.min(1, Math.max(0, (Math.abs(dx) / Math.max(1e-3, (now - before) / 1000) - 400) / 1200));
    look += dx * (LOOK_SLOW + (LOOK_FAST - LOOK_SLOW) * k * k * (3 - 2 * k));
  }

  const down = (e) => {
    if (!enabled) return;
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    const now = performance.now(), q = at(e);
    if (!stick && near(stickCenter(), q, STICK_PX * ZONE)) {
      const c = stickCenter();
      stick = { id: e.pointerId, x0: c.x, y0: c.y, x: q.x, y: q.y };
      return;
    }
    if (mode() !== 'tps' && near(recallCenter(), q, 56)) { recallId = e.pointerId; return; }
    if (mode() === 'tps' && !fire && near(fireCenter(), q, FIRE_GRAB)) {
      fire = { id: e.pointerId, t0: now, tm: now, x: q.x, x0: q.x, y0: q.y, cancel: false };
      return;
    }
    touches.set(e.pointerId, { x: q.x, y: q.y, x0: q.x, t0: now, tm: now });
  };
  const move = (e) => {
    const now = performance.now(), q = at(e);
    if (stick && stick.id === e.pointerId) { stick.x = q.x; stick.y = q.y; return; }
    if (fire && fire.id === e.pointerId) {
      turn(q.x - fire.x, now, fire.tm);
      fire.x = q.x; fire.tm = now;
      fire.cancel = q.y - fire.y0 > CANCEL_PX;
      return;
    }
    const t = touches.get(e.pointerId);
    if (!t) return;
    if (mode() === 'tps') turn(q.x - t.x, now, t.tm);
    t.x = q.x; t.y = q.y; t.tm = now;
  };
  const up = (e) => {
    if (stick && stick.id === e.pointerId) { stick = null; return; }
    if (recallId === e.pointerId) { recallId = null; recalls++; return; }
    if (fire && fire.id === e.pointerId) { if (!fire.cancel) fires.push({ forward: true }); fire = null; return; }
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (mode() !== 'tps') fires.push(at(e));
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
    // keepStick: a finger still on the stick keeps steering after the perk screen closes.
    setEnabled(on, { keepStick = false } = {}) {
      enabled = on;
      if (!on) { touches.clear(); fire = null; fires.length = 0; look = 0; recallId = null; recalls = 0; if (!keepStick) stick = null; }
    },
    // Stick in screen terms: x right, z down, length 0..1.
    move() {
      if (!stick) return { x: 0, z: 0 };
      const dx = stick.x - stick.x0, dz = stick.y - stick.y0, l = Math.hypot(dx, dz);
      if (l < DEAD_PX) return { x: 0, z: 0 };
      const k = Math.min(1, (l - DEAD_PX) / (FULL_PX - DEAD_PX)) / l;
      return { x: dx * k, z: dz * k };
    },
    takeFire: () => fires.shift() || null,
    takeRecall() { const r = recalls > 0; recalls = 0; return r; },
    // Camera turn since the last call, in radians (third person).
    takeLook() { const d = look; look = 0; return d; },
    // −1 / 1 while a turning finger that has moved rests at the left / right screen edge.
    edgeTurn() {
      if (mode() !== 'tps') return 0;
      for (const p of [fire, ...touches.values()]) {
        if (!p || Math.abs(p.x - p.x0) < 12) continue;
        if (p.x < EDGE_PX) return -1;
        if (p.x > size().w - EDGE_PX) return 1;
      }
      return 0;
    },
    // Top-down: the newest free touch held long enough to aim. Third person: the held fire button.
    aim() {
      const now = performance.now();
      if (mode() === 'tps') return fire && !fire.cancel && now - fire.t0 >= AIM_MS ? { forward: true } : null;
      let best = null;
      for (const t of touches.values()) if (now - t.t0 >= AIM_MS && (!best || t.t0 > best.t0)) best = t;
      return best && { x: best.x, y: best.y };
    },
    stick: () => stick,
    firing: () => !!fire,
    cancelling: () => !!fire?.cancel,
  };
}
