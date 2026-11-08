# Bitfocus Companion 5.1 - concepts and vocabulary

Source: the official Companion 5.1 user guide plus GitHub release notes v5.0.0 to v5.1.2 (2026-11-04). Everything here comes from those pages; anything the manual does not say is listed under "Gaps".

## Contents
1. Grid, pages and surfaces
2. Buttons (layered styles)
3. Actions, steps and action sets
4. Feedbacks
5. Variables and expressions
6. Triggers
7. Connections and modules
8. Import/export and backups
9. Remote control APIs
10. What changed in 5.0, 5.1 and the 5.1.x patches
11. Gaps

---

## 1. Grid, pages and surfaces

### Grid
- The button grid has a number of rows and columns (Settings > Buttons > Grid Size, "Configure Grid Size"). It can be any size and grows in all 4 directions (rows above, columns to the left are possible).
- Setting "Prompt to expand grid when attaching new surface": offers to enlarge the grid when a bigger surface connects.
- A button location is written `page/row/column` (e.g. `1/0/2`). Pages are numbered from 1; rows and columns start at 0 (examples in the manual: `1/0/0` = page 1, row 0, column 0 = top-left).
- Page buttons (Page up / Page number / Page down) default to the first column of a page ("Recreate navigation buttons" puts them back, replacing whatever is there).

### Pages
- Any number of pages (since 3.5). New installs start with 1 page. Pages have a name; name them.
- DANGER: reordering or inserting pages does not update references to page numbers (button references, `page/row/column` strings in actions, surface startup pages). Importing a page does not adjust button reference locations either.
- Page restrictions per surface/group are by page (see below).
- Page variables (5.1): each page has its own variables, shared by every button on that page, read as `$(page:name)`. Types: User Value, Evaluate Expression, Feedback (same as local variables). Set from anywhere with internal actions "Page Variable: Set value", "Page Variable: Reset to startup value", "Page Variable: Write current value to startup value" (these ask which page). Triggers cannot read `$(page:...)` but can set page variables. Included in page export/import. Also usable in a button's step-progression expression (5.1.1).
- Page actions menu (grid): Edit page, Export page, Recreate navigation buttons, Clear page.

### Surfaces
- A surface is a physical or virtual input device (Stream Deck, XKeys, Emulator, Satellite client, ...) mapped onto the grid. "Configured surfaces" hold the mapping and per-surface attributes.
- Per-surface settings (common set; exact list depends on the surface type):
  - Surface Name; Surface Group.
  - Use Last Page At Startup (otherwise the Startup Page is used).
  - Startup Page.
  - Horizontal Offset in grid / Vertical Offset in grid: position of a device smaller than the grid inside the grid. Common layout trick: several surfaces share one page, each owns an area of it via offsets; the alternative is one page per surface.
  - Surface Rotation (mount orientation), Button rotation.
  - Brightness.
  - Never pin code lock (exclude from PIN lockout; reworked in 5.0).
- Enable/disable per surface (4.3): disabling stops Companion claiming the device but keeps its config. Does NOT apply to surfaces connected over Satellite. Setting "Auto-enable newly discovered surfaces" controls whether new devices are used immediately.
- Page Permissions (4.2): a surface or surface group can be restricted to a list of pages. Next/previous page actions, page buttons and swipes follow the order of the list selected there; to reorder, delete entries and re-select in the new order.
- Surface Groups: linked surfaces always show the same page (e.g. two XL side by side as one 16x4). Page-changing actions pick the group instead of the individual surface; existing actions that reference a surface act on its group. Groups also give a stable id when devices are swapped (program against the group, add/remove surfaces later). In the REST API `groupId` equals the surface `id` when the surface is not in a group.
- Page number button: pressing it returns the surface to its startup page (5.0).
- PIN lockout (Settings, also on Surfaces page): Enable PIN Lockout, Link Lockouts, PIN Unlock Code, timeout in seconds (0 = off; then lock on demand by an action).
- Rescan USB / "Watch for new USB Devices" setting; with it off you must rescan yourself. If an Elgato Stream Deck is missing, close the Elgato app and rescan.
- Linux: udev rules must match the enabled surface modules; Companion alerts on the Surfaces page.
- Surface modules / integrations (4.3): surface support is downloadable modules like connections; add under Surfaces page > "Add Surface Integration" or the Modules page. Module must be installed AND enabled before Companion recognizes the device.
- Remote surfaces: Satellite, Stream Deck Network Dock; some are reached by Companion connecting to them (Surfaces page, Remote Surfaces: configured connections left, discovered right).
- Emulator: a browser grid acting as a surface. None created by default on new installs; multiple emulators allowed (3.0). An emulator can be viewed from many places but they share one Companion page; use several emulators for different people on different pages. Settings per emulator are on the Surfaces page.
- Companion Satellite: separate app on another machine forwarding its surfaces to Companion. TCP default port 16622, WebSocket 16623 (configurable in Settings > Satellite). Remote surfaces appear on the Surfaces page automatically. Supports a subset of devices. "Enable Button Subscriptions API" lets satellite clients subscribe to any button (needed by the Elgato Stream Deck plugin) but bypasses PIN lockout and the page system. Satellite ports are announced via mDNS (5.0), compressed images supported (5.0).
- Elgato Stream Deck plugin: the dedicated plugin server was removed in 5.0; the plugin connects through the Satellite API.
- Internal actions/feedbacks on surfaces (5.0/5.1): adjust surface brightness (action), variable for surface brightness, enable/monitor active remote surfaces (action + feedback), "Surface: When connected" feedback (5.1). Old xkeys `$(internal:tbar)`-style variables were removed in 4.2; bind surface controls to custom variables in the surface config instead.

---

## 2. Buttons

### Button types
- Regular button: runs actions (the normal type).
- Button reference (5.1): mirrors another button. Looks identical and pressing/turning it is the same as pressing/turning the source. Only setting: "Mirrored location" (`page/row/column`, e.g. `1/0/1`); accepts variables or an expression (e.g. `$(page:camera)/0/1`). Unresolvable/empty target draws "Unresolved Reference"; self-reference loop draws an infinity sign. "Edit" converts it to a normal editable copy (irreversible). Create by choosing the type on an empty button, or copy + "Paste as reference". Internal step actions/feedbacks and the pushed-state feedback resolve through references (5.1.1).
- Page up / Page number / Page down: special built-in buttons. "Convert to Normal Button" turns them into regular buttons with equivalent actions (one-way). Settings: "Flip counting direction on page up/down buttons", "Show + and - instead of arrows".
- Linked preset button (5.1): see section 7.
- Every button (and trigger, expression variable) has a Notes field: internal only, never drawn. Presets may fill it.
- Behaviour options on a regular button: Step progression (section 3) and Rotary actions (section 3).
- Buttons on inactive pages are lazily rendered (5.0).

### The layered style (since 5.0)
A button's appearance is an ordered stack of graphics elements drawn on a Canvas. Top of list = drawn on top. Old single "button style" (text, font size, background image, bgcolor) no longer exists as flat fields: a plain 4.x button converts to a Background (Box) + Image element + Text element. Old feedbacks are auto-converted to target the standard Text, Image and Background elements.

Element types: Group, Text, Image, Box, Line, Circle, Gauge, Reference. Modules can add composite elements (listed under the connection name in "Add element"; drawn as a whole, can be moved/resized/rotated (rotation since 5.1) and expose module-defined options; shown as "Missing Element" placeholder if the connection is disabled/removed or the element is missing/cyclic).

New elements are inserted above the selected one. Elements can be reordered, duplicated, removed, toggled hidden in preview, dragged in/out of Groups.

Common to every element:
- Element Name: shown in the list AND how feedback style overrides pick an element. Give meaningful names.
- External Usage: Automatic, or Text / Color / Image / Gauge. Tells surfaces without full colour screens (LEDs, light rings) which element to use. Gauges with any non-Automatic usage other than Gauge are never used for LEDs.
- Drawing section: Enabled (accepts expression; e.g. `blink(1000)` or `$(custom:armed)`), Opacity 0-100.
- Position & Size (all elements except Line and Canvas): X %, Y %, Width %, Height % of the button (percentages, not pixels; X0/Y0/W100/H100 fills the button), Rotation in degrees (negative allowed since 5.0.1; Circle has no rotation). Because they are percentages, shapes stretch on non-square buttons.
- Line has "Position" with From and To points (X %/Y %) instead of X/Y/Width/Height.

### Canvas and Background
- Canvas: always present, cannot be deleted, lowest layer. Properties: Decoration (Follow default / Top bar / Border when pressed / None) and Show status icons (Follow default / Show all / None). Defaults come from Settings > Buttons.
- Top bar shows location (page/row/column) and current step on multi-step buttons; it takes space at the top, so turn it off for edge-to-edge content. A pressed button shows a filled topbar or coloured border; it stays on if pressed without release (e.g. Button Trigger Press with no matching Release).
- Status icons: red triangle = connection error, orange = warning, green play arrow = actions running/queued (e.g. Wait or Sequential group).
- Background is NOT special: it is a Box with X0 Y0 W100 H100, no border. Recolour, rename or delete freely; to restore it add a Box. An empty button (no actions, no elements) draws muted grey.

### Text element
- "Button text string": two modes (toggle): Variables mode (plain text with `$(conn:var)`) or Expression mode (whole field is an expression, text must be quoted/templated). Line break: type `\n`.
- Font: Default or Monospace. Weight Normal/Bold. Styles Italic/Underline/Strikethrough (5.1) - as an expression it must return an array such as `['italic','underline']` or `[]`.
- Sizing: two properties since 5.0:
  - Text Size = percentage of the ELEMENT height (not button).
  - Shrink to fit (checkbox): may shrink below Text Size to the largest size that fits, down to 1/10 of the element height; unticked = fixed size, may clip. 5.1 made the shrink smooth (previously stepped).
  - The old fixed/"auto" font-size dropdown of 4.x is replaced by these two; the HTTP API `size` param is legacy (see section 9).
- Color, Outline Color (optional), Horizontal Alignment (left/centre/right), Vertical Alignment (top/centre/bottom).

### Image element
- Source: upload straight to the button (stored inside it) or pick from the Image Library (referenced as `$(image:name)`; usable in expressions).
- Fill Mode: Fit (default; whole image visible), Fill (covers, crops overflow), Crop (crop to element size, no scaling). Horizontal/Vertical Alignment.

### Box, Line, Circle
- Box: filled rectangle; Fill section (colour, Corner Radius % - 0 square, 100 pill; 5.1) and Border section (width, colour, drawn inside/centred/outside).
- Line: From/To, width, colour.
- Circle: fill and border, Start Angle / End Angle for an arc, "Draw Slice" to fill as a pie slice.

### Gauge element
- Value (usually variable/expression), Minimum, Maximum (outside values draw empty/full), Origin (0-point; empty = auto grows from Minimum; set middle value for pan-style gauges; auto starting point improved for negative ranges in 5.0.3/5.1), Symmetric (mirror around origin).
- Appearance: Orientation Horizontal / Vertical / Ring; Reverse direction. Ring-only: Start angle / End angle (degrees clockwise from top; e.g. 225 to 135 = arc with gap at bottom), Ring width %, Rounded ends.
- Fill: Show fill, Fill width % (5.1), Color stops (each Value + Color; "Gradient to next" blends; colours may be partly transparent; CSS colour strings accepted), Multi-color fill (each colour in its own segment like a level meter vs whole fill in current colour).
- Marker: Show marker, Color, Width %.
- Track (background): Style Transparent or Dimmed (darker), Amount % (0 black, 100 = fill colour), Track width %.
- Surface LEDs (5.1): a button's first gauge is shown on LED rings/strips of a supporting surface (e.g. Stream Deck Studio); set External Usage = Gauge on the right one if several. Marker not shown; ring follows start/end angle; transparent colours drawn against black.

### Group and Reference elements
- Group: container; move/resize/rotate/enable children together. Option "Square Aspect Ratio": child coordinate space is a square (shorter side) centred in the group, so arrows/icons keep shape on non-square buttons (how the built-in page buttons work).
- Reference element: draws another button's graphics only (does not press it). Source > Location `page/row/column`, expressions allowed (e.g. `$(this:page)/0/0`). Use a Button reference to also forward presses.

### Pinned properties (5.1)
- "Pinned" is a pseudo-entry in the elements list showing chosen properties from across the whole button, grouped by element, so relabelling many buttons needs no element selection. Pins are stored per element per button.
- Pinned by default: Text = text, Text Size, Shrink to fit, Color, alignment; Image = image + alignment; Box = Color; Circle = Color; Line = Line Color + Line Width; Gauge = Value; Reference = Location. Groups and composite elements: nothing pinned (elements with no pins are omitted from the view).
- To change a property that is not pinned, edit the element's full property panel.

### Expressions in properties
- Every element property can be switched to expression mode; the element redraws automatically when any variable it uses changes. The UI shows what the expression currently evaluates to (5.1) and warns if invalid.
- A property overridden by a feedback is marked with a layers icon.
- This replaces many former feedback use cases (text from variable, colour by `$(custom:armed)`, show/hide via Enabled, blinking).
- Composite elements and action/feedback option fields may support `isVisibleExpression` (module side); expression-type fields cannot be referenced from it (5.1.1).

### Colours
- A colour value can be a CSS colour string (`#f00`, `rgb(255 0 0)`, `hsl(...)`, keyword `red`), a 24-bit `0xRRGGBB` number (what colour pickers produce), or a channel object from `colorTo*` functions. Alpha supported in gauge fills, text colour (5.0.3 "translucent text color") and box fill (5.1). Colour functions in section 5.

### Editor-side previews (no effect on config)
- Preview aspect ratios 1:1, 9:7 (Stream Deck Studio), 2:1 (Stream Deck + dial screen), custom W/H, or shapes of surfaces Companion has seen. Remembered by browser only.

---

## 3. Actions, steps and action sets

### Action groups of a step
- Each step has: Press actions (button pressed or triggered), Release actions, and optional timed "duration groups".
- Duration group ("Add duration group"): has a time and a mode - run at that time upon release, or run while held (as soon as the time is reached while still pressed). With at least one duration group, Release actions becomes "Short release actions" and runs only if released before the first duration group's time.
- Rotary actions (behaviour option "Rotary actions"): adds "Rotate left actions" and "Rotate right actions". They run once per dial movement; `$(this:delta)` (5.1) = how far it moved (positive right/clockwise, negative left); only available inside rotate actions. Internal action "Button: Trigger rotate action" has Amount (positive right, negative left; can be `$(this:delta)`).
- Delays: the old per-action delay is gone (3.5); use internal action "Wait" (milliseconds; 1000 = 1 s). It delays all actions after it in the list.
- Internal action "Action Group": a container action with an execution mode:
  - Inherit: follow the parent group's mode.
  - Concurrent (root default): actions run in parallel, split at any Wait actions (equals old "absolute delays").
  - Sequential: run in order, each waits for the previous to finish. Only as reliable as the module reporting completion (not all do).
- Logic actions: "Logic: If statement" (Then / Else actions, run Then only when ALL "When True" conditions are true) and "Logic: While loop" (repeats while all "While True" conditions are true). Conditions are feedbacks. Built-in (internal) feedbacks in these conditions are evaluated at the moment the action runs (5.1), see current variable values and `$(this:surface_id)` / `$(this:delta)`; connection feedbacks use the last reported value. Always put a Wait (e.g. 100 ms) inside a While loop or it spins hundreds of times per second.
- Storing an action's result (5.0): actions that return a result show "Store Action Result": into a Local variable (button location + name, e.g. `$(this:page)/$(this:row)/$(this:column)`), a Page variable (page + name), a Custom variable (existing, optionally create), or `<discard>`.
- Internal "Button: Trigger press and release" has a Hold duration (ms) option (5.1; 0 = release immediately), useful for buttons with long-press groups. "Button: Trigger press" without a matching release leaves the pressed look on.
- Old "Button: set X" actions are marked deprecated (5.0); "use another buttons style" deprecated in favour of Reference.
- Internal actions also exist to adjust/set a button's current step, set custom/local/page variables, change surface page, lock surfaces, etc.

### Steps
- A button can have many steps (tabs "Step 1", "Step 2", ...; "Add step"). Each step has its own Press/Release/duration/rotate action lists. Steps replace the old "latch".
- Default: step advances each time the button is released; cycles back to step 1 after the last.
- Step Progression option: automatic, OR step number driven by an expression, OR only changed by internal actions (enables "shift layer" patterns). Expression can use local and (5.1.1) page variables.
- Example: close a shutter in Step 1 Press, open it in Step 2 Release.
- `$(this:step)` current step, `$(this:step_count)` number of steps. The topbar shows the current step on multi-step buttons.
- HTTP/OSC `.../step` sets the step externally.

### Action options
- Fields with a variables icon accept `$(...)`; fields with an expression toggle (modules on API 4.3+) accept a whole expression; fields with the globe icon accept local variables. Modules must opt in to expressions.

---

## 4. Feedbacks

- A feedback lets a button react to state. Two sources: module feedbacks (device state) and Companion's built-in "internal" feedbacks (variable checks, surface/connection/page state, etc.).
- You do not always need one: any element property can be an expression (section 2). Feedbacks are for module-reported state, for grouping several overrides under one on/off rule, or by preference. Both can coexist.
- Since 5.0 a feedback does not set a flat style; it OVERRIDES properties of named elements while active. Each feedback has a Style Overrides table: add an override = pick element (by its Element Name; e.g. Text, Image, Background) + one or more properties + a value. A feedback with no overrides has no effect.
- Order/priority: feedbacks apply top-down; a feedback LOWER in the list wins when two change the same property. This is the opposite of 4.x (higher won).
- Types (icon next to Style Overrides heading shows which):
  - Boolean: on/off; when the condition is true the configured overrides apply. "Inverted" is a standard option on boolean feedbacks (upgrade scripts reference `isInverted`).
  - Value feedback (5.1): produces a value (fader level, name, number; built-in "Evaluate Expression"). Each override value is ALWAYS an expression and can use `$(this:value)`; a new override defaults to `$(this:value)`. Example: `$(this:value) > -6 ? 0xff4040 : 0xffffff`. If the expression returns `undefined` or fails, the element keeps its own value.
  - Legacy style feedback (some modules): returns a whole style; each override picks one of the produced style properties and maps it onto an element property.
- Some modules offer feedbacks that draw a complete generated image.
- Built-in useful feedbacks: "Variable: Check boolean expression" (true when the expression is true), "Evaluate Expression" (value), condition checks usable in triggers and in Logic If/While actions.
- Feedbacks can also feed local variables (type "Feedback") so they can be used in boolean logic, including from presets.
- When their connection stops, a feedback's style overrides are dropped (5.1.2); overrides of a feedback with no definition are hidden.
- Disabled feedbacks/actions/events are shown more clearly (5.0).
- Flashing: `bool($(obs:streaming)) && blink(500)` as the boolean expression; pulsing: `oscillate(2000) * 100` as the Opacity of a Box.

---

## 5. Variables and expressions

### Variable syntax and kinds
- `$(label:name)`, where label is the connection LABEL (not id; renaming a connection changes references, Companion auto-renames statically detectable ones). Internal ones use `internal`.
- Variables work only where the field shows the variables icon; elsewhere they are unlikely to be parsed.
- Kinds:
  - Connection variables: read-only, produced by modules.
  - Internal (`$(internal:...)`): by Companion itself: `time_hms`, `time_s`, `date_monthname` (5.1), connection counts `instance_total` / `instance_oks` / `instance_warns` / `instance_errors` / `instance_disabled`, `connection_<label>_status` (good / warning / error / disabled), `connection_collection_<id>_status` (true = enabled; the id is internal, find it in the Variables page), surface brightness variable, version number variables, etc.
  - Custom variables `$(custom:name)`: user defined, global. Fields: current value, startup value, "Persist value" (stored across restarts; more disk IO). Can be organised in collections. Legacy `$(internal:custom_name)` still parses but is deprecated.
  - Expression variables: name + expression, recalculated automatically when dependencies change (no stored value). Can use local variables.
  - Local variables `$(local:name)`: belong to a button, trigger or expression variable; not readable from outside, but "User Value" locals can be set from elsewhere with internal actions by giving a target location (`1/0/0` or expression) and name; value expression may use `$(this:current)` (current value) and `$(target:name)` (another local at the target). Types: User Value, Evaluate Expression, Feedback. Support indicated by the globe icon. Collapsed rows show the current value. Triggers default the local location to `this` (5.1.1).
  - Page variables `$(page:name)`: see section 1.
  - Image library `$(image:name)`: an image reference, not a value.
- Value types: string, number (IEEE754 double, integers safe to +-2^53-1), boolean, object (JSON object or array), null. Custom variable editors have a Text mode (always string) and a JSON mode (type preserved). Arrays/objects are indexed in expressions: `$(custom:names)[1]`; update with `arr=$(custom:names); arr[1]='John'; arr`.
- `$(this:...)` built-ins: `page`, `page_name`, `column`, `row`, `location` (e.g. `1/2/3`), `active` (pressed), `step`, `step_count`, `button_status`, `actions_running`, `surface_id` (only in actions), `delta` (only in rotary actions), `current` (while setting a variable), `value` (in feedback style overrides).
- Modules' variable updates are rate limited to 50 Hz (5.0). Avoid cyclic local-variable dependencies (CPU cost).
- Variable names: id format enforced (5.0.4); rule loosened in 5.0.5.

### Expression language
- A subset of JavaScript (rebuilt on a standard JS parser in 5.0): no classes, no regex literals, no try/catch, only arrow functions (no `function` keyword).
- Expression mode vs text mode: in a plain text field you write text with `$(...)` substituted; in an expression field the whole field is a formula. `Cam $(atem:input_1_name)` is a syntax error in an expression; use a template string: `` `Cam ${$(atem:input_1_name)}` ``.
- Values: numbers (also `0x10`, `0b11`), strings ('..' or ".."), booleans, arrays `[1,2]`, objects `{a: 1}`; `PI` constant.
- Variables keep their type inside expressions; missing variable = `undefined`. Nested `$(custom:$(custom:b))` is NOT supported; use `parseVariables('...')` or `getVariable('conn','name')`.
- IMPORTANT: `+` is numeric addition only; `'a' + 'b'` gives `NaN`. Join text with template strings or `concat()`.
- A string like "false" or "0" is truthy; wrap with `bool()`.
- Statements separated by newline or `;` (two statements with no separator are rejected since 5.0); last statement is the result; `return` must be on the same line as its value. When a line starts with a backtick, `(` or `[`, end the previous statement with `;`.
- Temporary variables (`x = 1`, `let`, `const`) live only during evaluation. Bare assignment updates the nearest existing variable or creates one in the current scope; `let/const` always create a new one in the current block scope.
- Control flow (5.0): `if / else if / else`, `for`, `for...of`, `while`, `break`, `continue`, arrow functions (recursion allowed), optional chaining `?.`, spread `...`, comments `//` and `/* */`.
- Execution budget: loop iterations + function calls + call depth are limited; exceeding it aborts the expression as invalid (no hang). Some frequently evaluated places use a tighter budget. `oscillate` can't be used in action options (only continuously updated places: element properties, feedbacks, local/expression variables, trigger conditions).
- Invalid (syntax error) = no result and a logged error; wrong values just yield `NaN`/`undefined`.

### Operators
- Arithmetic `+ - * / ** %` (always numeric). Comparison `== != === !== > >= < <=` (`==` loose: text '5' equals 5, recommended for variables; ordering operators convert to numbers, no alphabetical compare). Logical `&& || !`, nullish `??` (fallback only for undefined/null; `||` also falls back on 0 and ''). Ternary `a ? b : c`. Unary `- + ! ~`. Bitwise `& | ^ << >>`. Assignment forms `= += -= *= /= %= **= ||= &&= ??= <<= >>= ^= &= |=`, `++ --`.

### Functions (full list in the manual; the useful ones)
- General/numeric: `length`, `round`, `floor`, `ceil`, `abs`, `min`, `max`, `randomInt([min],[max])` (default 0-10, inclusive), `toFixed(val, dp)`, `isNumber`, `toRadix/fromRadix`, maths added in 5.1: `sqrt cbrt pow log log10 exp sin cos tan asin acos atan asinh acosh atanh`, `PI`. Clamp: `min(100, max(0, x))`.
- String: `trim substr(val, start, end)` (negative indexes from the end) `split join concat includes indexOf lastIndexOf toUpperCase toLowerCase replaceAll stringCompare strlen encode decode (hex/base64)`, `encodeURI decodeURI encodeURIComponent decodeURIComponent`.
- Colour (5.1): `rgb rgba hsl hsla hsv` (build), `colorToRgb colorToHsl colorToHsv colorToHex`, `isColor`, `colorAlpha`, `colorLighten colorDarken colorSaturate colorInvert`, `colorMix(a, b, ratio)`, `colorIsDark`.
- Variables: `parseVariables(str, ?undefinedValue)`, `getVariable('conn:name')` or `getVariable('conn','name')`.
- Animation: `blink(periodMs, ?dutyOn)` gives 0/1 (min period 100 ms, duty default 0.5); `oscillate(periodMs, ?'sine'|'triangle'|'sawtooth'|'square', ?phase)` gives 0..1 (5.1; refreshed 10 times a second; same period stays in step across buttons).
- Bool: `bool(val)`.
- Objects/arrays: `jsonpath(obj, path)`, `jsonparse`, `jsonstringify`, `arrayIncludes arrayIndexOf arrayLastIndexOf arraySlice arrayConcat arrayFlat`, iteration `arrayMap arrayFilter arrayReduce arrayForEach arrayFind arrayFindIndex arraySome arrayEvery arraySort arrayReverse`, `objectKeys objectValues`.
- Time: `unixNow()`, `timestampToSeconds`, `secondsToTimestamp(sec, fmt)`, `msToTimestamp`, `timeOffset(ts, offset, 12hour)`, `timeDiff(from, to)` (e.g. `timeDiff($(internal:time_hms), '19:30:00')`).
- Date (4.3): `parseDate dateYear dateMonth dateDay dateHour dateMinute dateSecond dateWeekday dateFormat(value, fmt, tz?, locale?) dateAdd(value, amount, unit)`.
- Timezone for time variables, date functions and time triggers: Settings > "Timezone for time variables and triggers" (default = host timezone, configurable since 5.0).

### Worked patterns
- Cycle 1..4 with one button: set a custom variable to `($(custom:camera) % 4) + 1`.
- Countdown: `secondsToTimestamp(max(0, timeDiff($(internal:time_hms), '19:30:00')), 'HH:mm:ss')`.
- Default text: `$(custom:operator_name) ?? 'No operator'`.
- Zero pad: `substr(concat('000', $(custom:clip)), -3)`.

---

## 6. Triggers

- A trigger = Events (when) + Condition (filter) + Actions (what). Triggers do not belong to a page, so they cannot read `$(page:...)`; they can have local variables and notes.
- New triggers start disabled. They have a name and can be put in collections (collection enable switch disables its triggers).
- Events: the trigger runs when ANY listed event occurs. Named in the manual: Time interval, At random time interval (4.3), On variable change. The manual also mentions sunrise/sunset events (release notes 5.0.2). The full event list is not on the manual page (see Gaps).
- Condition: a subset of the button feedbacks (boolean feedbacks incl. "Variable: Check boolean expression"); example: on variable change, run only when the value is 1. Internal conditions are re-evaluated every time the event fires (5.1) so `randomInt(1,10) > 7` is re-rolled each time (run only some of the time). Connection feedbacks use the latest reported value.
- Actions: any action usable on a button. "Button: Trigger press and release" presses a button; its Hold duration (ms) holds it before release (0 = immediately).
- Rapid variable-change triggers are rate-limited (5.0).
- Trigger conditions can use `blink`/`oscillate`.

---

## 7. Connections and modules

### Connections
- A connection = one configured instance of a connection module for one device/software (two identical devices = two connections). It has an id (stable internal string, used by the REST API) and a label (user-facing name, used in `$(label:var)` and `internal:connection_<label>_status`). Labels are the vocabulary in the UI, ids are what APIs address.
- Status: category/level/message (`good`/`warning`/`error`/`disabled` in internal variables). Enable/disable per connection; disabling a connection collection disables everything inside it (including nested collections) without altering each connection's own enabled flag; connections in a disabled collection are reported as disabled (5.1).
- Collections (4.1): groups for connections, triggers and custom variables, nestable, with an enable switch.
- Module version per connection: each connection can run a different installed version. Updating Companion does NOT update modules automatically; choose versions on the Connections page (pencil next to the version restarts the connection). On config import, install the right module versions. REST API `updatePolicy`: `manual`, `stable`, `beta`; `versionId` null = newest compatible stable.
- Deprecated modules/versions show a yellow badge and a warning (5.1). Escape hatch: force a connection to use a different module (not for normal use).
- Per-connection tools: Help, Known Issues (module GitHub), Variables list, View Logs (debug log).
- Companion 5.1.2 accepts modules built on module API 1.15. Linked presets need module API 2.0+.

### Modules
- Connection modules are downloadable plugins (since 4.0); surface modules (since 4.3). Not shipped with Companion. Modules page: installed versions, stable/beta/deprecated toggle, refresh from store (also on an interval). Import a module package (`.tgz`) for test/internal builds; offline systems import an "offline module bundle" (versioned like Companion).
- Installing modules from the network from another machine and running shell commands are OFF by default since 5.0 (re-enable from the launcher); store installs and local-machine configuration are unaffected.

### Presets
- Presets are ready-made buttons (text, actions, feedbacks) from a module, dragged from the Presets tab onto the grid. Users cannot author presets (build your own library on other pages and export/import them).
- "When placed" toggle (browser-remembered): Linked (default for modules that support it, 5.1) or Copy.
  - Linked: button stays tied to the preset; updates when the module/connection config changes. Editor shows only Connection (switchable to another connection of the same module) and Preset variables (values differing per button, e.g. which input). "Edit" unlinks permanently into a normal button.
  - Copy: one-off editable button.
- If the used connection is disabled or deleted, a linked button keeps its last look.
- Presets can include local variables of type Feedback (5.0) and fill in notes (5.1).

### Action recorder
- Builds an action list from operations done on the real device. Open a button's Actions tab > Action Recorder > Start recording; perform operations; Stop recording; Save (apply to button) or Discard.
- Very few modules support it; only operations the module reports are captured; add `Wait` actions yourself for timing. The recorder is also exposed over the Ember+ API (4.1).

### Image Library (5.0)
- Central store for images (drag/drop or upload; PNG, JPEG, SVG ...; square, 72x72 px or larger works best). Each has a name, optional description, can be replaced (name kept, all users update), downloaded, deleted, organised in collections. Referenced as `$(image:name)`. Optional - images can still be uploaded directly into a button.

---

## 8. Import/export and backups

- File: `.companionconfig`. Export formats: Compressed (default, smallest, recommended), JSON (standard, other tools can read), YAML (human-readable; must be read fully into memory). Default format: Settings > "Default Export Format" (5.1); default file name can contain variables.
- Full export/import from Import/Export tab; single page export from the page actions menu; triggers can be exported too.
- Import: choose categories; "Import, Preserving unselected components" or "Full Reset then Import". Pages/triggers import can remap connections. Up to 1 GB; prefer Compressed/JSON for large files. Import may leave button reference locations unadjusted. Export your current config first. 5.1 made very large imports/exports more reliable (streaming JSON).
- Config reset is also available here.
- Backups (Settings > Backups): scheduled rules with Rule Name, Cron Schedule, Backup Type (Raw Database / Compressed / JSON / YAML), Backup Path (blank = built-in location), Name Pattern (variables), Number of Backups to Keep (older pruned), "Run Now". Raw Database backups are not restorable via the UI; the other three are (Import/Export page).
- Admin UI Password (Settings > Advanced) only stops casual browsers; it does not protect remote control protocols or the REST API. Optional HTTPS server (self-signed or external certificate).

---

## 9. Remote control APIs

All are enabled in Settings > Protocols (HTTP, REST, TCP, UDP, OSC, RossTalk port 7788, Ember+ port 9092, Artnet, Satellite). Older protocols have a "Deprecated ... API" switch for old commands (removed in a future release). Only the REST API requires authentication.

### HTTP Remote Control (same host:port as the admin UI)
- `POST /api/location/<page>/<row>/<column>/press` press+release; `/down`, `/up`, `/rotate-left`, `/rotate-right`, `/step` (set the current step).
- Style (legacy-style fields): `POST /api/location/<p>/<r>/<c>/style?text=..|bgcolor=..|color=..` or JSON body `{"text":"..","bgcolor":"#ffffff"|"rgb(r,g,b)","color":"#000000","size":28}`. These map onto the standard Text/Background elements of a layered button; `size` is a legacy field.
- Custom variables: `POST /api/custom-variable/<name>/value?value=..` or body (text/plain, or JSON via `application/json`: a quoted string, number, boolean, array, null or object stored with its type; empty body = undefined); `GET /api/custom-variable/<name>/value`.
- Module variable: `GET /api/variable/<Connection Label>/<name>/value`.
- `POST /api/surfaces/rescan`.
- Connections: `GET /api/connections` (id, label, moduleId, enabled, sortOrder, status), `GET /api/connections/<id>/status`, `POST /api/connections/<id>/restart` (409 if inactive), `/enable`, `/disable`.
- Deprecated (need the setting on): `/press/bank/<page>/<bank>[/down|/up]`, `/style/bank/<page>/<bank>?...`, `/set/custom-variable/<name>?value=`, `/rescan`.

### OSC (default port 12321, configurable)
- `/location/<page>/<row>/<column>/press|down|up|rotate-left|rotate-right|step`; `/location/<p>/<r>/<c>/style/bgcolor <r> <g> <b>` or `<css color>`; `.../style/color` same; `.../style/text <text>`; `/custom-variable/<name>/value <value>`; `/surfaces/rescan`. Deprecated: `/press/bank/...`, `/style/...`, `/rescan 1`.
- Other listeners (TCP, UDP, RossTalk, Ember+, Artnet) exist; their pages were not read (see Gaps).

### REST API v2 (new in 5.1, disabled by default)
- Enable in Settings > Protocols > REST API. API keys are created there (Name + Scopes); the key is shown once only (Companion stores a hash); revoke with the bin; the table shows Last used.
- Base: `http://<host>:<admin port>/api/v2`; each area is versioned separately (`/surfaces/v1`, `/connections/v1`). Docs UI at `/api/v2/docs`, schema at `/api/v2/openapi.json`. Errors: `{ "error": { "code": "...", "message": "..." } }`. Success bodies are `{ "data": ... }` (lists add `meta: {total, limit, offset}`, limit 100 shown).
- Auth: `Authorization: Bearer <token>` (keys start `cpn_`). 401 = no/invalid key, 403 = missing scope.
- Scopes: `read` (GET), `write` (create/update/delete, implies read), `execute` (trigger actions/buttons, implies read), `connections` (must be combined with read or write), `admin` (all).
- Coverage so far (only these):
  - Surfaces (`/surfaces/v1`): `GET` list (read), `GET /{surfaceId}`, `PATCH /{surfaceId}` body `{"brightness": int %}` (write; brightness is the only changeable field). Fields: id, type, integrationType, name, displayName, isConnected, size{rows,columns}, brightness, page{id,number,name}, groupId.
  - Connections (`/connections/v1`, scope `connections` + read/write): `GET` list (`include_config`, `include_secrets` needs `include_config=true`), `POST` create (`moduleId`, `label` required; `versionId`, `updatePolicy`, `disabled` optional; queues module install if missing), `GET /tree` (collections hierarchy), `PATCH /move` (atomic `moves[]` of `{connectionId, collectionId, position}`), `GET/PATCH/DELETE /{connectionId}` (PATCH merges `label`, `disabled`, `config`, `secrets`, `updatePolicy`, `versionId`), `GET /{connectionId}/config-fields` (connection must be running), `POST /{connectionId}/restart` (fails if disabled).
  - NOT covered yet: buttons, pages, styles, actions, feedbacks, triggers, variables, import/export. For those use the HTTP API (press/style/custom variables) or the web UI.
- Prometheus metrics endpoint (5.1): separate, disabled by default, scrape token.

---

## 10. What changed

### 4.x context that still matters
- 4.0: modules became downloadable. 4.1: collections, local variables, expression variables, backup rules, while loop, step expression. 4.2: page access restrictions, `$(internal:tbar)` variables removed, new expression editor, local variables in step expressions. 4.3: surface modules, enable/disable surfaces, expressions in any action/feedback field (module opt-in), date functions, blink(), random-interval trigger event, HTTP connection endpoints.

### 5.0.0 (2026-07-12)
- Platform: macOS 13.5+ required; Windows ARM64; Linux install script/udev sync; Companion Pi config tool.
- Graphics overhaul: buttons = stack of elements (Group, Text, Image, Box, Line, Circle, Gauge, Reference, composites); Background is a Box; text font size split into Text Size + Shrink to fit; font selection; non-square drawing; lazy rendering of inactive pages; legacy button rotation removed. Feedbacks now override element properties; priority reversed (lower wins). Old feedbacks auto-converted.
- Image Library with `$(image:name)`.
- Advanced expressions: control flow, functions, array helpers, execution budget; parser change quirks (statement separators, same-line return, dot access works on objects).
- Variables: local variable of another button; Feedback-type locals from presets; actions that return a result stored in local/page/custom variable; fuzzy search in variables table; module variable updates capped at 50 Hz.
- Surfaces: brightness action and variable; enable/monitor remote surfaces; page number button goes to startup page; mDNS satellite ports; compressed images over Satellite; "never lock" reworked.
- Elgato plugin server REMOVED (use Satellite API).
- Secure by default: shell commands and remote module install disabled; cross-site, DNS-rebind and oversize-data protections.
- Editor: notes on buttons/triggers/expression variables, context menu on grid, one-click convert page buttons, status icon hiding option, configurable timezone.
- Deprecations: old "Button: set X" actions, "use another buttons style".

### 5.0.1 - 5.0.7 (fixes only)
- 5.0.1: negative rotation allowed, topbar fixes, shrink keeps first line. 5.0.2: element editor remembers selection, sunrise/sunset DST fix, emulator long presses. 5.0.3: gauge auto origin on negative ranges, many gauge/line/image-library fixes, CSS colour strings from modules, "layer" property group renamed to "drawing". 5.0.4: variable id format enforced, symlinked module dirs, gauge stop colours accept CSS strings, set-brightness of surface group fixed. 5.0.5: feedbacks/local variables in presets not updating, hidden elements not invalidated, variable name rule loosened. 5.0.6: surface module version change fix, local-variable set action UX. 5.0.7: layered presets losing feedbacks when overrides use plain values fixed; preset advanced-feedback overrides limited to affected properties.

### 5.1.0 (2026-10-11)
- Style editor: edit on preview (select/move/resize with snapping, toolbar), Pinned properties, aspect ratio previews, bold/italic/underline/strikethrough, box corner radius, smooth text shrink, gauge fill width and alpha, value feedbacks as style overrides with `$(this:value)`, expression value previews, rotatable composite elements.
- Linked presets (default), Button references, page variables (`$(page:name)`), reworked grid (select/multi/arrange/press tools; Shift-click press replaced by the Press tool), gauge on surface LEDs.
- REST API v2 (surfaces list/brightness, connections CRUD, API keys), Prometheus metrics.
- Expressions: maths and colour functions, `oscillate()`; trigger conditions re-evaluated on every firing (randomInt works); built-in conditions in Logic If/While evaluated when the action runs.
- Variables: `$(this:delta)` for rotary actions, `$(internal:date_monthname)`, connection collection status variables; collapsed locals show value.
- Actions/feedbacks: hold duration on "Button: Trigger press and release", "Surface: When connected" feedback.
- UI: resizable panels, configurable default export format, deprecated modules marked, millisecond log timestamps; `COMPANION_INSTALL_NAME` env var.

### 5.1.1 (2026-10-21), 5.1.2 (2026-11-04)
- 5.1.1: page variables offered in step-progression expressions; trigger local variable location defaults to `this`; isVisibleExpression on composite element options; references resolved for pushed-state feedback and internal step actions/feedbacks; emulator blanking on non-4x8 fixed; fallback font and Tamil font; USB-unavailable detection.
- 5.1.2: modules on API 1.15 allowed; composite element shows its source connection; UI keeps connection while backend is busy; local-variable reset on connection clear notifies dependents; only user-value locals override startup value; style overrides dropped when their connection stops; import performance; button drawing optimised; mobile UI/emulator cutoff fixed.

### Renamed / removed (summary)
- Single flat button style, per-button font-size dropdown, latch (-> steps), per-action delays (-> Wait action), bank-based API paths (-> `location`), `$(internal:custom_name)` (-> `$(custom:name)`), Elgato plugin server, `$(internal:tbar)`, Shift-click to press (-> Press tool), "use another buttons style" (-> Reference) are gone or deprecated.

---

## 11. Gaps
- Triggers page lists only three event types by name (plus sunrise/sunset only via release notes); the full event list, and the exact names/ids of internal actions and feedbacks (custom variable set, button trigger, surface page change, etc.), are not in the sources.
- No source defines the internal entity ids of "Logic: If statement" / "Logic: While loop" beyond their UI names; no separate "if/else feedback" entity is described.
- Hold/duration-group time unit and defaults are not stated (duration groups only described as having a time).
- Default Text Size value, default colours and default grid size are not stated.
- The docs for TCP/UDP, RossTalk, Ember+, Artnet and Prometheus were not requested/read; REST API pages for authentication/surfaces/connections were read, but only surfaces and connections exist in v2.
- No source for the on-disk or config-file format of buttons/styles; the REST API cannot create or style buttons in 5.1.
