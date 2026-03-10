# Portfolio News Tracker

AI-powered portfolio intelligence dashboard for Initialized Capital. Aggregates news for all their portfolio companies, generates LLM summaries with sentiment classification, and provides a conversational chat interface with live news search for investment insights.

## Live Demo

- **Frontend:** https://ic-news-yh7s.vercel.app
- **Backend API:** https://ic-news-production.up.railway.app/api/health

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   React UI  │────▶│  Hono API (TS)  │────▶│  PostgreSQL  │
│  Vite + SWC │     │  /api/*         │     │  (Prisma 7)  │
└─────────────┘     └────────┬────────┘     └──────────────┘
                             │
                    ┌────────┼────────┐
                    │        │        │
              ┌─────▼─────┐  │  ┌────▼───────┐
              │  Exa.ai   │  │  │Claude Haiku│
              │  (news)   │  │  │+ GPT-5-mini│
              └───────────┘  │  │(summaries) │
                             │  └────────────┘
                      ┌──────▼──────┐
                      │ NewsData.io │
                      │ (fallback)  │
                      └─────────────┘
```

**Backend:** Hono.js, Prisma 7, PostgreSQL, TypeScript
**Frontend:** React , Vite, shadcn/ui, Tailwind CSS, TanStack Query, Framer Motion
**AI:** Claude Haiku (primary) with GPT-5-mini fallback for summaries + chat with Exa tool use
**Data:** Exa.ai neural search (primary) + NewsData.io (fallback)

## Features

- **Company Grid** — 175 portfolio companies with sentiment sparklines, signal badges, and sector-based filtering
- **News Pipeline** — Exa.ai neural search with targeted keyword queries (company name + sector/product context, e.g. "Cruise autonomous vehicles" not "Cruise"), parallel batch processing, SHA-256 dedup, 6-month article age filter to discard stale results
- **AI Portfolio Briefs** — Claude Haiku generates sector-specific investment briefs (max 100 words) with outlook, key themes, and action items
- **Chat Widget** — Conversational portfolio intelligence with Exa live search tool use — Claude can fetch real-time news mid-conversation
- **Market Signals** — Positive/Negative/Neutral/Breaking article classification with breaking news ticker
- **Filters** — By sector (8 real portfolio categories: Climate, Consumer, Crypto, Enterprise, Fintech, Frontier Tech, Healthcare, Real Estate), date range (Today/Week/Month/Year), and sentiment signal
- **Pagination** — Load More pattern (20 articles per page) for the news feed
- **Webhooks + SSE** — Register webhook URLs for article notifications; real-time SSE push to connected frontends with notification bell
- **Newsletter Subscribe** — Sidebar UI for daily/weekly email digest (frontend-ready)
- **In-Memory Cache** — Companies (60s), chat context (30s) with invalidation on refresh

## Security

- **Rate limiting** — Per-IP token bucket (10 req/min chat, 60 req/min companies, 2 req/10min refresh)
- **Security headers** — HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy
- **AI Guardrails** — Scope enforcement (portfolio-only), anti-jailbreak patterns (16 regex detections), prompt injection defense with `<user_question>` wrapping
- **LLM Output Sanitization** — HTML stripped, PII redacted (emails/phones), system prompt leak detection, 2000 char limit
- **Input Validation** — Zod schemas on all endpoints, HTML/control character stripping
- **CSRF protection** — Origin validation on mutation endpoints
- **CORS lockdown** — Explicit frontend origin allowlist
- **Refresh auth** — `X-Refresh-Token` (timing-safe comparison) for programmatic access; browser-origin check for frontend (Origin header is unforgeable in browsers, CORS restricts allowed origins)
- **Request timeouts** — 30s default, 5min for refresh pipeline
- **Request IDs** — `X-Request-Id` on every response for audit tracing
- **Body size limit** — 50KB max request body

## Local Setup

### Prerequisites

- **Node.js 22+** and **npm**
- **PostgreSQL 15+** — local install or Docker (`docker run -e POSTGRES_DB=ic_news -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16`)
- **Anthropic API key** — required for summaries and chat ([console.anthropic.com](https://console.anthropic.com))
- **Exa.ai API key** — required for news fetching ([dashboard.exa.ai](https://dashboard.exa.ai))
- **OpenAI API key** _(optional)_ — fallback LLM for summaries
- **NewsData.io API key** _(optional)_ — fallback news source

### Install & configure

```bash
git clone https://github.com/mitesh699/ic-news.git && cd ic-news
npm install                          # backend dependencies
cd src/frontend && npm install && cd ../..  # frontend dependencies
cp .env.example .env                 # copy env template
```

Edit `.env` with your values:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ic_news
ANTHROPIC_API_KEY=sk-ant-...         # required
EXA_API_KEY=...                      # required
OPENAI_API_KEY=sk-...                # optional fallback
NEWSDATA_API_KEY=pub_...             # optional fallback
REFRESH_SECRET=any-secret-string     # protects the refresh endpoint
FRONTEND_URL=http://localhost:8080   # for CORS
```

### Seed the database

```bash
npx prisma migrate deploy           # create tables
npm run scrape                       # scrape 175 portfolio companies from initialized.com
npm run fetch-news                   # fetch latest articles via Exa neural search
npm run generate-summaries           # generate AI briefs for each company
```

`scrape` populates the Company table. `fetch-news` queries Exa for each company and stores articles. `generate-summaries` sends articles through Claude Haiku to produce investment briefs.

### Run

```bash
npm run dev                          # backend → http://localhost:8000
cd src/frontend && npm run dev       # frontend → http://localhost:8080 (separate terminal)
```

## Data Model

```
Company (id, name*, sector, description, website, keywords[JSON], lastFetchedAt)
  ├── Article (id, companyId→FK, title, url, source, summary, publishedAt?, fetchedAt, urlHash*, sentiment, isBreaking)
  ├── Summary (id, companyId→FK, summaryText, promptVersion, articleCount, metadata[JSON], generatedAt)

Webhook (id, url*, secret?, events, active)

* = unique
```

- `Company` is the anchor entity. `Article` and `Summary` are children (cascade delete). `Webhook` is standalone.
- `urlHash` (SHA-256) deduplicates articles across repeated fetches via `skipDuplicates`.
- `publishedAt` is nullable — external APIs don't always return dates. `fetchedAt` (defaults to `now()`) is the fallback for ordering.
- `keywords` (JSON) stores disambiguation terms (e.g. `["autonomous vehicles"]` for Cruise) used to build targeted search queries.
- `metadata` (JSON) on Summary holds structured LLM output (`keyThemes`, `outlook`, `actionItems`) — no schema migration needed when prompt format changes.
- Composite indexes on `(companyId, publishedAt DESC)` and `(companyId, fetchedAt DESC)` on Article, `(companyId, generatedAt DESC)` on Summary — optimized for per-company queries.
- IDs use Prisma `cuid()` — URL-safe, sortable, shorter than UUID v4.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/companies` | List all companies (optional `?search=`, `?sort=name\|sector\|recent`) |
| `GET` | `/api/companies/:id` | Single company with articles + summary |
| `POST` | `/api/refresh` | Trigger full news fetch + summary pipeline |
| `POST` | `/api/refresh/:companyId` | Refresh news + summary for a single company |
| `POST` | `/api/chat` | Chat with portfolio AI + Exa live search (`{ message, companyId? }`) |
| `GET` | `/api/events` | SSE stream for real-time notifications (article updates) |
| `GET` | `/api/webhooks` | List registered webhooks (requires `X-Refresh-Token`) |
| `POST` | `/api/webhooks` | Register a webhook (`{ url, secret?, events? }`) |
| `DELETE` | `/api/webhooks/:id` | Unregister a webhook |

## Testing

```bash
npm test              # 77 tests across 13 files
npm run test:coverage # With coverage report
```

**77 tests** covering API endpoints, services, adapters (Exa, NewsData, LLM), chat guardrails, and middleware with mocked DB/external APIs.

## AI Tools Used

- **Claude Code** — Primary development assistant for backend, frontend, tests, and deployment
- **Lovable** — Initial frontend scaffolding and UI design
- **Claude Haiku** — Runtime AI for summaries, sentiment, and chat
- **GPT-5-mini** — Fallback LLM for summary generation
- **Exa.ai** — Neural news search (pipeline + chat tool use)

## Project Structure

```
src/
├── backend/
│   ├── api/           # Hono route handlers (companies, refresh, chat, health, events, webhooks)
│   ├── services/      # Business logic (news, summaries, portfolio, webhooks)
│   ├── adapters/      # External APIs (Exa, NewsData, LLM)
│   ├── db/            # Prisma client
│   ├── utils/         # Cache, rate limiting
│   └── middleware/     # Rate limiter, security headers
├── frontend/
│   ├── src/
│   │   ├── components/  # React components (CompanyCard, NewsItem, ChatWidget, NotificationBell, etc.)
│   │   ├── pages/       # Route pages (Index, Companies, CompanyDetail)
│   │   ├── hooks/       # React Query hooks (useCompanies, useNotifications)
│   │   ├── lib/         # API client, utilities
│   │   └── types/       # TypeScript interfaces
│   └── vitest.config.ts
├── prisma/
│   └── schema.prisma    # Database schema
└── scripts/             # Data pipeline scripts (scrape, fetch, cleanup, fix-dates)
```
