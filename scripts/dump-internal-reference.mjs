#!/usr/bin/env node
/**
 * Generate skills/companion/references/internal-entities.md from a live Companion:
 * the trigger event types and the `internal` connection's actions and feedbacks, with their
 * option keys. Rerun after a Companion update.
 *
 *   node scripts/dump-internal-reference.mjs [--url http://host:8000] [out-file]
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
let url = process.env.COMPANION_URL ?? 'http://127.0.0.1:8000'
const urlIdx = args.indexOf('--url')
if (urlIdx >= 0) {
	url = args[urlIdx + 1]
	args.splice(urlIdx, 2)
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = args[0] ?? join(root, 'skills', 'companion', 'references', 'internal-entities.md')

const dist = join(root, 'dist', 'index.js')
const transport = new StdioClientTransport({
	command: process.execPath,
	args: existsSync(dist)
		? [dist, url]
		: [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'src', 'index.ts'), url],
	stderr: 'pipe',
})
const client = new Client({ name: 'companion-mcp-dump', version: '1.0.0' })
await client.connect(transport)
const call = async (name, params = {}) => {
	const res = await client.callTool({ name, arguments: params })
	return JSON.parse(res.content.map((c) => c.text ?? '').join('\n'))
}

const optionLine = (o) => {
	let s = `\`${o.id}\` (${o.type}`
	if (o.label) s += `: ${o.label}`
	s += ')'
	if (o.choices && Array.isArray(o.choices) && o.choices.length <= 12) {
		s += ` = ${o.choices.map((c) => `\`${c.id}\``).join(' | ')}`
	} else if (o.choices && Array.isArray(o.choices)) {
		s += ` = ${o.choices.length} choices`
	}
	if (o.default !== undefined && o.default !== '' && o.type !== 'static-text') s += `, default \`${JSON.stringify(o.default)}\``
	return s
}

try {
	const events = await call('list_trigger_events')
	const defs = await call('list_connection_definitions', { connectionId: 'internal' })

	let md = `# Internal entities (generated)\n\n`
	md += `Generated from a live Companion with \`node scripts/dump-internal-reference.mjs\`. `
	md += `These are the ids to pass to the tools; option keys are what \`options\` objects accept. `
	md += `Module (connection) actions and feedbacks are looked up with \`list_connection_definitions\` instead.\n\n`

	md += `## Trigger event types (\`add_event\` \`eventType\`)\n\n| id | label | options |\n|---|---|---|\n`
	const evItems = Array.isArray(events) ? events : Object.entries(events).map(([id, v]) => ({ id, ...v }))
	for (const e of evItems) {
		const opts = (e.options ?? []).map(optionLine).join('; ') || '—'
		md += `| \`${e.id ?? e.type}\` | ${e.name ?? e.label ?? ''} | ${opts} |\n`
	}

	const section = (title, items, kind) => {
		md += `\n## Internal ${title} (connectionId \`internal\`)\n\n`
		const sorted = Object.entries(items).sort(([, a], [, b]) => String(a.label).localeCompare(String(b.label)))
		for (const [id, d] of sorted) {
			md += `### \`${id}\` — ${d.label}\n`
			if (d.description) md += `${d.description}\n`
			const flags = []
			if (kind === 'feedback' && d.feedbackType) flags.push(`type: ${d.feedbackType}`)
			if (d.supportsChildGroups) flags.push('has child action groups')
			if (d.actionHasResult) flags.push('returns a result')
			if (d.showInvert) flags.push('invertible')
			if (flags.length) md += `_${flags.join(', ')}_\n`
			const opts = (d.options ?? []).filter((o) => o.type !== 'static-text')
			if (opts.length) md += opts.map((o) => `- ${optionLine(o)}`).join('\n') + '\n'
			md += '\n'
		}
	}
	section('actions', defs.actions ?? {}, 'action')
	section('feedbacks', defs.feedbacks ?? {}, 'feedback')

	mkdirSync(dirname(outFile), { recursive: true })
	writeFileSync(outFile, md)
	console.log(`wrote ${outFile}: ${evItems.length} events, ${Object.keys(defs.actions ?? {}).length} actions, ${Object.keys(defs.feedbacks ?? {}).length} feedbacks`)
} finally {
	await client.close()
}
