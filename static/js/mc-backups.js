let pendingRestore = null
let pendingDelete = null

async function loadBackups() {
  try {
    const data = await apiGet('/api/minecraft/backups')
    const tbody = document.getElementById('backups-tbody')
    const countEl = document.getElementById('backup-count')

    if (!data.success) {
      countEl.textContent = 'Error loading backups'
      return
    }

    const backups = data.backups ?? []
    countEl.textContent = `${backups.length} backup${backups.length !== 1 ? 's' : ''}`

    if (backups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No backups found</td></tr>'
      return
    }

    tbody.innerHTML = backups.map(b => `
      <tr>
        <td style="font-family:var(--font-mono);font-size:11px">${escapeHtml(b.name)}</td>
        <td>${formatBytes(b.size)}</td>
        <td>${formatDate(b.createdAt)}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <a class="btn btn-ghost" style="font-size:10px;padding:4px 10px"
               href="/api/minecraft/backups/${encodeURIComponent(b.name)}/download"
               download="${escapeHtml(b.name)}">↓ Download</a>
            <button class="btn btn-warn" style="font-size:10px;padding:4px 10px"
                    onclick="confirmRestore('${escapeHtml(b.name)}')">↺ Restore</button>
            <button class="btn btn-danger" style="font-size:10px;padding:4px 10px"
                    onclick="confirmDelete('${escapeHtml(b.name)}')">✕ Delete</button>
          </div>
        </td>
      </tr>
    `).join('')
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      showToast('Failed to load backups', 'err')
    }
  }
}

async function createBackup() {
  const btn = document.getElementById('btn-create')
  btn.disabled = true
  btn.textContent = 'Creating…'
  try {
    const res = await apiPost('/api/minecraft/backups')
    if (res.success) {
      showToast(`Backup created: ${res.name}`, 'ok')
      loadBackups()
    } else {
      showToast(res.message, 'err')
    }
  } catch {
    showToast('Failed to create backup', 'err')
  } finally {
    btn.disabled = false
    btn.textContent = '+ Create backup'
  }
}

function confirmRestore(name) {
  pendingRestore = name
  document.getElementById('restore-modal-body').textContent =
    `Restore "${name}"? This will replace the current world folder. The server should be stopped first.`
  openModal('restore-modal')
}

function confirmDelete(name) {
  pendingDelete = name
  document.getElementById('delete-modal-body').textContent =
    `Permanently delete "${name}"? This cannot be undone.`
  openModal('delete-modal')
}

document.getElementById('restore-confirm-btn').addEventListener('click', async () => {
  closeModal('restore-modal')
  if (!pendingRestore) return
  const name = pendingRestore
  pendingRestore = null

  showToast('Restoring backup…', 'info')
  try {
    const res = await apiPost(`/api/minecraft/backups/${encodeURIComponent(name)}/restore`)
    if (res.success) {
      showToast('Backup restored successfully', 'ok')
    } else {
      showToast(res.message, 'err')
    }
  } catch {
    showToast('Failed to restore backup', 'err')
  }
})

document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
  closeModal('delete-modal')
  if (!pendingDelete) return
  const name = pendingDelete
  pendingDelete = null

  try {
    const res = await apiDelete(`/api/minecraft/backups/${encodeURIComponent(name)}`)
    if (res.success) {
      showToast('Backup deleted', 'ok')
      loadBackups()
    } else {
      showToast(res.message, 'err')
    }
  } catch {
    showToast('Failed to delete backup', 'err')
  }
})

loadBackups()