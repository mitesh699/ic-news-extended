const VALID_EVENT_SIGNALS = ['funding', 'hiring', 'product', 'regulatory', 'M&A', 'risk', 'partnership'] as const
export type EventSignal = (typeof VALID_EVENT_SIGNALS)[number]

export interface SummaryMeta {
  keyThemes: string[]
  outlook: string
  actionItems: string[]
  confidence?: string
  signals: EventSignal[]
}

export function parseSummaryMeta(raw: string | null | undefined): SummaryMeta | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return {
      keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes : [],
      outlook: parsed.outlook ?? 'stable',
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : undefined,
      signals: Array.isArray(parsed.signals)
        ? parsed.signals.filter((s: unknown) => VALID_EVENT_SIGNALS.includes(s as EventSignal))
        : [],
    }
  } catch {
    return null
  }
}

export function formatMetaContext(raw: string | null | undefined): string {
  const meta = parseSummaryMeta(raw)
  if (!meta) return ''
  const parts: string[] = []
  if (meta.outlook) parts.push(`Outlook: ${meta.outlook}`)
  if (meta.keyThemes.length) parts.push(`Themes: ${meta.keyThemes.join(', ')}`)
  if (meta.signals.length) parts.push(`Signals: ${meta.signals.join(', ')}`)
  return parts.length ? ` | ${parts.join(' | ')}` : ''
}
