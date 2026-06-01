import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

// ── Configuration ────────────────────────────────────────────────────────────
// Adjust these to match your environment
export const MC_HOME = process.env.MC_HOME ?? '/home/mc/server'
export const BACKUP_DIR = process.env.MC_BACKUP_DIR ?? '/home/mc/backups'
export const MC_SERVICE = process.env.MC_SERVICE ?? 'minecraft'
export const MAX_BACKUPS = parseInt(process.env.MC_MAX_BACKUPS ?? '10', 10)
export const MC_PORT = parseInt(process.env.MC_PORT ?? '25565', 10)
export const MC_HOST = process.env.MC_HOST ?? '127.0.0.1'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ServerStatus {
  online: boolean
  version: string | null
  playersOnline: number
  maxPlayers: number
  uptime: number | null
  motd: string | null
}

export interface BackupInfo {
  name: string
  size: number
  createdAt: Date
}

export interface ResourceUsage {
  memUsedBytes: number
  memTotalBytes: number
  memFreeBytes: number
  cpuModel: string
  loadAvg: number[]
  diskUsedBytes: number
  diskTotalBytes: number
}

// ── Systemd helpers ──────────────────────────────────────────────────────────

/**
 * Run a systemctl command for the minecraft service.
 * Uses execFile (no shell) with a hardcoded argument list.
 *
 * NOTE: The web-app user needs passwordless sudo for these commands.
 * Add to /etc/sudoers.d/minecraft-web:
 *
 *   www-data ALL=(ALL) NOPASSWD: \
 *     /usr/bin/systemctl start minecraft, \
 *     /usr/bin/systemctl stop minecraft, \
 *     /usr/bin/systemctl restart minecraft, \
 *     /usr/bin/systemctl is-active minecraft
 *
 * Replace "www-data" with the user running this Node process.
 */
async function systemctl(action: 'start' | 'stop' | 'restart' | 'is-active'): Promise<string> {
  const { stdout } = await execFileAsync('sudo', ['/usr/bin/systemctl', action, MC_SERVICE])
  return stdout.trim()
}

export async function startServer(): Promise<void> {
  await systemctl('start')
}

export async function stopServer(): Promise<void> {
  await systemctl('stop')
}

export async function restartServer(): Promise<void> {
  await systemctl('restart')
}

export async function isServerActive(): Promise<boolean> {
  try {
    const out = await systemctl('is-active')
    return out === 'active'
  } catch {
    return false
  }
}

// ── Status query ─────────────────────────────────────────────────────────────

export async function getServerStatus(): Promise<ServerStatus> {
  const active = await isServerActive()

  if (!active) {
    return { online: false, version: null, playersOnline: 0, maxPlayers: 0, uptime: null, motd: null }
  }

  // Try to query the Minecraft server via the status protocol
  try {
    // Dynamic import to handle ESM
    const { status } = await import('minecraft-server-util')
    const result = await status(MC_HOST, MC_PORT, { timeout: 3000 })
    return {
      online: true,
      version: result.version.name,
      playersOnline: result.players.online,
      maxPlayers: result.players.max,
      uptime: await getServiceUptime(),
      motd: result.motd?.clean ?? null,
    }
  } catch {
    // Server is active in systemd but not yet accepting connections (starting up)
    return {
      online: true,
      version: null,
      playersOnline: 0,
      maxPlayers: 0,
      uptime: await getServiceUptime(),
      motd: null,
    }
  }
}

async function getServiceUptime(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('systemctl', [
      'show', MC_SERVICE,
      '--property=ActiveEnterTimestamp',
      '--no-pager',
    ])
    const match = stdout.match(/ActiveEnterTimestamp=(.+)/)
    if (!match) return null
    const ts = new Date(match[1].trim()).getTime()
    if (isNaN(ts)) return null
    return Math.floor((Date.now() - ts) / 1000)
  } catch {
    return null
  }
}

// ── Player list ──────────────────────────────────────────────────────────────

export async function getPlayerList(): Promise<string[]> {
  try {
    const { status } = await import('minecraft-server-util')
    const result = await status(MC_HOST, MC_PORT, { timeout: 3000 })
    return (result.players.sample ?? []).map((p: { name: string }) => p.name)
  } catch {
    return []
  }
}

// ── Logs ─────────────────────────────────────────────────────────────────────

export async function getRecentLogs(lines = 100): Promise<string[]> {
  const logFile = path.join(MC_HOME, 'logs', 'latest.log')
  return new Promise((resolve) => {
    try {
      const stat = fs.statSync(logFile)
      const fileSize = stat.size
      if (fileSize === 0) return resolve([])

      // Read last ~50KB to get recent lines without loading the whole file
      const chunkSize = Math.min(fileSize, 50 * 1024)
      const buf = Buffer.alloc(chunkSize)
      const fd = fs.openSync(logFile, 'r')
      fs.readSync(fd, buf, 0, chunkSize, fileSize - chunkSize)
      fs.closeSync(fd)

      const text = buf.toString('utf8')
      const allLines = text.split('\n').filter(l => l.trim() !== '')
      const recent = allLines.slice(-lines).reverse()
      resolve(recent)
    } catch {
      resolve([])
    }
  })
}

// ── Properties ───────────────────────────────────────────────────────────────

export function getPropertiesPath(): string {
  return path.join(MC_HOME, 'server.properties')
}

export function readProperties(): Record<string, string> {
  const filePath = getPropertiesPath()
  const result: Record<string, string> = {}
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      result[key] = value
    }
  } catch {
    // File not found or unreadable
  }
  return result
}

export function writeProperties(updates: Record<string, string>): void {
  const filePath = getPropertiesPath()

  // Read existing content to preserve comments and ordering
  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    content = ''
  }

  const lines = content.split('\n')
  const updatedKeys = new Set<string>()

  const newLines = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) return line
    const key = trimmed.slice(0, eqIdx).trim()
    if (key in updates) {
      updatedKeys.add(key)
      return `${key}=${updates[key]}`
    }
    return line
  })

  // Append any new keys that weren't in the original file
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${value}`)
    }
  }

  fs.writeFileSync(filePath, newLines.join('\n'), 'utf8')
}

// ── Backups ──────────────────────────────────────────────────────────────────

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

export function listBackups(): BackupInfo[] {
  ensureBackupDir()
  try {
    const files = fs.readdirSync(BACKUP_DIR)
    const backups: BackupInfo[] = []
    for (const file of files) {
      if (!/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.tar\.gz$/.test(file)) continue
      const fullPath = path.join(BACKUP_DIR, file)
      const stat = fs.statSync(fullPath)
      backups.push({ name: file, size: stat.size, createdAt: stat.mtime })
    }
    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch {
    return []
  }
}

export async function createBackup(): Promise<string> {
  ensureBackupDir()
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const name = `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.tar.gz`
  const dest = path.join(BACKUP_DIR, name)

  // tar -czf <dest> -C <MC_HOME> world
  await execFileAsync('tar', ['-czf', dest, '-C', MC_HOME, 'world'])

  // Prune old backups
  await pruneBackups()

  return name
}

async function pruneBackups(): Promise<void> {
  const backups = listBackups()
  if (backups.length <= MAX_BACKUPS) return
  const toDelete = backups.slice(MAX_BACKUPS)
  for (const b of toDelete) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, b.name))
    } catch {
      // ignore
    }
  }
}

export async function restoreBackup(name: string): Promise<void> {
  // Validate name format (already validated by route, but double-check)
  if (!/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.tar\.gz$/.test(name)) {
    throw new Error('Invalid backup name')
  }
  const src = path.join(BACKUP_DIR, name)
  if (!fs.existsSync(src)) throw new Error('Backup not found')

  // Remove existing world folder and extract
  const worldDir = path.join(MC_HOME, 'world')
  if (fs.existsSync(worldDir)) {
    fs.rmSync(worldDir, { recursive: true, force: true })
  }
  await execFileAsync('tar', ['-xzf', src, '-C', MC_HOME])
}

export function deleteBackup(name: string): void {
  if (!/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.tar\.gz$/.test(name)) {
    throw new Error('Invalid backup name')
  }
  const filePath = path.join(BACKUP_DIR, name)
  if (!fs.existsSync(filePath)) throw new Error('Backup not found')
  fs.unlinkSync(filePath)
}

export function getBackupPath(name: string): string {
  if (!/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.tar\.gz$/.test(name)) {
    throw new Error('Invalid backup name')
  }
  return path.join(BACKUP_DIR, name)
}

// ── Resource usage ───────────────────────────────────────────────────────────

export async function getResourceUsage(): Promise<ResourceUsage> {
  const cpus = os.cpus()
  const memTotal = os.totalmem()
  const memFree = os.freemem()

  // Disk usage via df
  let diskUsed = 0
  let diskTotal = 0
  try {
    const { stdout } = await execFileAsync('df', ['--output=used,size', '-k', MC_HOME])
    const lines = stdout.trim().split('\n')
    if (lines.length >= 2) {
      const parts = lines[1].trim().split(/\s+/)
      diskUsed = parseInt(parts[0], 10) * 1024
      diskTotal = parseInt(parts[1], 10) * 1024
    }
  } catch {
    // ignore
  }

  return {
    memUsedBytes: memTotal - memFree,
    memTotalBytes: memTotal,
    memFreeBytes: memFree,
    cpuModel: cpus[0]?.model ?? 'Unknown',
    loadAvg: os.loadavg(),
    diskUsedBytes: diskUsed,
    diskTotalBytes: diskTotal,
  }
}