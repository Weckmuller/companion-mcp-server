import { randomUUID } from 'node:crypto'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CompanionClient } from '../trpc-client.js'
import { expectInit, getInitialData, textResult, toExpressionOrValue } from '../trpc-client.js'

// Inlined from @companion-app/shared to allow standalone npm publishing
const EntityModelType = { Action: 'action', Feedback: 'feedback' } as const

const locationSchema = {
	pageNumber: z.number().int().min(1).describe('Page number (1-based)'),
	row: z.number().int().describe('Row (0-based, top row is 0)'),
	column: z.number().int().describe('Column (0-based, left column is 0)'),
}

export async function readPages(client: CompanionClient): Promise<{
	order: string[]
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	pages: Record<string, any>
}> {
	return expectInit(
		await getInitialData((observer) => client.pages.watch.subscribe(undefined, observer)),
		'pages.watch'
	)
}

async function resolveControlId(
	client: CompanionClient,
	pageNumber: number,
	row: number,
	column: number
): Promise<string | null> {
	const pagesData = await readPages(client)
	const pageId = pagesData.order[pageNumber - 1]
	if (!pageId) return null
	const page = pagesData.pages[pageId]
	if (!page) return null
	return page.controls?.[row]?.[column] ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readControl(client: CompanionClient, controlId: string): Promise<any> {
	return expectInit(
		await getInitialData((observer) => client.controls.watchControl.subscribe({ controlId }, observer)),
		'controls.watchControl'
	)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findEntityLocation(config: any, entityId: string): 'feedbacks' | { stepId: string; setId: string } {
	for (const fb of config?.feedbacks ?? []) {
		if (fb.id === entityId) return 'feedbacks'
	}
	for (const [stepId, step] of Object.entries(config?.steps ?? {})) {
		const actionSets = (step as { action_sets?: Record<string, Array<{ id: string }>> }).action_sets
		if (!actionSets) continue
		for (const [setId, actions] of Object.entries(actionSets)) {
			for (const action of actions ?? []) {
				if (action.id === entityId) return { stepId, setId }
			}
		}
	}
	return { stepId: '0', setId: 'down' }
}

/**
 * Walk the layered style of a button and return the elements, flattening groups.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenLayers(layers: any[] | undefined, out: any[] = []): any[] {
	for (const layer of layers ?? []) {
		out.push(layer)
		if (layer.type === 'group' && Array.isArray(layer.children)) flattenLayers(layer.children, out)
	}
	return out
}

/**
 * Produce a compact, readable view of a layered button: the text/colour of the default
 * elements plus the actions and feedbacks, without the full layer tree.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function summariseButton(controlId: string, data: any): any {
	const config = data.config ?? {}
	const layers = flattenLayers(config.style?.layers)
	const text = layers.find((l) => l.type === 'text')
	const box = layers.find((l) => l.type === 'box')
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const unwrap = (v: any) => (v && typeof v === 'object' && 'isExpression' in v ? (v.isExpression ? `=${v.value}` : v.value) : v)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const unwrapOptions = (options: Record<string, any> | undefined) => {
		if (!options) return options
		const out: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(options)) out[k] = unwrap(v)
		return out
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const unwrapChildren = (children: Record<string, any[]> | undefined) => {
		if (!children) return children
		const out: Record<string, unknown[]> = {}
		for (const [group, list] of Object.entries(children)) {
			out[group] = (list ?? []).map((a) => ({
				entityId: a.id,
				connectionId: a.connectionId,
				definitionId: a.definitionId,
				options: unwrapOptions(a.options),
				disabled: a.disabled || undefined,
				children: unwrapChildren(a.children),
			}))
		}
		return out
	}

	const steps: Record<string, unknown> = {}
	for (const [stepId, step] of Object.entries(config.steps ?? {})) {
		const sets: Record<string, unknown> = {}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		for (const [setId, actions] of Object.entries((step as any).action_sets ?? {})) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			sets[setId] = (actions as any[]).map((a) => ({
				entityId: a.id,
				connectionId: a.connectionId,
				definitionId: a.definitionId,
				options: unwrapOptions(a.options),
				disabled: a.disabled || undefined,
				children: unwrapChildren(a.children),
			}))
		}
		steps[stepId] = sets
	}

	return {
		controlId,
		type: config.type,
		style: {
			text: text ? unwrap(text.text) : undefined,
			color: text ? unwrap(text.color) : undefined,
			bgcolor: box ? unwrap(box.color) : undefined,
			fontsize: text ? unwrap(text.fontsize) : undefined,
			textElementId: text?.id,
			backgroundElementId: box?.id,
			elements: layers.map((l) => ({ id: l.id, type: l.type, name: l.name })),
		},
		options: config.options,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		feedbacks: (config.feedbacks ?? []).map((f: any) => ({
			entityId: f.id,
			connectionId: f.connectionId,
			definitionId: f.definitionId,
			options: unwrapOptions(f.options),
			isInverted: unwrap(f.isInverted),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			styleOverrides: (f.styleOverrides ?? []).map((o: any) => ({
				overrideId: o.overrideId,
				elementId: o.elementId,
				property: o.elementProperty,
				value: unwrap(o.override),
			})),
			disabled: f.disabled || undefined,
		})),
		steps,
		localVariables: config.localVariables,
		runtime: data.runtime,
	}
}

export function registerButtonTools(server: McpServer, client: CompanionClient): void {
	server.registerTool(
		'list_pages',
		{
			description:
				'List all pages with their names and which grid positions hold a button. Rows and columns are 0-based; pages are 1-based.',
		},
		async () => {
			const pagesData = await readPages(client)
			const pages = pagesData.order.map((pageId: string, index: number) => {
				const page = pagesData.pages[pageId]
				const occupied: string[] = []
				for (const [row, cols] of Object.entries(page?.controls ?? {})) {
					for (const col of Object.keys(cols as Record<string, string>)) occupied.push(`${row}/${col}`)
				}
				return {
					pageNumber: index + 1,
					id: pageId,
					name: page?.name ?? '',
					buttonCount: occupied.length,
					occupied: occupied.join(' '),
				}
			})
			return textResult(pages)
		}
	)

	server.registerTool(
		'describe_page',
		{
			description:
				'Describe every button on a page in one call: position, text, colours, and the actions and feedbacks (definition IDs with their options). Use this to understand a layout before changing it, instead of calling get_button for each position. Rows and columns are 0-based.',
			inputSchema: {
				pageNumber: z.number().int().min(1).describe('Page number (1-based)'),
				rows: z.array(z.number().int()).optional().describe('Only these rows (default: all)'),
				columns: z.array(z.number().int()).optional().describe('Only these columns (default: all)'),
			},
		},
		async ({ pageNumber, rows, columns }) => {
			const pagesData = await readPages(client)
			const pageId = pagesData.order[pageNumber - 1]
			if (!pageId) return textResult({ error: `No page ${pageNumber}` })
			const page = pagesData.pages[pageId]

			const buttons: unknown[] = []
			for (const [rowStr, cols] of Object.entries(page?.controls ?? {})) {
				const row = Number(rowStr)
				if (rows && !rows.includes(row)) continue
				for (const [colStr, controlId] of Object.entries(cols as Record<string, string>)) {
					const column = Number(colStr)
					if (columns && !columns.includes(column)) continue
					try {
						const data = await readControl(client, controlId)
						const s = summariseButton(controlId, data)
						buttons.push({
							row,
							column,
							controlId,
							type: s.type,
							text: s.style?.text,
							color: s.style?.color,
							bgcolor: s.style?.bgcolor,
							steps: s.steps,
							feedbacks: s.feedbacks,
						})
					} catch (e) {
						buttons.push({ row, column, controlId, error: String((e as Error)?.message ?? e) })
					}
				}
			}
			buttons.sort((a, b) => {
				const x = a as { row: number; column: number }
				const y = b as { row: number; column: number }
				return x.row - y.row || x.column - y.column
			})
			return textResult({ pageNumber, pageId, name: page?.name ?? '', buttonCount: buttons.length, buttons })
		}
	)

	server.registerTool(
		'create_page',
		{
			description:
				'Create one or more new pages at a position. Companion fills column 0 of a new page with page-up (row 0), page-number (row 1) and page-down (row 2) buttons; delete them with delete_button if you need those positions. Inserting before existing pages shifts their numbers, which other things reference. To append, pass asPageNumber = current page count + 1.',
			inputSchema: {
				asPageNumber: z.number().describe('Page number the first new page gets (1-based); existing pages from there on move down'),
				pageNames: z.array(z.string()).describe('Names of the pages to create, in order'),
			},
		},
		async ({ asPageNumber, pageNames }) => {
			const result = await client.pages.insert.mutate({ asPageNumber, pageNames })
			const created = pageNames.map((name, i) => ({ pageNumber: asPageNumber + i, name }))
			return textResult({
				success: result === 'ok',
				result,
				created,
				note: 'Each new page has page-up/page-number/page-down buttons at 0/0, 1/0 and 2/0 (column 0).',
			})
		}
	)

	server.registerTool(
		'remove_page',
		{
			description: 'Delete a page and all its controls. Cannot delete the last remaining page.',
			inputSchema: {
				pageNumber: z.number().describe('Page number to delete (1-based)'),
			},
		},
		async ({ pageNumber }) => {
			const result = await client.pages.remove.mutate({ pageNumber })
			return textResult({ success: result === 'ok', result })
		}
	)

	server.registerTool(
		'set_page_name',
		{
			description: 'Rename a page',
			inputSchema: {
				pageNumber: z.number().describe('Page number to rename (1-based)'),
				name: z.string().describe('New name for the page'),
			},
		},
		async ({ pageNumber, name }) => {
			await client.pages.setName.mutate({ pageNumber, name })
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'move_page',
		{
			description: 'Move a page to a different position in the page order',
			inputSchema: {
				pageId: z.string().describe('The page ID to move (from list_pages)'),
				pageNumber: z.number().describe('The new page number position (1-based)'),
			},
		},
		async ({ pageId, pageNumber }) => {
			const result = await client.pages.move.mutate({ pageId, pageNumber })
			return textResult({ success: result === 'ok', result })
		}
	)

	server.registerTool(
		'clear_page',
		{
			description: 'Clear all controls from a page and reset it to defaults with navigation buttons',
			inputSchema: {
				pageNumber: z.number().describe('Page number to clear (1-based)'),
			},
		},
		async ({ pageNumber }) => {
			const result = await client.pages.clearPage.mutate({ pageNumber })
			return textResult({ success: result === 'ok', result })
		}
	)

	server.registerTool(
		'get_button',
		{
			description:
				'Get the configuration of the button at a location: text, colours, style elements, actions (with entity IDs), feedbacks and runtime state. Pass full=true for the raw Companion control model including every style layer property.',
			inputSchema: {
				...locationSchema,
				full: z.boolean().optional().describe('Return the raw control model instead of the summary (default: false)'),
			},
		},
		async ({ pageNumber, row, column, full }) => {
			const controlId = await resolveControlId(client, pageNumber, row, column)
			if (!controlId) return textResult({ error: 'No button at this location' })
			const data = await readControl(client, controlId)
			return textResult(full ? { controlId, ...data } : summariseButton(controlId, data))
		}
	)

	server.registerTool(
		'create_button',
		{
			description:
				'Create a new empty button at a location (Companion 5 layered button with a background and a text element). Refuses if a button already exists there unless replace=true, because creating over an existing button erases it with no undo. Use update_button afterwards to set the style and add actions.',
			inputSchema: {
				...locationSchema,
				type: z
					.enum(['button-layered', 'pagenum', 'pageup', 'pagedown'])
					.optional()
					.describe('Control type to create (default: button-layered, a normal button)'),
				replace: z
					.boolean()
					.optional()
					.describe('Set true to erase and replace a button that already exists at this location (default: false)'),
			},
		},
		async ({ pageNumber, row, column, type, replace }) => {
			const existing = await resolveControlId(client, pageNumber, row, column)
			if (existing && !replace) {
				const data = await readControl(client, existing)
				const s = summariseButton(existing, data)
				return textResult({
					success: false,
					error: `A ${s.type} button already exists at ${pageNumber}/${row}/${column} (text ${JSON.stringify(s.style?.text ?? '')}). Use update_button to change it, delete_button to remove it, or create_button with replace=true to erase and recreate it.`,
					existing: { controlId: existing, type: s.type, text: s.style?.text },
				})
			}
			await client.controls.resetControls.mutate({
				locations: [{ pageNumber, row, column }],
				newType: type ?? 'button-layered',
			})
			const controlId = await resolveControlId(client, pageNumber, row, column)
			if (!controlId) {
				return textResult({
					success: false,
					error: 'Companion refused to create the button. The location is probably outside the configured grid size.',
				})
			}
			return textResult({ success: true, controlId })
		}
	)

	server.registerTool(
		'delete_button',
		{
			description: 'Delete the button at a location, leaving the position empty',
			inputSchema: { ...locationSchema },
		},
		async ({ pageNumber, row, column }) => {
			await client.controls.resetControls.mutate({
				locations: [{ pageNumber, row, column }],
				newType: null,
			})
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'copy_button',
		{
			description: 'Copy, move or swap buttons between grid locations (like drag and drop in the Companion UI).',
			inputSchema: {
				operation: z.enum(['copy', 'move', 'swap']).describe('What to do with the pair(s)'),
				pairs: z
					.array(
						z.object({
							from: z.object(locationSchema),
							to: z.object(locationSchema),
						})
					)
					.min(1)
					.describe('Location pairs to process'),
			},
		},
		async ({ operation, pairs }) => {
			const result = await client.controls.gridBatchTransfer.mutate({
				operation,
				pairs: pairs.map((p) => ({ fromLocation: p.from, toLocation: p.to })),
			})
			return textResult({ success: result !== false, result })
		}
	)

	server.registerTool(
		'press_button',
		{
			description:
				'Simulate a button press at a location. With direction omitted, performs a full press (down then up). Pass direction=true for down only, false for up only.',
			inputSchema: {
				...locationSchema,
				direction: z
					.boolean()
					.optional()
					.describe('true = press down, false = release. Omit for a complete press-and-release.'),
			},
		},
		async ({ pageNumber, row, column, direction }) => {
			const location = { pageNumber, row, column }
			if (direction === undefined) {
				await client.controls.hotPressControl.mutate({ location, direction: true, surfaceId: 'mcp' })
				await new Promise((r) => setTimeout(r, 50))
				await client.controls.hotPressControl.mutate({ location, direction: false, surfaceId: 'mcp' })
			} else {
				await client.controls.hotPressControl.mutate({ location, direction, surfaceId: 'mcp' })
			}
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'import_preset',
		{
			description:
				'Place a preset from a connection module onto a grid location. Presets are ready-made buttons (style + actions + feedbacks) that modules provide; see the companion://presets resource or list_presets for IDs. mode "copy" makes an editable one-off copy; "reference" (default) keeps a live link to the preset when the module supports it.',
			inputSchema: {
				connectionId: z.string().describe('Connection ID that provides the preset'),
				presetId: z.string().describe('Preset ID (from list_presets)'),
				...locationSchema,
				mode: z.enum(['copy', 'reference']).optional().describe('Default: reference'),
				variableValues: z
					.record(z.string(), z.unknown())
					.optional()
					.describe('Values for the preset\'s local variables, if it has any'),
			},
		},
		async ({ connectionId, presetId, pageNumber, row, column, mode, variableValues }) => {
			const result = await client.controls.importPreset.mutate({
				connectionId,
				presetId,
				location: { pageNumber, row, column },
				variableValues: variableValues ?? null,
				mode: mode ?? 'reference',
			})
			const controlId = await resolveControlId(client, pageNumber, row, column)
			return textResult({ success: !!result, controlId })
		}
	)

	server.registerTool(
		'list_presets',
		{
			description:
				'List the presets a connection offers, grouped by category. Use with import_preset. Pass search to filter by label or ID.',
			inputSchema: {
				connectionId: z.string().describe('Connection ID'),
				search: z.string().optional().describe('Case-insensitive filter on preset label, ID or category'),
			},
		},
		async ({ connectionId, search }) => {
			const data = expectInit(
				await getInitialData((observer) => client.instances.definitions.presets.subscribe(undefined, observer)),
				'definitions.presets'
			)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const presets = Object.values((data.definitions?.[connectionId] ?? {}) as Record<string, any>)
			const q = search?.toLowerCase()
			const byCategory: Record<string, Array<{ id: string; label: string; type: string }>> = {}
			for (const p of presets) {
				if (q && !`${p.id} ${p.label} ${p.category ?? ''}`.toLowerCase().includes(q)) continue
				const cat = p.category || 'Uncategorized'
				;(byCategory[cat] ??= []).push({ id: p.id, label: p.label, type: p.type })
			}
			return textResult({ connectionId, presetCount: presets.length, categories: byCategory })
		}
	)

	server.registerTool(
		'update_button',
		{
			description: `Update a button with multiple operations in a single call. Operations are executed in order.

IMPORTANT: Call get_button first to read the current state (existing actions, feedbacks, style elements and their entity IDs) before changing a button that already has content.

Available operations:
- set_style: Set text, text colour, background colour and text size on the button's default text and background elements. Colours are decimal RGB numbers (16777215 = white, 16711680 = red); text may contain variables like $(custom:name) and "\\n" for a line break. Size is a percentage of the element height; shrink-to-fit stays on unless shrinkToFit is false.
- set_element_options: Set arbitrary properties on one style element (from get_button's style.elements), e.g. { "halign": "left", "fontsize": 18 }. A property value may be an expression: { "value": "$(custom:x) > 1", "isExpression": true }.
- add_element: Add a style element (text, box, image, line, circle, group) to the button and return its elementId.
- remove_element: Remove a style element by elementId.
- add_action: Add an action (use list_connection_definitions for actionId values). Pass options to configure it at once. Defaults to the press ("down") set of step 0; stepId/setId select another set (e.g. setId "up" for release, or a number for a hold duration set).
- add_feedback: Add a feedback (use list_connection_definitions for feedbackId values), optionally with options.
- update_entity_options: Update options on an existing action or feedback by entityId.
- set_entity_enabled: Enable or disable an action or feedback without removing it.
- set_feedback_inverted: Invert a boolean feedback.
- set_feedback_style: Make a feedback restyle the button while it is active: override one property of one style element (e.g. elementId "box0" property "color" value 65280). A boolean feedback with no style override has no visible effect. For value feedbacks the value is an expression using $(this:value). Repeat for several properties.
- remove_feedback_style: Remove one style override (overrideId from get_button) from a feedback.
- remove_entity: Remove an action or feedback by entityId.
- set_option: Set a button option (e.g. rotaryActions, stepProgression, notes).`,
			inputSchema: {
				...locationSchema,
				operations: z
					.array(
						z.union([
							z.object({
								op: z.literal('set_style'),
								text: z.string().optional().describe('Button text'),
								color: z.number().optional().describe('Text colour as decimal RGB (e.g. 16777215 for white)'),
								bgcolor: z.number().optional().describe('Background colour as decimal RGB (e.g. 16711680 for red)'),
								size: z
									.union([z.string(), z.number()])
									.optional()
									.describe(
										'Text size as a percentage of the text element height (24 is a typical label, 44 large). "auto" only turns shrink-to-fit on.'
									),
								shrinkToFit: z
									.boolean()
									.optional()
									.describe('Allow the text to shrink below the size when it does not fit (Companion default: true)'),
							}),
							z.object({
								op: z.literal('set_element_options'),
								elementId: z.string().describe('Style element ID (from get_button style.elements)'),
								values: z.record(z.string(), z.unknown()).describe('Property values to set'),
							}),
							z.object({
								op: z.literal('add_element'),
								type: z.enum(['text', 'box', 'image', 'line', 'circle', 'group']).describe('Element type'),
								afterElementId: z
									.string()
									.optional()
									.describe('Insert directly above this element; omit to add on top'),
								values: z.record(z.string(), z.unknown()).optional().describe('Property values to set on the new element'),
							}),
							z.object({
								op: z.literal('remove_element'),
								elementId: z.string().describe('Style element ID'),
							}),
							z.object({
								op: z.literal('add_action'),
								connectionId: z.string().describe('The connection ID'),
								actionId: z.string().describe('The action definition ID'),
								options: z.record(z.string(), z.unknown()).optional().describe('Option values for the new action'),
								stepId: z.string().optional().describe('Step ID (default "0")'),
								setId: z
									.union([z.string(), z.number()])
									.optional()
									.describe('Action set: "down" (default), "up", "rotate_left", "rotate_right", or a hold duration in ms'),
							}),
							z.object({
								op: z.literal('add_feedback'),
								connectionId: z.string().describe('The connection ID'),
								feedbackId: z.string().describe('The feedback definition ID'),
								options: z.record(z.string(), z.unknown()).optional().describe('Option values for the new feedback'),
							}),
							z.object({
								op: z.literal('update_entity_options'),
								entityId: z.string().describe('The entity ID to update'),
								options: z.record(z.string(), z.unknown()).describe('Option values to set'),
							}),
							z.object({
								op: z.literal('set_entity_enabled'),
								entityId: z.string().describe('The entity ID'),
								enabled: z.boolean(),
							}),
							z.object({
								op: z.literal('set_feedback_inverted'),
								entityId: z.string().describe('The feedback entity ID'),
								isInverted: z.boolean(),
							}),
							z.object({
								op: z.literal('set_feedback_style'),
								entityId: z.string().describe('The feedback entity ID'),
								elementId: z.string().describe('Style element to override (e.g. "box0" background, "text0" text)'),
								property: z
									.string()
									.describe('Element property to override: color, text, fontsize, enabled, opacity, base64Image, ...'),
								value: z
									.unknown()
									.describe(
										'Value while the feedback is active. Plain value, or { "value": "<expr>", "isExpression": true }; value feedbacks need an expression with $(this:value)'
									),
								overrideId: z
									.string()
									.optional()
									.describe('Existing overrideId to replace (from get_button); omit to add a new override'),
							}),
							z.object({
								op: z.literal('remove_feedback_style'),
								entityId: z.string().describe('The feedback entity ID'),
								overrideId: z.string().describe('The override ID (from get_button feedbacks[].styleOverrides)'),
							}),
							z.object({
								op: z.literal('remove_entity'),
								entityId: z.string().describe('The entity ID to remove'),
							}),
							z.object({
								op: z.literal('set_option'),
								key: z.string().describe('Option key, e.g. rotaryActions, stepProgression, notes'),
								value: z.unknown().describe('Option value'),
							}),
						])
					)
					.describe('Array of operations to perform on the button'),
			},
		},
		async ({ pageNumber, row, column, operations }) => {
			const controlId = await resolveControlId(client, pageNumber, row, column)
			if (!controlId) return textResult({ error: 'No button at this location' })

			const results: Array<{ op: string; success: boolean; entityId?: string; elementId?: string; error?: string }> = []

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let cachedConfig: any = null
			const config = async () => {
				if (!cachedConfig) cachedConfig = (await readControl(client, controlId)).config
				return cachedConfig
			}
			const invalidate = () => (cachedConfig = null)

			const setElementValues = async (elementId: string, values: Record<string, unknown>) => {
				const wrapped: Record<string, unknown> = {}
				for (const [k, v] of Object.entries(values)) wrapped[k] = toExpressionOrValue(v)
				const ok = await client.controls.styles.updateOptions.mutate({ controlId, elementId, values: wrapped })
				if (ok === false) throw new Error(`Element ${elementId} not found or value rejected`)
			}

			for (const operation of operations) {
				try {
					switch (operation.op) {
						case 'set_style': {
							const layers = flattenLayers((await config()).style?.layers)
							let text = layers.find((l) => l.type === 'text')
							let box = layers.find((l) => l.type === 'box')
							const textValues: Record<string, unknown> = {}
							if (operation.text !== undefined) textValues.text = operation.text
							if (operation.color !== undefined) textValues.color = operation.color
							if (operation.size !== undefined) {
								if (operation.size === 'auto') {
									textValues.fontsizeAllowShrink = true
								} else {
									const n = Number(operation.size)
									if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid size "${operation.size}": use a percentage of the element height (e.g. 24) or "auto"`)
									textValues.fontsize = n
								}
							}
							if (operation.shrinkToFit !== undefined) textValues.fontsizeAllowShrink = operation.shrinkToFit
							if (Object.keys(textValues).length > 0) {
								if (!text) {
									const id = await client.controls.styles.addElement.mutate({ controlId, type: 'text', afterElementId: null })
									if (!id) throw new Error('Could not add a text element')
									text = { id }
									invalidate()
								}
								await setElementValues(text.id, textValues)
							}
							if (operation.bgcolor !== undefined) {
								if (!box) {
									// Insert the background below everything but the canvas
									const canvas = layers.find((l) => l.type === 'canvas')
									const firstAboveCanvas = (await config()).style?.layers?.find(
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										(l: any) => l.id !== canvas?.id
									)
									const id = await client.controls.styles.addElement.mutate({
										controlId,
										type: 'box',
										afterElementId: firstAboveCanvas?.id ?? null,
									})
									if (!id) throw new Error('Could not add a background element')
									box = { id }
									invalidate()
								}
								await setElementValues(box.id, { color: operation.bgcolor })
							}
							results.push({ op: 'set_style', success: true })
							break
						}
						case 'set_element_options': {
							await setElementValues(operation.elementId, operation.values)
							results.push({ op: 'set_element_options', success: true, elementId: operation.elementId })
							break
						}
						case 'add_element': {
							const id = await client.controls.styles.addElement.mutate({
								controlId,
								type: operation.type,
								afterElementId: operation.afterElementId ?? null,
							})
							if (!id) throw new Error('Companion did not create the element')
							if (operation.values) await setElementValues(id, operation.values)
							invalidate()
							results.push({ op: 'add_element', success: true, elementId: id })
							break
						}
						case 'remove_element': {
							await client.controls.styles.removeElement.mutate({ controlId, elementId: operation.elementId })
							invalidate()
							results.push({ op: 'remove_element', success: true })
							break
						}
						case 'add_action': {
							const setIdRaw = operation.setId ?? 'down'
							const setId = typeof setIdRaw === 'string' && /^\d+$/.test(setIdRaw) ? Number(setIdRaw) : setIdRaw
							const actionLocation = { stepId: operation.stepId ?? '0', setId }
							const entityId = await client.controls.entities.add.mutate({
								controlId,
								entityLocation: actionLocation,
								ownerId: null,
								connectionId: operation.connectionId,
								entityType: EntityModelType.Action,
								entityDefinition: operation.actionId,
							})
							if (!entityId) throw new Error('Companion did not create the action (unknown connection or action ID?)')
							for (const [key, value] of Object.entries(operation.options ?? {})) {
								await client.controls.entities.setOption.mutate({
									controlId,
									entityLocation: actionLocation,
									entityId,
									key,
									value: toExpressionOrValue(value),
								})
							}
							invalidate()
							results.push({ op: 'add_action', success: true, entityId })
							break
						}
						case 'add_feedback': {
							const entityId = await client.controls.entities.add.mutate({
								controlId,
								entityLocation: 'feedbacks',
								ownerId: null,
								connectionId: operation.connectionId,
								entityType: EntityModelType.Feedback,
								entityDefinition: operation.feedbackId,
							})
							if (!entityId) throw new Error('Companion did not create the feedback (unknown connection or feedback ID?)')
							for (const [key, value] of Object.entries(operation.options ?? {})) {
								await client.controls.entities.setOption.mutate({
									controlId,
									entityLocation: 'feedbacks',
									entityId,
									key,
									value: toExpressionOrValue(value),
								})
							}
							invalidate()
							results.push({ op: 'add_feedback', success: true, entityId })
							break
						}
						case 'update_entity_options': {
							const entityLocation = findEntityLocation(await config(), operation.entityId)
							for (const [key, value] of Object.entries(operation.options)) {
								await client.controls.entities.setOption.mutate({
									controlId,
									entityLocation,
									entityId: operation.entityId,
									key,
									value: toExpressionOrValue(value),
								})
							}
							results.push({ op: 'update_entity_options', success: true })
							break
						}
						case 'set_entity_enabled': {
							const entityLocation = findEntityLocation(await config(), operation.entityId)
							await client.controls.entities.setEnabled.mutate({
								controlId,
								entityLocation,
								entityId: operation.entityId,
								enabled: operation.enabled,
							})
							results.push({ op: 'set_entity_enabled', success: true })
							break
						}
						case 'set_feedback_inverted': {
							await client.controls.entities.setInverted.mutate({
								controlId,
								entityLocation: 'feedbacks',
								entityId: operation.entityId,
								isInverted: { value: operation.isInverted, isExpression: false },
							})
							results.push({ op: 'set_feedback_inverted', success: true })
							break
						}
						case 'set_feedback_style': {
							// Replace an existing override of the same element+property (feedbacks often come
							// with default overrides), otherwise add a new one.
							let overrideId = operation.overrideId
							if (!overrideId) {
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const fb = ((await config()).feedbacks ?? []).find((f: any) => f.id === operation.entityId)
								const existing = (fb?.styleOverrides ?? []).find(
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									(o: any) => o.elementId === operation.elementId && o.elementProperty === operation.property
								)
								overrideId = existing?.overrideId
							}
							const ok = await client.controls.entities.replaceStyleOverride.mutate({
								controlId,
								entityLocation: 'feedbacks',
								entityId: operation.entityId,
								override: {
									overrideId: overrideId ?? randomUUID().replace(/-/g, '').slice(0, 21),
									elementId: operation.elementId,
									elementProperty: operation.property,
									override: toExpressionOrValue(operation.value),
								},
							})
							if (ok === false) throw new Error('Feedback not found, or the element/property is not overridable')
							invalidate()
							results.push({ op: 'set_feedback_style', success: true, entityId: operation.entityId })
							break
						}
						case 'remove_feedback_style': {
							const ok = await client.controls.entities.removeStyleOverride.mutate({
								controlId,
								entityLocation: 'feedbacks',
								entityId: operation.entityId,
								overrideId: operation.overrideId,
							})
							if (ok === false) throw new Error('Feedback or override not found')
							invalidate()
							results.push({ op: 'remove_feedback_style', success: true })
							break
						}
						case 'remove_entity': {
							const entityLocation = findEntityLocation(await config(), operation.entityId)
							await client.controls.entities.remove.mutate({
								controlId,
								entityLocation,
								entityId: operation.entityId,
							})
							invalidate()
							results.push({ op: 'remove_entity', success: true })
							break
						}
						case 'set_option': {
							await client.controls.setOptionsField.mutate({ controlId, key: operation.key, value: operation.value })
							results.push({ op: 'set_option', success: true })
							break
						}
					}
				} catch (e) {
					results.push({ op: operation.op, success: false, error: String((e as Error)?.message ?? e) })
				}
			}

			return textResult({ controlId, results })
		}
	)
}
