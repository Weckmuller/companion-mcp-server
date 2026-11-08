import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CompanionClient } from './trpc-client.js'
import { expectInit, getInitialData } from './trpc-client.js'

const USAGE_GUIDE = `# Bitfocus Companion MCP Server - Usage Guide

## Overview
This MCP server connects to a running Bitfocus Companion (5.x) instance and exposes tools
to manage buttons, triggers, connections, variables and surfaces (Stream Decks and other panels).

## Key Concepts

### Connections
Connections are integrations with external devices/software (video switchers, media servers,
lighting controllers, OSC targets...). Each connection has an ID (used in add_action/add_feedback)
and a label (used in variable references like \`$(label:variable)\`).
Use \`list_connections\` to see them.

### Pages and the grid
Pages organise buttons in a grid. Rows and columns are 0-based; pages are 1-based. The grid can
be bigger than any one surface: a surface shows the window of the grid given by its xOffset/yOffset
and its size (e.g. two Stream Deck XLs side by side cover columns 0-7 and 8-15 of a 16x4 grid).
Use \`list_pages\` to see pages and which positions hold buttons.

### Buttons
Companion 5 buttons are "layered": their look is a stack of style elements (canvas, a background
box, a text element, optional images/shapes). \`update_button\` with \`set_style\` edits the default
text and background; \`set_element_options\` and \`add_element\` give full control. Buttons also have:
- **Actions** in steps and action sets ("down" = press, "up" = release, numbers = hold durations)
- **Feedbacks**: dynamic styling or conditions driven by device state

Option values are plain values; pass \`{ "value": "...", "isExpression": true }\` to use an expression.

### Triggers
Triggers run actions on events (interval, time of day, variable changed, condition true, startup...).
Each trigger has a controlId like \`trigger:abc123\`.

### Variables
Variables hold values from connections or custom (user) values, referenced as \`$(label:name)\`.
Custom variables live under the label \`custom\`.

### Surfaces
Surfaces are Stream Decks, X-keys, emulators, satellite panels... Each belongs to a group (an
"auto group" with the same id as the surface, unless you create manual groups). The group decides
the current page, the startup page and page restrictions; the surface itself has brightness,
rotation and grid offsets. Surfaces are listed even when disconnected, so a deck can be configured
before it is plugged in. Panel config (brightness etc.) can only be changed while connected.

## Common Workflows

### Build a button
1. \`list_connections\` - find the connection ID
2. \`list_connection_definitions\` (compact=true, search=...) - find the action/feedback IDs and option keys
3. \`create_button\` at the location
4. \`update_button\` with \`set_style\`, \`add_action\` (with options), \`add_feedback\`

### Place a preset
1. \`list_presets\` for the connection
2. \`import_preset\` at the location

### Change an existing button
1. \`get_button\` - read style elements, actions and feedbacks with their IDs
2. \`update_button\` with the needed operations

### Configure a Stream Deck
1. \`list_surfaces\` - find the surfaceId, its group and current settings
2. \`set_surface_group_config\` - startup_page, use_last_page, page (switch now), restrict_pages...
3. \`set_surface_config\` - brightness, rotation, xOffset/yOffset (connected surfaces only)
4. \`set_surface_name\`, \`create_surface_group\` + \`set_surface_group\` to make two decks act as one

### Create a trigger
1. \`create_trigger\` with name, enabled and operations (add_event with options, add_action with options)
2. \`test_trigger\` to run its actions once

## Entity Locations
- Button actions use location \`{ stepId: '0', setId: 'down' }\` by default
- Button feedbacks use location \`'feedbacks'\`
- Trigger actions use location \`'trigger_actions'\`
- Trigger conditions use location \`'feedbacks'\`

## Colours
Colours are decimal RGB numbers: white 16777215, black 0, red 16711680, green 65280, blue 255,
yellow 16776960, orange 16744448, dark grey 2500134.
`

export function registerResources(server: McpServer, client: CompanionClient): void {
	server.registerResource(
		'usage_guide',
		'companion://guide',
		{ description: 'How to use the Companion MCP server tools effectively' },
		() => ({
			contents: [
				{
					uri: 'companion://guide',
					mimeType: 'text/markdown',
					text: USAGE_GUIDE,
				},
			],
		})
	)

	server.registerResource(
		'connections_summary',
		'companion://connections',
		{ description: 'Summary of all configured connections with their IDs, labels, module types, and enabled state' },
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
				enabled: config.enabled,
			}))

			let text = '# Companion Connections\n\n'
			if (connections.length === 0) {
				text += 'No connections configured.\n'
			} else {
				text += `${connections.length} connection(s) configured:\n\n`
				for (const conn of connections) {
					const status = conn.enabled ? 'enabled' : 'disabled'
					text += `- **${conn.label}** (ID: \`${conn.id}\`, module: \`${conn.moduleId}\`, ${status})\n`
				}
			}

			return {
				contents: [
					{
						uri: 'companion://connections',
						mimeType: 'text/markdown',
						text,
					},
				],
			}
		}
	)

	server.registerResource(
		'presets_summary',
		'companion://presets',
		{
			description:
				'Summary of all available presets grouped by connection, showing categories and preset names. Presets are pre-configured button templates provided by connection modules.',
		},
		async () => {
			const data = expectInit(
				await getInitialData((observer) => client.instances.definitions.presets.subscribe(undefined, observer)),
				'definitions.presets'
			)

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const definitions = data.definitions as Record<string, Record<string, any>>

			let text = '# Companion Presets\n\n'
			const connectionIds = Object.keys(definitions)

			if (connectionIds.length === 0) {
				text += 'No presets available.\n'
			} else {
				for (const connectionId of connectionIds) {
					const presets = definitions[connectionId]
					const presetList = Object.values(presets)
					if (presetList.length === 0) continue

					const categories: Record<string, Array<{ id: string; label: string; type: string }>> = {}
					for (const preset of presetList) {
						const cat = preset.category || 'Uncategorized'
						if (!categories[cat]) categories[cat] = []
						categories[cat].push({ id: preset.id, label: preset.label, type: preset.type })
					}

					text += `## Connection: \`${connectionId}\` (${presetList.length} presets)\n\n`
					for (const [category, items] of Object.entries(categories)) {
						text += `### ${category}\n`
						for (const item of items) {
							text += `- **${item.label}** (ID: \`${item.id}\`, type: ${item.type})\n`
						}
						text += '\n'
					}
				}
			}

			return {
				contents: [
					{
						uri: 'companion://presets',
						mimeType: 'text/markdown',
						text,
					},
				],
			}
		}
	)
}
