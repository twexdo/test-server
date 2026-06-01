let currentProperties = {}

async function loadProperties() {
  document.getElementById('props-status').textContent = 'Loading…'
  try {
    const data = await apiGet('/api/minecraft/properties')
    if (!data.success) {
      document.getElementById('props-status').textContent = 'Failed to load'
      showToast(data.message, 'err')
      return
    }

    currentProperties = data.properties ?? {}
    renderProperties(currentProperties)
    document.getElementById('props-status').textContent =
      `${Object.keys(currentProperties).length} properties`
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      document.getElementById('props-status').textContent = 'Error loading properties'
    }
  }
}

function renderProperties(props) {
  const form = document.getElementById('props-form')
  const keys = Object.keys(props).sort()

  if (keys.length === 0) {
    form.innerHTML = '<div class="empty-state">No properties found. Is server.properties readable?</div>'
    return
  }

  form.innerHTML = keys.map(key => `
    <div class="mc-props-row">
      <div class="mc-props-key">${escapeHtml(key)}</div>
      <input class="mc-props-val"
             type="text"
             data-key="${escapeHtml(key)}"
             value="${escapeHtml(props[key])}"
             spellcheck="false"
             autocomplete="off">
    </div>
  `).join('')
}

function collectProperties() {
  const inputs = document.querySelectorAll('.mc-props-val')
  const result = {}
  inputs.forEach(input => {
    const key = input.getAttribute('data-key')
    if (key) result[key] = input.value
  })
  return result
}

function confirmSave() {
  openModal('save-modal')
}

async function saveProperties() {
  closeModal('save-modal')
  const btn = document.getElementById('btn-save')
  btn.disabled = true
  btn.textContent = 'Saving…'

  try {
    const properties = collectProperties()
    const res = await apiPost('/api/minecraft/properties', { properties })
    if (res.success) {
      showToast(res.message, 'ok')
      currentProperties = properties
      document.getElementById('props-status').textContent =
        `${Object.keys(properties).length} properties — saved`
    } else {
      showToast(res.message, 'err')
    }
  } catch {
    showToast('Failed to save properties', 'err')
  } finally {
    btn.disabled = false
    btn.textContent = 'Save changes'
  }
}

loadProperties()