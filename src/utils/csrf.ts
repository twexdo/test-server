import { createHmac, randomBytes } from 'crypto'

const SECRET = process.env.CSRF_SECRET ?? 'change-me-in-production-csrf-secret'

export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString('hex')
  const sig = createHmac('sha256', SECRET).update(nonce).digest('hex')
  return `${nonce}.${sig}`
}

export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [nonce, sig] = parts
  const expected = createHmac('sha256', SECRET).update(nonce).digest('hex')
  // Constant-time comparison
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  }
  return diff === 0
}