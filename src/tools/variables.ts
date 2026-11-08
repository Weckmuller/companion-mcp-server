import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CompanionClient } from '../trpc-client.js'
import { expectInit, getInitialData, textResult } from '../trpc-client.js'

export function registerVariableTools(server: McpServer, client: CompanionClient, companionUrl: string): void {
	server.registerTool(
		'list_variables',
		{
			description:
				'List variable definitions grouped by connection label. Pass connectionLabel to limit the list to one connection (the full list can be long).',
			inputSchema: {
				connectionLabel: z.string().optional().describe('Only this connection label (e.g. "internal", "custom", or a connection label)'),
			},
		},
		async ({ connectionLabel }) => {
			const data = expectInit(
				await getInitialData((observer) => client.variables.definitions.watch.subscribe(undefined, observer)),
				'variables.definitions.watch'
			)
			if (connectionLabel) {
				return textResult({ [connectionLabel]: data.variables?.[connectionLabel] ?? null })
			}
			// Summarise: label -> count, so the model can drill down
			const summary: Record<string, number> = {}
			for (const [label, vars] of Object.entries(data.variables ?? {})) {
				summary[label] = Array.isArray(vars) ? vars.length : Object.keys(vars ?? {}).length
			}
			return textResult({ connections: summary, hint: 'Call again with connectionLabel, or use search_variables' })
		}
	)

	server.registerTool(
		'search_variables',
		{
			description:
				'Search variable definitions by name or label pattern across all or one connection. Useful for finding variables without browsing the full list.',
			inputSchema: {
				query: z.string().describe('Search pattern (case-insensitive). Matches against variable name and label.'),
				connectionLabel: z
					.string()
					.optional()
					.describe('Optional: filter to a specific connection label (case-insensitive substring match)'),
			},
		},
		async ({ query, connectionLabel }) => {
			const data = expectInit(
				await getInitialData((observer) => client.variables.definitions.watch.subscribe(undefined, observer)),
				'variables.definitions.watch'
			)

			const queryLower = query.toLowerCase()
			const connFilterLower = connectionLabel?.toLowerCase()
			const results: Array<{ connectionLabel: string; name: string; label: string }> = []

			for (const [connLabel, vars] of Object.entries(data.variables ?? {})) {
				if (connFilterLower && !connLabel.toLowerCase().includes(connFilterLower)) continue
				// Definitions may be an array or a record keyed by name, depending on the Companion version
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const list: Array<any> = Array.isArray(vars)
					? vars
					: Object.entries(vars ?? {}).map(([name, v]) => ({ name, ...(v as object) }))
				for (const v of list) {
					if (
						String(v.name ?? '').toLowerCase().includes(queryLower) ||
						String(v.label ?? '').toLowerCase().includes(queryLower)
					) {
						results.push({ connectionLabel: connLabel, name: v.name, label: v.label })
					}
				}
			}

			return textResult({ query, matchCount: results.length, results })
		}
	)

	server.registerTool(
		'get_variable_value',
		{
			description:
				'Get the current value of a variable by connection label and name, e.g. ("custom", "smode_look") for $(custom:smode_look). Omit variableName to get every value of that connection.',
			inputSchema: {
				connectionLabel: z.string().describe('The connection label (e.g. "internal", "custom", or a connection label)'),
				variableName: z.string().optional().describe('The variable name; omit for all variables of the connection'),
			},
		},
		async ({ connectionLabel, variableName }) => {
			// Preferred: the tRPC values query (always available)
			try {
				const values = await client.variables.values.connection.query({ label: connectionLabel })
				if (values && typeof values === 'object') {
					if (variableName === undefined) return textResult({ connectionLabel, values })
					if (variableName in values) return textResult({ connectionLabel, variableName, value: values[variableName] })
				}
			} catch {
				// fall through to the HTTP API
			}
			if (variableName === undefined) return textResult({ error: `No values for connection label "${connectionLabel}"` })

			// Fallback: the HTTP API (needs "HTTP API" enabled in Settings > Protocols)
			const url = `${companionUrl}/api/variable/${encodeURIComponent(connectionLabel)}/${encodeURIComponent(variableName)}/value`
			const response = await fetch(url)
			if (!response.ok) {
				return textResult({ error: `HTTP ${response.status}: ${response.statusText} (variable unknown, or the HTTP API is disabled)` })
			}
			const value = await response.text()
			return textResult({ connectionLabel, variableName, value })
		}
	)

	server.registerTool(
		'list_custom_variables',
		{
			description: 'List custom variables with their description, default value and persistence setting',
		},
		async () => {
			const data = expectInit(
				await getInitialData((observer) => client.customVariables.watch.subscribe(undefined, observer)),
				'customVariables.watch'
			)
			return textResult(data.info ?? data.variables ?? data)
		}
	)

	server.registerTool(
		'create_custom_variable',
		{
			description: 'Create a new custom variable with a name and default value',
			inputSchema: {
				name: z.string().describe('The custom variable name (no spaces or special characters)'),
				defaultValue: z.string().optional().describe('The default value (defaults to empty string)'),
				description: z.string().optional().describe('Description shown in the Companion UI'),
			},
		},
		async ({ name, defaultValue, description }) => {
			const err = await client.customVariables.create.mutate({ name, defaultVal: defaultValue ?? '' })
			if (err) return textResult({ success: false, error: err })
			if (description) await client.customVariables.setDescription.mutate({ name, description })
			return textResult({ success: true, name })
		}
	)

	server.registerTool(
		'set_custom_variable',
		{
			description: 'Set the current value of a custom variable (strings, numbers, booleans and JSON values are accepted)',
			inputSchema: {
				name: z.string().describe('The custom variable name'),
				value: z.unknown().describe('The value to set'),
			},
		},
		async ({ name, value }) => {
			const err = await client.customVariables.setCurrent.mutate({ name, value })
			if (err) return textResult({ success: false, error: err })
			return textResult({ success: true, name, value })
		}
	)

	server.registerTool(
		'delete_custom_variable',
		{
			description: 'Delete a custom variable',
			inputSchema: {
				name: z.string().describe('The custom variable name'),
			},
		},
		async ({ name }) => {
			await client.customVariables.delete.mutate({ name })
			return textResult({ success: true, name })
		}
	)
}
