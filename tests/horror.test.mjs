import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApartment, trace, collide, roomAt, navPath, shiftGroup, neighbourRooms } from '../horror/world.js';
import { parseDirective, cleanLine, chat, directorMessages, sisterMessages, loadSettings, saveSettings, DEFAULT_MODEL } from '../horror/ai.js';

test('a ray across the hall hits the wall at the right distance', () => {
  const w = buildApartment();
  const h = trace(w, 1.45, 1.6, 6.5, -1, 0, 0, 20);
  assert.ok(h && Math.abs(h.dist - (1.45 - 0.06)) < 1e-6, `dist ${h?.dist}`);
});

test('the Жилец swallows the ray — no point behind him', () => {
  const w = buildApartment();
  const monster = { id: -1, kind: 'monster', min: [0.7, 0, 6.3], max: [1.1, 1.8, 6.7] };
  assert.equal(trace(w, 1.45, 1.6, 6.5, -1, 0, 0, 20, { monster }), null);
  assert.ok(trace(w, 1.45, 1.6, 6.5, -1, 0, 0, 20, { monster: { ...monster, min: [0.7, 0, 5.3], max: [1.1, 1.8, 5.7] } }));
});

test('the mirror puts points behind the glass and shows the ghost only through it', () => {
  const w = buildApartment();
  // Стоим в ванной лицом к зеркалу (на стене z = 0).
  const h = trace(w, 4.7, 1.4, 1.2, 0, 0, -1, 20);
  assert.ok(h.mirrored && h.z < 0, 'the point lies in the mirrored flat');
  const ghostless = trace(w, 4.7, 1.4, 1.2, 0, 0, -1, 20, { ghost: false });
  const ghosted = trace(w, 4.68, 1.4, 1.2, 0, 0, -1, 20, { ghost: true });
  assert.notEqual(ghostless.box.kind, 'ghost');
  assert.equal(ghosted.box.kind, 'ghost');
  // Прямой луч на «призрака» его не видит.
  const direct = trace(w, 4.68, 1.4, 1.2, 0, 0, 1, 20, { ghost: true });
  assert.notEqual(direct.box.kind, 'ghost');
});

test('walls stop the player; the open doorway lets them through', () => {
  const w = buildApartment();
  const [x] = collide(w, 2.9, 7.6, 0.24); // в стену прихожая|зал (x = 3) без проёма
  assert.ok(x <= 3 - 0.06 - 0.24 + 1e-6);
  const [x2, z2] = collide(w, 3.0, 6.45, 0.24); // проём 6.0–6.9
  assert.ok(Math.abs(x2 - 3.0) < 1e-6 && Math.abs(z2 - 6.45) < 1e-6);
  const [, zd] = collide(w, 1.45, 7.95, 0.24);
  assert.ok(zd < 7.8, 'the locked front door blocks');
  w.byName.entrance.removed = true;
  const [, zo] = collide(w, 1.45, 7.95, 0.24);
  assert.ok(Math.abs(zo - 7.95) < 1e-6, 'the open door lets out');
});

test('rooms and paths go through doors', () => {
  assert.equal(roomAt(1, 1), 'kitchen');
  assert.equal(roomAt(1, 7), 'hall');
  assert.equal(roomAt(8, 1), 'child');
  const path = navPath({ x: 1.5, z: 1 }, { x: 4.6, z: 1 });
  assert.deepEqual(path.slice(0, -1).map((p) => `${p.x},${p.z}`), ['1.45,5', '1.6,6.5', '3,6.45', '4.3,5.2', '4.45,3']);
  assert.deepEqual(neighbourRooms('zal').sort(), ['bath', 'child', 'hall']);
});

test('furniture shifts inside its room and never onto the player', () => {
  const w = buildApartment();
  const moved = shiftGroup(w, 'armchair', -5, 0, null);
  assert.ok(moved && moved.every((b) => b.min[0] >= 3 && b.rev === 1));
  assert.equal(shiftGroup(w, 'coffee', 0.5, 0, { x: 8.3, z: 5.6 }), null);
});

test('director replies are parsed leniently and validated', () => {
  assert.deepEqual(parseDirective('```json\n{"event":"knock","text":"","target":"kitchen"}\n```'), { event: 'knock', text: '', target: 'kitchen' });
  assert.deepEqual(parseDirective('Вот: {"event":"WHISPER","text":"Тише...","target":"moon"}'), { event: 'whisper', text: 'Тише...', target: null });
  assert.equal(parseDirective('{"event":"kill_player"}'), null);
  assert.equal(parseDirective('{"event":"whisper","text":""}'), null);
  assert.equal(parseDirective('не json'), null);
  assert.equal(cleanLine('«Я здесь...» *шёпот* (тихо)'), 'Я здесь...');
});

test('chat sends the key, the model and the dialog to OpenRouter', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ choices: [{ message: { content: ' Тише. ' } }] }) }; };
  const state = { t: 5, room: 'Кухня', notesRead: 1, doorOpen: false, noise: 'нет', monster: 'бродит', battery: 90 };
  const text = await chat({ key: 'sk-test', model: 'x/y', messages: sisterMessages(state, [{ role: 'user', content: 'Аня?' }]), fetchImpl });
  assert.equal(text, 'Тише.');
  assert.match(seen.url, /openrouter\.ai\/api\/v1\/chat\/completions$/);
  assert.equal(seen.init.headers.Authorization, 'Bearer sk-test');
  for (const v of Object.values(seen.init.headers)) assert.match(v, /^[\x20-\x7e]*$/, 'header values must be ASCII for fetch');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, 'x/y');
  assert.equal(body.messages.at(-1).content, 'Аня?');
  const bad = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'No auth' } }) });
  await assert.rejects(chat({ key: 'k', model: 'm', messages: [], fetchImpl: bad }), /No auth/);
  assert.match(directorMessages(state, { radio: ['где ты'], events: ['knock'] })[1].content, /где ты/);
});

test('settings round-trip and default model', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(loadSettings(storage).model, DEFAULT_MODEL);
  saveSettings({ key: 'sk-1', model: 'a/b', tts: false }, storage);
  assert.deepEqual(loadSettings(storage), { key: 'sk-1', model: 'a/b', tts: false });
});
