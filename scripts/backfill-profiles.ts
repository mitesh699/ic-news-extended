import dotenv from 'dotenv'
dotenv.config()

import Exa from 'exa-js'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../src/backend/db/client'

const exa = new Exa(process.env.EXA_API_KEY!)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const BATCH_SIZE = 5
const DELAY_MS = 1500 // rate limit courtesy

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchProfileFromExa(name: string, description: string | null): Promise<string | null> {
  const query = `${name} company overview business model operations`

  try {
    const result = await exa.searchAndContents(query, {
      type: 'auto',
      numResults: 3,
      highlights: { numSentences: 3, highlightsPerUrl: 2 },
    })

    if (!result.results || result.results.length === 0) return null

    // Collect all highlights
    const highlights: string[] = []
    for (const r of result.results) {
      const h = (r as Record<string, unknown>).highlights
      if (Array.isArray(h)) {
        highlights.push(...h.map(String))
      }
    }

    if (highlights.length === 0) return null

    // Use Haiku to synthesize a business profile from the highlights
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Based on the following excerpts about "${name}" (${description ?? 'a company'}), write a 2-3 sentence business profile covering: what the company does, how it makes money, and who its primary customers are. Be factual and concise. No marketing language.

Excerpts:
${highlights.join('\n\n')}

Business profile:`,
        },
      ],
    })

    const text = response.content[0]
    if (text.type === 'text' && text.text.trim().length > 20) {
      return text.text.trim()
    }
    return null
  } catch (err) {
    console.error(`  [error] ${name}:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

async function main() {
  const companies = await db.company.findMany({
    where: { businessProfile: null },
    select: { id: true, name: true, description: true },
    orderBy: { name: 'asc' },
  })

  console.log(`Found ${companies.length} companies without business profiles`)

  let updated = 0
  let failed = 0

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE)
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + BATCH_SIZE, companies.length)} of ${companies.length})`)

    const results = await Promise.allSettled(
      batch.map(async (c) => {
        const profile = await fetchProfileFromExa(c.name, c.description)
        if (profile) {
          await db.company.update({
            where: { id: c.id },
            data: { businessProfile: profile },
          })
          console.log(`  [ok] ${c.name}: ${profile.slice(0, 80)}...`)
          return true
        }
        console.log(`  [skip] ${c.name}: no usable data from Exa`)
        return false
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) updated++
      else failed++
    }

    // Rate limit pause between batches
    if (i + BATCH_SIZE < companies.length) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed/skipped: ${failed}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
  })
