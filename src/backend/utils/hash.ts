import { createHash } from 'crypto'

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}
