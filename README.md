# Companion MCP Server

An MCP (Model Context Protocol) server for [Bitfocus Companion](https://bitfocus.io/companion) 5.x.
It lets an AI assistant read and change a running Companion: pages and buttons, actions and
feedbacks, triggers, variables, connections, and surfaces (Stream Decks and other panels).

This is a fork of [yannisgu/companion-mcp-server](https://github.com/yannisgu/companion-mcp-server),
updated for Companion 5.1 (the upstream 4.3.0 release targets Companion 4.3 and its button and style
calls no longer exist in 5.x). See [docs/COMPANION-API.md](docs/COMPANION-API.md) for what changed
and how the server talks to Companion, and [docs/PLAN.md](docs/PLAN.md) for the roadmap.

## Features

- **Pages & buttons**: list, create, delete, copy/move/swap; read a button as a compact summary;
  set text and colours; edit any style element of Companion 5's layered buttons; add, configure,
  enable/disable and remove actions and feedbacks (in any step and action set); press buttons;
  place module presets.
- **Triggers**: list, create (with events, conditions and actions in one call), clone, update,
  batch update, test, delete; collections.
- **Variables**: list, search, read values; custom variables: list, create, set, delete.
- **Connections**: list; browse action and feedback definitions with search and a compact view.
- **Surfaces**: list every known surface (connected or not) with its group, size, grid offset,
  brightness and rotation; set brightness/rotation/offsets; set a surface's startup page, current
  page, page restrictions and lock behaviour; rename; enable/disable; groups; rescan USB; forget.

Option values accept plain values or expressions (`{ "value": "...", "isExpression": true }`).

## Requirements

- Node.js 20 or newer
- Bitfocus Companion **5.1** running and reachable (the server uses the same WebSocket tRPC
  interface as Companion's admin page, so it needs access to the admin port, 8000 by default)

The admin interface has no authentication. Only point this server at a Companion you are
allowed to administer, and do not expose the admin port beyond your network.

## Install

```bash
git clone https://github.com/Weckmuller/companion-mcp-server.git
cd companion-mcp-server
npm install
npm run build
```

Check it against your Companion (read-only):

```bash
npm run smoke -- http://127.0.0.1:8000
```

`npm run smoke -- http://127.0.0.1:8000 --write` additionally creates a page named `mcp-smoke`,
builds one button on it, presses it and removes the page again.

## Configure your MCP client

The server speaks MCP over stdio. It takes the Companion URL as its first argument, or from
`COMPANION_URL`; the default is `http://127.0.0.1:8000`.

### Claude Code

Project scope: put a `.mcp.json` next to your project:

```json
{
  "mcpServers": {
    "companion": {
      "command": "node",
      "args": ["C:/path/to/companion-mcp-server/dist/index.js", "http://127.0.0.1:8000"]
    }
  }
}
```

User scope: `claude mcp add --scope user companion -- node C:/path/to/companion-mcp-server/dist/index.js http://127.0.0.1:8000`

### Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json` (Windows) or
`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "companion": {
      "command": "node",
      "args": ["/path/to/companion-mcp-server/dist/index.js", "http://192.168.1.50:8000"]
    }
  }
}
```

Other clients (Cursor, Windsurf, ...) take the same `command`/`args` shape in their MCP config.

### Remote Companion

Point the URL at the machine running Companion, for example `http://192.168.1.50:8000`. Companion
must be bound to a reachable address (Settings > Admin interface, "bind IP").

## Tools

### Pages & buttons
| Tool | Description |
|------|-------------|
| `list_pages` | Pages with names and occupied grid positions |
| `create_page`, `remove_page`, `set_page_name`, `move_page`, `clear_page` | Page management |
| `get_button` | Compact summary of a button (style, elements, actions, feedbacks, runtime); `full=true` for the raw model |
| `create_button` | Create an empty layered button (or `pagenum`/`pageup`/`pagedown`) |
| `delete_button` | Remove a button |
| `copy_button` | Copy, move or swap buttons between locations |
| `update_button` | Ordered operations: `set_style`, `set_element_options`, `add_element`, `remove_element`, `add_action`, `add_feedback`, `update_entity_options`, `set_entity_enabled`, `set_feedback_inverted`, `remove_entity`, `set_option` |
| `press_button` | Press (down+up, or one direction) |
| `list_presets`, `import_preset` | Browse and place module presets |

### Triggers
| Tool | Description |
|------|-------------|
| `list_triggers`, `list_trigger_collections`, `get_trigger` | Read triggers |
| `create_trigger`, `clone_trigger`, `update_trigger`, `batch_update_triggers` | Write triggers (events, conditions, actions, collections) |
| `test_trigger` | Run a trigger's actions once |
| `create_trigger_collection`, `delete_trigger` | |

### Variables
| Tool | Description |
|------|-------------|
| `list_variables` | Definitions per connection label (summary, or one label) |
| `search_variables` | Search by name/label |
| `get_variable_value` | Current value(s) of a connection's variables |
| `list_custom_variables`, `create_custom_variable`, `set_custom_variable`, `delete_custom_variable` | Custom variables |

### Connections
| Tool | Description |
|------|-------------|
| `list_connections` | IDs, labels, modules, enabled state |
| `list_connection_definitions` | Action/feedback definitions, with `kind`, `search` and `compact` |

### Surfaces
| Tool | Description |
|------|-------------|
| `list_surfaces` | Every known surface with group, size, offset, brightness, rotation, current/startup page |
| `get_surface_config` | Panel config and group config of one surface |
| `set_surface_config` | brightness, rotation, xOffset, yOffset, integration-specific keys (connected surfaces) |
| `set_surface_group_config` | startup page, current page, use_last_page, never_lock, restrict_pages, allowed pages, name |
| `set_surface_name`, `set_surface_enabled`, `rescan_usb_surfaces`, `forget_surface` | |
| `create_surface_group`, `set_surface_group`, `remove_surface_group` | Make several surfaces act as one |

### Resources
| Resource | Description |
|----------|-------------|
| `companion://guide` | Concepts and workflows for the tools |
| `companion://connections` | Connections summary |
| `companion://presets` | Presets by connection |

## Development

```bash
npm install
npm run dev -- http://127.0.0.1:8000     # run from source with tsx
npm run build                             # compile to dist/
npm run smoke -- http://127.0.0.1:8000    # read-only check against a Companion
npm run smoke -- http://127.0.0.1:8000 --tool get_button '{"pageNumber":1,"row":0,"column":0}'
```

## License

MIT
