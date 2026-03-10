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

export async function fetchExaNews(query: string): Promise<FetchedArticle[]> {
  const exa = getExa()
  if (!exa) throw new Error('EXA_API_KEY not set')
  const cutoff = new Date(Date.now() - MAX_ARTICLE_AGE_MS)

  const result = await exa.search(query, {
    type: 'auto',
    category: 'news',
    numResults: 10,
    startPublishedDate: new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0],
  })

  return result.results
    .filter((r) => {
      try { new URL(r.url); return true } catch { return false }
    })
    .map((r) => {
      const pubDate = r.publishedDate ? new Date(r.publishedDate) : null
      return {
        title: r.title || query,
        url: r.url,
        source: new URL(r.url).hostname.replace('www.', ''),
        // Discard dates older than 6 months — Exa sometimes returns stale results
        publishedAt: pubDate && pubDate > cutoff ? pubDate : null,
      }
    })
}
