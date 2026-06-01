// ── CSRF token (injected server-side into each page) ─────────────────────────
// Each page has: <meta name="csrf-token" content="__CSRF_TOKEN__">
function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content ?? ''
}

// ── Authenticated fetch helpers ───────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const method = (options.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = getCsrfToken()
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  return res
}

async function apiGet(url) {
  const res = await apiFetch(url)
  return res.json()
}

async function apiPost(url, body = {}) {
  const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(body) })
  return res.json()
}

async function apiDelete(url) {
  const res = await apiFetch(url, { method: 'DELETE' })
  return res.json()
}

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity .3s'
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open')
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open')
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open')
  }
})

// ── Formatting helpers ────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 0) + ' ' + sizes[i]
}

function formatUptime(secs) {
  if (secs === null || secs === undefined) return '—'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Log line colorizer ────────────────────────────────────────────────────────
function colorLogLine(line) {
  const esc = escapeHtml(line)
  if (/\[ERROR\]|ERROR|FATAL|Exception|error|fatal/i.test(line)) return `<span class="log-err">${esc}</span>`
  if (/\[WARN\]|WARN|warning/i.test(line)) return `<span class="log-warn">${esc}</span>`
  if (/\[INFO\].*(?:Done|Started|Ready|logged in)/i.test(line)) return `<span class="log-ok">${esc}</span>`
  return esc
}

// ── Active nav link ───────────────────────────────────────────────────────────
function setActiveNav() {
  const path = window.location.pathname.replace(/\/$/, '') || '/minecraft'
  document.querySelectorAll('.mc-nav a').forEach(a => {
    const href = a.getAttribute('href').replace(/\/$/, '')
    if (href === path) a.classList.add('active')
    else a.classList.remove('active')
  })
}

document.addEventListener('DOMContentLoaded', setActiveNav)

// ── Logout form CSRF injection ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const logoutForm = document.getElementById('logout-form')
  if (logoutForm) {
    const input = logoutForm.querySelector('input[name="_csrf"]')
    if (input) input.value = getCsrfToken()
  }
})