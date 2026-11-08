import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CompanionClient } from '../trpc-client.js'
import { expectInit, getInitialData, textResult } from '../trpc-client.js'

export function registerConnectionTools(server: McpServer, client: CompanionClient): void {
	server.registerTool(
		'list_connections',
		{
			description:
				'List all configured connections with their IDs, labels, module types and enabled state. Connection IDs are needed for add_action/add_feedback; labels are what variables are referenced by ($(label:name)).',
		},
		async () => {
			const data = expectInit(
				await getInitialData((observer) => client.instances.connections.watch.subscribe(undefined, observer)),
				'instances.connections.watch'
			)

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const connections = Object.entries(data.info as Record<string, any>).map(([id, config]) => ({
				id,
				label: config.label,
				moduleId: config.moduleId,
				moduleVersionId: config.moduleVersionId,
				enabled: config.enabled,
			}))
			return textResult(connections)
		}
	)

	server.registerTool(
		'list_connection_definitions',
		{
			description:
				'List the action and feedback definitions a connection offers (IDs, labels, option fields). Use this to find actionId/feedbackId values and their option keys before adding actions or feedbacks to buttons and triggers. Pass `kind` to get only actions or only feedbacks, and `search` to filter by label/ID.',
			inputSchema: {
				connectionId: z.string().describe('The connection ID (from list_connections)'),
				kind: z.enum(['actions', 'feedbacks', 'both']).optional().describe('Which definitions to return (default: both)'),
				search: z.string().optional().describe('Case-insensitive filter on definition ID, label or description'),
				compact: z
					.boolean()
					.optional()
					.describe('When true, return only id, label and option keys instead of full option schemas (default: false)'),
			},
		},
		async ({ connectionId, kind, search, compact }) => {
			const wantActions = kind !== 'feedbacks'
			const wantFeedbacks = kind !== 'actions'
			const [actionsData, feedbacksData] = await Promise.all([
				wantActions
					? getInitialData((observer) => client.instances.definitions.actions.subscribe(undefined, observer))
					: null,
				wantFeedbacks
					? getInitialData((observer) => client.instances.definitions.feedbacks.subscribe(undefined, observer))
					: null,
			])

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const pick = (defs: Record<string, any> | undefined) => {
				const out: Record<string, unknown> = {}
				const q = search?.toLowerCase()
				for (const [id, def] of Object.entries(defs ?? {})) {
					if (q) {
						const hay = `${id} ${def.label ?? ''} ${def.description ?? ''}`.toLowerCase()
						if (!hay.includes(q)) continue
					}
					out[id] = compact
						? {
								label: def.label,
								description: def.description,
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								options: (def.options ?? []).map((o: any) => `${o.id} (${o.type}${o.label ? `: ${o.label}` : ''})`),
							}
						: def
				}
				return out
			}

			const result: Record<string, unknown> = { connectionId }
			if (actionsData) result.actions = pick(expectInit(actionsData, 'definitions.actions').definitions[connectionId])
			if (feedbacksData)
				result.feedbacks = pick(expectInit(feedbacksData, 'definitions.feedbacks').definitions[connectionId])
			return textResult(result)
		}
	)
}
