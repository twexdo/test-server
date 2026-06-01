async function loadPlayers() {
  try {
    const data = await apiGet('/api/minecraft/players')
    const grid = document.getElementById('players-grid')
    const tbody = document.getElementById('players-table-body')
    const countEl = document.getElementById('player-count')

    if (!data.success) {
      countEl.textContent = 'Error loading players'
      return
    }

    const players = data.players ?? []
    countEl.textContent = `${players.length} player${players.length !== 1 ? 's' : ''} online`

    // Chips grid
    if (players.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="width:100%">No players online</div>'
    } else {
      grid.innerHTML = players.map(name => `
        <div class="player-chip">
          <img class="player-avatar"
               src="https://mc-heads.net/avatar/${encodeURIComponent(name)}/20"
               alt="${escapeHtml(name)}"
               onerror="this.style.display='none'">
          ${escapeHtml(name)}
        </div>
      `).join('')
    }

    // Table
    if (players.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty-state">No players online</td></tr>'
    } else {
      tbody.innerHTML = players.map(name => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <img class="player-avatar"
                   src="https://mc-heads.net/avatar/${encodeURIComponent(name)}/20"
                   alt="${escapeHtml(name)}"
                   onerror="this.style.display='none'">
              ${escapeHtml(name)}
            </div>
          </td>
          <td><span class="status-badge online"><span class="status-dot"></span>Online</span></td>
        </tr>
      `).join('')
    }

    document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString()
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      document.getElementById('last-updated').textContent = 'Failed to load — ' + new Date().toLocaleTimeString()
    }
  }
}

loadPlayers()
setInterval(loadPlayers, 15000)