import Exa from 'exa-js'
import type { FetchedArticle } from './newsdata'

let _exa: Exa | null | undefined = undefined
export function getExa(): Exa | null {
  if (_exa === undefined) {
    const apiKey = process.env.EXA_API_KEY
    _exa = apiKey ? new Exa(apiKey) : null
  }
  return _exa
}

const MAX_ARTICLE_AGE_MS = 180 * 86_400_000 // 6 months

export interface ExaSearchOptions {
  numResults?: number
  daysBack?: number
}

export async function searchExa(query: string, opts: ExaSearchOptions = {}): Promise<string> {
  const exa = getExa()
  if (!exa) return 'Search unavailable — EXA_API_KEY not configured.'

  try {
    const numResults = Math.min(Math.max(opts.numResults ?? 5, 1), 10)
    const daysBack = opts.daysBack ?? 14
    const result = await exa.search(query, {
      type: 'auto',
      category: 'news',
      numResults,
      startPublishedDate: new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0],
    })

    if (!result.results || result.results.length === 0) {
      return `No recent news found for "${query}".`
    }

    return result.results
      .map((r) => {
        const source = r.url ? new URL(r.url).hostname.replace('www.', '') : 'unknown'
        return `- ${r.title || 'Untitled'} (${source}) ${r.url}`
      })
      .join('\n')
  } catch (err) {
    console.error('Exa search error:', err instanceof Error ? err.message : String(err))
    return 'Search temporarily unavailable. Please answer using the portfolio context already provided.'
  }
}

export async function fetchExaNews(query: string, daysBack = 180): Promise<FetchedArticle[]> {
  const exa = getExa()
  if (!exa) throw new Error('EXA_API_KEY not set')
  const cutoff = new Date(Date.now() - MAX_ARTICLE_AGE_MS)

  const result = await exa.searchAndContents(query, {
    type: 'auto',
    category: 'news',
    numResults: 10,
    startPublishedDate: new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0],
    highlights: { numSentences: 2, highlightsPerUrl: 1 },
  })

  return result.results
    .filter((r) => {
      try { new URL(r.url); return true } catch { return false }
    })
    .map((r) => {
      const pubDate = r.publishedDate ? new Date(r.publishedDate) : null
      const highlight = (r as Record<string, unknown>).highlights
      const summary = Array.isArray(highlight) && highlight.length > 0
        ? String(highlight[0])
        : undefined
      return {
        title: r.title || query,
        url: r.url,
        source: new URL(r.url).hostname.replace('www.', ''),
        publishedAt: pubDate && pubDate > cutoff ? pubDate : null,
        summary,
      }
    })
}
