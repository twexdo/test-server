import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import os from 'os'
const app = new Hono()

app.get('/', (c) => {
  return c.text(`Hello this pc belongs to Stef Vasile Adrian!
     And its running from ${os.hostname}`)
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
