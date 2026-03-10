# docs-writer memory — ic_news project

## Project Identity
- Project: Portfolio News Tracker (Initialized Capital take-home)
- Repo: mitesh699/ic-news (private)
- Branch: mitesh / master

## Files That Are Never Committed
- PROGRESS.md
- PRD.md
- TDD.md
- assignment.md
- PROJECT_NOTES.md (developer-only local notes)
- .claude/CLAUDE.local.md
- .claude/settings.local.json

## Documentation Written
- `/Users/miteshsingh/Downloads/ic_news/PROJECT_NOTES.md` — primary developer notes file
  - Problem statement, architecture, what worked, what didn't, Browserbase, schema notes, lessons
  - Agentic AI extension section (added 2026-03-09): Mastra framework, MCP servers for Exa + NewsAPI, RAG + agentic RAG design, research report workflow with createStep/.then()/.parallel(), decisions table, open questions

## Stack (confirmed from CLAUDE.local.md + PROJECT_NOTES.md)
- Backend: Node.js + TypeScript strict, Express, Prisma, PostgreSQL
- LLM: gpt-5-mini (sentiment batch), claude-haiku-4-5 (chat)
- News: Exa.ai neural search
- Frontend: React + Vite + Tailwind + shadcn/ui
- Deploy: Railway (backend + DB), Vercel (frontend)
- Tests: 76 tests across 13 files

## Agentic Extension — Key Decisions Documented
- Framework: Mastra (@mastra/core, @mastra/mcp, @mastra/rag)
- MCP: Exa server (port 3001), NewsAPI server (port 3002), HTTP/Hono transport
- RAG: pgvector extension on existing PostgreSQL, text-embedding-3-small, createVectorQueryTool
- Workflow: createStep + .then() + .parallel() for 6-step research report pipeline
- Report model: claude-haiku-4-5 (structured output via ReportSchema zod)

## Style Notes
- No emojis
- Tables over paragraphs for comparisons and decisions
- Code blocks use TypeScript with accurate Mastra API shapes
- Tone: candid developer notes, not marketing copy
- Dates: YYYY-MM-DD
