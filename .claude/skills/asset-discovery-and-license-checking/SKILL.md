---
name: asset-discovery-and-license-checking
description: Find, vet, import and verify ready-made game assets (sprites, icons, UI kits, textures, 3D models, sounds, music, VFX) before creating new ones. Use whenever a task needs an image, sound, model, font or effect that the project doesn't have yet.
---

# Asset discovery and license checking

## 1. Search existing sources first
| Source | Good for | License to confirm |
|---|---|---|
| Kenney — https://kenney.nl/assets | UI packs, icons, 2D sprites, audio | Usually CC0; confirm on the pack page |
| Poly Haven — https://polyhaven.com | Textures, HDRIs, 3D models | CC0 |
| OpenGameArt — https://opengameart.org | Sprites, music, SFX | Varies per asset (CC0 / CC-BY / GPL) |
| Google Fonts — https://fonts.google.com | Fonts | OFL / Apache |

Check what's already in the project before downloading anything.

## 2. Vet each candidate (all must pass)
- **License**: CC0 preferred; CC-BY is allowed only if attribution is added to `CREDITS.md`. Reject non-commercial (NC), "personal use only", unclear, or missing licenses.
- **Format**: web-ready — PNG/WebP/SVG for images, OGG plus M4A/AAC for audio (iOS has no OGG in older Safari), glTF/GLB for 3D, WOFF2 for fonts.
- **Compatibility and quality**: correct resolution (@2x/@3x for iPhone), consistent style with the existing UI, transparent backgrounds where needed.
- **Animations**: for animated assets, confirm the frames, spritesheet or clips are included.
- **Size**: one image ≤ 200 KB, a sound effect ≤ 100 KB, a music loop ≤ 1 MB, unless justified.

## 3. Safety
- Download only from the source's own domain over HTTPS.
- Do not download or run `.exe`, `.dmg`, `.app`, `.msi`, `.bat`, `.sh`, installers, or archives from unknown hosts.
- Unpack archives into a fresh scratch directory, inspect the file list, and copy only the needed media files into the project.

## 4. Import and verify (don't stop at a list of links)
1. Put files under `assets/<type>/` with clear names; optimize them (WebP or compressed PNG, trimmed audio).
2. Add an entry to `CREDITS.md`: name, author, source URL, license, date.
3. Wire the asset into the code.
4. Verify it in a real browser (Playwright/Chromium): the asset loads (no 404), renders or plays, and the layout and animation still look right. Report what was actually checked.
