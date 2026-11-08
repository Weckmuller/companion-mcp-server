#!/usr/bin/env node
/**
 * Smoke test: start the MCP server over stdio (like an MCP client would), call the read-only
 * tools against a running Companion, and optionally run a write round-trip on a scratch page.
 *
 *   node scripts/smoke.mjs [companion-url] [--write] [--tool name '{"json":"args"}']
 *
 * --write creates a page named "mcp-smoke", builds one button on it (style + internal action),
 * reads it back, presses it, then removes the page. Nothing else is touched.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

const args = process.argv.slice(2)
const url = args.find((a) => /^https?:\/\//.test(a)) ?? process.env.COMPANION_URL ?? 'http://127.0.0.1:8000'
const doWrite = args.includes('--write')
const toolIdx = args.indexOf('--tool')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist', 'index.js')
const useDist = existsSync(dist)

const transport = new StdioClientTransport({
	command: process.execPath,
	args: useDist ? [dist, url] : [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'src', 'index.ts'), url],
	stderr: 'pipe',
})
transport.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`))

const client = new Client({ name: 'companion-mcp-smoke', version: '1.0.0' })
await client.connect(transport)

const call = async (name, params = {}) => {
	const t0 = Date.now()
	const res = await client.callTool({ name, arguments: params })
	const text = res.content?.map((c) => c.text ?? '').join('\n') ?? ''
	let parsed
	try {
		parsed = JSON.parse(text)
	} catch {
		parsed = text
	}
	console.log(`\n=== ${name} (${Date.now() - t0} ms)${res.isError ? ' ERROR' : ''}`)
	return parsed
}
const show = (v, max = 1200) => {
	const s = typeof v === 'string' ? v : JSON.stringify(v, null, 1)
	console.log(s.length > max ? s.slice(0, max) + `\n... (${s.length} chars)` : s)
}

try {
	if (toolIdx >= 0) {
		const name = args[toolIdx + 1]
		const params = args[toolIdx + 2] ? JSON.parse(args[toolIdx + 2]) : {}
		show(await call(name, params), 20000)
	} else {
		const tools = await client.listTools()
		console.log(`server exposes ${tools.tools.length} tools: ${tools.tools.map((t) => t.name).join(', ')}`)

		show(await call('list_connections'))
		const pages = await call('list_pages')
		show(pages)
		show(await call('list_surfaces'))
		show(await call('list_custom_variables'))
		show(await call('search_variables', { query: 'smode' }), 600)
		show(await call('get_variable_value', { connectionLabel: 'custom' }), 600)
		show(await call('list_triggers'), 600)
		if (Array.isArray(pages) && pages.length > 0) {
			const first = pages[0].occupied?.split(' ')[0]
			if (first) {
				const [row, column] = first.split('/').map(Number)
				show(await call('get_button', { pageNumber: 1, row, column }), 1500)
			}
		}

		if (doWrite) {
			console.log('\n########## write round-trip on a scratch page')
			const before = await call('list_pages')
			const asPageNumber = before.length + 1
			show(await call('create_page', { asPageNumber, pageNames: ['mcp-smoke'] }))
			show(await call('create_button', { pageNumber: asPageNumber, row: 0, column: 0 }))
			show(
				await call('update_button', {
					pageNumber: asPageNumber,
					row: 0,
					column: 0,
					operations: [
						{ op: 'set_style', text: 'MCP\\nOK', color: 16777215, bgcolor: 255, size: 18 },
						{
							op: 'add_action',
							connectionId: 'internal',
							actionId: 'custom_log',
							options: { message: 'companion-mcp-server smoke test pressed the button' },
						},
						{
							op: 'add_feedback',
							connectionId: 'internal',
							feedbackId: 'instance_custom_state',
							options: { instance_id: 'all', state: 'ok' },
						},
					],
				})
			)
			const built = await call('get_button', { pageNumber: asPageNumber, row: 0, column: 0 })
			show(built, 3000)
			const action = built?.steps?.['0']?.down?.[0]
			const feedback = built?.feedbacks?.[0]
			const checks = {
				text: built?.style?.text === 'MCP\\nOK',
				color: built?.style?.color === 16777215,
				bgcolor: built?.style?.bgcolor === 255,
				fontsize: built?.style?.fontsize === 18,
				action: action?.definitionId === 'custom_log' && typeof action?.options?.message === 'string',
				feedback: feedback?.definitionId === 'instance_custom_state' && feedback?.options?.state === 'ok',
			}
			console.log('\nCHECKS', JSON.stringify(checks))
			if (action?.entityId) {
				show(
					await call('update_button', {
						pageNumber: asPageNumber,
						row: 0,
						column: 0,
						operations: [
							{ op: 'update_entity_options', entityId: action.entityId, options: { message: 'updated by smoke' } },
							{ op: 'set_entity_enabled', entityId: action.entityId, enabled: false },
							{ op: 'set_entity_enabled', entityId: action.entityId, enabled: true },
						],
					})
				)
				const after = await call('get_button', { pageNumber: asPageNumber, row: 0, column: 0 })
				console.log('CHECK update_entity_options', after?.steps?.['0']?.down?.[0]?.options?.message === 'updated by smoke')
			}
			if (Object.values(checks).some((v) => !v)) process.exitCode = 1
			show(await call('press_button', { pageNumber: asPageNumber, row: 0, column: 0 }))
			show(await call('remove_page', { pageNumber: asPageNumber }))
			show(await call('list_pages'))
		}
	}
} finally {
	await client.close()
}
