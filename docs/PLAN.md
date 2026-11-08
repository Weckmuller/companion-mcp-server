# Plan

Where this fork is going, in order. Items are small on purpose; each lands as one commit.

## Done (5.1.0)

- Port to Companion 5.1: `resetControls`, layered-button styles, wrapped option values,
  `setInverted` as expression-or-value, trigger clone via Companion's own `clone`.
- Standalone build (no reference to the Companion monorepo), `npm run build`, `npm run smoke`.
- Surfaces: list, panel config, group config (startup/current page, restrictions), names,
  enable, groups, USB rescan, forget.
- Buttons: compact `get_button`, `copy_button`, any step/action set, enable/disable entities,
  style elements, presets (`list_presets`, `import_preset`).
- Variables: values via tRPC, custom variable list/delete.
- Triggers: `test_trigger`, events with options, enable/disable entities.

## Next

1. **Page overview with button text** — `list_pages` already tells which positions are used;
   add a `describe_page` tool that returns, per position, the button text and the first action's
   definition, so the model can understand a layout without 40 `get_button` calls.
2. **Batch button build** — `set_buttons`: one call that applies a list of
   `{ location, style, actions, feedbacks }` entries. Building a show page button by button costs
   one round trip per operation today.
3. **Surface layout helper** — `arrange_surfaces`: given surface IDs in left-to-right order,
   set their xOffsets from their widths (two XLs → 0 and 8). Today this is two `set_surface_config`
   calls and some arithmetic.
4. **Export / import** — read a page as a portable JSON (controls with definitions, not IDs) and
   apply it to another Companion with connection relabelling. This is what moving the show
   configuration from the notebook to the NUCs needs. Companion's `importExport` router has
   `importSinglePage` / `importFull`; the export side needs the HTTP export endpoints.
5. **Connections** — `add_connection`, `set_connection_config`, `set_connection_enabled`,
   `restart_connection` (tRPC `instances.connections.*`), and module listing from
   `instances.modules`. Needed to set up a fresh Companion on a NUC end to end.
6. **Companion version guard** — read the version at startup (`appInfo`) and warn when it is
   not one the server was checked against. Keep a table in `docs/COMPANION-API.md`.
7. **Typed client** — generate the tRPC `AppRouter` type from the extracted Companion sources
   (see "Checking a new Companion version" in `docs/COMPANION-API.md`) so call sites are checked
   at build time instead of at run time.
8. **Tests** — the smoke script becomes a test suite run against a throwaway Companion in CI
   (Companion publishes Docker images), with one case per tool.
9. **REST API v2** — once Companion's REST API covers buttons and triggers, offer it as the
   transport (token auth, versioned) and keep tRPC as the fallback.
10. **Upstream** — offer the 5.x port back to yannisgu/companion-mcp-server, and ask Bitfocus
    whether an `mcp-server/` folder in the Companion monorepo (where the npm metadata says it came
    from) is wanted, so the server tracks Companion releases.

## Deployment notes (this workspace)

- Notebook: Companion 5.1 on `http://127.0.0.1:8000`; server registered for Claude Code in
  `C:\Projetos\MATA\.mcp.json`.
- NUCs: install Node 20+, clone this repo, `npm install && npm run build`, register the server in
  the client with the NUC's Companion URL (or run the server on the notebook and point it at
  `http://<nuc>:8000`, since the server only needs network access to the admin port).
