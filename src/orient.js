// Portrait lock for phones. iOS Safari can't lock the screen's orientation from a web page, so when
// the phone turns sideways the whole page turns back: the game stays upright the way the phone is
// held, like an app locked to portrait. Touches arrive in screen coordinates; toLocal() maps them
// into the game's own (portrait) frame, and size() is that frame's size.
const touch = matchMedia('(pointer: coarse)');
let turn = 0;                     // the game frame's rotation on screen: 0, -90 or 90 degrees
let vw = innerWidth, vh = innerHeight; // the screen when turn was set

export function updateOrientation() {
  vw = innerWidth; vh = innerHeight;
  const sideways = touch.matches && vw > vh && vh <= 520; // a phone held sideways (not a tablet or a PC)
  // Device angle, positive counterclockwise (iOS still has window.orientation; others the Screen API).
  const a = typeof window.orientation === 'number' ? window.orientation : screen.orientation?.angle ?? 90;
  turn = !sideways ? 0 : ((a % 360) + 360) % 360 === 90 ? -90 : 90; // turned left → the game turns right back
  const root = document.documentElement, s = document.body.style;
  root.classList.toggle('turned', turn !== 0);
  root.dataset.turn = String(turn); // CSS swaps the safe areas to match
  if (!turn) { s.width = s.height = s.transform = ''; return; }
  s.width = `${vh}px`; s.height = `${vw}px`;
  s.transform = turn === -90 ? `translateY(${vh}px) rotate(-90deg)` : `translateX(${vw}px) rotate(90deg)`;
}

export const turned = () => turn !== 0;
export const size = () => (turn ? { w: vh, h: vw } : { w: innerWidth, h: innerHeight });
export function toLocal(x, y) {
  if (turn === -90) return { x: vh - y, y: x };
  if (turn === 90) return { x: y, y: vw - x };
  return { x, y };
}
