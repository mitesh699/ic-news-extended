import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('fetchExaNews', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.EXA_API_KEY = 'test-exa-key'
  })

  afterEach(() => {
    delete process.env.EXA_API_KEY
  })

  it('returns mapped FetchedArticle array from Exa results', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      results: [
        {
          title: 'Stripe raises $1B',
          url: 'https://www.techcrunch.com/stripe-series-i',
          publishedDate: '2026-03-01T00:00:00.000Z',
        },
        {
          title: 'Stripe expands to India',
          url: 'https://www.reuters.com/stripe-india',
          publishedDate: '2026-03-02T00:00:00.000Z',
        },
      ],
    })
    vi.doMock('exa-js', () => ({
      default: function MockExa() { return { search: mockSearch } },
    }))

    const { fetchExaNews } = await import('../exa')
    const articles = await fetchExaNews('Stripe')

    expect(articles).toHaveLength(2)
    expect(articles[0].title).toBe('Stripe raises $1B')
    expect(articles[0].url).toBe('https://www.techcrunch.com/stripe-series-i')
    expect(articles[0].source).toBe('techcrunch.com')
    expect(articles[0].publishedAt).toBeInstanceOf(Date)
    expect(articles[1].source).toBe('reuters.com')
  })

  it('strips www. from hostname for source field', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      results: [
        { title: 'News', url: 'https://www.bloomberg.com/article', publishedDate: null },
      ],
    })
    vi.doMock('exa-js', () => ({
      default: function MockExa() { return { search: mockSearch } },
    }))

    const { fetchExaNews } = await import('../exa')
    const articles = await fetchExaNews('Coinbase')
    expect(articles[0].source).toBe('bloomberg.com')
  })

  it('falls back to query string as title when result has no title', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      results: [
        { title: undefined, url: 'https://example.com/article', publishedDate: null },
      ],
    })
    vi.doMock('exa-js', () => ({
      default: function MockExa() { return { search: mockSearch } },
    }))

    const { fetchExaNews } = await import('../exa')
    const articles = await fetchExaNews('Fallback Query')
    expect(articles[0].title).toBe('Fallback Query')
  })

  it('returns null publishedAt when publishedDate is absent', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      results: [
        { title: 'Article', url: 'https://example.com/a', publishedDate: null },
      ],
    })
    vi.doMock('exa-js', () => ({
      default: function MockExa() { return { search: mockSearch } },
    }))

    const { fetchExaNews } = await import('../exa')
    const articles = await fetchExaNews('Test')
    expect(articles[0].publishedAt).toBeNull()
  })

  it('returns empty array when results is empty', async () => {
    const mockSearch = vi.fn().mockResolvedValue({ results: [] })
    vi.doMock('exa-js', () => ({
      default: function MockExa() { return { search: mockSearch } },
    }))

    const { fetchExaNews } = await import('../exa')
    const articles = await fetchExaNews('Obscure Company')
    expect(articles).toEqual([])
  })

  it('throws when EXA_API_KEY is not set', async () => {
    delete process.env.EXA_API_KEY
    vi.doMock('exa-js', () => ({
      default: vi.fn().mockImplementation(() => ({ search: vi.fn() })),
    }))

    const { fetchExaNews } = await import('../exa')
    await expect(fetchExaNews('Test')).rejects.toThrow('EXA_API_KEY not set')
  })

  it('passes correct search parameters to Exa client', async () => {
    const mockSearch = vi.fn().mockResolvedValue({ results: [] })
    vi.doMock('exa-js', () => ({
      default: function MockExa() { return { search: mockSearch } },
    }))

    const { fetchExaNews } = await import('../exa')
    await fetchExaNews('Plaid')

    const [query, options] = mockSearch.mock.calls[0]
    expect(query).toBe('Plaid')
    expect(options.type).toBe('auto')
    expect(options.category).toBe('news')
    expect(options.numResults).toBe(10)
    expect(options.startPublishedDate).toBeDefined()
  })

  it('propagates search errors to the caller', async () => {
    const mockSearch = vi.fn().mockRejectedValue(new Error('Exa API error'))
    vi.doMock('exa-js', () => ({
      default: function MockExa() { return { search: mockSearch } },
    }))

    const { fetchExaNews } = await import('../exa')
    await expect(fetchExaNews('Test')).rejects.toThrow('Exa API error')
  })

  it('filters out results with malformed URLs', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      results: [
        { title: 'Good', url: 'https://example.com/article', publishedDate: null },
        { title: 'Bad', url: 'not-a-url', publishedDate: null },
      ],
    })
    vi.doMock('exa-js', () => ({
      default: function MockExa() { return { search: mockSearch } },
    }))

    const { fetchExaNews } = await import('../exa')
    const articles = await fetchExaNews('Test')
    expect(articles).toHaveLength(1)
    expect(articles[0].title).toBe('Good')
  })
})
