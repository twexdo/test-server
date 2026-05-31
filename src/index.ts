import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import os from 'os'
import fs from 'fs'

const app = new Hono()

function formatBytes(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

app.get('/', (c) => {
  const cpus = os.cpus()

  let logs = 'No logs found'

  try {
    logs = fs.readFileSync('/home/adrian/Coding/runner.log', 'utf8')
  } catch (err) {
    logs = err.message
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="5">
<title>System Dashboard</title>

<style>
*{
  box-sizing:border-box;
  margin:0;
  padding:0;
}

body{
  font-family:system-ui,sans-serif;
  background:#0f172a;
  color:white;
  padding:30px;
}

h1{
  margin-bottom:20px;
}

.grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
  gap:20px;
  margin-bottom:30px;
}

.card{
  background:#1e293b;
  border-radius:12px;
  padding:20px;
  box-shadow:0 4px 15px rgba(0,0,0,.3);
}

.card h2{
  font-size:16px;
  margin-bottom:10px;
  color:#38bdf8;
}

.value{
  font-size:20px;
  font-weight:bold;
}

.logs{
  background:#020617;
  border-radius:12px;
  padding:20px;
  margin-top:20px;
}

.logs h2{
  margin-bottom:15px;
  color:#22c55e;
}

pre{
  white-space:pre-wrap;
  word-wrap:break-word;
  max-height:700px;
  overflow:auto;
  color:#d1fae5;
}

.cpu{
  margin-top:10px;
  padding:8px;
  border-radius:8px;
  background:#334155;
}
</style>
</head>
<body>

<h1>🖥️ ${os.hostname()}</h1>

<div class="grid">

  <div class="card">
    <h2>Platform</h2>
    <div class="value">${os.platform()}</div>
  </div>

  <div class="card">
    <h2>OS Release</h2>
    <div class="value">${os.release()}</div>
  </div>

  <div class="card">
    <h2>Architecture</h2>
    <div class="value">${os.arch()}</div>
  </div>

  <div class="card">
    <h2>Uptime</h2>
    <div class="value">${Math.floor(os.uptime() / 3600)} h</div>
  </div>

  <div class="card">
    <h2>Total RAM</h2>
    <div class="value">${formatBytes(os.totalmem())}</div>
  </div>

  <div class="card">
    <h2>Free RAM</h2>
    <div class="value">${formatBytes(os.freemem())}</div>
  </div>

  <div class="card">
    <h2>Current User</h2>
    <div class="value">${os.userInfo().username}</div>
  </div>

  <div class="card">
    <h2>Node Hostname</h2>
    <div class="value">${os.hostname()}</div>
  </div>

</div>

<div class="card">
  <h2>CPU Information</h2>

  ${cpus.map((cpu, index) => `
    <div class="cpu">
      <strong>CPU ${index}</strong><br>
      ${cpu.model}<br>
      ${cpu.speed} MHz
    </div>
  `).join('')}
</div>

<div class="logs">
  <h2>Runner Logs</h2>
  <pre>${logs.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</div>

</body>
</html>
`

  return c.html(html)
})

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server running on http://localhost:${info.port}`)
  }
)