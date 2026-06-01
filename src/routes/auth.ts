import { Hono } from 'hono'
import fs from 'fs'
import path from 'path'
import { createSession, deleteSession, getSession } from '../utils/session.js'
import { generateCsrfToken, verifyCsrfToken } from '../utils/csrf.js'

// ── Credentials stored in data/users.json ────────────────────────────────────
// Format: { "admin": "hashed-password" }
// Passwords are stored as SHA-256 hex hashes.
// To add a user, run:
//   node -e "const c=require('crypto');console.log(c.createHash('sha256').update('yourpassword').digest('hex'))"
// Then add to data/users.json: { "admin": "<hash>" }

import { createHash } from 'crypto'
import { setCookie } from 'hono/cookie'

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

function loadUsers(): Record<string, string> {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

function verifyCredentials(username: string, password: string): boolean {
  const users = loadUsers()
  const stored = users[username]
  if (!stored) return false
  return stored === hashPassword(password)
}

function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k.trim() === name) return decodeURIComponent(rest.join('='))
  }
  return null
}


const auth = new Hono()

// GET /login — serve login page
auth.get('/login', (c) => {
  const cookie = c.req.header('cookie') ?? ''
  const token = parseCookie(cookie, 'session')
  // Already logged in → redirect to dashboard
  if (token && getSession(token)) {
    return c.redirect('/minecraft/')
  }

  const csrfToken = generateCsrfToken()
  const html = fs.readFileSync(path.join(process.cwd(), 'static', 'login.html'), 'utf8')
  const rendered = html.replace('__CSRF_TOKEN__', csrfToken)
  return c.html(rendered)
})

// POST /login — handle login form
auth.post('/login', async (c) => {
  const body = await c.req.parseBody()
  const username = String(body['username'] ?? '').trim()
  const password = String(body['password'] ?? '')
  const csrfToken = String(body['_csrf'] ?? '')

  if (!verifyCsrfToken(csrfToken)) {
    return c.html(loginErrorPage('Invalid request. Please try again.'), 403)
  }

  if (!username || !password) {
    return c.html(loginErrorPage('Username and password are required.'), 400)
  }

  if (!verifyCredentials(username, password)) {
    return c.html(loginErrorPage('Invalid username or password.'), 401)
  }

  const sessionToken = createSession(username)
  const newCsrf = generateCsrfToken()

  setCookie(c,'session',sessionToken,{
    httpOnly:true,
    sameSite:"Strict",
    path:"/",
    maxAge:28800

  })

  setCookie(c,'csrf',newCsrf,{
    sameSite:"Strict",
    path:"/",
    maxAge:28800
  })
  
  return c.redirect('/minecraft/')
})

// POST /logout
auth.post('/logout', async (c) => {
  const cookie = c.req.header('cookie') ?? ''
  const token = parseCookie(cookie, 'session')
  if (token) deleteSession(token)
  c.header('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
  c.header('Set-Cookie', 'csrf=; SameSite=Strict; Path=/; Max-Age=0')
  return c.redirect('/login')
})

function loginErrorPage(message: string): string {
  const csrfToken = generateCsrfToken()
  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'static', 'login.html'), 'utf8')
    return html
      .replace('__CSRF_TOKEN__', csrfToken)
      .replace('__ERROR__', `<div class="login-error">${escapeHtml(message)}</div>`)
      .replace('<!--__ERROR__-->', `<div class="login-error">${escapeHtml(message)}</div>`)
  } catch {
    return `<p>${escapeHtml(message)}</p>`
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default auth