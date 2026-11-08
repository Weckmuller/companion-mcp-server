# Internal entities (generated)

Generated from a live Companion with `node scripts/dump-internal-reference.mjs`. These are the ids to pass to the tools; option keys are what `options` objects accept. Module (connection) actions and feedbacks are looked up with `list_connection_definitions` instead.

## Trigger event types (`add_event` `eventType`)

| id | label | options |
|---|---|---|
| `interval` | Time Interval: Fixed | `seconds` (number: Interval (seconds)), default `10` |
| `intervalRandom` | Time Interval: Random | `minimum` (number: Minimum (seconds)), default `3`; `maximum` (number: Maximum (seconds)), default `10` |
| `timeofday` | Time of Day | `time` (internal:time: Time); `days` (multidropdown: Days) = `0` | `1` | `2` | `3` | `4` | `5` | `6`, default `[0,1,2,3,4,5,6]` |
| `specificDate` | Once on Specific Date & Time | `date` (internal:date: Date); `time` (internal:time: Time) |
| `sun_event` | On Sunrise/Sunset | `type` (dropdown: Sunrise / Sunset) = `sunrise` | `sunset`, default `"sunrise"`; `latitude` (number: Latitude), default `0`; `longitude` (number: Longitude), default `0`; `offset` (number: Offset (in min)), default `0` |
| `startup` | Startup | `delay` (number: Delay (milliseconds)), default `10000` |
| `client_connect` | Web client connect | `delay` (number: Delay (milliseconds)), default `0` |
| `button_press` | On any button press | — |
| `button_release` | On any button release | — |
| `condition_true` | On condition becoming true | — |
| `condition_false` | On condition becoming false | — |
| `variable_changed` | On variable change | `variableId` (internal:variable: Variable to watch) |
| `computer_locked` | On computer becoming locked | — |
| `computer_unlocked` | On computer becoming unlocked | — |

## Internal actions (connectionId `internal`)

### `action_group` — Action Group
Execute a group of actions
_has child action groups_
- `execution_mode` (dropdown: Execution mode) = `inherit` | `concurrent` | `sequential`, default `"inherit"`

### `action_recorder_discard_actions` — Action Recorder: Discard actions
_has child action groups_

### `action_recorder_save_to_button` — Action Recorder: Finish recording and save to button
_has child action groups_
- `page` (textinput: Page), default `"0"`
- `bank` (textinput: Button), default `"0"`
- `step` (textinput: Button Step), default `"1"`
- `set` (textinput: Action Group), default `"press"`
- `mode` (dropdown: Mode) = `replace` | `append`, default `"replace"`

### `action_recorder_set_connections` — Action Recorder: Set connections
_has child action groups_
- `mode` (dropdown: Mode) = `set` | `add` | `remove` | `toggle`, default `"set"`
- `connections` (internal:connection_id: Connections), default `[]`

### `action_recorder_set_recording` — Action Recorder: Set recording
_has child action groups_
- `enable` (dropdown: Enable) = `toggle` | `true` | `false`, default `"true"`

### `panic` — Actions: Abort all button and trigger runs
_has child action groups_
- `ignoreCurrent` (checkbox: Ignore current run), default `true`

### `panic_page` — Actions: Abort all button runs on a page
_has child action groups_
- `page` (internal:page: Page), default `0`
- `ignoreSelf` (checkbox: Except this button), default `false`
- `ignoreCurrent` (checkbox: Ignore current run), default `true`

### `panic_bank` — Actions: Abort button runs
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `unlatch` (checkbox: Skip release actions?), default `false`

### `panic_trigger` — Actions: Abort trigger runs
_has child action groups_
- `trigger_id` (internal:trigger: Trigger), default `"self"`

### `bgcolor` — Button: Set background color (Deprecated)
Avoid this if you can. It's better to dynamically change the color with a feedback
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `color` (colorpicker: Background Color), default `"0x000000"`

### `bank_current_step` — Button: Set current step
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `step` (textinput: Button Step), default `"1"`

### `button_text` — Button: Set text (Deprecated)
Avoid this if you can. It's better to either set the text to a custom variable, or to use a feedback to dynamically override the text
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `label` (textinput: Button Text)

### `textcolor` — Button: Set text color (Deprecated)
Avoid this if you can. It's better to dynamically change the color with a feedback
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `color` (colorpicker: Text Color), default `"0x000000"`

### `bank_current_step_delta` — Button: Skip step
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `amount` (number: Amount), default `1`

### `button_press` — Button: Trigger press
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `force` (checkbox: Force press if already pressed), default `false`

### `button_pressrelease` — Button: Trigger press and release
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `force` (checkbox: Force press if already pressed), default `false`
- `duration` (number: Hold duration (ms)), default `0`

### `button_release` — Button: Trigger release
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `force` (checkbox: Force release even if currently pressed), default `false`

### `button_rotate` — Button: Trigger rotate
Make sure to enable rotary actions for the specified button
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `delta` (number: Amount), default `1`

### `instance_control` — Connection: Enable or disable connection
_has child action groups_
- `instance_id` (internal:connection_id: Connection)
- `enable` (dropdown: Enable) = `toggle` | `true` | `false`, default `"toggle"`

### `connection_collection_enabled` — Connection: Enable or disable connection collection
_has child action groups_
- `collection_id` (internal:connection_collection: Collection)
- `enable` (dropdown: Enable) = `toggle` | `true` | `false`, default `"toggle"`

### `custom_variable_reset_to_default` — Custom Variable: Reset to startup value
_has child action groups_
- `name` (internal:custom_variable: Custom variable)

### `custom_variable_set_value` — Custom Variable: Set value
_has child action groups_
- `name` (internal:custom_variable: Custom variable)
- `create` (checkbox: Create if not exists), default `false`
- `value` (textinput: Value)

### `custom_variable_sync_to_default` — Custom Variable: Write current value to startup value
_has child action groups_
- `name` (internal:custom_variable: Custom variable)

### `local_variable_reset_to_default` — Local Variable: Reset to startup value
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `name` (textinput: Local variable)

### `local_variable_set_value` — Local Variable: Set value
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `name` (textinput: Local variable)
- `value` (textinput: Value)

### `local_variable_sync_to_default` — Local Variable: Write current value to startup value
_has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `name` (textinput: Local variable)

### `logic_if` — Logic: If statement
Execute some actions if all of the configured conditions are true
_has child action groups_

### `logic_while` — Logic: While loop
Execute some actions repeatedly while all of the configured conditions are true
_has child action groups_

### `page_variable_reset_to_default` — Page Variable: Reset to startup value
_has child action groups_
- `page` (internal:page: Page), default `0`
- `name` (textinput: Page variable)

### `page_variable_set_value` — Page Variable: Set value
_has child action groups_
- `page` (internal:page: Page), default `0`
- `name` (textinput: Page variable)
- `value` (textinput: Value)

### `page_variable_sync_to_default` — Page Variable: Write current value to startup value
_has child action groups_
- `page` (internal:page: Page), default `0`
- `name` (textinput: Page variable)

### `outbound_surface_set_enabled` — Remote surface: Enable/Disable
_has child action groups_
- `surfaceId` (internal:outbound_surface_id: Remote surface)
- `setType` (dropdown: Enable) = `enable` | `disable` | `toggle`, default `"toggle"`

### `adjust_brightness` — Surface: Adjust brightness
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`
- `brightness` (number: Brightness adjustment), default `0`

### `surface_adjust_position` — Surface: Adjust offset
Adjust the offset of a surface relative to the button grid by a relative amount
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`
- `x_adjustment` (number: Horizontal Offset Adjustment), default `0`
- `y_adjustment` (number: Vertical Offset Adjustment), default `0`

### `dec_page` — Surface: Decrement page number
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`

### `inc_page` — Surface: Increment page number
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`

### `lockout_all` — Surface: Lockout all immediately.
This requires the `PIN Lockout` setting to be enabled and configured
_has child action groups_

### `lockout_device` — Surface: Lockout specified surface immediately.
This requires the `PIN Lockout` setting to be enabled and configured
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`

### `rescan` — Surface: Rescan USB for devices
_has child action groups_

### `set_page_byindex` — Surface: Set by index to page
_has child action groups_
- `surfaceIndex` (number: Surface / group index), default `0`
- `page` (internal:page: Page), default `0`

### `surface_set_position` — Surface: Set offset
Set the absolute offset of a surface relative to the button grid
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`
- `x_offset` (number: Horizontal Offset), default `0`
- `y_offset` (number: Vertical Offset), default `0`

### `set_brightness` — Surface: Set to brightness
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`
- `brightness` (number: Brightness), default `100`

### `set_page` — Surface: Set to page
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`
- `page` (internal:page: Page), default `0`

### `unlockout_all` — Surface: Unlock all immediately.
This requires the `PIN Lockout` setting to be enabled and configured
_has child action groups_

### `unlockout_device` — Surface: Unlock specified surface immediately.
This requires the `PIN Lockout` setting to be enabled and configured
_has child action groups_
- `surfaceId` (internal:surface_serial: Surface / group), default `"self"`

### `app_exit` — System: Exit companion
_has child action groups_

### `app_restart` — System: Restart companion
_has child action groups_

### `exec` — System: Run shell command (local)
_has child action groups_
- `path` (textinput: Command)
- `cwd` (textinput: Working Directory)
- `timeout` (number: Timeout (ms, between 500 and 20000)), default `5000`
- `targetVariable` (internal:custom_variable: Target Variable (stdout))

### `trigger_enabled` — Trigger: Enable or disable trigger
_has child action groups_
- `trigger_id` (internal:trigger: Trigger)
- `enable` (dropdown: Enable) = `toggle` | `true` | `false`, default `"toggle"`

### `trigger_collection_enabled` — Trigger: Enable or disable trigger collection
_has child action groups_
- `collection_id` (internal:trigger_collection: Collection)
- `enable` (dropdown: Enable) = `toggle` | `true` | `false`, default `"toggle"`

### `wait` — Wait
Wait for a specified amount of time
_has child action groups_
- `time` (expression: Time expression (ms)), default `"1000"`

### `custom_log` — Write to companion log
_has child action groups_
- `message` (textinput: Message)


## Internal feedbacks (connectionId `internal`)

### `action_recorder_check_connections` — Action Recorder: Check if specified connections are selected
_type: boolean, has child action groups, invertible_
- `connections` (internal:connection_id: Connections), default `[]`
- `mode` (dropdown: Mode) = `any` | `all`, default `"any"`
- `state` (dropdown: State) = `recording` | `selected`, default `"recording"`

### `bank_current_step` — Button: Check step
Change style based on the current step of a button
_type: boolean, has child action groups, invertible_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `step` (number: Step), default `1`

### `bank_style` — Button: Use another buttons legacy style (Deprecated)
Since 5.0 this is no longer capable of replicating the full style of a button. Instead you should add a reference element in the Style tab.
_type: advanced, has child action groups_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`

### `bank_pushed` — Button: When pushed
Change style when a button is being pressed
_type: boolean, has child action groups, invertible_
- `location` (textinput: Location), default `"$(this:page)/$(this:row)/$(this:column)"`
- `latch_compatability` (checkbox: Treat stepped as pressed? (latch compatibility)), default `false`

### `logic_conditionalise_advanced` — Conditionalise existing feedbacks
Make 'advanced' feedbacks conditional
_type: advanced, has child action groups_

### `instance_status` — Connection: Check Status
Change button color on Connection Status
Disabled color is not used when "All" connections is selected
_type: advanced, has child action groups_
- `instance_id` (internal:connection_id: Connection or All)
- `ok_fg` (colorpicker: OK foreground color), default `16777215`
- `ok_bg` (colorpicker: OK background color), default `51200`
- `warning_fg` (colorpicker: Warning foreground color), default `0`
- `warning_bg` (colorpicker: Warning background color), default `16776960`
- `error_fg` (colorpicker: Error foreground color), default `16777215`
- `error_bg` (colorpicker: Error background color), default `13107200`
- `disabled_fg` (colorpicker: Disabled foreground color), default `10066329`
- `disabled_bg` (colorpicker: Disabled background color), default `4210752`

### `connection_collection_enabled` — Connection: When collection enabled or disabled
_type: boolean, has child action groups, invertible_
- `collection_id` (internal:connection_collection: Collection)
- `enable` (dropdown: Enable) = `true` | `false`, default `"true"`

### `instance_custom_state` — Connection: When matches specified status
Change style when a connection matches the specified status
_type: boolean, has child action groups, invertible_
- `instance_id` (internal:connection_id: Connection)
- `state` (dropdown: State) = `good` | `warning` | `error` | `null`, default `"good"`

### `expression_value` — Evaluate Expression
A dynamic expression that can be used in other fields
_type: value, has child action groups_
- `expression` (expression: Expression), default `"2 > 1"`

### `logic_operator` — Logic: Operation
Combine multiple conditions
_type: boolean, has child action groups, invertible_
- `operation` (dropdown: Operation) = `and` | `or` | `xor`, default `"and"`

### `outbound_surface_enabled` — Remote surface: When enabled
Change style when a remote surface is enabled
_type: boolean, has child action groups, invertible_
- `surfaceId` (internal:outbound_surface_id: Remote surface)

### `surface_connected` — Surface: When connected
Change style when a surface is connected
_type: boolean, has child action groups, invertible_
- `surfaceId` (internal:surface_serial: Surface)

### `surface_on_page` — Surface: When on the selected page
Change style when a surface is on the selected page
_type: boolean, has child action groups, invertible_
- `surfaceId` (internal:surface_serial: Surface / group)
- `page` (internal:page: Page), default `0`

### `trigger_collection_enabled` — Trigger: When collection enabled or disabled
_type: boolean, has child action groups, invertible_
- `collection_id` (internal:trigger_collection: Collection)
- `enable` (dropdown: Enable) = `true` | `false`, default `"true"`

### `trigger_enabled` — Trigger: When enabled or disabled
_type: boolean, has child action groups, invertible_
- `trigger_id` (internal:trigger: Trigger)
- `enable` (dropdown: Enable) = `true` | `false`, default `"true"`

### `user_value` — User Value
A value that can be used in other fields
_type: value, has child action groups_
- `persist_value` (checkbox: Persist value), default `false`
- `startup_value` (internal:variable_value: Startup Value), default `"1"`

### `check_expression` — Variable: Check boolean expression
Change style based on a boolean expression
_type: boolean, has child action groups, invertible_
- `expression` (expression: Expression), default `"2 > 1"`

### `variable_value` — Variable: Check value
Change style based on the value of a variable
_type: boolean, has child action groups, invertible_
- `variable` (internal:variable: Variable)
- `op` (dropdown: Operation) = `eq` | `ne` | `gt` | `lt`, default `"eq"`
- `value` (textinput: Value)

### `variable_variable` — Variable: Compare two variables
Change style based on a variable compared to another variable
_type: boolean, has child action groups, invertible_
- `variable` (internal:variable: Compare Variable)
- `op` (dropdown: Operation) = `eq` | `ne` | `gt` | `lt`, default `"eq"`
- `variable2` (internal:variable: Against Variable)

