async function fetchAndRender() {
  const tail = parseInt(document.getElementById('tail-input')?.value, 10) || 100

  let d
  try {
    const res = await fetch('/api/data?tail=' + tail)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    d = await res.json()
  } catch (err) {
    console.error('Failed to fetch dashboard data:', err)
    return
  }

  document.title = document.title + ' — ' + d.hostname
  document.getElementById('hostname-title').textContent = d.hostname
  document.getElementById('platform-badge').textContent = d.platform
  document.getElementById('subtitle').textContent =
    d.username + '@' + d.hostname + '  ·  ' + d.release
  document.getElementById('last-updated').textContent =
    'updated ' + new Date().toLocaleTimeString()

  document.getElementById('arch').textContent      = d.arch
  document.getElementById('username').textContent  = d.username
  document.getElementById('release').textContent   = d.release
  document.getElementById('uptime').textContent    = formatUptime(d.uptimeSecs)
  document.getElementById('cpu-model').textContent = d.cpuModel
  document.getElementById('cpu-speed').textContent = d.cpuSpeed + ' MHz'

  const usedBytes = d.totalMem - d.freeMem
  const pct       = Math.round((usedBytes / d.totalMem) * 100)
  const bar       = document.getElementById('ram-bar')
  bar.style.width = pct + '%'
  bar.className   = 'ram-bar' + (pct > 85 ? ' crit' : pct > 65 ? ' warn' : '')

  document.getElementById('ram-used').textContent  = toGB(usedBytes)
  document.getElementById('ram-total').textContent = toGB(d.totalMem)
  document.getElementById('ram-pct').textContent   = pct + '%'

  const lines = d.logs.split('\n')
  document.getElementById('log-lines').textContent = lines.length + ' lines'

  const pre = document.getElementById('log-output')
  pre.innerHTML = lines.map(colorLine).join('\n')
  pre.scrollTop = pre.scrollHeight
}

function toGB(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

function formatUptime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h >= 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h'
  return h + 'h ' + m + 'm'
}

function colorLine(line) {
  const escaped = line.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (/error|fail|fatal|exception/i.test(line)) return '<span class="log-err">'  + escaped + '</span>'
  if (/warn|warning/i.test(line))               return '<span class="log-warn">' + escaped + '</span>'
  if (/success|done|ok|started|ready/i.test(line)) return '<span class="log-ok">' + escaped + '</span>'
  return escaped
}

document.getElementById('tail-input').addEventListener('change', fetchAndRender)

fetchAndRender()
setInterval(fetchAndRender, 5000)