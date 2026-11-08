# How this server talks to Companion

Companion has no public API that covers buttons and triggers. The admin web UI talks to the
backend over **tRPC on a WebSocket** at `ws://<host>:<port>/trpc`, and that is what this server
uses too. It is an internal API: it has no authentication (anyone who can reach the admin port can
do anything), and it changes between Companion releases without notice.

Companion 5.1 also ships a **REST API v2** (`/api/v2`, Bearer tokens, OpenAPI at
`/api/v2/openapi.json`, disabled by default under Settings > Protocols). As of 5.1 it covers only
connections and surfaces (list, get, set brightness), so it cannot replace the tRPC link yet. When
it grows to cover buttons and triggers, the tools should move over to it.

## Version coverage

| Companion | Status |
|-----------|--------|
| 5.1       | Supported. Every procedure below was checked against the 5.1 sources. |
| 4.3       | The upstream `companion-mcp-server@4.3.0` on npm targets it. Not supported by this fork: `resetControl` and `setStyleFields` were replaced in 5.x. |

Read procedures (`watch` subscriptions) have been stable; write procedures are where versions differ.

## Reading state

Companion exposes state as `watch` subscriptions whose first message is `{ type: 'init', ... }`
with the complete current state. `getInitialData()` subscribes, takes that first message and
unsubscribes, so the server never holds subscriptions open.

| Data | Procedure | Init payload |
|------|-----------|--------------|
| Pages | `pages.watch` | `{ order: pageId[], pages: { [pageId]: { id, name, controls: { [row]: { [col]: controlId } } } } }` |
| One control | `controls.watchControl({ controlId })` | `{ config, runtime }` (config is the control model) |
| Connections | `instances.connections.watch` | **array**: `[{ type: 'init', info: { [connectionId]: { label, moduleId, moduleVersionId, enabled, ... } } }]` |
| Action/feedback definitions | `instances.definitions.actions` / `.feedbacks` | `{ definitions: { [connectionId]: { [definitionId]: { label, description, options[] } } } }` |
| Presets | `instances.definitions.presets` | `{ definitions: { [connectionId]: { [presetId]: { id, label, category, type } } } }` |
| Variable definitions | `variables.definitions.watch` | `{ variables: { [label]: { [name]: { label, ... } } } }` |
| Variable values | `variables.values.connection.query({ label })` | `{ [name]: value }` |
| Custom variables | `customVariables.watch` | `{ info: { [name]: { description, defaultValue, persistCurrentValue, sortOrder } } }` |
| Triggers | `controls.triggers.watch` | `{ triggers: { [controlId]: { name, enabled, description, collectionId, sortOrder, lastExecuted } } }` |
| Trigger collections | `controls.triggers.collections.watchQuery` | **raw array** of `{ id, label, sortOrder, children[], metaData }` (no init wrapper) |
| Surfaces | `surfaces.watchSurfaces` | **array**: `[{ type: 'init', info: { [groupId]: { id, index, displayName, isAutoGroup, surfaces: ClientSurfaceItem[] } } }]` |
| Surface panel config | `surfaces.watchSurfaceConfig({ surfaceId })` | `{ brightness, rotation, xOffset, yOffset, ...integration keys }` or `null` when disconnected |
| Surface group config | `surfaces.watchGroupConfig({ groupId })` | `{ name, startup_page_id, last_page_id, use_last_page, never_lock, restrict_pages, allowed_page_ids }` |

## Writing

### Buttons (Companion 5 "layered" buttons)

A button's look is `style.layers`: a `canvas` element plus a stack of elements (`box`, `text`,
`image`, `line`, `circle`, `group`). A freshly created button has `box0` (background) and `text0`.
Every element property is `{ value, isExpression }`.

| Tool op | Procedure |
|---------|-----------|
| `create_button` | `controls.resetControls({ locations: [loc], newType: 'button-layered' })` (also `pagenum`, `pageup`, `pagedown`) |
| `delete_button` | `controls.resetControls({ locations: [loc], newType: null })` |
| `copy_button` | `controls.gridBatchTransfer({ operation, pairs })` |
| `set_style` | `controls.styles.updateOptions({ controlId, elementId, values: { text: {value,isExpression}, ... } })` on the first `text` / `box` element; adds one with `controls.styles.addElement` if missing |
| `add_element` / `remove_element` | `controls.styles.addElement({ controlId, type, afterElementId })` → elementId; `controls.styles.removeElement` |
| `add_action` | `controls.entities.add({ controlId, entityLocation: { stepId, setId }, ownerId: null, connectionId, entityType: 'action', entityDefinition })` → entityId |
| `add_feedback` | same with `entityLocation: 'feedbacks'`, `entityType: 'feedback'` |
| option values | `controls.entities.setOption({ ..., value: { value, isExpression } })` — **must be wrapped** in 5.x |
| `set_feedback_inverted` | `controls.entities.setInverted({ ..., isInverted: { value, isExpression: false } })` |
| `set_feedback_style` / `remove_feedback_style` | `controls.entities.replaceStyleOverride({ ..., override: { overrideId, elementId, elementProperty, override: { value, isExpression } } })` / `removeStyleOverride`. Feedback definitions often add default overrides on creation (`styleOverrides[]` in the control model); the tool reuses the `overrideId` of a matching element+property. |
| `describe_page` | `pages.watch` + one `controls.watchControl` per occupied position |
| `list_trigger_events` | `instances.definitions.events.query()` |
| `set_entity_enabled` | `controls.entities.setEnabled` |
| `set_option` | `controls.setOptionsField({ controlId, key, value })` (plain value) |
| `press_button` | `controls.hotPressControl({ location, direction, surfaceId: 'mcp' })` |
| `import_preset` | `controls.importPreset({ connectionId, presetId, location, variableValues, mode: 'copy' \| 'reference' })` |

Action set IDs: `'down'`, `'up'`, `'rotate_left'`, `'rotate_right'`, or a number (hold duration in ms).

### Triggers

| Tool op | Procedure |
|---------|-----------|
| create / clone / delete / test | `controls.triggers.create()`, `.clone({ controlId })`, `.delete({ controlId })`, `.testActions({ controlId })` |
| name / enabled | `controls.setOptionsField({ controlId, key: 'name' \| 'enabled', value })` |
| collection | `controls.triggers.reorder({ collectionId, controlId, dropIndex })` |
| events | `controls.events.add({ controlId, eventType })` → eventId; `.setOption({ controlId, eventId, key, value })` (plain value) |
| actions / conditions | `controls.entities.*` with `entityLocation: 'trigger_actions'` / `'feedbacks'`, values wrapped as above |

### Surfaces

| Tool | Procedure |
|------|-----------|
| `set_surface_config` | `surfaces.surfaceSetConfigKey({ surfaceId, key, value })` — connected surfaces only |
| `set_surface_group_config` | `surfaces.groupSetConfigKey({ groupId, key, value })` — works for offline auto groups too |
| `set_surface_name` | `surfaces.surfaceOrGroupSetName` |
| `set_surface_enabled` | `surfaces.surfaceSetEnabled` |
| groups | `surfaces.groupAdd({ baseId, name })`, `.groupRemove`, `.surfaceSetGroup({ surfaceId, groupId })` |
| `rescan_usb_surfaces` | `surfaces.rescanUsb()` |
| `forget_surface` | `surfaces.surfaceForget({ surfaceId })` |

### Pages, custom variables

`pages.insert / remove / setName / move / clearPage`, `customVariables.create / setCurrent /
setDefault / setDescription / delete`. These are unchanged since 4.x.

## Checking a new Companion version

Companion ships its backend as `main.js` with a source map that includes the original TypeScript.
Extract the sources from `main.js.map` (`sourcesContent`) and compare:

- `companion/lib/UI/TRPC.ts` — the root router
- `companion/lib/Controls/*TrpcRouter.ts`, `Controls/Controller.ts` — controls, entities, styles, steps, events, triggers
- `companion/lib/Page/Controller.ts`, `Surface/Controller.ts`, `Variables/*.ts`, `Instance/Connection/TrpcRouter.ts`, `Instance/Definitions.ts`

Then run `npm run smoke -- http://host:8000 --write` against a test instance.
