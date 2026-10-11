// Challenge link: everything a friend needs to replay the exact run, in the URL hash.

const toB64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeChallenge({ date, location, weapon, score, combo, wave }) {
  return toB64url(JSON.stringify({ d: date, l: location, w: weapon, s: score, b: combo, v: wave }));
}

export function decodeChallenge(code) {
  try {
    const o = JSON.parse(fromB64url(code));
    if (typeof o.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.d)) return null;
    return {
      date: o.d, location: String(o.l), weapon: String(o.w),
      score: Math.max(0, o.s | 0), combo: Math.max(0, o.b | 0), wave: Math.max(0, o.v | 0),
    };
  } catch {
    return null;
  }
}

export function challengeFromHash(hash) {
  const m = /[#&]c=([A-Za-z0-9_-]+)/.exec(hash || '');
  return m ? decodeChallenge(m[1]) : null;
}

export function challengeUrl(baseUrl, challenge) {
  return `${baseUrl.split('#')[0]}#c=${encodeChallenge(challenge)}`;
}
