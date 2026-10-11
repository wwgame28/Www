// Cloud rating through OpenRouter. The key lives only in this device's localStorage.
const URL = 'https://openrouter.ai/api/v1/chat/completions';

const PROMPT = `Ты опытный фотограф. Оцени кадр: композиция, свет, резкость, фон, момент.
Ответь СТРОГО одним JSON без пояснений и markdown:
{"score": число 0-100, "verdict": "одна короткая фраза", "tips": ["до 3 коротких конкретных советов по улучшению кадра"]}
Пиши по-русски.`;

export async function rateFrame({ key, model, dataUrl, signal }) {
  const res = await fetch(URL, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'AI Camera',
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const msg = res.status === 401 ? 'Неверный ключ OpenRouter'
      : res.status === 402 ? 'Недостаточно средств на OpenRouter'
      : res.status === 429 ? 'Слишком много запросов, подождите'
      : `Ошибка OpenRouter (${res.status})`;
    throw new Error(msg);
  }
  const json = await res.json();
  return parseRating(json?.choices?.[0]?.message?.content ?? '');
}

export function parseRating(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Модель вернула неожиданный ответ');
  let o;
  try { o = JSON.parse(m[0]); } catch { throw new Error('Модель вернула неожиданный ответ'); }
  const score = Math.round(Number(o.score));
  if (!Number.isFinite(score)) throw new Error('Модель не вернула оценку');
  return {
    score: Math.min(100, Math.max(0, score)),
    verdict: String(o.verdict ?? ''),
    tips: Array.isArray(o.tips) ? o.tips.slice(0, 3).map(String) : [],
  };
}
