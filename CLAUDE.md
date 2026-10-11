# Project rules (profile: premium-ui-development)

Stack: vanilla JS ES modules + three.js, no build step (see README.md). Reply to the owner in Russian.
Context: read `.claude/STATE.md` first; follow the `token-efficiency` skill.

## UI skills (load on demand)
- `frontend-design` — visual direction, typography, layout, color. Write a short design direction before coding a new screen.
- `web-design-guidelines` — accessibility / responsive / UX audit of changed UI.
- `game-ui-ux`, `animation-and-game-feel`, `iphone-performance` — project-specific; they win over generic web advice.
- `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions`, `21st-*` — React/shadcn only. This repo has no React: use them for patterns, never migrate the stack without the owner's approval.
- References: 21st.dev, magicui.design, ui.aceternity.com, motion.dev — check the license before copying code or assets (`asset-discovery-and-license-checking`).

## Design rules
- Reuse existing components and dependencies; consistent spacing and type scale; no generic template look.
- Mobile (iPhone portrait) and desktop; respect `prefers-reduced-motion`; motion only for meaningful feedback, no excessive effects.
- Cover loading, empty, error and success states.

## Safety
- Never print secrets or env contents.
- Ask before destructive changes, paid services (incl. 21st.dev login/AI credits), production deploys and publishing.
