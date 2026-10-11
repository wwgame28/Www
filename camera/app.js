import { analyzeFrame, scoreFrame, pickHint } from './analyze.js';
import { rateFrame } from './openrouter.js';

const $ = (id) => document.getElementById(id);
const video = $('video'), hintEl = $('hint'), arc = $('arc'), scoreNum = $('scoreNum');
const target = $('target'), subject = $('subject'), shutter = $('shutter');
const store = {
  get: (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

let stream = null, roll = null, ema = null, lastHint = '', hintStreak = 0, busy = false;
const AW = 120; // analysis width
const ac = document.createElement('canvas'), actx = ac.getContext('2d', { willReadFrequently: true });

function toast(msg, ms = 2400) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.id); toast.id = setTimeout(() => (t.hidden = true), ms);
}

// Region of the video that is actually visible under object-fit: cover.
function visibleCrop() {
  const vw = video.videoWidth, vh = video.videoHeight;
  const ew = innerWidth, eh = innerHeight;
  const s = Math.max(ew / vw, eh / vh);
  const sw = ew / s, sh = eh / s;
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}

async function start() {
  const err = $('startErr'); err.hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) { err.textContent = 'Камера недоступна в этом браузере.'; err.hidden = false; return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
    });
  } catch (e) {
    err.textContent = e.name === 'NotAllowedError'
      ? 'Доступ к камере запрещён. Разрешите его в Настройки → Safari → Камера.'
      : 'Не удалось включить камеру.';
    err.hidden = false; return;
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  $('start').hidden = true;
  enableTilt();
  loop();
}

function enableTilt() {
  const on = () => addEventListener('deviceorientation', (e) => {
    roll = e.gamma != null && e.beta != null && e.beta > 60 && e.beta < 120 ? e.gamma : null;
  });
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') D.requestPermission().then((r) => r === 'granted' && on()).catch(() => {});
  else if (D) on();
}

let last = 0;
function loop(t = 0) {
  requestAnimationFrame(loop);
  if (t - last < 160 || !video.videoWidth || document.hidden) return;
  last = t;
  const c = visibleCrop();
  ac.width = AW; ac.height = Math.round(AW * c.sh / c.sw);
  actx.drawImage(video, c.sx, c.sy, c.sw, c.sh, 0, 0, ac.width, ac.height);
  const a = analyzeFrame(actx.getImageData(0, 0, ac.width, ac.height).data, ac.width, ac.height);
  // Smooth to avoid flicker.
  if (!ema) ema = { ...a, subject: { ...a.subject } };
  else {
    const k = 0.35;
    ema.meanLuma += (a.meanLuma - ema.meanLuma) * k;
    ema.sharpness += (a.sharpness - ema.sharpness) * k;
    ema.subject.x += (a.subject.x - ema.subject.x) * k;
    ema.subject.y += (a.subject.y - ema.subject.y) * k;
    ema.hasSubject = a.hasSubject;
  }
  const s = scoreFrame(ema, roll);
  const h = pickHint(ema, s, roll);
  render(s, h);
}

function render(s, h) {
  scoreNum.textContent = s.score;
  arc.style.strokeDashoffset = 119.4 * (1 - s.score / 100);
  arc.style.stroke = s.score >= 75 ? 'var(--good)' : s.score >= 50 ? 'var(--accent)' : 'var(--warn)';
  // Only change the hint text once it is stable for 3 frames.
  if (h.id === lastHint) hintStreak++; else { lastHint = h.id; hintStreak = 0; }
  if (hintStreak === 2) {
    hintEl.textContent = h.text;
    hintEl.className = 'hint' + (h.id === 'good' ? ' good' : ['dark', 'bright', 'blur', 'tilt'].includes(h.id) ? ' warn' : '');
  }
  shutter.classList.toggle('ready', h.id === 'good');
  const showPan = ema.hasSubject && ['pan', 'tiltcam'].includes(h.id);
  target.classList.toggle('on', showPan);
  subject.classList.toggle('on', ema.hasSubject);
  target.style.left = s.target.x * 100 + '%'; target.style.top = s.target.y * 100 + '%';
  subject.style.left = ema.subject.x * 100 + '%'; subject.style.top = ema.subject.y * 100 + '%';
}

function frameBlob(maxSide) {
  const c = visibleCrop();
  const k = Math.min(1, maxSide / Math.max(c.sw, c.sh));
  const cv = document.createElement('canvas');
  cv.width = Math.round(c.sw * k); cv.height = Math.round(c.sh * k);
  cv.getContext('2d').drawImage(video, c.sx, c.sy, c.sw, c.sh, 0, 0, cv.width, cv.height);
  return cv;
}

async function takePhoto() {
  if (!video.videoWidth) return;
  const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  navigator.vibrate?.(15);
  const cv = frameBlob(4096);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.92));
  const file = new File([blob], `kadr-${Date.now()}.jpg`, { type: 'image/jpeg' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Снимок сохранён');
}

let abort = null;
async function aiRate() {
  const key = store.get('or_key');
  if (!key) { openSettings(); toast('Сначала введите ключ OpenRouter'); return; }
  if (busy) return;
  busy = true; $('aiBtn').disabled = true;
  const dataUrl = frameBlob(768).toDataURL('image/jpeg', 0.8);
  const sheet = $('sheet');
  $('aiScore').textContent = '--'; $('sheetTitle').textContent = 'Оцениваю кадр…'; $('aiTips').replaceChildren();
  sheet.hidden = false;
  abort = new AbortController();
  try {
    const r = await rateFrame({ key, model: store.get('or_model', DEFAULT_MODEL) || DEFAULT_MODEL, dataUrl, signal: abort.signal });
    $('aiScore').textContent = r.score; $('sheetTitle').textContent = r.verdict || 'Готово';
    $('aiTips').replaceChildren(...r.tips.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  } catch (e) {
    if (e.name === 'AbortError') return;
    $('sheetTitle').textContent = e.message || 'Не удалось получить оценку';
  } finally { busy = false; $('aiBtn').disabled = false; }
}

function openSettings() {
  $('keyInput').value = store.get('or_key');
  $('modelInput').value = store.get('or_model', DEFAULT_MODEL) || DEFAULT_MODEL;
  $('settings').hidden = false;
}

$('startBtn').onclick = start;
shutter.onclick = takePhoto;
$('aiBtn').onclick = aiRate;
$('settingsBtn').onclick = openSettings;
$('setClose').onclick = () => ($('settings').hidden = true);
$('sheetClose').onclick = () => { abort?.abort(); $('sheet').hidden = true; };
$('saveSet').onclick = () => {
  store.set('or_key', $('keyInput').value.trim());
  store.set('or_model', $('modelInput').value.trim() || DEFAULT_MODEL);
  $('settings').hidden = true; toast('Сохранено');
};
$('clearKey').onclick = () => { store.del('or_key'); $('keyInput').value = ''; toast('Ключ удалён'); };
document.addEventListener('visibilitychange', () => { if (!document.hidden && stream && video.paused) video.play(); });
