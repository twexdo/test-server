import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import os from 'os'
import fs from 'fs'
import path from 'path'

const app = new Hono()

app.use('/static/*', serveStatic({ root: './' }))

app.get('/', (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), 'static', 'index.html'),
    'utf8'
  )
  return c.html(html)
})

app.get('/api/data', (c) => {
  const cpu  = os.cpus()[0]
  const tail = Math.max(1, Math.min(10000, parseInt(c.req.query('tail') ?? '100', 10) || 100))

  let logs = 'No logs found'
  try {
    logs = fs.readFileSync('/home/adrian/Coding/runner.log', 'utf8')
      .split('\n').slice(-tail).join('\n')
  } catch (err) {
    logs = (err as NodeJS.ErrnoException).message
  }

  return c.json({
    hostname:   os.hostname(),
    platform:   os.platform(),
    release:    os.release(),
    arch:       os.arch(),
    uptimeSecs: Math.floor(os.uptime()),
    totalMem:   os.totalmem(),
    freeMem:    os.freemem(),
    username:   os.userInfo().username,
    cpuModel:   cpu?.model ?? 'Unknown',
    cpuSpeed:   cpu?.speed ?? 0,
    logs,
  })
})

serve(
  { fetch: app.fetch, port: 3000 },
  (info) => console.log(`Server running on http://localhost:${info.port}`)
)