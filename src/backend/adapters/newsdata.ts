import retry from 'async-retry'

interface NewsDataArticle {
  title: string
  link: string
  source_id: string
  pubDate: string | null
}

interface NewsDataResponse {
  status: string
  totalResults: number
  results: NewsDataArticle[]
}

export interface FetchedArticle {
  title: string
  url: string
  source: string
  publishedAt: Date | null
  summary?: string
}

export async function fetchNewsData(companyName: string): Promise<FetchedArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY
  if (!apiKey) throw new Error('NEWSDATA_API_KEY not set — will try fallback')

  const url = new URL('https://newsdata.io/api/1/news')
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('q', companyName)
  url.searchParams.set('language', 'en')
  url.searchParams.set('category', 'business,technology')
  url.searchParams.set('size', '10')
  url.searchParams.set('timeframe', '48')

  const data = await retry(
    async () => {
      const res = await fetch(url.toString())
      if (res.status === 429) throw new Error('rate_limited')
      if (!res.ok) throw new Error(`NewsData API error: ${res.status}`)
      return res.json() as Promise<NewsDataResponse>
    },
    { retries: 3, factor: 2, minTimeout: 1_000, maxTimeout: 30_000 }
  )

  if (!data.results || data.results.length === 0) return []

  return data.results.map((article) => ({
    title: article.title,
    url: article.link,
    source: article.source_id || 'unknown',
    publishedAt: article.pubDate ? new Date(article.pubDate) : null,
  }))
}
