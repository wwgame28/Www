// «Задания дня»: three small goals a day — one for any mode, one for the arcade, one for the
// «Приключение» — the same for everybody on a date. Game events count toward them; a finished task is
// claimed for coins, and when all three are claimed the chest opens: it grows with the streak of days
// in a row. Pure (no DOM): it reads and changes data.dayTasks (data.daily holds the daily challenge's
// records) and data.coins.
import { createRng, todayKey } from './rng.js';

const ru = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};

export const TASKS = [
  { id: 'kills', pool: 'any', icon: '💀', goals: [25, 40, 60], coins: 40, text: (n) => `Победи ${n} ${ru(n, 'скелета', 'скелетов', 'скелетов')}` },
  { id: 'combo', pool: 'any', icon: '🔥', goals: [3, 4], coins: 50, text: (n) => `Убей ${n} ${ru(n, 'врага', 'врагов', 'врагов')} одним броском` },
  { id: 'waves', pool: 'arcade', icon: '🌊', goals: [3, 5, 7], coins: 50, text: (n) => `Пройди ${n} ${ru(n, 'волну', 'волны', 'волн')} в аркаде` },
  { id: 'runs', pool: 'arcade', icon: '🎮', goals: [2, 3], coins: 30, text: (n) => `Сыграй ${n} ${ru(n, 'забег', 'забега', 'забегов')} в аркаде` },
  { id: 'steps', pool: 'story', icon: '🗺', goals: [2, 3, 4], coins: 60, text: (n) => `Выполни ${n} ${ru(n, 'шаг', 'шага', 'шагов')} заданий в «Приключении»` },
  { id: 'storyKills', pool: 'story', icon: '⚔️', goals: [10, 20], coins: 50, text: (n) => `Победи ${n} ${ru(n, 'врага', 'врагов', 'врагов')} в «Приключении»` },
];
export const POOLS = ['any', 'arcade', 'story'];
export const CHEST = { base: 100, perDay: 20, days: 7 }; // day 1: 100, then +20 a day up to day 7

export const getTask = (id) => TASKS.find((t) => t.id === id) || null;
export const taskText = (t) => getTask(t.id)?.text(t.goal) || '';
export const dayStreak = (n) => `${n} ${ru(n, 'день', 'дня', 'дней')}`;

export function yesterday(key) {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d - 1));
}

// The three tasks of a date.
export function tasksFor(dateKey) {
  const rng = createRng(`tasks:${dateKey}`);
  return POOLS.map((pool) => {
    const t = rng.pick(TASKS.filter((x) => x.pool === pool));
    return { id: t.id, goal: rng.pick(t.goals), coins: t.coins };
  });
}

export const blankTasks = () => ({ date: '', list: [], chest: false, streak: 0, last: '' });

// Today's state: a new date brings new tasks (the streak stays until a day is missed).
export function today(data, dateKey) {
  if (data.dayTasks?.date !== dateKey) {
    data.dayTasks = { ...blankTasks(), ...data.dayTasks, date: dateKey, chest: false, list: tasksFor(dateKey).map((t) => ({ ...t, n: 0, claimed: false })) };
  }
  return data.dayTasks;
}

// A game event counted for today: kind is a task id; combo keeps the best value, the others add up.
// Returns the tasks this finished (for a toast).
export function track(data, dateKey, kind, value = 1) {
  const done = [];
  for (const t of today(data, dateKey).list) {
    if (t.id !== kind || t.n >= t.goal) continue;
    t.n = Math.min(t.goal, kind === 'combo' ? Math.max(t.n, value) : t.n + value);
    if (t.n >= t.goal) done.push(t);
  }
  return done;
}

export const isDone = (t) => t.n >= t.goal;
export const chestReady = (day) => !day.chest && day.list.length > 0 && day.list.every((t) => t.claimed);
// Rewards waiting for a tap (the menu button shows a dot).
export const waiting = (data, dateKey) => { const day = today(data, dateKey); return day.list.filter((t) => isDone(t) && !t.claimed).length + (chestReady(day) ? 1 : 0); };

// mult: ×2 for watching an ad (monetize.js), else 1.
export function claim(data, dateKey, id, mult = 1) {
  const t = today(data, dateKey).list.find((x) => x.id === id);
  if (!t || !isDone(t) || t.claimed) return { ok: false };
  t.claimed = true;
  const coins = t.coins * mult;
  data.coins += coins;
  return { ok: true, coins };
}

export const chestCoins = (streak) => CHEST.base + CHEST.perDay * (Math.min(CHEST.days, Math.max(1, streak)) - 1);
// The streak shown today: alive while the chest was opened today or yesterday.
export const streakNow = (data, dateKey) => { const d = data.dayTasks; return d && (d.last === dateKey || d.last === yesterday(dateKey)) ? d.streak : 0; };

export function openChest(data, dateKey, mult = 1) {
  const day = today(data, dateKey);
  if (!chestReady(day)) return { ok: false };
  day.streak = day.last === yesterday(dateKey) ? day.streak + 1 : 1;
  day.last = dateKey;
  day.chest = true;
  const coins = chestCoins(day.streak) * mult;
  data.coins += coins;
  return { ok: true, coins, streak: day.streak };
}

// Repairs a saved state (old saves have none; unknown tasks and broken numbers are dropped).
export function repairTasks(x) {
  const out = blankTasks();
  if (!x || typeof x !== 'object') return out;
  const key = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  out.date = key(x.date);
  out.last = key(x.last);
  out.streak = Math.max(0, Math.floor(Number(x.streak)) || 0);
  out.chest = !!x.chest;
  const fresh = out.date ? tasksFor(out.date) : [];
  // The list must be that date's tasks; the counts are kept (within each goal).
  out.list = fresh.map((t) => {
    const old = Array.isArray(x.list) ? x.list.find((o) => o && o.id === t.id) : null;
    return { ...t, n: Math.max(0, Math.min(t.goal, Math.floor(Number(old?.n)) || 0)), claimed: !!old?.claimed };
  });
  return out;
}
