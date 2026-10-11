# State — 2026-10-11
Goal: «Рикошет» — 3D web arcade for iPhone (one projectile you must retrieve), in `ricochet/`.
Done: spec `docs/superpowers/specs/2026-10-11-ricochet-design.md`; v1 playable (7 weapons, 4 locations, 5 enemy types, daily seed, challenge links, records); Kenney CC0 assets in `ricochet/assets/`.
Checks passed: `node --test ricochet/tests/*.test.mjs` → 14/14; Playwright iPhone 14 (local http.server 8765): menu/arsenal/play/over, 4 locations × 7 weapons, challenge link — 0 console errors.
Next: owner tests on a real iPhone; balance (wave 1 may be too fast); hosting only after owner confirms.
Gotchas: container network blocks kenney.nl — assets come as uploads; 3 uploads were truncated, files salvaged by CRC. Walk Wars `Index.html` untouched.
