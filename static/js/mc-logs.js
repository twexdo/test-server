let allLines = []

async function loadLogs() {
  const lines = parseInt(document.getElementById('lines-input').value, 10) || 100
  try {
    const data = await apiGet(`/api/minecraft/logs?lines=${lines}`)
    if (!data.success) return

    allLines = data.logs ?? []
    document.getElementById('log-count').textContent = `${allLines.length} lines`
    document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString()
    filterLogs()
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      document.getElementById('last-updated').textContent = 'Failed to load — ' + new Date().toLocaleTimeString()
    }
  }
}

function filterLogs() {
  const query = (document.getElementById('log-search').value ?? '').toLowerCase()
  const body = document.getElementById('log-body')

  const filtered = query
    ? allLines.filter(l => l.toLowerCase().includes(query))
    : allLines

  if (filtered.length === 0) {
    body.innerHTML = '<span style="color:var(--dim)">No matching log lines</span>'
    return
  }

  body.innerHTML = filtered.map(colorLogLine).join('\n')
}

// Auto-refresh
let refreshTimer = null

function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(() => {
    if (document.getElementById('auto-refresh').checked) loadLogs()
  }, 10000)
}

document.getElementById('auto-refresh').addEventListener('change', (e) => {
  if (e.target.checked) startRefresh()
  else if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
})

loadLogs()
startRefresh()