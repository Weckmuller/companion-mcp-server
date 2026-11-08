import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CompanionClient } from '../trpc-client.js'
import { expectInit, getInitialData, textResult, toExpressionOrValue } from '../trpc-client.js'

// Inlined from @companion-app/shared to allow standalone npm publishing
const EntityModelType = { Action: 'action', Feedback: 'feedback' } as const

const operationSchema = z.union([
	z.object({
		op: z.literal('set_options'),
		name: z.string().optional().describe('Trigger name'),
		enabled: z.boolean().optional().describe('Whether the trigger is enabled'),
		collectionId: z
			.string()
			.nullable()
			.optional()
			.describe('Collection ID to group the trigger (null to remove from collection)'),
		sortOrder: z.number().optional().describe('Sort order within collection (lower = earlier). Use with collectionId.'),
	}),
	z.object({
		op: z.literal('add_event'),
		eventType: z.string().describe('Event type (e.g., "interval", "timeofday", "startup", "variable_changed", "condition_true", "computer_locked")'),
		options: z.record(z.string(), z.unknown()).optional().describe('Option values for the new event'),
	}),
	z.object({
		op: z.literal('update_event_options'),
		eventId: z.string().describe('The event ID'),
		key: z.string().describe('The option key'),
		value: z.unknown().describe('The option value'),
	}),
	z.object({
		op: z.literal('remove_event'),
		eventId: z.string().describe('The event ID'),
	}),
	z.object({
		op: z.literal('add_action'),
		connectionId: z.string().describe('The connection ID'),
		actionId: z.string().describe('The action definition ID'),
		parentId: z.string().optional().describe('Parent entity ID for child actions (e.g., logic_if entity ID)'),
		childGroup: z.string().optional().describe('Child group name (e.g., "actions", "else_actions")'),
		options: z.record(z.string(), z.unknown()).optional().describe('Key-value pairs of options to set on the new action'),
	}),
	z.object({
		op: z.literal('add_condition'),
		connectionId: z.string().describe('The connection ID'),
		feedbackId: z.string().describe('The feedback definition ID'),
		parentId: z.string().optional().describe('Parent entity ID for child conditions (e.g., logic_if entity ID)'),
		childGroup: z.string().optional().describe('Child group name (e.g., "condition")'),
		options: z.record(z.string(), z.unknown()).optional().describe('Key-value pairs of options to set on the new condition'),
	}),
	z.object({
		op: z.literal('set_entity_inverted'),
		entityId: z.string().describe('The condition entity ID'),
		isInverted: z.boolean().describe('Whether the condition is inverted'),
		entityLocation: z.enum(['trigger_actions', 'feedbacks']).optional().describe('Entity location (default: "feedbacks")'),
	}),
	z.object({
		op: z.literal('update_entity_options'),
		entityId: z.string().describe('The entity ID'),
		options: z.record(z.string(), z.unknown()).describe('Key-value pairs of options to set'),
		entityLocation: z.enum(['trigger_actions', 'feedbacks']).optional().describe('Entity location (default: "trigger_actions")'),
	}),
	z.object({
		op: z.literal('set_entity_enabled'),
		entityId: z.string().describe('The entity ID'),
		enabled: z.boolean(),
		entityLocation: z.enum(['trigger_actions', 'feedbacks']).optional().describe('Entity location (default: "trigger_actions")'),
	}),
	z.object({
		op: z.literal('remove_entity'),
		entityId: z.string().describe('The entity ID'),
		entityLocation: z.enum(['trigger_actions', 'feedbacks']).optional().describe('Entity location (default: "trigger_actions")'),
	}),
])

type Operation = z.infer<typeof operationSchema>
type OperationResult = { op: string; success: boolean; entityId?: string; eventId?: string; error?: string }

async function executeOperations(
	client: CompanionClient,
	controlId: string,
	operations: Operation[]
): Promise<OperationResult[]> {
	const results: OperationResult[] = []

	const setOptions = async (
		entityLocation: 'trigger_actions' | 'feedbacks',
		entityId: string,
		options: Record<string, unknown>
	) => {
		for (const [key, value] of Object.entries(options)) {
			await client.controls.entities.setOption.mutate({
				controlId,
				entityLocation,
				entityId,
				key,
				value: toExpressionOrValue(value),
			})
		}
	}

	for (const operation of operations) {
		try {
			switch (operation.op) {
				case 'set_options': {
					if (operation.name !== undefined) {
						await client.controls.setOptionsField.mutate({ controlId, key: 'name', value: operation.name })
					}
					if (operation.enabled !== undefined) {
						await client.controls.setOptionsField.mutate({ controlId, key: 'enabled', value: operation.enabled })
					}
					if (operation.collectionId !== undefined) {
						await client.controls.triggers.reorder.mutate({
							collectionId: operation.collectionId,
							controlId,
							dropIndex: operation.sortOrder ?? 0,
						})
					}
					results.push({ op: 'set_options', success: true })
					break
				}
				case 'add_event': {
					const eventId = await client.controls.events.add.mutate({ controlId, eventType: operation.eventType })
					if (!eventId) throw new Error('Companion did not create the event (unknown event type?)')
					for (const [key, value] of Object.entries(operation.options ?? {})) {
						await client.controls.events.setOption.mutate({ controlId, eventId: String(eventId), key, value })
					}
					results.push({ op: 'add_event', success: true, eventId: String(eventId) })
					break
				}
				case 'update_event_options': {
					await client.controls.events.setOption.mutate({
						controlId,
						eventId: operation.eventId,
						key: operation.key,
						value: operation.value,
					})
					results.push({ op: 'update_event_options', success: true })
					break
				}
				case 'remove_event': {
					await client.controls.events.remove.mutate({ controlId, eventId: operation.eventId })
					results.push({ op: 'remove_event', success: true })
					break
				}
				case 'add_action': {
					const ownerId =
						operation.parentId && operation.childGroup
							? { parentId: operation.parentId, childGroup: operation.childGroup }
							: null
					const entityId = await client.controls.entities.add.mutate({
						controlId,
						entityLocation: 'trigger_actions',
						ownerId,
						connectionId: operation.connectionId,
						entityType: EntityModelType.Action,
						entityDefinition: operation.actionId,
					})
					if (!entityId) throw new Error('Companion did not create the action (unknown connection or action ID?)')
					if (operation.options) await setOptions('trigger_actions', entityId, operation.options)
					results.push({ op: 'add_action', success: true, entityId })
					break
				}
				case 'add_condition': {
					const ownerId =
						operation.parentId && operation.childGroup
							? { parentId: operation.parentId, childGroup: operation.childGroup }
							: null
					const conditionLocation = ownerId ? 'trigger_actions' : 'feedbacks'
					const entityId = await client.controls.entities.add.mutate({
						controlId,
						entityLocation: conditionLocation,
						ownerId,
						connectionId: operation.connectionId,
						entityType: EntityModelType.Feedback,
						entityDefinition: operation.feedbackId,
					})
					if (!entityId) throw new Error('Companion did not create the condition (unknown connection or feedback ID?)')
					if (operation.options) await setOptions(conditionLocation, entityId, operation.options)
					results.push({ op: 'add_condition', success: true, entityId })
					break
				}
				case 'set_entity_inverted': {
					await client.controls.entities.setInverted.mutate({
						controlId,
						entityLocation: operation.entityLocation ?? 'feedbacks',
						entityId: operation.entityId,
						isInverted: { value: operation.isInverted, isExpression: false },
					})
					results.push({ op: 'set_entity_inverted', success: true })
					break
				}
				case 'update_entity_options': {
					await setOptions(operation.entityLocation ?? 'trigger_actions', operation.entityId, operation.options)
					results.push({ op: 'update_entity_options', success: true })
					break
				}
				case 'set_entity_enabled': {
					await client.controls.entities.setEnabled.mutate({
						controlId,
						entityLocation: operation.entityLocation ?? 'trigger_actions',
						entityId: operation.entityId,
						enabled: operation.enabled,
					})
					results.push({ op: 'set_entity_enabled', success: true })
					break
				}
				case 'remove_entity': {
					await client.controls.entities.remove.mutate({
						controlId,
						entityLocation: operation.entityLocation ?? 'trigger_actions',
						entityId: operation.entityId,
					})
					results.push({ op: 'remove_entity', success: true })
					break
				}
			}
		} catch (e) {
			results.push({ op: operation.op, success: false, error: String((e as Error)?.message ?? e) })
		}
	}

	return results
}

const operationsDescription = `Available operations:
- set_options: Set trigger name, enabled state, and/or collection. Use sortOrder with collectionId for explicit positioning.
- add_event: Add an event to the trigger (e.g., "interval", "timeofday", "startup", "variable_changed", "condition_true"), optionally with options.
- update_event_options: Update an event's options
- remove_event: Remove an event from the trigger
- add_action: Add an action to the trigger (optionally as child of a parent entity using parentId/childGroup). Optionally pass options to configure it immediately.
- add_condition: Add a condition (feedback) to the trigger (optionally as child of a parent entity). Optionally pass options to configure it immediately.
- set_entity_inverted: Set isInverted on a condition entity
- update_entity_options: Update options on an entity (action or condition). Use entityLocation "feedbacks" for conditions, "trigger_actions" for actions (default).
- set_entity_enabled: Enable or disable an action or condition without removing it
- remove_entity: Remove an entity (action or condition)

Option values may be expressions: pass { "value": "<expression>", "isExpression": true } instead of a plain value.`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readTriggers(client: CompanionClient): Promise<Record<string, any>> {
	const data = expectInit(
		await getInitialData((observer) => client.controls.triggers.watch.subscribe(undefined, observer)),
		'controls.triggers.watch'
	)
	return data.triggers ?? {}
}

export function registerTriggerTools(server: McpServer, client: CompanionClient): void {
	server.registerTool(
		'list_triggers',
		{
			description: 'List all triggers with their names, enabled state, descriptions, and collection IDs',
		},
		async () => {
			const triggers = Object.entries(await readTriggers(client)).map(([controlId, info]) => ({
				controlId,
				name: info.name,
				enabled: info.enabled,
				description: info.description,
				collectionId: info.collectionId ?? null,
				sortOrder: info.sortOrder,
				lastExecuted: info.lastExecuted,
			}))
			return textResult(triggers)
		}
	)

	server.registerTool(
		'list_trigger_collections',
		{
			description: 'List all trigger collections (groups) with their IDs and names',
		},
		async () => {
			const data = await getInitialData((observer) =>
				client.controls.triggers.collections.watchQuery.subscribe(undefined, observer)
			)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const flatten = (items: any[], parentId: string | null, out: any[]) => {
				for (const item of items ?? []) {
					out.push({
						collectionId: item.id,
						name: item.label,
						parentId,
						sortOrder: item.sortOrder,
						enabled: item.metaData?.enabled,
					})
					if (item.children) flatten(item.children, item.id, out)
				}
				return out
			}
			return textResult(Array.isArray(data) ? flatten(data, null, []) : data)
		}
	)

	server.registerTool(
		'get_trigger',
		{
			description: 'Get the full configuration of a trigger including its events, actions, and conditions',
			inputSchema: {
				controlId: z.string().describe('The trigger controlId (e.g., "trigger:abc123")'),
			},
		},
		async ({ controlId }) => {
			const data = expectInit(
				await getInitialData((observer) => client.controls.watchControl.subscribe({ controlId }, observer)),
				'controls.watchControl'
			)
			return textResult({ controlId, ...data })
		}
	)

	server.registerTool(
		'create_trigger',
		{
			description:
				'Create a new trigger, optionally with full configuration in one call. Returns the controlId of the new trigger.',
			inputSchema: {
				name: z.string().optional().describe('Trigger name'),
				enabled: z.boolean().optional().describe('Whether the trigger is enabled (default: false)'),
				collectionId: z.string().optional().describe('Collection ID to add trigger to'),
				operations: z
					.array(operationSchema)
					.optional()
					.describe('Optional operations to configure the trigger after creation'),
			},
		},
		async ({ name, enabled, collectionId, operations }) => {
			const controlId = await client.controls.triggers.create.mutate()

			const initOps: Operation[] = []
			if (name !== undefined || enabled !== undefined || collectionId !== undefined) {
				initOps.push({ op: 'set_options', name, enabled, collectionId })
			}

			const allOps = [...initOps, ...(operations ?? [])]
			const results = allOps.length > 0 ? await executeOperations(client, controlId, allOps) : []
			return textResult({ success: true, controlId, results })
		}
	)

	server.registerTool(
		'clone_trigger',
		{
			description:
				'Clone an existing trigger (Companion makes an exact copy), then optionally rename it, change its enabled state or collection, and override options on its actions/conditions. Entity IDs in optionOverrides refer to the SOURCE trigger; the copy\'s entities are matched by position.',
			inputSchema: {
				sourceControlId: z.string().describe('The trigger controlId to clone'),
				name: z.string().optional().describe('Name for the cloned trigger (default: Companion\'s copy name)'),
				enabled: z.boolean().optional().describe('Whether the clone is enabled (defaults to source state)'),
				collectionId: z
					.string()
					.nullable()
					.optional()
					.describe('Collection to add clone to (defaults to source collection)'),
				optionOverrides: z
					.array(
						z.object({
							entityId: z.string().describe('Entity ID from the source trigger'),
							entityLocation: z.enum(['trigger_actions', 'feedbacks']).describe('Location of the entity'),
							options: z.record(z.string(), z.unknown()).describe('Options to override'),
						})
					)
					.optional()
					.describe('Override specific entity options in the cloned trigger'),
			},
		},
		async ({ sourceControlId, name, enabled, collectionId, optionOverrides }) => {
			const newControlId: string | false = await client.controls.triggers.clone.mutate({ controlId: sourceControlId })
			if (!newControlId) throw new Error('Companion could not clone the trigger (is the controlId a trigger?)')

			const ops: Operation[] = []
			if (name !== undefined || enabled !== undefined || collectionId !== undefined) {
				ops.push({ op: 'set_options', name, enabled, collectionId })
			}

			if (optionOverrides && optionOverrides.length > 0) {
				// Map source entity IDs to the clone's entity IDs by position
				const [source, clone] = await Promise.all([
					getInitialData((observer) => client.controls.watchControl.subscribe({ controlId: sourceControlId }, observer)),
					getInitialData((observer) => client.controls.watchControl.subscribe({ controlId: newControlId }, observer)),
				])
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const collectIds = (entities: any[] | undefined, out: string[] = []): string[] => {
					for (const e of entities ?? []) {
						out.push(e.id)
						for (const children of Object.values(e.children ?? {})) collectIds(children as [], out)
					}
					return out
				}
				const idMap = new Map<string, { id: string; location: 'trigger_actions' | 'feedbacks' }>()
				for (const location of ['trigger_actions', 'feedbacks'] as const) {
					const src = collectIds(source.config?.[location])
					const dst = collectIds(clone.config?.[location])
					src.forEach((id, i) => {
						if (dst[i]) idMap.set(id, { id: dst[i], location })
					})
				}
				for (const override of optionOverrides) {
					const mapped = idMap.get(override.entityId)
					if (!mapped) {
						ops.push({ op: 'update_entity_options', entityId: override.entityId, options: override.options })
						continue
					}
					ops.push({
						op: 'update_entity_options',
						entityId: mapped.id,
						entityLocation: mapped.location,
						options: override.options,
					})
				}
			}

			const results = ops.length > 0 ? await executeOperations(client, newControlId, ops) : []
			return textResult({ success: true, controlId: newControlId, clonedFrom: sourceControlId, results })
		}
	)

	server.registerTool(
		'create_trigger_collection',
		{
			description: 'Create a trigger collection (group). Returns the collectionId.',
			inputSchema: {
				name: z.string().describe('The collection name'),
			},
		},
		async ({ name }) => {
			const collectionId = await client.controls.triggers.collections.add.mutate({ collectionName: name })
			return textResult({ success: true, collectionId })
		}
	)

	server.registerTool(
		'delete_trigger',
		{
			description: 'Delete a trigger by its controlId',
			inputSchema: {
				controlId: z.string().describe('The trigger controlId'),
			},
		},
		async ({ controlId }) => {
			await client.controls.triggers.delete.mutate({ controlId })
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'test_trigger',
		{
			description: 'Run the actions of a trigger once, now, regardless of its events (same as "Test actions" in the UI)',
			inputSchema: {
				controlId: z.string().describe('The trigger controlId'),
			},
		},
		async ({ controlId }) => {
			await client.controls.triggers.testActions.mutate({ controlId })
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'update_trigger',
		{
			description: `Update a trigger with multiple operations in a single call. Operations are executed in order.

IMPORTANT: Always call get_trigger first to read the current trigger state before making changes. This ensures you know the existing events, actions, conditions, and entity IDs, and avoids accidentally duplicating or misconfiguring entities.

${operationsDescription}`,
			inputSchema: {
				controlId: z.string().describe('The trigger controlId'),
				operations: z.array(operationSchema).describe('Array of operations to perform on the trigger'),
			},
		},
		async ({ controlId, operations }) => {
			const results = await executeOperations(client, controlId, operations)
			return textResult({ controlId, results })
		}
	)

	server.registerTool(
		'batch_update_triggers',
		{
			description: `Update multiple triggers in a single call. Each item specifies a controlId and an array of operations. Items are processed sequentially, and operations within each item are also executed in order.

Use this for bulk operations like configuring many triggers at once, reordering triggers in a collection, or applying the same changes across multiple triggers.

IMPORTANT: Always call get_trigger first to read the current trigger state before making changes.

${operationsDescription}`,
			inputSchema: {
				items: z
					.array(
						z.object({
							controlId: z.string().describe('The trigger controlId'),
							operations: z.array(operationSchema).describe('Array of operations to perform on this trigger'),
						})
					)
					.describe('Array of trigger updates to perform'),
			},
		},
		async ({ items }) => {
			const triggerResults: Array<{ controlId: string; results: OperationResult[] }> = []
			for (const item of items) {
				const results = await executeOperations(client, item.controlId, item.operations)
				triggerResults.push({ controlId: item.controlId, results })
			}
			return textResult({ triggerResults })
		}
	)
}
