let pendingAction = null

async function loadStatus() {
  try {
    const [status, resources] = await Promise.all([
      apiGet('/api/minecraft/status'),
      apiGet('/api/minecraft/resources'),
    ])

    // Status badge
    const badge = document.getElementById('status-badge')
    const statusText = document.getElementById('status-text')
    badge.className = 'status-badge ' + (status.online ? (status.version ? 'online' : 'starting') : 'offline')
    statusText.textContent = status.online ? (status.version ? 'Online' : 'Starting…') : 'Offline'

    // Cards
    document.getElementById('card-version').textContent = status.version ?? '—'
    document.getElementById('card-players').textContent = status.online ? String(status.playersOnline) : '—'
    document.getElementById('card-players-max').textContent = status.online ? `of ${status.maxPlayers} max` : ''
    document.getElementById('card-uptime').textContent = formatUptime(status.uptime)

    // MOTD
    const motdWrap = document.getElementById('motd-wrap')
    if (status.motd) {
      document.getElementById('card-motd').textContent = status.motd
      motdWrap.style.display = ''
    } else {
      motdWrap.style.display = 'none'
    }

    // Resources
    if (resources.success) {
      document.getElementById('card-load').textContent = resources.loadAvg[0].toFixed(2)
      document.getElementById('card-cpu-model').textContent = resources.cpuModel

      const memPct = Math.round((resources.memUsedBytes / resources.memTotalBytes) * 100)
      const ramBar = document.getElementById('ram-bar')
      ramBar.style.width = memPct + '%'
      ramBar.className = 'ram-bar' + (memPct > 85 ? ' crit' : memPct > 65 ? ' warn' : '')
      document.getElementById('ram-used').textContent = formatBytes(resources.memUsedBytes)
      document.getElementById('ram-total').textContent = formatBytes(resources.memTotalBytes)
      document.getElementById('ram-pct').textContent = memPct + '%'

      if (resources.diskTotalBytes > 0) {
        const diskPct = Math.round((resources.diskUsedBytes / resources.diskTotalBytes) * 100)
        const diskBar = document.getElementById('disk-bar')
        diskBar.style.width = diskPct + '%'
        diskBar.className = 'ram-bar' + (diskPct > 85 ? ' crit' : diskPct > 65 ? ' warn' : '')
        document.getElementById('disk-used').textContent = formatBytes(resources.diskUsedBytes)
        document.getElementById('disk-total').textContent = formatBytes(resources.diskTotalBytes)
        document.getElementById('disk-pct').textContent = diskPct + '%'
      }
    }

    document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString()
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      document.getElementById('last-updated').textContent = 'Failed to load — ' + new Date().toLocaleTimeString()
    }
  }
}

function confirmAction(title, body, action) {
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').textContent = body
  pendingAction = action
  openModal('confirm-modal')
}

document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
  closeModal('confirm-modal')
  if (!pendingAction) return
  const action = pendingAction
  pendingAction = null

  const btns = document.querySelectorAll('.btn')
  btns.forEach(b => b.disabled = true)

  try {
    const res = await apiPost(`/api/minecraft/${action}`)
    if (res.success) {
      showToast(res.message, 'ok')
    } else {
      showToast(res.message, 'err')
    }
  } catch {
    showToast('Request failed', 'err')
  } finally {
    btns.forEach(b => b.disabled = false)
    setTimeout(loadStatus, 1500)
  }
})

document.getElementById('btn-start').addEventListener('click', () => {
  confirmAction('Start server', 'Start the Minecraft server via systemd?', 'start')
})

document.getElementById('btn-stop').addEventListener('click', () => {
  confirmAction('Stop server', 'Stop the Minecraft server? Players will be disconnected.', 'stop')
})

document.getElementById('btn-restart').addEventListener('click', () => {
  confirmAction('Restart server', 'Restart the Minecraft server? Players will be briefly disconnected.', 'restart')
})

// Initial load + auto-refresh every 15s
loadStatus()
setInterval(loadStatus, 15000)