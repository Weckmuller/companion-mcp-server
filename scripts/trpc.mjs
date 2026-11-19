// raw tRPC helper: node trpc.mjs <url> query|mutate|watch <path.to.proc> ['<json input>']
import { createCompanionClient, getInitialData } from '../dist/trpc-client.js'
const [url, kind, path, input] = process.argv.slice(2)
const c = createCompanionClient(url)
const client = c.client ?? c
let node = client
for (const p of path.split('.')) node = node[p]
const arg = input ? JSON.parse(input) : undefined
try {
  let r
  if (kind === 'watch') r = await getInitialData((obs) => node.subscribe(arg, obs))
  else if (kind === 'query') r = await node.query(arg)
  else r = await node.mutate(arg)
  console.log(JSON.stringify(r, null, 1))
} catch (e) { console.log('ERROR', e.message) }
process.exit(0)
