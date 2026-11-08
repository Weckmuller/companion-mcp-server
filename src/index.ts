#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createCompanionClient } from './trpc-client.js'
import { registerVariableTools } from './tools/variables.js'
import { registerConnectionTools } from './tools/connections.js'
import { registerButtonTools } from './tools/buttons.js'
import { registerTriggerTools } from './tools/triggers.js'
import { registerSurfaceTools } from './tools/surfaces.js'
import { registerResources } from './resources.js'

// Parse URL from CLI args or env var. Companion's admin interface defaults to port 8000.
const urlArg = process.argv[2]
const url = (urlArg || process.env.COMPANION_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

let version = '0.0.0'
try {
	const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'))
	version = pkg.version
} catch {
	// keep the fallback
}

const { client } = createCompanionClient(url)

const mcpServer = new McpServer({
	name: 'Bitfocus Companion',
	version,
})

registerVariableTools(mcpServer, client, url)
registerConnectionTools(mcpServer, client)
registerButtonTools(mcpServer, client)
registerTriggerTools(mcpServer, client)
registerSurfaceTools(mcpServer, client)
registerResources(mcpServer, client)

const transport = new StdioServerTransport()
await mcpServer.connect(transport)
console.error(`[companion-mcp] v${version} connected to stdio, talking to Companion at ${url}`)
