# Credits

All art assets are licensed **CC0 1.0** (public domain; credit not required). License text verified in each pack's `License.txt` / `LICENSE.txt`. Files were converted to compact GLBs (unused animations and props removed).

**KayKit, by Kay Lousberg** — https://kaylousberg.itch.io · sources: https://github.com/KayKit-Game-Assets

| Folder | Pack |
|---|---|
| `assets/heroes/` | Character Pack: Adventurers 1.0 — Barbarian, Knight, Mage, Rogue, Rogue Hooded (with their hand props) |
| `assets/props/` | Character Pack: Adventurers 1.0 — axe, shield, dagger, sword (thrown projectiles) |
| `assets/skeletons/` | Character Pack: Skeletons 1.0 — Minion, Rogue, Warrior, Mage |
| `assets/dungeon/` | Dungeon Remastered 1.0 |
| `assets/halloween/` | Halloween Bits 1.0 |
| `assets/hex/` | Medieval Hexagon Pack 1.0 |
| `assets/space/` | Space Base Bits 1.0 |
| `assets/city/` | City Builder Bits 1.0 |

**Kenney** — https://kenney.nl

| Folder | Pack |
|---|---|
| `assets/nature/` | Nature Kit |
| `assets/holiday/` | Holiday Kit |
| `assets/towerdefense/` | Tower Defense Kit (UFO enemy) |
| `assets/sky/` | Skyboxes (downscaled to 2048×1024 JPEG) |
| `assets/ui/crosshair.svg` | Crosshair Pack |
| `assets/ui/icon-*.png` | App icon made from a Blaster Kit preview |

**Code libraries** (`vendor/`, MIT License)

- three.js r169 — `vendor/THREE-LICENSE`
- three.quarks 0.16.0 + quarks.core 0.16.0 (particle effects) — `vendor/THREE-QUARKS-LICENSE`
- postprocessing 6.39.5 (bloom, vignette) — `vendor/POSTPROCESSING-LICENSE.md`

Sound effects are synthesized in code (`src/audio.js`).

**Claude Code skills and agents** (`.claude/skills/`, `.claude/agents/`, MIT License)

- Claude Code Game Studios by Donchitos — https://github.com/Donchitos/claude-code-game-studios, release 1.1.3 (commit be8993b). 73 skills and 49 agents, copied unchanged except that `code-review`, `help` and `settings` were renamed `studio-code-review`, `studio-help` and `studio-settings` (they clash with built-in commands). The `hotfix` skill, the pack's hooks, scripts and `.claude/docs/` were not installed. Licence text: `.claude/LICENSE-claude-code-game-studios.txt`.
