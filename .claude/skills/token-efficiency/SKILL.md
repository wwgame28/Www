---
name: token-efficiency
description: Keep context and token use small — read only relevant files, make small diffs, summarize logs, run only relevant tests. Use at the start of any multi-step task in this repo, before broad file reads, and whenever output (logs, test runs, diffs) gets large.
---

# Token efficiency

## Reading
- Start from `.claude/STATE.md` and the files it names; don't re-explore what it already states.
- Locate with Grep/Glob first, then read only the needed line range (`offset`/`limit`). Never read `vendor/`, minified files, GLB/binary assets or lockfiles in full.
- Don't re-read a file you just edited, and don't repeat research already done this session.

## Skills and tools
- Load a skill only when the task matches it; for one rule, read the one reference file, not the whole skill folder.
- Prefer one targeted command over several exploratory ones; batch independent calls.

## Changing code
- Smallest diff that solves the task; reuse existing helpers and dependencies, add none without need.
- Edit in place (Edit) instead of rewriting whole files.

## Output
- Pipe long output through `tail`/`grep`; report a summary (counts, first error), not the full log.
- Run only the tests touching the change (`node --test tests/<name>.test.mjs`), the full suite once before commit.
- Never claim success without having run the check; say what was not verified.

## End of task
- Update `.claude/STATE.md` in ≤10 lines so the next session doesn't re-derive context.
