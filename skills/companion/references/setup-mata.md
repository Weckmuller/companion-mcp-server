# The MATA setup (house facts)

Read this before touching Companion in the MATA workspace. Update it when the setup changes.

## Machines

| Machine | Companion | URL for the tools | Notes |
|---|---|---|---|
| Notebook (Gabriel's working machine) | 5.1.2 | `http://127.0.0.1:8000` | Admin bound to 0.0.0.0; HTTP API on, REST API v2 off. Config in `%APPDATA%\companion\v5.1\`. |
| NUCs (venue) | to be installed | `http://<nuc>:8000` | Planned 2026-11-09. Same server and skill; point the URL at the NUC. |

The MCP server checkout is `C:\Projetos\MATA\companion-mcp-server` (fork of
yannisgu/companion-mcp-server, remote `origin` = Weckmuller). It is registered for Claude Code in
`C:\Projetos\MATA\.mcp.json`. Shell fallback: `node C:/Projetos/MATA/companion-mcp-server/scripts/call.mjs <tool> '<json>'`.

## Surfaces on the notebook

| Surface id | What | Offset | Group |
|---|---|---|---|
| `streamdeck:A00NA6103LR6FW` | Stream Deck XL (8×4), left | x 0 | own auto group |
| `streamdeck:A00NA6103LR99B` | Stream Deck XL (8×4), right | x 8 | own auto group |
| `emulator:zx76FiUT-tzKXt8FPjdhz` | Emulator 16×4 (the whole grid in a browser) | x 0 | own auto group |

The grid is 16 columns × 4 rows (`gridSize` maxColumn 15, maxRow 3). The two XLs together show the
full width of a page. They are **not** in a manual surface group yet, so page-switch buttons carry
one `set_page` action per surface (three actions, emulator included). A manual group holding both
decks would reduce that to one action and give the pair a stable id when a deck is swapped; propose
it, do not do it unprompted during show preparation.

All three auto groups start on page 1 with `use_last_page: true`.

## Connections

| Label | Id | Module | Target |
|---|---|---|---|
| `smode` | `aND2BY--wdpldfum_e20B` | generic-osc 2.8.2 | UDP to 100.113.220.92:13000 (Smode master), listens on 13001 for feedback |
| `osc` | `lKZk0915pzEzZaMnzHg13` | generic-osc 2.8.2 | UDP broadcast 2.0.0.255:7100 |
| `novastar-h-series` | `Yg87S-1KwMxGRAdCLB6NP` | novastar-h-series 1.0.2 | the H20 at 2.0.0.2:6000 |

Smode OSC convention seen in the log: `/mata/fadetime` with an integer argument (generic-osc action
`send_int`). Check `list_connection_definitions` for the exact action ids before use.

## Pages (show configuration, as of 2026-11-08)

| # | Name | Content |
|---|---|---|
| 1 | SHOW rows 1-4 | Looks ("ATO 1" …) rows 0–3, columns 14–15 hold page/menu buttons |
| 2 | SHOW rows 2-5 | Second half of the look list |
| 3 | MENU | SHOW / H20 page switches (one `set_page` action per surface) |
| 4 | H20 | NovaStar H20 controls |

Custom variables (`$(custom:...)`): `smode_look` (look on air), `smode_ppt` (PPT state),
`smode_trans` (transition/fade time), `smode_clip` (time left in the back wall clip), `smode_time`
(master clock). They are fed by Smode over OSC and shown on buttons; do not set them by hand during
a show.

## House rules

- Pages 1–4 are the show. Experiments go on a scratch page at the end, removed afterwards.
- Do not press show buttons to "test": they fire OSC at the Smode master and the H20.
- Product and venue text follows the workspace rules: no vendor names in button text unless the
  button controls that device; keep the existing colour language (dark grey `2500134` background,
  off-white text `11579568` for looks).
- When the NUCs get Companion, their configuration is imported from the notebook's export, then
  the `smode` connection host is changed per machine. The MCP tools cannot export yet (see the
  server's `docs/PLAN.md`); use the Companion UI's Import/Export for that step.
