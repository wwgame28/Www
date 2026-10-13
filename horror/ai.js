// «Плотность»: ИИ через OpenRouter — режиссёр страха, голос Ани в рации и эпилог.
// Ключ хранится только в localStorage этого браузера; без ключа работают заготовки ниже.

export const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OR_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const DEFAULT_MODEL = 'google/gemini-2.5-flash';
export const EVENTS = ['none', 'whisper', 'knock', 'shift', 'approach', 'retreat', 'mirror', 'glitch'];
export const ROOM_KEYS = ['hall', 'kitchen', 'zal', 'bath', 'child'];
const STORE = 'plotnost.ai';

export function loadSettings(storage = globalThis.localStorage) {
  const base = { key: '', model: DEFAULT_MODEL, tts: true };
  try { return { ...base, ...JSON.parse(storage.getItem(STORE) || '{}') }; } catch { return base; }
}
export function saveSettings(s, storage = globalThis.localStorage) {
  try { storage.setItem(STORE, JSON.stringify({ key: s.key, model: s.model, tts: s.tts })); } catch { /* приватный режим */ }
}

export async function chat({ key, model, messages, maxTokens = 300, temperature = 0.9, timeoutMs = 20000, fetchImpl = globalThis.fetch }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(OR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Title': 'Plotnost lidar horror' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, reasoning: { effort: 'low', exclude: true } }),
      signal: ctl.signal,
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
    let text = data?.choices?.[0]?.message?.content;
    if (Array.isArray(text)) text = text.map((p) => p?.text || '').join('');
    if (typeof text !== 'string' || !text.trim()) throw new Error('пустой ответ модели');
    return text.trim();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('модель не ответила за 20 с');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Ответ режиссёра → {event, text, target}; всё лишнее отбрасывается.
export function parseDirective(raw) {
  if (typeof raw !== 'string') return null;
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  let obj;
  try { obj = JSON.parse(raw.slice(a, b + 1)); } catch { return null; }
  const event = String(obj.event || '').toLowerCase();
  if (!EVENTS.includes(event)) return null;
  const text = typeof obj.text === 'string' ? obj.text.replace(/\s+/g, ' ').trim().slice(0, 140) : '';
  const target = ROOM_KEYS.includes(obj.target) ? obj.target : null;
  if (event === 'whisper' && !text) return null;
  return { event, text, target };
}

// Реплики модели иногда приходят в кавычках или с ремарками — чистим.
export function cleanLine(raw) {
  const t = String(raw || '').replace(/\*[^*]*\*/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  return t.replace(/^["«„']+|["»“']+$/g, '').trim().slice(0, 240);
}

const DIRECTOR_SYSTEM = `Ты — невидимый режиссёр хоррор-игры «Плотность». Игрок ищет пропавшую сестру Аню в тёмной хрущёвке. Света нет: игрок видит только облако точек от лидар-сканера, и точки со временем гаснут. В квартире живёт Жилец — лидар его не видит, на его месте в облаке остаётся дыра. Жилец идёт на звук сканера и рации.
Комнаты: hall (прихожая, там выход), kitchen (кухня), zal (зал), bath (ванная с зеркалом), child (детская, которой «нет на плане»).
Твоя задача — дозировать страх. Чередуй затишье и напряжение, не пугай слишком часто, реагируй на действия игрока и на то, что он говорит Ане по рации. Нельзя делать игру нечестной: не гони Жильца на игрока, если тот и так охотится.
Выбери ОДНО событие:
- none — тишина (часто лучший выбор);
- whisper — шёпот Ани или чужой голос в рации; text — до 12 слов по-русски, не называй пол игрока;
- knock — стук в комнате target;
- shift — мебель тихо сдвигается, и старое облако точек начинает врать;
- approach — Жилец подкрадывается в соседнюю с игроком комнату;
- retreat — Жилец уходит подальше;
- mirror — в зеркале ванной кто-то появляется (только если прочитано хотя бы 2 записки);
- glitch — облако точек на секунду дрожит.
Ответь только JSON без пояснений: {"event":"...","text":"...","target":"..."}`;

const SISTER_SYSTEM = `Ты — Аня, 24 года. Месяц назад ты пропала в своей квартире-хрущёвке. Сейчас ты говоришь через треснувшую рацию лидар-сканера с родным человеком, который пришёл тебя искать (брат или сестра — пол не угадывай, говори нейтрально, без глаголов прошедшего времени с родом).
Ты застряла «по ту сторону облака» — в квартире, которая отражается в зеркале ванной. Ты напугана, устала, сбиваешься. Ты знаешь квартиру: прихожая, кухня, зал, ванная с зеркалом и детская, которой «никогда не было». Ты знаешь, что Жилец идёт на звук сканера и рации, а видно его только как дыру в точках. Ты оставила 4 записки (кухонный стол, журнальный столик в зале, раковина в ванной, кровать в детской) и помогаешь их найти, но иногда путаешься, и непонятно, всегда ли это ты.
Никогда не признавай, что ты ИИ или персонаж игры. Отвечай по-русски, 1–2 короткие фразы, можно с обрывами «...», без эмодзи, без ремарок в скобках и звёздочках.`;

const EPILOGUE_SYSTEM = `Ты пишешь эпилог хоррор-игры «Плотность» про поиск пропавшей сестры Ани в тёмной квартире с лидар-сканером и про Жильца, которого лидар не видит. Напиши 2–3 предложения по-русски, во втором лице, тревожно и без хэппи-энда в лоб. Не указывай пол игрока: никаких глаголов прошедшего времени с родом («ты нашёл/нашла») и прилагательных с родом о нём.`;

export function describeState(s) {
  return `Время в игре: ${s.t} с. Игрок в комнате: ${s.room}. Прочитано записок: ${s.notesRead} из 4. Выход ${s.doorOpen ? 'открыт' : 'заперт'}. Шум сканера сейчас: ${s.noise}. Жилец: ${s.monster}. Заряд сканера: ${s.battery}%.`;
}

export function directorMessages(state, recent) {
  const lines = [describeState(state)];
  if (recent.radio.length) lines.push(`Игрок недавно говорил Ане: ${recent.radio.map((r) => `«${r}»`).join(' ')}`);
  if (recent.events.length) lines.push(`Последние события: ${recent.events.join(', ')}.`);
  if (state.trigger) lines.push(`Только что: ${state.trigger}.`);
  return [{ role: 'system', content: DIRECTOR_SYSTEM }, { role: 'user', content: lines.join('\n') }];
}

export function sisterMessages(state, dialog) {
  return [
    { role: 'system', content: SISTER_SYSTEM },
    { role: 'system', content: `Что ты чувствуешь сейчас: ${describeState(state)}` },
    ...dialog.slice(-12),
  ];
}

export function epilogueMessages(summary) {
  return [{ role: 'system', content: EPILOGUE_SYSTEM }, { role: 'user', content: summary }];
}

// Заготовки на случай, когда ключа нет или сеть упала.
export const FALLBACK_WHISPERS = [
  '...не включай свет...',
  'Он слышит щелчки.',
  'Я на кухне. Нет. Я не знаю, где я.',
  'Не стой у зеркала долго.',
  'Диван был там? Посмотри ещё раз.',
  'Тише... тише...',
  'Стены дышат. Слышно?',
  'Я оставила записки. Ищи жёлтое.',
];
export const FALLBACK_REPLIES = [
  '...шшш... не слышу... сканируй тише...',
  'Записки... я оставляла записки...',
  'Кто это? ...а. Это ты.',
  'Не отвечай, если позовут из детской.',
  'Он рядом с тобой. Или со мной. Здесь трудно понять.',
];
export const FALLBACK_EPILOGUE = {
  win: 'Дверь закрывается за спиной, и в подъезде горит лампочка. Сканер в руке ещё щёлкает сам по себе. На экране — облако точек: в нём кто-то стоит у зеркала и машет тебе.',
  death: 'Последний скан ложится на стену ровно, без единой дыры. Теперь в квартире двое, кого лидар не видит. Аня больше не одна.',
};
