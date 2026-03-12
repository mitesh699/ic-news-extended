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
                    ┌────────┼─────────────┐
                    │        │             │
              ┌─────▼─────┐  │  ┌──────────▼──────────┐
              │  Exa.ai   │  │  │  Mastra Agent        │
              │  (news +  │  │  │  Sonnet 4.6 → GPT-5.4│
              │   MCP)    │  │  │  9 tools + Exa MCP   │
              └───────────┘  │  └─────────────────────┘
                             │
                    ┌────────┼────────┐
                    │        │        │
              ┌─────▼─────┐  │  ┌────▼───────┐
              │Claude Haiku│  │  │ GPT-5-mini │
              │(summaries) │  │  │(relevance  │
              └───────────┘  │  │ + fallback)│
                             │  └────────────┘
                      ┌──────▼──────┐
                      │ NewsData.io │
                      │ (fallback)  │
                      └─────────────┘
```

**Backend:** Hono.js, Prisma 7, PostgreSQL, TypeScript, Mastra Agent Framework
**Frontend:** React 18, Vite, shadcn/ui, Tailwind CSS, TanStack Query, Framer Motion
**AI Agent:** Mastra-powered portfolio intelligence agent (Sonnet 4.6 primary → GPT-5.4 fallback) with 9 local tools + Exa MCP for live web search
**AI Pipeline:** Claude Haiku (summaries/sentiment), GPT-5-mini (relevance filtering + fallback)
**Data:** Exa.ai neural search with `searchAndContents` + highlights (primary) + NewsData.io (fallback)

## Features

- **Company Grid** — 175 portfolio companies with sentiment sparklines, signal badges, and sector-based filtering
- **News Pipeline** — Exa.ai `searchAndContents` with highlights (6-month window), parallel batch processing, SHA-256 dedup, GPT-5-mini relevance filter to reject off-topic results
- **AI Portfolio Briefs** — Claude Haiku generates sector-specific investment briefs (max 100 words) with outlook, key themes, and action items
- **Mastra Agent** — Portfolio intelligence agent with 9 local tools (company lookup, sector listing, portfolio health, sentiment trends, company comparison, newsletter drafting, chart generation, report creation, email sending) + Exa MCP for live web search + Slack MCP (optional)
- **Model Fallback** — Agent uses Claude Sonnet 4.6 (primary) → GPT-5.4 (fallback) with automatic failover
- **Chat Widget** — Conversational portfolio intelligence with markdown rendering (headers, tables, lists, code blocks via react-markdown + remark-gfm), follow-up suggestions based on tool usage
- **Market Signals** — Positive/Negative/Neutral/Breaking article classification with breaking news ticker
- **Filters** — By sector (8 real portfolio categories: Climate, Consumer, Crypto, Enterprise, Fintech, Frontier Tech, Healthcare, Real Estate), date range (Today/Week/Month/Year), and sentiment signal
- **Pagination** — Load More pattern (20 articles per page) for the news feed
- **Competitive Intelligence** — Track competitors per portfolio company, auto-fetch news with signal detection (funding, hiring, product, regulatory, M&A, risk)
- **Sector Briefs** — AI-generated sector analysis with trend direction, top signals, competitor moves, and watch list items
- **Structured Signals** — LLM summaries return typed event signals (funding, hiring, product, regulatory, M&A, risk, partnership) displayed as tags
- **Virtualized Grid** — TanStack Virtual on /companies page for smooth scrolling across 175+ company cards
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
- **OpenAI API key** — required for GPT-5-mini relevance filter + fallback summaries
- **NewsData.io API key** _(optional)_ — fallback news source

### Install & configure

```bash
git clone https://github.com/mitesh699/ic-news-extended.git && cd ic-news-extended
npm install                          # backend dependencies
cd src/frontend && npm install && cd ../..  # frontend dependencies
cp .env.example .env                 # copy env template
```

Edit `.env` with your values:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ic_news
ANTHROPIC_API_KEY=sk-ant-...         # required
EXA_API_KEY=...                      # required
OPENAI_API_KEY=sk-...                # required (relevance filter + fallback)
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
Source (id, domain*, name, logoUrl?, category, language, trustRank)

Company (id, name*, sector, description, website, keywords[JSON], lastFetchedAt)
  ├── Article (id, companyId→FK, title, url, canonicalUrl?, source, sourceName?, author?, imageUrl?,
  │            summary, highlights?, publishedAt?, fetchedAt, urlHash*, sentiment, isBreaking, readingTimeMs?)
  ├── Summary (id, companyId→FK, summaryText, promptVersion, articleCount, metadata[JSON], generatedAt)
  ├── Competitor (id, companyId→FK, name, website?, description?, sector?, relevance)
  │     └── CompetitorArticle (id, competitorId→FK, title, url, source, summary, publishedAt?,
  │                            fetchedAt, urlHash*, sentiment, signal?)

SectorBrief (id, sector, briefText, metadata[JSON]?, generatedAt)
Webhook (id, url*, secret?, events, active)

* = unique
```

- `Company` is the anchor entity. `Article`, `Summary`, and `Competitor` are children (cascade delete).
- `Competitor` tracks competitors per portfolio company. `CompetitorArticle` stores their news with signal detection (funding, hiring, product, regulatory, M&A, risk).
- `SectorBrief` stores AI-generated sector analysis with trend direction, top signals, competitor moves, and watch list items.
- `Source` is a reference registry for canonical news source metadata (domain, trust rank, logo).
- Article enrichment fields (`canonicalUrl`, `author`, `imageUrl`, `highlights`, `readingTimeMs`) mirror news website data patterns.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/companies` | List all companies (optional `?search=`, `?sort=name\|sector\|recent`) |
| `GET` | `/api/companies/:id` | Single company with articles + summary |
| `GET` | `/api/companies/:id/competitors` | List competitors with recent articles |
| `POST` | `/api/companies/:id/competitors` | Add a competitor (requires `X-Refresh-Token`) |
| `DELETE` | `/api/competitors/:id` | Remove a competitor (requires `X-Refresh-Token`) |
| `POST` | `/api/competitors/:id/fetch` | Fetch news for one competitor |
| `POST` | `/api/competitors/fetch-all` | Fetch news for all competitors |
| `GET` | `/api/sectors` | List all sectors with briefs and counts |
| `GET` | `/api/sectors/:sector` | Single sector brief with metadata |
| `POST` | `/api/sectors/:sector/generate` | Generate brief for one sector |
| `POST` | `/api/sectors/generate-all` | Generate briefs for all sectors |
| `POST` | `/api/refresh` | Trigger full news fetch + summary pipeline |
| `POST` | `/api/refresh/:companyId` | Refresh news + summary for a single company |
| `POST` | `/api/chat` | Chat with portfolio AI + Exa live search (`{ message, companyId? }`) |
| `GET` | `/api/events` | SSE stream for real-time notifications (article updates) |
| `GET` | `/api/webhooks` | List registered webhooks (requires `X-Refresh-Token`) |
| `POST` | `/api/webhooks` | Register a webhook (`{ url, secret?, events? }`) |
| `DELETE` | `/api/webhooks/:id` | Unregister a webhook |

## Testing

```bash
npm test              # 79 tests across 13 files
npm run test:coverage # With coverage report
```

**79 tests** covering API endpoints, services, adapters (Exa, NewsData, LLM), chat guardrails, relevance filtering, and middleware with mocked DB/external APIs.

## AI Tools Used

- **Claude Code** — Primary development assistant for backend, frontend, tests, and deployment
- **Lovable** — Initial frontend scaffolding and UI design
- **Claude Haiku** — Runtime AI for summaries, sentiment classification, and chat
- **GPT-5-mini** — Article relevance filter (strict prompt-based classifier) + fallback summary generation
- **Exa.ai** — Neural news search with `searchAndContents` + highlights (pipeline + chat tool use)

## Project Structure

```
src/
├── backend/
│   ├── api/           # Hono route handlers (companies, competitors, sectors, refresh, chat, health, events, webhooks)
│   ├── services/      # Business logic (news, summaries, competitors, sector-briefs, portfolio, webhooks)
│   ├── adapters/      # External APIs (Exa, NewsData, LLM)
│   ├── db/            # Prisma client
│   ├── utils/         # Cache, rate limiting, sleep, parseSummaryMeta
│   └── middleware/     # Rate limiter, auth, security headers
├── frontend/
│   ├── src/
│   │   ├── components/  # React components (CompanyCard, CompetitorPanel, SectorCard, NewsItem, ChatWidget, etc.)
│   │   ├── pages/       # Route pages (Index, Companies, CompanyDetail, Sectors, SectorDetail)
│   │   ├── hooks/       # React Query hooks (useCompanies, useCompetitors, useSectors, useNotifications)
│   │   ├── lib/         # API client, utilities
│   │   └── types/       # TypeScript interfaces
│   └── vitest.config.ts
├── prisma/
│   └── schema.prisma    # Database schema
└── scripts/             # Data pipeline scripts (scrape, fetch, cleanup, fix-dates)
```
