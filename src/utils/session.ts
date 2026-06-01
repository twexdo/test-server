import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'

const SESSION_FILE = path.join(process.cwd(), 'data', 'sessions.json')
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

interface Session {
  username: string
  expires: number
}

type SessionStore = Record<string, Session>

function readStore(): SessionStore {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf8')
    return JSON.parse(raw) as SessionStore
  } catch {
    return {}
  }
}

function writeStore(store: SessionStore): void {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(store, null, 2), 'utf8')
}

function purgeExpired(store: SessionStore): SessionStore {
  const now = Date.now()
  const cleaned: SessionStore = {}
  for (const [token, session] of Object.entries(store)) {
    if (session.expires > now) cleaned[token] = session
  }
  return cleaned
}

export function createSession(username: string): string {
  const token = randomBytes(32).toString('hex')
  const store = purgeExpired(readStore())
  store[token] = { username, expires: Date.now() + SESSION_TTL_MS }
  writeStore(store)
  return token
}

export function getSession(token: string): Session | null {
  if (!token) return null
  const store = readStore()
  const session = store[token]
  if (!session) return null
  if (session.expires < Date.now()) {
    // Expired — clean up
    delete store[token]
    writeStore(store)
    return null
  }
  return session
}

export function deleteSession(token: string): void {
  const store = readStore()
  delete store[token]
  writeStore(store)
}