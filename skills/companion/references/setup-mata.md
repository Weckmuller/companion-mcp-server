# The MATA setup (house facts)

Read this before touching Companion in the MATA workspace. Update it when the setup changes.

## Machines

| Machine | Companion | URL for the tools | Notes |
|---|---|---|---|
| Notebook (Gabriel's working machine) | 5.1.2 | `http://127.0.0.1:8000` | Admin bound to 0.0.0.0; HTTP API on, REST API v2 off. Config in `%APPDATA%\companion\v5.1\`. |
| NUC-01 (2.0.0.31, ssh `nuc01`) | 5.1.2 | `http://2.0.0.31:8000` | Admin bound to 2.0.0.31. Since 2026-11-10 the two Stream Deck XLs are plugged into it (right deck xOffset 8). Connections: `smode` (generic-osc 2.8.2, 2.0.0.15:13000, listen 13001), `novastar-h-series`. Pages replayed from the generated file with `companion_replay.py`. |
| NUC-02 (2.0.0.32, ssh `nuc02`) | 5.0.5 | `http://2.0.0.32:8000` | Admin bound to 2.0.0.32 but its Windows firewall blocks port 8000 from the LAN (rule to add: `tools/nuc-ssh-setup.ps1` style, TCP 8000 from 2.0.0.0/24). Older Companion: update to 5.1.2 before using the tools. |

The MCP server checkout is `C:\Projetos\MATA\companion-mcp-server` (fork of
yannisgu/companion-mcp-server, remote `origin` = Weckmuller). It is registered for Claude Code in
`C:\Projetos\MATA\.mcp.json`. Shell fallback: `node C:/Projetos/MATA/companion-mcp-server/scripts/call.mjs <tool> '<json>'`.
Whole-config replay without the UI's import: `node scripts/replay.mjs <file.companionconfig> --url <companion> [--insert-at N]` (one process, ~8 s)
(companion-mcp-server/scripts/replay.mjs; the slow per-call Python version is smode-shows/tools/companion_replay.py) recreates every page, button, action,
feedback and extra style element (a progress-bar box, say) from a generated file through these tools; connections must already exist with the same labels.

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
| `smode` | `aND2BY--wdpldfum_e20B` | generic-osc 2.8.2 | UDP to the Smode master port 13000: **2.0.0.15 at the venue**, 100.113.220.92 (NetBird) from home; listens on 13001 for feedback. The master pushes its state to both notebook addresses, so only this host changes with the location. |
| `osc` | `lKZk0915pzEzZaMnzHg13` | generic-osc 2.8.2 | UDP broadcast 2.0.0.255:7100 |
| `novastar-h-series` | `Yg87S-1KwMxGRAdCLB6NP` | novastar-h-series 1.0.2 | the H20 at 2.0.0.2:6000 |

Smode OSC convention (2026-11-09): `/mata/show <i>` ARMS SHOW item i (preloads it, nothing on air changes),
`/mata/take <n>` and `/mata/cancel <n>` fire TAKE / CANCEL on any change of n (the keys send `$(internal:time_unix)`),
`/mata/transition <i>`, `/mata/fadetime <i>`, `/mata/ppt <i>` fire those lists' items at once, `/mata/go <n>` fires the
selected SHOW item immediately. Tally back on `/mata/state/<look|armed|ppt|transition|fadetime|link>`. All generic-osc
`send_int`. Check `list_connection_definitions` for the exact action ids before use.

## Pages (show configuration, as of 2026-11-08)

| # | Name | Content |
|---|---|---|
| 1 | SHOW rows 1-4 | Looks ("ATO 1" …) rows 0–3; a look key ARMS the look (amber text while armed, red box while on air); TAKE at 3/13 (shows `$(custom:smode_next)`), CANCEL at 3/12; columns 14–15 hold status and page/menu buttons |
| 2 | SHOW rows 2-5 | Second half of the look list, same TAKE / CANCEL keys |
| 3 | MENU | SHOW (3/14) and H20 (2/15) page switches next to BACK (3/15), the key the operator pressed as MENU; one `set_page` action per surface |
| 4 | H20 | NovaStar H20 controls |

Custom variables (`$(custom:...)`): `smode_look` (look on air), `smode_ppt` (PPT state),
`smode_trans` (transition/fade time), `smode_clip` (time left in the back wall clip), `smode_time`
(master clock), `smode_next` (look armed for TAKE). They are fed by Smode over OSC and shown on buttons; do not set them by hand during
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

## Deck layout since 2026-11-10 17:45 (one page) and how to regenerate it

`smode-shows/tools/make_companion_xl.py` builds ONE show page for the two XLs on NUC-01 when it fits (left deck
columns 0-7: row 0 ATO 1 looks, row 1 ATO 2, row 2 ATO 3, row 3 TRANS = CUT, FADE 0.5/1/2 s, gap, WIPE 01/02;
right deck columns 8-15: row 0 PPT SIDES/BACK/SIDES+BACK/CEILING/OFF at 8-12, row 1 PIP MAKING OF/VIDEO HERO/OFF
at 8-10, status column 14 = LINK+clock, look on air, PPT state, transition+time left; column 15 = clip readout
(timecode + bar, row 0), PIP on air (row 1), MENU (row 3); CANCEL 3/12, TAKE 3/13). More than 8 keys in a look
row or more than 4 look rows and it falls back to the rolling-window layout (label column, arrows, pages).
Pages: 1 SHOW, 2 MENU (SHOW / H20 / BACK), 3 H20.

- Look keys send `/mata/show <SHOW index>` and read `smode-shows/companion/looks.json` (write it with
  `tools/master/export_looks.sh` after the SHOW list changed; the key text/colour table is KEY_TEXT).
- Fade-time keys send `/mata/transition 0` then `/mata/fadetime i`; wipe keys `/mata/transition 1|2`; PPT
  `/mata/ppt 0-4`; PIP `/mata/pip 0-2`; TAKE / CANCEL `$(internal:time_unix)` on `/mata/take` / `/mata/cancel`.
  On-air colour = OSC feedback on `/mata/state/<name>` (the master sends fadetime -1 while a wipe is selected).
- Variables pushed by the master: smode_look, smode_next, smode_ppt, smode_trans, smode_clip (time left),
  smode_time, smode_clip_pos / smode_clip_len (HH:MM:SS:FF), smode_clip_pct, smode_pip. The clip readout
  arrives over the raw UDP API (port 16759, `CUSTOM-VARIABLE <name> SET-VALUE <v>`, enabled on both) at up to
  30 Hz; the rest over HTTP once a second. The raw API never creates a variable: create it first.
- Replay everything with `smode-shows/tools/master/deck_replay.sh [hosts]` (default notebook + NUC-01): it
  regenerates, replays with `companion-mcp-server/scripts/replay.mjs` (which carries extra style elements
  such as the progress bar), deletes the default page keys, removes stale pages and puts every deck group on
  page 1. Check a key afterwards with `get_button` (full=true shows every element property).
