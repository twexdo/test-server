import { Hono } from 'hono'
import fs from 'fs'
import { requireAuthApi } from '../middleware/auth.js'
import { verifyCsrfToken } from '../utils/csrf.js'
import { propertiesUpdateSchema, backupNameSchema } from '../utils/validate.js'
import {
  getServerStatus,
  getPlayerList,
  getRecentLogs,
  readProperties,
  writeProperties,
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  getBackupPath,
  getResourceUsage,
  startServer,
  stopServer,
  restartServer,
} from '../services/minecraft.js'

const mc = new Hono()

// All minecraft API routes require authentication
mc.use('*', requireAuthApi)

// ── CSRF helper ───────────────────────────────────────────────────────────────

function checkCsrf(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const token = c.req.header('x-csrf-token') ?? ''
  return verifyCsrfToken(token)
}

// ── GET /api/minecraft/status ─────────────────────────────────────────────────

mc.get('/status', async (c) => {
  try {
    const status = await getServerStatus()
    return c.json({ success: true, ...status })
  } catch (err) {
    console.error('[minecraft/status]', err)
    return c.json({ success: false, message: 'Failed to get server status' }, 500)
  }
})

// ── GET /api/minecraft/players ────────────────────────────────────────────────

mc.get('/players', async (c) => {
  try {
    const players = await getPlayerList()
    return c.json({ success: true, players, count: players.length })
  } catch (err) {
    console.error('[minecraft/players]', err)
    return c.json({ success: false, message: 'Failed to get player list' }, 500)
  }
})

// ── GET /api/minecraft/logs ───────────────────────────────────────────────────

mc.get('/logs', async (c) => {
  try {
    const linesParam = parseInt(c.req.query('lines') ?? '100', 10)
    const lines = Math.max(1, Math.min(500, isNaN(linesParam) ? 100 : linesParam))
    const logs = await getRecentLogs(lines)
    return c.json({ success: true, logs, count: logs.length })
  } catch (err) {
    console.error('[minecraft/logs]', err)
    return c.json({ success: false, message: 'Failed to read logs' }, 500)
  }
})

// ── GET /api/minecraft/properties ─────────────────────────────────────────────

mc.get('/properties', (c) => {
  try {
    const props = readProperties()
    return c.json({ success: true, properties: props })
  } catch (err) {
    console.error('[minecraft/properties GET]', err)
    return c.json({ success: false, message: 'Failed to read server.properties' }, 500)
  }
})

// ── POST /api/minecraft/properties ────────────────────────────────────────────

mc.post('/properties', async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ success: false, message: 'Invalid CSRF token' }, 403)
  }
  try {
    const body = await c.req.json()
    const parsed = propertiesUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ success: false, message: 'Invalid properties: ' + parsed.error.issues[0]?.message }, 400)
    }

    // Auto-backup before saving
    try {
      await createBackup()
    } catch (backupErr) {
      console.warn('[minecraft/properties] Auto-backup failed:', backupErr)
    }

    writeProperties(parsed.data.properties)
    return c.json({ success: true, message: 'Properties saved' })
  } catch (err) {
    console.error('[minecraft/properties POST]', err)
    return c.json({ success: false, message: 'Failed to save properties' }, 500)
  }
})

// ── POST /api/minecraft/start ─────────────────────────────────────────────────

mc.post('/start', async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ success: false, message: 'Invalid CSRF token' }, 403)
  }
  try {
    await startServer()
    return c.json({ success: true, message: 'Server start requested' })
  } catch (err) {
    console.error('[minecraft/start]', err)
    return c.json({ success: false, message: 'Failed to start server' }, 500)
  }
})

// ── POST /api/minecraft/stop ──────────────────────────────────────────────────

mc.post('/stop', async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ success: false, message: 'Invalid CSRF token' }, 403)
  }
  try {
    await stopServer()
    return c.json({ success: true, message: 'Server stop requested' })
  } catch (err) {
    console.error('[minecraft/stop]', err)
    return c.json({ success: false, message: 'Failed to stop server' }, 500)
  }
})

// ── POST /api/minecraft/restart ───────────────────────────────────────────────

mc.post('/restart', async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ success: false, message: 'Invalid CSRF token' }, 403)
  }
  try {
    await restartServer()
    return c.json({ success: true, message: 'Server restart requested' })
  } catch (err) {
    console.error('[minecraft/restart]', err)
    return c.json({ success: false, message: 'Failed to restart server' }, 500)
  }
})

// ── GET /api/minecraft/backups ────────────────────────────────────────────────

mc.get('/backups', (c) => {
  try {
    const backups = listBackups()
    return c.json({
      success: true,
      backups: backups.map(b => ({
        name: b.name,
        size: b.size,
        createdAt: b.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[minecraft/backups GET]', err)
    return c.json({ success: false, message: 'Failed to list backups' }, 500)
  }
})

// ── POST /api/minecraft/backups ───────────────────────────────────────────────

mc.post('/backups', async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ success: false, message: 'Invalid CSRF token' }, 403)
  }
  try {
    const name = await createBackup()
    return c.json({ success: true, message: 'Backup created', name })
  } catch (err) {
    console.error('[minecraft/backups POST]', err)
    return c.json({ success: false, message: 'Failed to create backup' }, 500)
  }
})

// ── POST /api/minecraft/backups/:name/restore ─────────────────────────────────

mc.post('/backups/:name/restore', async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ success: false, message: 'Invalid CSRF token' }, 403)
  }
  const name = c.req.param('name')
  const parsed = backupNameSchema.safeParse(name)
  if (!parsed.success) {
    return c.json({ success: false, message: 'Invalid backup name' }, 400)
  }
  try {
    await restoreBackup(parsed.data)
    return c.json({ success: true, message: 'Backup restored' })
  } catch (err) {
    console.error('[minecraft/backups/restore]', err)
    const msg = err instanceof Error ? err.message : 'Failed to restore backup'
    return c.json({ success: false, message: msg }, 500)
  }
})

// ── DELETE /api/minecraft/backups/:name ───────────────────────────────────────

mc.delete('/backups/:name', async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ success: false, message: 'Invalid CSRF token' }, 403)
  }
  const name = c.req.param('name')
  const parsed = backupNameSchema.safeParse(name)
  if (!parsed.success) {
    return c.json({ success: false, message: 'Invalid backup name' }, 400)
  }
  try {
    deleteBackup(parsed.data)
    return c.json({ success: true, message: 'Backup deleted' })
  } catch (err) {
    console.error('[minecraft/backups/delete]', err)
    const msg = err instanceof Error ? err.message : 'Failed to delete backup'
    return c.json({ success: false, message: msg }, 500)
  }
})

// ── GET /api/minecraft/backups/:name/download ─────────────────────────────────

mc.get('/backups/:name/download', (c) => {
  const name = c.req.param('name')
  const parsed = backupNameSchema.safeParse(name)
  if (!parsed.success) {
    return c.json({ success: false, message: 'Invalid backup name' }, 400)
  }
  try {
    const filePath = getBackupPath(parsed.data)
    if (!fs.existsSync(filePath)) {
      return c.json({ success: false, message: 'Backup not found' }, 404)
    }
    const stat = fs.statSync(filePath)
    const stream = fs.createReadStream(filePath)
    c.header('Content-Type', 'application/gzip')
    c.header('Content-Disposition', `attachment; filename="${parsed.data}"`)
    c.header('Content-Length', String(stat.size))
    return c.body(stream as unknown as ReadableStream)
  } catch (err) {
    console.error('[minecraft/backups/download]', err)
    return c.json({ success: false, message: 'Failed to download backup' }, 500)
  }
})

// ── GET /api/minecraft/resources ──────────────────────────────────────────────

mc.get('/resources', async (c) => {
  try {
    const usage = await getResourceUsage()
    return c.json({ success: true, ...usage })
  } catch (err) {
    console.error('[minecraft/resources]', err)
    return c.json({ success: false, message: 'Failed to get resource usage' }, 500)
  }
})

export default mc