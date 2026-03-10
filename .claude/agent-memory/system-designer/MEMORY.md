# System Designer Memory — ic_news_extended

## Project Context
- Portfolio News Tracker for Initialized Capital (175 companies)
- Stack: Hono.js + Prisma 7 + PostgreSQL (Railway) / React + Vite + shadcn/ui (Vercel)
- AI: Claude Haiku for summaries/sentiment, Exa.ai for news search, OpenAI fallback
- Cron: 6h news refresh, batches of 5 concurrent, 2s between batches

## Key Architecture Patterns
- Services layer: pure functions taking IDs, returning counts/booleans
- Adapters: thin wrappers around external APIs (exa.ts, newsdata.ts, llm.ts)
- API routes: Hono `new Hono()` per file, Zod validation, error shape `{ error, code }`
- Auth: `checkRefreshAuth` for mutations (token-first, browser-origin fallback)
- Caching: in-memory TTL cache, prefix-based invalidation
- DB: PrismaClient via lazy proxy in db/client.ts
- URL dedup: SHA-256 hash, `createMany({ skipDuplicates: true })`

## Design Decisions Made
- Competitive intelligence: designed 2026-03-10 (see TDD.md for full spec)
  - Separate Competitor/CompetitorArticle models (not reusing Company/Article)
  - Separate daily cron (not piggybacked on 6h portfolio refresh)
  - Manual competitor curation (not LLM auto-detection)
  - SectorBrief standalone table for cross-company aggregation
  - relevance field (direct/indirect) on CompetitorArticle

## File Layout (source only, exclude dist/)
- prisma/schema.prisma — single schema file
- src/backend/index.ts — app setup, middleware, cron, routes
- src/backend/api/*.ts — route handlers (companies, refresh, chat, events, webhooks, health)
- src/backend/services/*.ts — business logic (news, summaries, portfolio, webhooks)
- src/backend/adapters/*.ts — external API wrappers (exa, newsdata, llm)
- src/backend/middleware/*.ts — auth, rate-limit
- src/backend/utils/*.ts — cache, rate-limiter
- src/frontend/src/pages/*.tsx — Index (news feed), Companies (grid), CompanyDetail
- src/frontend/src/types/company.ts — all frontend interfaces
- src/frontend/src/lib/api.ts — fetch wrappers
- src/frontend/src/hooks/*.ts — useCompanies, useRefreshNews, useNotifications

## Constraints Discovered
- Exa rate limits: batch of 5 concurrent with 2s delay works
- LLM rate limit: ~40 RPM, 1.5s between calls
- Railway proxy timeout: 30-60s (refresh uses fire-and-forget pattern)
- Prisma 7 requires Node 22.12+
