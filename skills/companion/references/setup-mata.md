# The MATA setup (house facts)

Read this before touching Companion in the MATA workspace. It describes the setup as it is (last checked
2026-11-19); when you change the setup, change this file in the same piece of work and remove what stopped being
true. The current production's own keys and looks are in the show-type skill's reference file
(`corporate-show/references/`).

## Machines

| Machine | Companion | Role |
|---|---|---|
| NUC-01 (2.0.0.31) | 5.1.2 | **The show's Companion.** Both Stream Deck XLs are plugged into it. Admin and HTTP API bound to 2.0.0.31:8000. |
| NUC-02 (2.0.0.32) | 5.1.2 (since 2026-11-19) | **Spare, a copy of NUC-01**: same settings, connections, variables and pages. No deck is plugged in; if NUC-01 fails the decks move here. Bound to 2.0.0.32:8000. Keep it equal to NUC-01: whatever you change there, change here. |
| Notebook (Gabriel's working machine) | 5.1.2 | For experiments only. Companion is usually not running, no deck is plugged in, and its pages are older than the NUCs'. `http://127.0.0.1:8000` when started. |

**Reaching the NUCs.** On the venue network: `http://2.0.0.31:8000`, `http://2.0.0.32:8000`, `ssh nuc01`, `ssh nuc02`.
From anywhere else, through the control NUC over NetBird:

```bash
ssh -f -N -L 18031:2.0.0.31:8000 -L 18032:2.0.0.32:8000 nb-rds      # then http://127.0.0.1:18031 and :18032
ssh -J nb-rds nuc01 "..."                                           # a shell on a NUC
```

The `companion` MCP tools of a Claude session are registered against the notebook (`C:\Projetos\MATA\.mcp.json`),
so for the NUCs use the shell form, which takes a URL:
`node C:/Projetos/MATA/companion-mcp-server/scripts/call.mjs --url http://127.0.0.1:18031 <tool> '<json>'`.

Over SSH to a NUC, `powershell -Command -` fed from stdin silently drops multi-line blocks (`if`, `try`): copy a
`.ps1` file and run it with `-File`. Companion runs in the desktop session of user `admin`; to start it from SSH
use a one-shot scheduled task with an interactive principal.

## Surfaces

| Surface id | What | Offset | On |
|---|---|---|---|
| `streamdeck:A00NA6103LR6FW` | Stream Deck XL (8×4), left | x 0 | NUC-01 (known but offline on NUC-02) |
| `streamdeck:A00NA6103LR99B` | Stream Deck XL (8×4), right | x 8 | NUC-01 (known but offline on NUC-02) |
| `emulator:6r60yw7EhxiSDcCki4p66` | Emulator 16×4 | x 0 | NUC-01 |
| `emulator:zx76FiUT-tzKXt8FPjdhz` | Emulator 16×4 | x 0 | NUC-02 |

The grid is 16 columns × 4 rows; the two XLs together show a whole page. Each surface is its own auto group, so a
page switch carries one `set_page` action per surface (three, the emulator included; the emulator's id differs per
machine). Every group starts on the current show page with `use_last_page: false`.

## Connections (same labels on both NUCs; the ids differ per machine, look them up)

| Label | Module | Target |
|---|---|---|
| `smode` | generic-osc 2.8.2 | the Smode master, UDP 2.0.0.15:13000; listens on 13001 for the tally |
| `novastar-h-series` | novastar-h-series 1.0.2 | the H20 LED processor, 2.0.0.2:6000 (shows "connecting" while the H20 is off) |
| `room-remote` | generic-osc 2.8.2 | the clients' phone remote on the control NUC, UDP 2.0.0.254:8082; listens on 13002 |
| `desklock` | generic-osc 2.8.2 | the desk lock on the same machine, UDP 127.0.0.1:7796; listens on 13003 |

NUC-02 also has an old `osc` connection (broadcast 2.0.0.255:7100) that nothing uses. generic-osc 2.8.2 sends
nothing while "Listen for Feedback" is off: give every such connection a free listen port. Only generic-osc and
novastar-h-series are installed on the NUCs.

Settings on both (Settings > Protocols): HTTP API, OSC, TCP, the raw UDP API (16759) and REST API v2 on; key
decoration none.

Smode OSC convention: `/mata/show <i>` ARMS SHOW item i (preloads it, nothing on air changes), `/mata/take <n>` and
`/mata/cancel <n>` fire TAKE / CANCEL on any change of n (the keys send `$(internal:time_unix)`),
`/mata/transition <i>`, `/mata/fadetime <i>`, `/mata/ppt <i>`, `/mata/pip <i>` fire those lists' items at once.
Tally back on `/mata/state/<look|armed|ppt|transition|fadetime|pip|link>`. All generic-osc `send_int`. Show cues go
over OSC only, never through Smode's REST API.

## Pages (both NUCs)

| # | Name | Content | Written by |
|---|---|---|---|
| 1 | SUVINIL | The previous production's deck, kept as it was. Its look keys send that show's indices: do not use it on another project. | (kept; restorable from `smode-shows/companion/exports/NUC-01_full_2026-11-17.companionconfig` with `replay.mjs --pages 1`) |
| 2 | MENU | Page switches: SYSTEM 2/2/15, CASAMENTO 2/3/13, SUVINIL 2/3/14, BACK 2/3/15 | by hand |
| 3 | SYSTEM | Everything that is not the show: the H20 keys (right deck: presets 1/13-15, Release 2/15, brightness 0-100 % 3/8-13, Freeze 3/14, MENU 3/15), PHONES 3/1/0 (the clients' phone remote, green ON / red OFF), LOCK ALL 3/3/0 | H20 keys from the old export; the rest by `deck_system.mjs` |
| 4 | the current show (CASAMENTO) | Look keys, transitions, PPT, status, TAKE / CANCEL: see the production's reference file | the production's deck script |
| 5 | LOCK | Empty on purpose: desklock draws on the decks while the desks are locked | `deck_system.mjs` |
| 6 | LOCKCTL | 6/0/0 sends every surface to LOCK, 6/0/1 back to the show page. desklock presses them over the HTTP API. Not for the operator, and no key links here. | `deck_system.mjs` |

Custom variables (`$(custom:...)`), pushed by the Smode master (over HTTP once a second; the clip readouts over the
raw UDP API at up to 30 Hz, which never creates a variable: it must exist first): `smode_look`, `smode_next`,
`smode_ppt`, `smode_trans`, `smode_clip`, `smode_time`, `smode_clip_pos`, `smode_clip_len`, `smode_clip_pct`,
`smode_pip`, `smode_pip_pos`, `smode_pip_len`, `smode_pip_pct`; and `room_phones` (ON / OFF, from room-remote). Do
not set them by hand during a show. The master pushes to NUC-01, NUC-02 and the notebook.

## How the pages are built

- **System pages** (SYSTEM's PHONES and LOCK ALL, LOCK, LOCKCTL, the SYSTEM names):
  `node C:/Projetos/MATA/smode-shows/tools/deck_system.mjs <companion url> [--show <page>]`. It writes only its
  own keys, can be run again at any time, and creates the `desklock` connection when missing. Run it on both NUCs.
- **The show page**: the production's own script, which writes one page only (for the current production
  `smode-shows/tools/master/casamento_deck.py <url> --page 4`). A generated corporate deck
  (`smode-shows/tools/make_companion_xl.py`) is replayed one page at a time:
  `node scripts/replay.mjs <file.companionconfig> --url <companion> --pages <n>`.
- **Never replay a whole generated file over a NUC**: without `--pages`, `replay.mjs` clears every page the file
  names. (The old `deck_replay.sh`, which did that and removed the other pages, is gone.)
- **Making one Companion a copy of another** (how NUC-02 was built): save a full export
  (`curl -o x.companionconfig "http://<source>/int/export/full?format=json"`), create the connections with the same
  labels on the target, replace the source's emulator id with the target's in the file, `replay.mjs` it, then run
  `deck_system.mjs`. Compare afterwards by exporting both and diffing the pages (ids aside).

What `replay.mjs` does not carry: style properties that are expressions (a background colour that follows a
variable), key notes, hold groups, and anything but step 0's press actions. It also leaves Companion's default
page-up / number / down keys on pages it had to create. `deck_system.mjs` covers the system keys that need those.

## The decks lock with the desks (desklock, `tools/desk-lock`)

desklock is the workspace's desk lock on NUC-01, NUC-02, PARSEC-01 and PARSEC-05 (all on 0.5.0). On a machine with
Stream Decks it also locks the decks; its README is the reference. What matters for Companion work:

- When NUC-01's desk locks, desklock presses LOCKCTL 6/0/0 (the decks go to the empty LOCK page, so no key fires
  anything), opens the decks beside Companion and draws the logo and the PIN pad on them itself. When the lock
  ends it presses 6/0/1 and Companion redraws its keys. The page numbers are in `desklock.ini`
  (`deck_lock_press`, `deck_unlock_press`): if LOCKCTL or the show page moves, change them there too.
- The bottom-right key of a locked deck opens the PIN pad. A PIN typed on a deck unlocks every desk; a PIN typed
  on a keyboard unlocks that desk only.
- LOCK ALL (SYSTEM 3/3/0) must be held for 1 s (a hold group that runs while held). It sends `/desklock/lock` to
  the `desklock` connection; desklock locks the four desks and the decks.
- Companion cannot animate a picture across keys itself: measured on 5.1.2, a key with one animated element
  redraws under 5 times a second, a page of 28 animated keys 0.7 times. That is why the lock picture is drawn by
  desklock, not by a Companion page.

## House rules

- Experiments go on a scratch page at the end, on NUC-02 or the notebook, removed afterwards. NUC-01 is the show.
- Do not press show keys to "test": they fire OSC at the Smode master and the H20. LOCK ALL locks four desks.
- Do not edit LOCK or LOCKCTL by hand, and do not insert or remove a page before page 6 without updating the
  MENU keys, the LOCKCTL keys and `desklock.ini`.
- Text follows the workspace rules: no vendor names in key text unless the key controls that device; keep the
  colour language (dark grey `2500134` background, off-white `11579568` text for looks).
- Before a change on NUC-01, save a full export (the URL above) next to your work; it is the undo.

## Things the MCP tools cannot do

Use Companion's own API through `node scripts/trpc.mjs <url> query|mutate|watch <procedure> ['<json>']`:

| Need | Procedure |
|---|---|
| Read or change a setting (protocols, decoration, grid) | `userConfig.getConfig` (query), `userConfig.setConfigKeys {values:{...}}` |
| Add a connection, set its config | `instances.connections.add {module:{type}, label, versionId}` (answers the id), `instances.connections.setConfig {connectionId, label, config}` |
| Read a connection's config | `instances.connections.watchEdit {connectionId}` (watch) |
| A hold group on a key | `controls.actionSets.add {controlId, stepId:"0"}` (creates set 1000), `.rename`, `.setRunWhileHeld`; then `add_action` with `setId: 1000` |
| A key's rendered picture | `preview.graphics.location {location:{pageNumber,row,column}, size:{width:96,height:96}}` (subscription, PNG data URL) |
| Fire a hold from a test | HTTP `POST /api/location/<p>/<r>/<c>/down`, wait, then `/up` (`/press` is a tap) |

## Updating Companion on a NUC

Done on NUC-02 on 2026-11-19 (5.0.5 to 5.1.2): download the installer from Bitfocus on the NUC itself (ask Gabriel
first), check its signature (Bitfocus AS), copy `%APPDATA%\companion` aside, stop Companion's processes by id, run
the installer with `/S`, start Companion again in the desktop session, check the version and the pages. The
installer and the backup of that update are in `C:\companion_install` on NUC-02. Keep both NUCs on the same version.
After a Companion update, audit the tools first (`docs/COMPANION-API.md`).
