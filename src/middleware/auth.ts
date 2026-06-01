import type { Context, Next } from 'hono'
import { getSession } from '../utils/session.js'

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const cookie = c.req.header('cookie') ?? ''
  const token = parseCookie(cookie, 'session')

  if (!token) {
    return c.redirect('/login')
  }

  const session = getSession(token)
  if (!session) {
    return c.redirect('/login')
  }

  // Attach username to context for downstream handlers
  c.set('username', session.username)
  await next()
}

export async function requireAuthApi(c: Context, next: Next): Promise<Response | void> {
  const cookie = c.req.header('cookie') ?? ''
  const token = parseCookie(cookie, 'session')

  if (!token) {
    return c.json({ success: false, message: 'Unauthorized' }, 401)
  }

  const session = getSession(token)
  if (!session) {
    return c.json({ success: false, message: 'Unauthorized' }, 401)
  }

  c.set('username', session.username)
  await next()
}

function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k.trim() === name) return decodeURIComponent(rest.join('='))
  }
  return null
}