// Minimal CDP client for the DSH Host inspector endpoint (port from /json/list).
// Usage: node cdp.mjs '<javascript expression>' [--client-index N] [--list]
const base = process.argv[3] === '--port' ? process.argv[4] : 'http://127.0.0.1:9230'

async function main() {
  const list = await (await fetch(`${base}/json/list`)).json()
  const target = list.find((t) => typeof t.webSocketDebuggerUrl === 'string')
  if (!target) throw new Error('no inspector target')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let nextId = 1
  const pending = new Map()
  const contexts = []
  const logs = []

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
      return
    }
    if (msg.method === 'Runtime.executionContextCreated') contexts.push(msg.params.context)
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push({
        type: msg.params.type,
        text: msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '),
      })
    }
  })

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', (e) => reject(new Error('ws error: ' + (e.message ?? 'unknown'))), { once: true })
  })

  await send('Runtime.enable')
  await new Promise((r) => setTimeout(r, 1200))

  if (process.argv.includes('--list')) {
    for (const ctx of contexts) {
      console.log(
        JSON.stringify({
          id: ctx.id,
          origin: ctx.origin,
          name: ctx.name,
          uniqueId: ctx.uniqueId,
          auxData: ctx.auxData,
        }),
      )
    }
    console.log(`contexts=${contexts.length} logs=${logs.length}`)
    for (const log of logs.slice(-10)) console.log(`[console.${log.type}] ${log.text}`)
    ws.close()
    return
  }

  const expression = process.argv[2]
  const clientIndex = Number(process.argv.includes('--client-index') ? process.argv[process.argv.indexOf('--client-index') + 1] : -1)
  const hostContext = contexts.find((c) => c.auxData?.isDefault === true) ?? contexts[0]
  const clientContexts = contexts.filter((c) => c !== hostContext && c.auxData?.isDefault !== true && String(c.origin).startsWith('http'))
  let context = hostContext
  if (clientIndex >= 0) {
    context = clientContexts[clientIndex] ?? clientContexts[0] ?? hostContext
  }
  const result = await send('Runtime.evaluate', {
    expression,
    contextId: context?.id,
    awaitPromise: true,
    returnByValue: true,
    userGesture: false,
  })
  console.log(
    JSON.stringify(
      {
        contextUsed: { id: context?.id, origin: context?.origin, name: context?.name, auxData: context?.auxData },
        value: result.result?.value,
        description: result.result?.description,
        exception: result.exceptionDetails?.exception?.description ?? result.exceptionDetails?.text,
      },
      null,
      2,
    ),
  )
  for (const log of logs.slice(-15)) console.log(`[console.${log.type}] ${log.text}`)
  ws.close()
}

main().catch((error) => {
  console.error('FAILED', error)
  process.exit(1)
})
