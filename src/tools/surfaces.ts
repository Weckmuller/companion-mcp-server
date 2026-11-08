import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CompanionClient } from '../trpc-client.js'
import { expectInit, getInitialData, textResult } from '../trpc-client.js'
import { readPages } from './buttons.js'

/**
 * Surfaces (Stream Decks, X-keys, emulators, satellite panels...) and the groups that hold them.
 *
 * Companion addresses a surface by its id (e.g. `streamdeck:A00NA6103LR6FW`). Every surface belongs to a
 * group: either a manual group, or an "auto group" whose id equals the surface id. Which page is shown,
 * the startup page and page restrictions live on the group; brightness, rotation and the grid offset live
 * on the surface itself.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readSurfaceGroups(client: CompanionClient): Promise<Record<string, any>> {
	const data = expectInit(
		await getInitialData((observer) => client.surfaces.watchSurfaces.subscribe(undefined, observer)),
		'surfaces.watchSurfaces'
	)
	return data.info ?? {}
}

export function registerSurfaceTools(server: McpServer, client: CompanionClient): void {
	server.registerTool(
		'list_surfaces',
		{
			description:
				'List every surface Companion knows (connected or not) with its group, type, size, grid offset, brightness, rotation and the config fields it accepts. Groups show which page they are on and their startup page.',
			inputSchema: {
				includeConfigFields: z
					.boolean()
					.optional()
					.describe('Include each surface\'s configFields schema (default: false)'),
			},
		},
		async ({ includeConfigFields }) => {
			const groups = await readSurfaceGroups(client)
			const pages = await readPages(client)
			const pageNumberOf = (pageId: string | undefined | null) => {
				if (!pageId) return null
				const idx = pages.order.indexOf(pageId)
				return idx >= 0 ? idx + 1 : null
			}

			const result = []
			for (const group of Object.values(groups)) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let groupConfig: any = null
				try {
					groupConfig = await getInitialData(
						(observer) => client.surfaces.watchGroupConfig.subscribe({ groupId: group.id }, observer),
						3000
					)
				} catch {
					groupConfig = null
				}
				result.push({
					groupId: group.id,
					displayName: group.displayName,
					isAutoGroup: group.isAutoGroup,
					index: group.index,
					group: groupConfig
						? {
								name: groupConfig.name,
								currentPage: pageNumberOf(groupConfig.last_page_id),
								startupPage: pageNumberOf(groupConfig.startup_page_id),
								use_last_page: groupConfig.use_last_page,
								never_lock: groupConfig.never_lock,
								restrict_pages: groupConfig.restrict_pages,
								allowed_pages: (groupConfig.allowed_page_ids ?? []).map(pageNumberOf),
							}
						: null,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					surfaces: (group.surfaces ?? []).map((s: any) => ({
						surfaceId: s.id,
						type: s.type,
						integrationType: s.integrationType,
						name: s.name,
						displayName: s.displayName,
						isConnected: s.isConnected,
						enabled: s.enabled,
						location: s.location,
						size: s.size,
						offset: s.offset,
						brightness: s.brightness,
						rotation: s.rotation,
						locked: s.locked,
						hasFirmwareUpdates: s.hasFirmwareUpdates,
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						configFields: includeConfigFields ? s.configFields : (s.configFields ?? []).map((f: any) => f.id),
					})),
				})
			}
			return textResult(result)
		}
	)

	server.registerTool(
		'get_surface_config',
		{
			description:
				'Get the full configuration of one surface: its panel config (brightness, rotation, xOffset, yOffset and integration-specific keys) and its group config (startup page, page restrictions, lock behaviour). A surface must be connected for its panel config to be readable.',
			inputSchema: {
				surfaceId: z.string().describe('Surface ID (from list_surfaces)'),
			},
		},
		async ({ surfaceId }) => {
			const groups = await readSurfaceGroups(client)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let groupId: string | null = null
			for (const group of Object.values(groups)) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if ((group.surfaces ?? []).some((s: any) => s.id === surfaceId)) groupId = group.id
			}
			const [panelConfig, groupConfig] = await Promise.all([
				getInitialData((observer) => client.surfaces.watchSurfaceConfig.subscribe({ surfaceId }, observer), 3000).catch(
					() => null
				),
				groupId
					? getInitialData((observer) => client.surfaces.watchGroupConfig.subscribe({ groupId }, observer), 3000).catch(
							() => null
						)
					: null,
			])
			return textResult({ surfaceId, groupId, panelConfig, groupConfig })
		}
	)

	server.registerTool(
		'set_surface_config',
		{
			description:
				'Set one panel config key on a connected surface. Common keys: brightness (0-100), rotation (0, "surface90", "surface-90", "surface180"), xOffset and yOffset (grid offset in buttons, e.g. a second Stream Deck XL to the right of the first gets xOffset 8), never_lock. Integration-specific keys are listed in list_surfaces configFields. Changes apply immediately and are saved.',
			inputSchema: {
				surfaceId: z.string().describe('Surface ID (from list_surfaces)'),
				key: z.string().describe('Config key'),
				value: z.unknown().describe('New value'),
			},
		},
		async ({ surfaceId, key, value }) => {
			const result = await client.surfaces.surfaceSetConfigKey.mutate({ surfaceId, key, value })
			return textResult({ success: result !== false && result !== 'device not found', result })
		}
	)

	server.registerTool(
		'set_surface_group_config',
		{
			description:
				'Set one group config key. For a surface in an auto group, groupId equals the surfaceId. Keys: startup_page_id (page ID from list_pages) or startup_page (page number, converted for you), use_last_page (true = resume last page instead of the startup page), last_page_id / page (page number: switch the surface to that page now), never_lock, restrict_pages, allowed_page_ids, name.',
			inputSchema: {
				groupId: z.string().describe('Group ID (from list_surfaces; equals the surfaceId for auto groups)'),
				key: z
					.enum([
						'startup_page_id',
						'startup_page',
						'use_last_page',
						'last_page_id',
						'page',
						'never_lock',
						'restrict_pages',
						'allowed_page_ids',
						'name',
					])
					.describe('Config key'),
				value: z.unknown().describe('New value (page numbers for startup_page and page, page IDs otherwise)'),
			},
		},
		async ({ groupId, key, value }) => {
			let realKey: string = key
			let realValue: unknown = value
			if (key === 'startup_page' || key === 'page') {
				const pages = await readPages(client)
				const pageNumber = Number(value)
				const pageId = pages.order[pageNumber - 1]
				if (!pageId) return textResult({ success: false, error: `No page ${pageNumber}` })
				realKey = key === 'startup_page' ? 'startup_page_id' : 'last_page_id'
				realValue = pageId
			}
			const result = await client.surfaces.groupSetConfigKey.mutate({ groupId, key: realKey, value: realValue })
			return textResult({ success: result !== false && result !== 'device not found', key: realKey, value: realValue, result })
		}
	)

	server.registerTool(
		'set_surface_name',
		{
			description: 'Set the display name of a surface or group',
			inputSchema: {
				surfaceOrGroupId: z.string().describe('Surface ID or group ID'),
				name: z.string().describe('New name'),
			},
		},
		async ({ surfaceOrGroupId, name }) => {
			await client.surfaces.surfaceOrGroupSetName.mutate({ surfaceOrGroupId, name })
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'set_surface_enabled',
		{
			description: 'Enable or disable a surface (a disabled surface stays known but is not driven)',
			inputSchema: {
				surfaceId: z.string().describe('Surface ID'),
				enabled: z.boolean(),
			},
		},
		async ({ surfaceId, enabled }) => {
			await client.surfaces.surfaceSetEnabled.mutate({ surfaceId, enabled })
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'rescan_usb_surfaces',
		{
			description: 'Ask Companion to rescan USB for surfaces (same as the "Rescan USB" button in the Surfaces page)',
		},
		async () => {
			const result = await client.surfaces.rescanUsb.mutate()
			return textResult({ success: true, result })
		}
	)

	server.registerTool(
		'create_surface_group',
		{
			description:
				'Create a manual surface group. Surfaces in the same group always show the same page, so two decks can act as one. Returns the new groupId. Use set_surface_group to add surfaces to it.',
			inputSchema: {
				name: z.string().min(1).describe('Group name'),
				baseId: z
					.string()
					.optional()
					.describe('Identifier used to form the group ID (default: derived from the name)'),
			},
		},
		async ({ name, baseId }) => {
			const groupId = await client.surfaces.groupAdd.mutate({
				baseId: baseId ?? (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group'),
				name,
			})
			return textResult({ success: !!groupId, groupId })
		}
	)

	server.registerTool(
		'set_surface_group',
		{
			description: 'Move a surface into a manual group, or back to its own auto group (groupId null)',
			inputSchema: {
				surfaceId: z.string().describe('Surface ID'),
				groupId: z.string().nullable().describe('Target group ID, or null for the surface\'s own auto group'),
			},
		},
		async ({ surfaceId, groupId }) => {
			await client.surfaces.surfaceSetGroup.mutate({ surfaceId, groupId })
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'remove_surface_group',
		{
			description: 'Delete a manual surface group; its surfaces fall back to their own auto groups',
			inputSchema: {
				groupId: z.string().describe('Group ID'),
			},
		},
		async ({ groupId }) => {
			await client.surfaces.groupRemove.mutate({ groupId })
			return textResult({ success: true })
		}
	)

	server.registerTool(
		'forget_surface',
		{
			description:
				'Forget a disconnected surface: removes its saved configuration. It will be re-added with defaults when plugged in again.',
			inputSchema: {
				surfaceId: z.string().describe('Surface ID'),
			},
		},
		async ({ surfaceId }) => {
			const result = await client.surfaces.surfaceForget.mutate({ surfaceId })
			return textResult({ success: result === true || result === undefined, result })
		}
	)
}
