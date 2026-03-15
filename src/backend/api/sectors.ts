import { Hono } from 'hono'
import { requireRefreshToken } from '../middleware/auth'
import {
  getAllSectorBriefs,
  getSectorBrief,
  generateSectorBrief,
  generateAllSectorBriefs,
} from '../services/sector-briefs'

const sectors = new Hono()

// GET /api/sectors — list all sectors with briefs
sectors.get('/', async (c) => {
  const briefs = await getAllSectorBriefs()
  return c.json(briefs)
})

// POST /api/sectors/generate-all — MUST come before /:sector routes
sectors.post('/generate-all', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const result = await generateAllSectorBriefs()
  return c.json(result)
})

// GET /api/sectors/:sector — single sector brief
sectors.get('/:sector', async (c) => {
  const sector = decodeURIComponent(c.req.param('sector'))
  const brief = await getSectorBrief(sector)
  if (!brief) {
    return c.json({ error: 'No brief found for this sector', code: 'NOT_FOUND' }, 404)
  }
  return c.json({
    sector: brief.sector,
    brief: brief.briefText,
    metadata: brief.metadata ? JSON.parse(brief.metadata) : null,
    generatedAt: brief.generatedAt?.toISOString() ?? null,
  })
})

// POST /api/sectors/:sector/generate — generate brief for one sector
sectors.post('/:sector/generate', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const sector = decodeURIComponent(c.req.param('sector'))
  const success = await generateSectorBrief(sector)
  if (!success) {
    return c.json({ error: 'No data available for sector brief', code: 'NO_DATA' }, 422)
  }
  return c.json({ generated: true, sector })
})

export default sectors
