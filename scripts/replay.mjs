#!/usr/bin/env node
/**
 * Replay a generated .companionconfig into a live Companion through this MCP server, in ONE process
 * (call.mjs starts a server per call, which makes 400 calls take a quarter of an hour).
 *
 *   node scripts/replay.mjs <file.companionconfig> [--url http://host:8000] [--insert-at N] [--pages 1,2]
 *
 * Pages: cleared and rebuilt from the file (names restored); with --insert-at N, pages are inserted at N
 * until the live count matches the file. Buttons: style (text, colours, size), press actions, feedbacks
 * with their style overrides. Connections are matched by LABEL and must exist on the live Companion
 * (only the ones the file's buttons use). Custom variables are created when missing.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (name) => {
	const i = args.indexOf(name)
	return i >= 0 ? args[i + 1] : undefined
}
const file = args.find((a) => a.endsWith('.companionconfig') || a.endsWith('.json'))
if (!file) {
	console.error('usage: node scripts/replay.mjs <file.companionconfig> [--url http://host:8000] [--insert-at N] [--pages 1,2]')
	process.exit(2)
}
const url = opt('--url') ?? process.env.COMPANION_URL ?? 'http://127.0.0.1:8000'
const insertAt = opt('--insert-at') ? Number(opt('--insert-at')) : null
const only = opt('--pages') ? new Set(opt('--pages').split(',')) : null

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist', 'index.js')
const transport = new StdioClientTransport({
	command: process.execPath,
	args: existsSync(dist) ? [dist, url] : [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'src', 'index.ts'), url],
	stderr: 'pipe',
})
const client = new Client({ name: 'replay', version: '1.0.0' })
await client.connect(transport)

async function call(tool, a = {}) {
	const res = await client.callTool({ name: tool, arguments: a })
	const text = (res.content ?? []).map((c) => c.text ?? '').join('')
	try {
		return JSON.parse(text)
	} catch {
		return { raw: text, isError: res.isError }
	}
}

const cfg = JSON.parse(readFileSync(file, 'utf8'))
const fileLabel = Object.fromEntries(Object.entries(cfg.instances).map(([id, inst]) => [id, inst.label]))
const live = await call('list_connections')
const liveId = {}
for (const c of Array.isArray(live) ? live : live.connections ?? []) liveId[c.label] = c.id
const used = new Set()
for (const page of Object.values(cfg.pages))
	for (const cells of Object.values(page.controls))
		for (const ctrl of Object.values(cells)) {
			for (const a of ctrl.steps['0'].action_sets.down ?? []) used.add(a.connectionId)
			for (const f of ctrl.feedbacks ?? []) used.add(f.connectionId)
		}
const missing = [...used].filter((c) => c !== 'internal' && !liveId[fileLabel[c]]).map((c) => fileLabel[c])
if (missing.length) {
	console.error('connections missing on', url, '(create them in its UI first):', [...new Set(missing)])
	process.exit(1)
}
const mapConn = (c) => (c === 'internal' ? 'internal' : liveId[fileLabel[c]])
const plain = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v)

for (const [name, v] of Object.entries(cfg.custom_variables ?? {}))
	await call('create_custom_variable', { name, defaultValue: String(v.defaultValue ?? ''), description: v.description ?? '' })

const pages = Object.entries(cfg.pages).sort((a, b) => Number(a[0]) - Number(b[0]))
let nLive = (await call('list_pages')).length
if (insertAt) while (nLive < pages.length) {
	await call('create_page', { asPageNumber: insertAt, pageNames: ['new'] })
	nLive++
}
const t0 = Date.now()
for (const [number, page] of pages) {
	const n = Number(number)
	if (only && !only.has(number)) continue
	if (n > nLive) {
		await call('create_page', { asPageNumber: n, pageNames: [page.name] })
		nLive++
	} else await call('clear_page', { pageNumber: n })
	await call('set_page_name', { pageNumber: n, name: page.name })
	let made = 0
	const problems = []
	for (const [row, cells] of Object.entries(page.controls))
		for (const [col, ctrl] of Object.entries(cells)) {
			const r = Number(row), c = Number(col)
			await call('create_button', { pageNumber: n, row: r, column: c, replace: true })
			const layers = Object.fromEntries(ctrl.style.layers.map((l) => [l.id, l]))
			const ops = [
				{
					op: 'set_style',
					text: plain(layers.text0?.text) ?? '',
					color: plain(layers.text0?.color) ?? 0xffffff,
					bgcolor: plain(layers.box0?.color) ?? 0,
					size: plain(layers.text0?.fontsize) ?? 24,
				},
			]
			// style elements beyond the default three (a progress bar box, an extra text...): added above the
			// element that precedes them in the file, with every property the file gives them (expressions included)
			const order = ctrl.style.layers.map((l) => l.id)
			for (const l of ctrl.style.layers) {
				if (['canvas', 'box0', 'text0'].includes(l.id)) continue
				const { id, name, usage, type, ...values } = l
				ops.push({ op: 'add_element', type, afterElementId: order[order.indexOf(id) - 1] ?? null, values })
			}
			for (const a of ctrl.steps['0'].action_sets.down ?? [])
				ops.push({
					op: 'add_action',
					connectionId: mapConn(a.connectionId),
					actionId: a.definitionId,
					options: Object.fromEntries(Object.entries(a.options).map(([k, v]) => [k, plain(v)])),
				})
			const r1 = await call('update_button', { pageNumber: n, row: r, column: c, operations: ops })
			for (const x of r1.results ?? []) if (x.success === false) problems.push(`${n}/${r}/${c} ${x.op}: ${x.error ?? ''}`)
			for (const f of ctrl.feedbacks ?? []) {
				const r2 = await call('update_button', {
					pageNumber: n,
					row: r,
					column: c,
					operations: [
						{
							op: 'add_feedback',
							connectionId: mapConn(f.connectionId),
							feedbackId: f.definitionId,
							options: Object.fromEntries(Object.entries(f.options).map(([k, v]) => [k, plain(v)])),
						},
					],
				})
				const ent = (r2.results ?? []).map((x) => x.entityId).filter(Boolean).pop()
				if (!ent) {
					problems.push(`${n}/${r}/${c} feedback ${f.definitionId}: ${JSON.stringify(r2).slice(0, 120)}`)
					continue
				}
				const sops = (f.styleOverrides ?? []).map((so) => ({
					op: 'set_feedback_style',
					entityId: ent,
					elementId: so.elementId,
					property: so.elementProperty,
					value: plain(so.override),
				}))
				if (sops.length) await call('update_button', { pageNumber: n, row: r, column: c, operations: sops })
			}
			made++
		}
	console.log(`page ${n} ${page.name}: ${made} keys${problems.length ? ', problems: ' + problems.join(' | ') : ''}`)
}
console.log(`done ${url} in ${Math.round((Date.now() - t0) / 1000)} s`)
await client.close()
process.exit(0)
