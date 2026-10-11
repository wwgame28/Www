# State — 2026-10-11
Goal: «Рикошет» — 3D web arcade for iPhone (one projectile you must retrieve), in the repo root (served by GitHub Pages at https://wwgame28.github.io/Www/).
Done: v1.1 adds fixed joystick, hold-to-aim trajectory line, perk choice after each wave. spec `docs/superpowers/specs/2026-10-11-ricochet-design.md`; v1 playable (7 weapons, 4 locations, 5 enemy types, daily seed, challenge links, records); Kenney CC0 assets in `assets/`.
Checks passed: `node --test tests/*.test.mjs` → 21/21; Playwright iPhone 14 (local http.server): menu/play/over, 4 locations × 7 weapons, challenge link, fixed joystick, aim line, perk picker — 0 console errors.
Next: owner tests on a real iPhone; balance (wave 1 may be too fast); hosting only after owner confirms.
Gotchas: container network blocks kenney.nl — assets come as uploads; 3 uploads were truncated, files salvaged by CRC. Walk Wars removed from the tree (in git history, commit b973256).
