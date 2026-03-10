import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store original env
const originalEnv = process.env

beforeEach(() => {
  process.env = { ...originalEnv, NEWSDATA_API_KEY: 'test-key' }
  vi.clearAllMocks()
})

afterEach(() => {
  process.env = originalEnv
  vi.restoreAllMocks()
})

describe('fetchNewsData', () => {
  it('fetches and transforms articles from NewsData.io', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: 'success',
          totalResults: 2,
          results: [
            { title: 'Article 1', link: 'https://example.com/1', source_id: 'bloomberg', pubDate: '2026-03-07 10:00:00' },
            { title: 'Article 2', link: 'https://example.com/2', source_id: 'reuters', pubDate: null },
          ],
        }),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    // Dynamic import to pick up env
    const { fetchNewsData } = await import('../newsdata')
    const articles = await fetchNewsData('Coinbase')

    expect(articles).toHaveLength(2)
    expect(articles[0].title).toBe('Article 1')
    expect(articles[0].url).toBe('https://example.com/1')
    expect(articles[0].source).toBe('bloomberg')
    expect(articles[0].publishedAt).toBeInstanceOf(Date)
    expect(articles[1].publishedAt).toBeNull()
  })

  it('returns empty array when no results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'success', totalResults: 0, results: [] }),
      })
    )

    const { fetchNewsData } = await import('../newsdata')
    const articles = await fetchNewsData('Unknown')
    expect(articles).toEqual([])
  })

  it('throws when API key is not set', async () => {
    delete process.env.NEWSDATA_API_KEY

    // Re-import to get fresh module
    vi.resetModules()
    const { fetchNewsData } = await import('../newsdata')
    await expect(fetchNewsData('Test')).rejects.toThrow('NEWSDATA_API_KEY not set')
  })
})
