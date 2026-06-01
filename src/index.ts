import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import fs from 'fs'
import { Hono } from 'hono'
import os from 'os'
import path from 'path'

import { requireAuth } from './middleware/auth.js'
import authRouter from './routes/auth.js'
import minecraftRouter from './routes/minecraft.js'
import { generateCsrfToken } from './utils/csrf.js'

import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const LOG_FILE = resolve(process.cwd(), '.logs')

export async function writeLog(data: Record<string, unknown>) {
  try {
    await appendFile(
      LOG_FILE,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...data,
      }) + '\n'
    )
  } catch (err) {
    console.error('Failed to write log:', err)
  }
}


const app = new Hono()


app.use('*', async (c, next) => {
  const start = Date.now()

  try {
    await next()

    await writeLog({
      type: 'request',
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: Date.now() - start,
    })
  } catch (error) {
    await writeLog({
      type: 'error',
      method: c.req.method,
      path: c.req.path,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - start,
    })

    throw error
  }
})

app.onError(async (error, c) => {
  await writeLog({
    type: 'unhandled_error',
    method: c.req.method,
    path: c.req.path,
    error: error.message,
    stack: error.stack,
  })

  return c.json({ error: 'Internal Server Error' }, 500)
})

// ── Static assets ─────────────────────────────────────────────────────────────
app.use('/static/*', serveStatic({ root: './' }))

// ── Auth routes (login / logout) ──────────────────────────────────────────────
app.route('/', authRouter)

// ── Minecraft API ─────────────────────────────────────────────────────────────
app.route('/api/minecraft', minecraftRouter)

// ── Minecraft dashboard pages (protected) ─────────────────────────────────────
// Serve static HTML files from static/minecraft/ with auth guard
app.get('/minecraft', requireAuth, (c) => c.redirect('/minecraft/'))

app.get('/minecraft/*', requireAuth, (c) => {
  const url = new URL(c.req.url)
  let filePath = url.pathname

  // Strip trailing slash → serve index.html
  if (filePath === '/minecraft/' || filePath === '/minecraft') {
    filePath = '/minecraft/index.html'
  }

  const diskPath = path.join(process.cwd(), 'static', filePath)

  if (!fs.existsSync(diskPath)) {
    return c.notFound()
  }

  let html = fs.readFileSync(diskPath, 'utf8')

  // Inject CSRF token into every dashboard page
  const csrf = generateCsrfToken()
  html = html.replace('__CSRF_TOKEN__', csrf)

  return c.html(html)
})

// ── Existing system dashboard ─────────────────────────────────────────────────
app.get('/', (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), 'static', 'index.html'),
    'utf8'
  )
  return c.html(html)
})

app.get('/api/data', (c) => {
  const cpu = os.cpus()[0]
  const tail = Math.max(1, Math.min(10000, parseInt(c.req.query('tail') ?? '100', 10) || 100))

  let logs = 'No logs found'
  try {
    logs = fs.readFileSync('/home/adrian/Coding/runner.log', 'utf8')
      .split('\n').slice(-tail).join('\n')
  } catch (err) {
    logs = (err as NodeJS.ErrnoException).message
  }

  return c.json({
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    uptimeSecs: Math.floor(os.uptime()),
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    username: os.userInfo().username,
    cpuModel: cpu?.model ?? 'Unknown',
    cpuSpeed: cpu?.speed ?? 0,
    logs,
  })
})

// ── Start server ──────────────────────────────────────────────────────────────
serve(
  { fetch: app.fetch, port: 8080 },
  (info) => console.log(`Server running on http://localhost:${info.port}`)
)