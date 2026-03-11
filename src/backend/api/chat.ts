import { Hono } from 'hono'
import { z } from 'zod'
import type { CoreMessage } from '@mastra/core/llm'
import { db } from '../db/client'
import { cache } from '../utils/cache'
import { portfolioAgent } from '../agents/portfolio'
import { formatMetaContext } from '../utils/parseSummaryMeta'

const chat = new Hono()

const CHAT_CONTEXT_TTL = 30_000
const COMPANY_LIST_TTL = 300_000

// --- Input validation ---

const historyMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(2000),
})

const chatBodySchema = z.object({
  message: z.string().min(1).max(1000),
  companyId: z.string().cuid().optional(),
  history: z.array(historyMessageSchema).max(10).optional(),
})

// --- Injection detection ---

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts)/i,
  /you\s+are\s+now\s+/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /act\s+as\s+(a|an|if)\s+/i,
  /new\s+(persona|identity|role|character)/i,
  /override\s+(your|all|the)\s+/i,
  /jailbreak/i,
  /\bDAN\b/,
  /system\s*:\s*/i,
  /assistant\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
  /what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions|rules)/i,
  /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
  /output\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
]

// --- Output sanitization ---

function sanitize(text: string): string {
  let cleaned = text.replace(/<[^>]*>/g, '').slice(0, 2000)

  // Redact PII that may leak from source data
  cleaned = cleaned
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email redacted]')
    .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[phone redacted]')

  // Detect system prompt leakage
  const leakPatterns = ['NON-NEGOTIABLE', 'STRICTLY ENFORCED', 'OUTPUT GUARDRAILS', 'INPUT HANDLING', 'SECURITY —']
  if (leakPatterns.some((p) => cleaned.includes(p))) {
    return "I'm a portfolio intelligence assistant. I can help with questions about Initialized Capital's portfolio companies."
  }

  return cleaned
}

// --- Follow-up generation from tool usage ---

interface ToolStep {
  toolCalls?: { toolName?: string; payload?: { toolName?: string } }[]
}

function generateFollowUps(steps: ToolStep[]): string[] {
  const usedTools = new Set<string>()
  for (const step of steps) {
    for (const tc of step.toolCalls ?? []) {
      const name = tc.toolName ?? tc.payload?.toolName
      if (name) usedTools.add(name)
    }
  }

  const suggestions: string[] = []

  if (usedTools.has('lookup_company')) {
    suggestions.push('Compare with a competitor?', 'Show sentiment trend')
  }
  if (usedTools.has('list_sector_companies')) {
    suggestions.push('Which companies have breaking news?', 'Generate a sector report')
  }
  if (usedTools.has('portfolio_health')) {
    suggestions.push('Draft a newsletter digest', 'Show risk signals')
  }
  if (usedTools.has('compare_companies')) {
    suggestions.push('Create a detailed report', 'Chart the sentiment')
  }
  if (usedTools.has('sentiment_trend')) {
    suggestions.push('What caused the shift?', 'Compare with sector peers')
  }
  if (usedTools.has('draft_newsletter')) {
    suggestions.push('Send this as an email', 'Generate charts for the digest')
  }

  if (suggestions.length === 0) {
    suggestions.push('Portfolio health check', 'Any breaking news?', 'Draft weekly newsletter')
  }

  return suggestions.slice(0, 3)
}

// --- Context helpers ---

async function getCompanyList(): Promise<{ name: string; sector: string | null }[]> {
  const cached = cache.get<{ name: string; sector: string | null }[]>('chat:companyList')
  if (cached) return cached

  const companies = await db.company.findMany({
    select: { name: true, sector: true },
    orderBy: { name: 'asc' },
  })
  cache.set('chat:companyList', companies, COMPANY_LIST_TTL)
  return companies
}

function compressCompanyList(companies: { name: string; sector: string | null }[]): string {
  const bySector = new Map<string, string[]>()
  for (const c of companies) {
    const sector = c.sector || 'Other'
    if (!bySector.has(sector)) bySector.set(sector, [])
    bySector.get(sector)!.push(c.name)
  }
  return Array.from(bySector.entries())
    .map(([sector, names]) => `${sector}: ${names.join(', ')}`)
    .join('\n')
}

type ArticleRow = {
  id: string; title: string; url: string; source: string | null
  summary: string | null; publishedAt: Date | null; sentiment: string | null
  company: { name: string; sector: string | null }
}
type SummaryRow = {
  summaryText: string; metadata: string | null
  company: { name: string; sector: string | null }
}

async function getPortfolioContext(companyId?: string) {
  const contextKey = `chat:ctx:${companyId || 'all'}`
  const cached = cache.get<{ articles: ArticleRow[]; summaries: SummaryRow[] }>(contextKey)
  if (cached) return cached

  const [articles, summaries] = await Promise.all([
    companyId
      ? db.article.findMany({
          where: { companyId },
          orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }],
          take: 15,
          select: { id: true, title: true, url: true, source: true, summary: true, publishedAt: true, sentiment: true, company: { select: { name: true, sector: true } } },
        })
      : db.article.findMany({
          orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }],
          take: 50,
          select: { id: true, title: true, url: true, source: true, summary: true, publishedAt: true, sentiment: true, company: { select: { name: true, sector: true } } },
        }),
    db.summary.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { generatedAt: 'desc' },
      take: companyId ? 3 : 10,
      select: { summaryText: true, metadata: true, company: { select: { name: true, sector: true } } },
    }),
  ])

  const result = { articles, summaries }
  cache.set(contextKey, result, CHAT_CONTEXT_TTL)
  return result
}

function buildContextString(articles: ArticleRow[], summaries: SummaryRow[]): string {
  const byCompany = new Map<string, ArticleRow[]>()
  for (const a of articles) {
    const key = a.company.name
    if (!byCompany.has(key)) byCompany.set(key, [])
    byCompany.get(key)!.push(a)
  }

  const articleContext = Array.from(byCompany.entries())
    .map(([name, companyArticles]) => {
      const sector = companyArticles[0]?.company.sector || 'Unknown'
      const lines = companyArticles.map((a) => {
        const signal = a.sentiment ? ` [${a.sentiment}]` : ''
        const summary = a.summary ? ` — ${a.summary}` : ''
        return `  - ${a.title} (${a.source ?? 'unknown'})${signal}${summary}`
      })
      return `${name} (${sector}):\n${lines.join('\n')}`
    })
    .join('\n\n')

  const summaryContext = summaries
    .map((s) => `[${s.company.name} (${s.company.sector || 'Unknown'})] ${s.summaryText}${formatMetaContext(s.metadata)}`)
    .join('\n')

  return `Recent news articles by company:\n${articleContext || '(No recent articles)'}\n\nCompany intelligence summaries:\n${summaryContext || '(No summaries available)'}`
}

// --- Route handler ---

chat.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = chatBodySchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', code: 'VALIDATION_ERROR' }, 400)
  }

  const { message: rawMessage, companyId, history } = parsed.data

  // Sanitize input
  const sanitizedMessage = rawMessage
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!sanitizedMessage || sanitizedMessage.length < 1) {
    return c.json({ error: 'Message is empty after sanitization', code: 'VALIDATION_ERROR' }, 400)
  }

  if (INJECTION_PATTERNS.some((pattern) => pattern.test(sanitizedMessage))) {
    return c.json({
      response: "I can only help with questions about Initialized Capital's portfolio companies and related news. Could you rephrase your question about a portfolio company?",
      followUps: ['Portfolio health check', 'Any breaking news?', 'Sector overview'],
    })
  }

  try {
    const [companyList, { articles, summaries }] = await Promise.all([
      getCompanyList(),
      getPortfolioContext(companyId),
    ])

    const companyListContext = compressCompanyList(companyList)
    const dbContext = buildContextString(articles, summaries)
    const contextMessage = `Full portfolio (${companyList.length} companies by sector):\n${companyListContext}\n\n${dbContext}`

    // Build message history for the agent
    const messages: CoreMessage[] = []

    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({
      role: 'user',
      content: `${contextMessage}\n\n<user_question>${sanitizedMessage}</user_question>`,
    })

    // Execute via Mastra agent (handles tool orchestration + model fallback)
    const result = await portfolioAgent.generate(messages, { maxSteps: 5 })
    const text = await result.text

    if (!text) {
      return c.json({ error: 'Empty response from AI', code: 'EMPTY_RESPONSE' }, 500)
    }

    const steps = (await result.steps) ?? []
    const followUps = generateFollowUps(steps as ToolStep[])

    return c.json({ response: sanitize(text), followUps })
  } catch (err) {
    console.error('Chat error:', err instanceof Error ? err.message : String(err))
    return c.json({ error: 'Failed to process chat', code: 'CHAT_ERROR' }, 500)
  }
})

export default chat
