---
name: companion
description: Configure Bitfocus Companion 5.x (the software behind Stream Decks and other control surfaces) through the `companion` MCP tools: build and change buttons, actions, feedbacks, pages, triggers, custom variables and surface settings, and read the current setup. Use this skill whenever the user mentions Companion, a Stream Deck, X-keys, a button grid or page, a surface, a trigger, a Companion variable, "the deck", or wants a physical button to do something, even if they do not say "Companion". Also use it to inspect or explain an existing Companion configuration.
---

# Configuring Bitfocus Companion

You have tools that read and change a live Companion instance over its admin interface. Changes
apply immediately on the connected Stream Decks, there is no "save" step and no undo. Work like a
careful show operator: read first, change in small verified batches, and report precisely.

## Tools

The `companion` MCP server exposes about 45 tools in five groups: pages/buttons, triggers,
variables, connections, surfaces. Call `list-tools` or read the `companion://guide` resource for
the full list; the ones you will use most are named below.

If the MCP tools are not loaded in this session, the same tools work from a shell:

```bash
node <server-dir>/scripts/call.mjs [--url http://host:8000] <tool> '<json-arguments>'
node <server-dir>/scripts/call.mjs list-tools
```

`<server-dir>` is the companion-mcp-server checkout; the house setup file (`references/setup-mata.md`
in this workspace) gives its path, the machines and the URLs.
Arguments are JSON on one line, exactly as an MCP call would send them. `list-tools` prints each
tool with its parameter names and types; `describe <tool>` prints the full schema. Check the
parameters before the first call to a tool rather than guessing them (`create_page`, for example,
takes `asPageNumber` and `pageNames`, not `name`).

## Companion's model in one minute

Read `references/companion-concepts.md` when you need detail; this is the minimum to act safely.

- **Grid, pages, surfaces.** Buttons live on pages in one grid (rows and columns, 0-based; pages
  1-based). A surface (a Stream Deck, an emulator, a satellite panel) shows a window of the grid
  given by its size and its `xOffset`/`yOffset`. Two Stream Deck XLs side by side are 8×4 each at
  offsets 0 and 8, showing columns 0–15 of a 16×4 grid. Each surface belongs to a group (by default
  its own "auto group" with the same id); the group holds the current page, the startup page and
  page restrictions. Surfaces stay listed when unplugged, and their page settings can be changed
  offline; brightness and rotation need the surface connected.
- **Buttons are layered.** A button's look is a stack of style elements: a `canvas`, a `box`
  (`box0`, the background), a `text` (`text0`), and optionally images, lines, circles, gauges,
  groups. Positions are percentages. Every property can be a fixed value or an expression.
- **Actions** run on press, grouped in steps and action sets: step `0` set `down` is the normal
  press, `up` is release, a number is a hold duration in ms, `rotate_left`/`rotate_right` are dial
  turns. Each action belongs to a connection and has a definition id plus options.
- **Feedbacks** restyle a button while a condition holds, by overriding properties of named
  elements (for example `text0.color` or `box0.color`). A boolean feedback with no style override
  does nothing. Lower feedbacks in the list win over higher ones. Many dynamic looks need no
  feedback at all: put an expression on the element property instead.
- **Variables** are `$(label:name)`: `$(custom:x)` for custom variables, `$(internal:...)` for
  Companion's own, `$(connection-label:name)` for module variables, `$(page:x)` for page variables,
  `$(local:x)` inside a button. Connections are referenced by **id** in actions and by **label** in
  variables.
- **Presets** are buttons a module ships ready-made. Since 5.1 they are placed *linked* by default
  (they follow the module's updates and cannot be edited); place a *copy* when the user wants to
  customise it.
- **Triggers** run actions on events (interval, time of day, variable change, startup, condition
  true), optionally filtered by conditions.

## How to work

### 1. Orient before touching anything

One call each is enough to know the terrain:

- `list_connections` → connection ids and labels (ids go into actions, labels into variables).
- `list_pages` → page numbers, names, occupied positions.
- `describe_page` for the page you will change → every button's text, colours, actions and
  feedbacks in one call. Prefer it to repeated `get_button`.
- `list_surfaces` when the request involves a deck, a page switch, brightness, or "which deck
  shows what".

Do this even for a request that sounds fully specified. Positions may be occupied, the connection
the user names may have a different label, the page may not exist.

### 2. Never guess definition ids or option keys

Action and feedback ids and their option keys are module-specific. Look them up:

```
list_connection_definitions { connectionId, kind: "actions", compact: true, search: "fade" }
```

Then read the matching definition's option list. A wrong key is accepted silently and the action
does nothing on the device, so this lookup is cheaper than a failed show cue. The same goes for
presets (`list_presets`) and trigger event types (`list_trigger_events`).

Companion's own `internal` connection (set a custom variable, switch a surface's page, press
another button, wait, if/else logic, variable checks) is catalogued with option keys in
`references/internal-entities.md`, so for those you can skip the lookup.

### 3. Change in batches, verify, then report

`update_button` takes an ordered list of operations, so one call builds a complete button:

```json
{
  "pageNumber": 5, "row": 0, "column": 0,
  "operations": [
    { "op": "set_style", "text": "FADE\n2 s", "color": 16777215, "bgcolor": 1127526, "size": "auto" },
    { "op": "add_action", "connectionId": "<id>", "actionId": "send_int",
      "options": { "path": "/show/fadetime", "int": 2 } },
    { "op": "add_feedback", "connectionId": "internal", "feedbackId": "variable_value",
      "options": { "variable": "custom:show_trans", "op": "eq", "value": "FADE 2 s" } },
    { "op": "set_feedback_style", "entityId": "<feedback entityId from the previous result>",
      "elementId": "box0", "property": "color", "value": 65280 }
  ]
}
```

Create the button first with `create_button` when the position is empty. Each operation reports
its own success and the entity id it created; read those ids back for follow-up operations rather
than calling `get_button` again. After a batch, `get_button` (or `describe_page` for several) and
check that what is there is what you meant: text, colours, definition ids, option values.

Report locations as `page/row/column` with the page name, state colours as hex as well as decimal,
and say which connection each action targets. The user checks your work against the Companion UI
and the physical deck, so give them something they can match.

### 4. Be assertive, within these limits

Do the work. Do not ask the user for things the tools can tell you (ids, labels, free positions,
current values). Do not stop to ask whether to look up a definition. When a request leaves a real
choice (which free position, which colour family, copy vs linked preset), pick the option that
matches the surrounding buttons and say what you picked.

Limits that come from the nature of the system, not from caution for its own sake:

- **Pressing a button runs real actions on real devices.** Use `press_button` and `test_trigger`
  only when the user asks to fire something, or on a scratch button whose actions are harmless
  (`internal` log action, custom variable set). Never "test" a show button by pressing it.
- **Deleting is instant.** `remove_page`, `clear_page`, `delete_button`, `forget_surface` and
  `delete_trigger` ask nothing and keep nothing. Before any of them on something that is not a
  scratch object you created, name the exact thing and confirm it is the one the user meant.
- **Inspect with read tools only.** `list_*`, `describe_page`, `get_button`, `get_trigger` and
  `get_surface_config` never change anything; `create_*`, `update_*`, `set_*` always do. Never
  "probe" a tool's behaviour or schema by calling a write tool on a real location: `create_button`
  over an existing button erases it (the tool now refuses unless `replace: true`, but older builds
  and `delete_button` do not). Use `describe <tool>` for schemas and a scratch page for probing.
- **Experiments go on a scratch page** at the end (`create_page` with `asPageNumber` = page count
  + 1 and a name like `scratch-<topic>`), and you remove it when done. Show pages stay untouched by
  experiments. A new page is not empty: Companion puts page-up, page-number and page-down buttons
  at `0/0`, `1/0` and `2/0`. Use other columns, or `delete_button` those first when the user asked
  for column 0.
- **Linked presets cannot be edited**; say so and offer to re-place as a copy if the user wants
  to change one.
- **Page numbers are referenced by other things** (page-switch actions, button references, surface
  startup pages). Inserting or moving a page shifts the numbers; do it only when asked and warn
  about the consequences.
- **The grid has a size** (Settings; default 8×4; two XLs side by side need 16×4). `create_button` outside it fails
  with a clear message; check `list_surfaces` sizes and offsets to know which positions a deck
  actually shows.

### 5. Reach for the right mechanism

Everything that changes a button is an operation inside `update_button`'s `operations` array
(there is no standalone `set_element_options` or `add_action` tool). Element-level edits take
`elementId` + `values`; entity edits take `entityId` + `options`.

| The user wants | Do |
|---|---|
| A button that sends a command | `create_button` + `update_button` ops `set_style`, `add_action` (with `options`) |
| Text that follows a value | `set_style` with `text: "$(custom:name)"` or any `$(label:var)`; no feedback needed |
| Colour that follows a value | `update_button` op `{ "op": "set_element_options", "elementId": "box0", "values": { "color": { "value": "$(custom:armed) ? 0x00ff00 : 0x202020", "isExpression": true } } }` |
| Colour that follows a device state | `add_feedback` from the module + `set_feedback_style` (`entityId`, `elementId`, `property`, `value`) |
| The module's ready-made button | `list_presets` then `import_preset` |
| Same button on several pages | A `button-reference` control, or copy it with `copy_button` |
| Press and hold doing different things | `add_action` with `setId` = hold duration in ms |
| Toggle behaviour | Steps: `add_action` with `stepId: "1"` after adding a step, or a custom variable plus an expression |
| Something to happen on a schedule or on a change | `create_trigger` with `add_event` (`interval`, `timeofday`, `variable_changed`, `condition_true`, `startup`) and actions |
| A deck to start on a page / switch page now | `set_surface_group_config` with `startup_page` / `page` (page numbers); `use_last_page: false` to make the startup page stick |
| Two decks to act as one | `create_surface_group`, `set_surface_group` for each, then target the group in `set_page`-style actions |
| Dimmer deck | `set_surface_config` `brightness` 0–100 (surface must be connected) |
| A value shared by many buttons | A custom variable (`create_custom_variable`), referenced as `$(custom:name)` |

## Pitfalls that cost real time

- Option values are plain JSON. To use an expression pass `{ "value": "<expr>", "isExpression": true }`.
- Colours are decimal RGB integers: white 16777215 (`0xffffff`), red 16711680, green 65280,
  blue 255, dark grey 2500134. Convert hex for the user in reports.
- `set_style` `size` is a percentage of the text element's height (24 is a normal label);
  match the size of the surrounding buttons; shrink-to-fit stays on, so long text still fits. `"auto"` only
  turns shrink-to-fit on.
- A feedback's style override targets an element id (`box0`, `text0`, or the id from
  `get_button` → `style.elements`), not "the button". Companion attaches **default overrides**
  to many feedbacks when they are added (internal `variable_value` comes with red `box0` and
  white `text0`): read them back in the `add_feedback` result or `get_button` and set the ones you
  want with `set_feedback_style` (same element + property replaces the default) or remove the rest
  with `remove_feedback_style`.
- Connection **label** ≠ connection **id**. `list_connections` shows both.
- Rows and columns are 0-based; the Companion UI shows locations as `page/row/column` too.
- `list_variables` without a label returns only counts; use `search_variables` or pass a label.
- The emulator is a surface like any other and appears in `list_surfaces`; page-switch actions
  that target "all surfaces" may need to include it.
- Companion's admin interface has no authentication. Only point the tools at an instance the user
  administers.

## When something fails

Tool results carry `success: false` and an error string per operation. Common causes: a
definition id or option key from another module version, a position outside the grid, a surface
that is offline (panel config), an entity id from a different button. Fix the input and retry the
single failed operation; do not re-run the whole batch, or you will duplicate actions.

If a tool returns "Companion did not answer", the instance is down or the URL is wrong:
check with `list_connections` (cheapest call) and report the URL you used.

## References

- `references/companion-concepts.md`: Companion 5.1 concepts from the official manual: grid and
  surfaces, layered buttons, steps, feedbacks, variables and expressions, triggers, presets,
  import/export, remote APIs, and what changed in 5.0/5.1. Read it before building anything
  beyond a plain action button.
- `references/internal-entities.md`: generated catalogue of trigger event types and of the
  `internal` connection's actions and feedbacks with their option keys (regenerate with
  `node scripts/dump-internal-reference.mjs` after a Companion update).
- `references/setup-mata.md`: this workspace's machines, Companion URLs, surfaces, show pages,
  house rules, and the generate-and-replay workflow for a show deck (`replay.mjs`, the deck
  generator, the feedback variables and the UDP fast path). Read it first when working on the MATA
  setup. The production's own deck layout and variables are in the show-type skill's reference file
  (for a corporate show: `corporate-show/references/`).
- `docs/COMPANION-API.md` in the server repo: how the tools map onto Companion's internal API,
  for when a tool misbehaves after a Companion update.
