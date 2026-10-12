// Ads for game portals. Without a platform (GitHub Pages, a local copy) there is no provider: nothing
// loads, can() is false and every ad button stays hidden, so the game plays exactly as before. A
// portal build names its platform with ?platform=yandex|crazygames|poki in the game's URL (or sets
// window.RICOCHET_PLATFORM before main.js); ?platform=test shows a fake ad, to see where ads appear.
// The SDK calls follow the official docs (checked 12.10.2026): Yandex Games SDK, CrazyGames HTML5
// SDK v3, PokiSDK v2. How to publish and what the owner has to do: docs/monetization.md.

export const SDK_URLS = {
  yandex: '/sdk.js', // served by Yandex next to an uploaded game (own domain: https://sdk.games.s3.yandex.net/sdk.js)
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
};
export const AD_GAP = 180; // seconds between two interstitials at least (the portals also limit them)

export function platformOf(loc = globalThis.location, preset = globalThis.RICOCHET_PLATFORM) {
  const p = String(new URLSearchParams(loc?.search || '').get('platform') || preset || '').toLowerCase();
  return p in SDK_URLS || p === 'test' ? p : '';
}

const loadScript = (src) => new Promise((resolve, reject) => {
  const el = document.createElement('script');
  el.src = src; el.async = true;
  el.onload = resolve; el.onerror = () => reject(new Error(`no SDK: ${src}`));
  document.head.append(el);
});

// Each provider: loaded(), gameplay(on), rewarded() → Promise<boolean> (true: give the reward),
// interstitial() → Promise. onStart mutes the game while an ad plays.
async function yandex() {
  await loadScript(SDK_URLS.yandex);
  const ysdk = await globalThis.YaGames.init();
  const show = (method, rewarded) => new Promise((resolve) => {
    let got = false, done = false;
    const end = () => { if (!done) { done = true; resolve(got); } };
    ysdk.adv[method]({ callbacks: { onRewarded: () => { got = true; }, onClose: end, onError: end } });
    if (!rewarded) got = true;
  });
  return {
    loaded: () => ysdk.features?.LoadingAPI?.ready?.(),
    gameplay: (on) => (on ? ysdk.features?.GameplayAPI?.start?.() : ysdk.features?.GameplayAPI?.stop?.()),
    rewarded: () => show('showRewardedVideo', true),
    interstitial: () => show('showFullscreenAdv', false),
  };
}

async function crazygames() {
  await loadScript(SDK_URLS.crazygames);
  const sdk = globalThis.CrazyGames.SDK;
  await sdk.init();
  if (sdk.environment === 'disabled') return null; // outside CrazyGames every call would throw
  sdk.game.loadingStart();
  const ad = (kind) => new Promise((resolve) => sdk.ad.requestAd(kind, { adFinished: () => resolve(true), adError: () => resolve(false) }));
  return {
    loaded: () => sdk.game.loadingStop(),
    gameplay: (on) => (on ? sdk.game.gameplayStart() : sdk.game.gameplayStop()),
    rewarded: () => ad('rewarded'),
    interstitial: () => ad('midgame'),
    muted: () => !!sdk.game.settings?.muteAudio,
  };
}

async function poki() {
  await loadScript(SDK_URLS.poki);
  const sdk = globalThis.PokiSDK;
  await sdk.init().catch(() => {}); // the docs: load the game anyway
  return {
    loaded: () => sdk.gameLoadingFinished(),
    gameplay: (on) => (on ? sdk.gameplayStart() : sdk.gameplayStop()),
    rewarded: () => sdk.rewardedBreak().then((ok) => !!ok),
    interstitial: () => sdk.commercialBreak(),
  };
}

// ?platform=test: a fake 1.5-second ad that always pays out.
function test() {
  const fake = (label) => new Promise((resolve) => {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:#000c;color:#fff;font:900 26px system-ui';
    document.body.append(el);
    setTimeout(() => { el.remove(); resolve(true); }, 1500);
  });
  return { loaded() {}, gameplay() {}, rewarded: () => fake('📺 Реклама (тест)'), interstitial: () => fake('📺 Межстраничная реклама (тест)') };
}

const PROVIDERS = { yandex, crazygames, poki, test: async () => test() };

// hooks.pause / hooks.resume: mute and unmute the game around an ad.
// make: builds the provider (tests pass a fake one).
export function createAds({ platform = platformOf(), hooks = {}, now = () => performance.now() / 1000, make = PROVIDERS[platform] } = {}) {
  let provider = null, busy = false, lastAd = -Infinity, playing = null;
  const ready = (make ? Promise.resolve().then(make) : Promise.resolve(null))
    .then((p) => { provider = p; })
    .catch((e) => { console.warn('ads off:', e?.message || e); provider = null; });
  const run = async (fn) => {
    if (!provider || busy) return false;
    busy = true;
    hooks.pause?.();
    try { return await fn(); } catch { return false; } finally { busy = false; hooks.resume?.(); }
  };
  return {
    platform, ready,
    can: () => !!provider && !busy,
    muted: () => !!provider?.muted?.(),
    loaded: () => { try { provider?.loaded(); } catch { /* the game goes on */ } },
    gameplay(on) {
      if (!provider || playing === on) return;
      playing = on;
      try { provider.gameplay(on); } catch { /* the game goes on */ }
    },
    // true: the ad was watched to the end, give the reward.
    rewarded: () => run(async () => { const ok = await provider.rewarded(); if (ok) lastAd = now(); return ok; }),
    // At a natural break (a new run, the next kingdom); skipped when the last ad was recent.
    async interstitial() {
      if (now() - lastAd < AD_GAP) return false;
      const shown = await run(() => provider.interstitial());
      lastAd = now();
      return shown !== false;
    },
  };
}
