# Project Instructions — ic_news_extended

## Session Rules
- **Always update memory before context ends** (when ~15% context remains) — save any new learnings, decisions, or user preferences to memory files
- **Always update TDD.md and README.md after any feature change** — changelog entries, architecture updates, decision log, test counts

## Never Commit
- `PROGRESS.md`, `PRD.md`, `TDD.md`, `assignment.md`
- `.claude/CLAUDE.local.md`, `.claude/settings.local.json`

## Tech Stack
- Backend: Hono.js, Prisma 7, PostgreSQL, TypeScript strict
- Frontend: React 18, Vite, shadcn/ui, Tailwind, TanStack Query
- AI: Claude Haiku (summaries/sentiment), GPT-5-mini (relevance filter + fallback), Exa.ai (news search)
- Hosting: Railway (backend), Vercel (frontend)

## OpenAI Model Rules
- Use GPT-5 series: `gpt-5-mini` (cost-efficient) or `gpt-5.4` (max capability)
- No `temperature` — use `reasoning_effort` for reasoning models
- No `max_tokens` — use `max_completion_tokens`
- System role = `developer` (not `system`)

## Code Style
- TypeScript: strict mode, no `any`, interfaces over type aliases for objects
- No docstrings or comments on code not touched
- Minimum complexity, no premature abstractions

## Workflow
- Always read files before editing
- Run tests (`npx vitest run`) before committing
- Git: never force push; always confirm before `git push`
- Commits by Mitesh Singh only — no Co-Authored-By or AI mention
