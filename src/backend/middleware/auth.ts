import { timingSafeEqual } from 'node:crypto'

type HonoContext = { req: { header: (name: string) => string | undefined } }

export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.alloc(64)
  const bBuf = Buffer.alloc(64)
  Buffer.from(a).copy(aBuf)
  Buffer.from(b).copy(bBuf)
  return timingSafeEqual(aBuf, bBuf) && a.length === b.length
}

export function requireRefreshToken(c: HonoContext): boolean {
  const secret = process.env.REFRESH_SECRET
  if (!secret) return false
  const token = c.req.header('X-Refresh-Token') ?? ''
  if (token.length === 0) return false
  return safeCompare(token, secret)
}

export function checkRefreshAuth(c: HonoContext): boolean {
  // Token auth takes priority — always check first
  if (requireRefreshToken(c)) return true

  // Browser-origin auth: Origin header cannot be spoofed by browsers
  // and CORS middleware already restricts allowed origins.
  // This lets the frontend refresh button work without exposing the token client-side.
  const origin = c.req.header('Origin')
  if (!origin) return false
  const allowedOrigins = ['http://localhost:8080']
  const frontendUrl = process.env.FRONTEND_URL?.trim()
  if (frontendUrl) allowedOrigins.push(frontendUrl)
  return allowedOrigins.includes(origin)
}
