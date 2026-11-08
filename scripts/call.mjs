#!/usr/bin/env node
/**
 * Call one tool of the Companion MCP server from a shell, without an MCP client.
 *
 *   node scripts/call.mjs [--url http://host:8000] <tool> [json-arguments]
 *   node scripts/call.mjs list-tools            # every tool with its parameters
 *   node scripts/call.mjs describe <tool>       # full description and input schema
 *
 * Examples
 *   node scripts/call.mjs list_pages
 *   node scripts/call.mjs get_button '{"pageNumber":1,"row":0,"column":0}'
 *   node scripts/call.mjs --url http://192.168.1.50:8000 list_surfaces
 *
 * Prints the tool's text result (JSON) to stdout. Exit code 1 when the tool reports an error;
 * on an argument validation error the tool's input schema is printed too.
 * The server is started from dist/ when built, else from src/ via tsx.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

const args = process.argv.slice(2)
let url = process.env.COMPANION_URL ?? 'http://127.0.0.1:8000'
const urlIdx = args.indexOf('--url')
if (urlIdx >= 0) {
	url = args[urlIdx + 1]
	args.splice(urlIdx, 2)
}
const [tool, rawArgs] = args
if (!tool) {
	console.error(
		'usage: node scripts/call.mjs [--url http://host:8000] <tool> [json-arguments]\n       node scripts/call.mjs list-tools | describe <tool>'
	)
	process.exit(2)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist', 'index.js')
const transport = new StdioClientTransport({
	command: process.execPath,
	args: existsSync(dist)
		? [dist, url]
		: [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'src', 'index.ts'), url],
	stderr: 'pipe',
})
transport.stderr?.on('data', (d) => {
	const s = String(d)
	if (!s.includes('connected to stdio')) process.stderr.write(s)
})

const paramSummary = (schema) => {
	const props = schema?.properties ?? {}
	const required = new Set(schema?.required ?? [])
	return Object.entries(props)
		.map(([k, v]) => {
			const t = v.type ?? (v.enum ? 'enum' : v.anyOf ? 'union' : 'any')
			return `${k}${required.has(k) ? '' : '?'}: ${Array.isArray(t) ? t.join('|') : t}`
		})
		.join(', ')
}

const client = new Client({ name: 'companion-mcp-call', version: '1.0.0' })
await client.connect(transport)
try {
	if (tool === 'list-tools') {
		const { tools } = await client.listTools()
		for (const t of tools) {
			console.log(`${t.name}(${paramSummary(t.inputSchema)})\n    ${t.description.split('\n')[0]}`)
		}
	} else if (tool === 'describe') {
		const { tools } = await client.listTools()
		const t = tools.find((x) => x.name === rawArgs)
		if (!t) {
			console.error(`no tool named ${rawArgs}`)
			process.exit(2)
		}
		console.log(`${t.name}\n\n${t.description}\n\nInput schema:\n${JSON.stringify(t.inputSchema, null, 2)}`)
	} else {
		let params = {}
		if (rawArgs) {
			try {
				params = JSON.parse(rawArgs)
			} catch (e) {
				console.error(`arguments are not valid JSON: ${e.message}`)
				process.exit(2)
			}
		}
		const res = await client.callTool({ name: tool, arguments: params })
		const text = res.content?.map((c) => c.text ?? '').join('\n') ?? ''
		console.log(text)
		if (res.isError) {
			process.exitCode = 1
			if (/invalid|expected|required|unrecognized/i.test(text)) {
				const { tools } = await client.listTools()
				const t = tools.find((x) => x.name === tool)
				if (t) console.error(`\nInput schema of ${tool}:\n${JSON.stringify(t.inputSchema, null, 2)}`)
			}
		}
	}
} finally {
	await client.close()
}
