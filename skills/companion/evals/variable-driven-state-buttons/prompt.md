---
tags: [companion]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

Create a custom variable called show_state with default IDLE. Then on a new scratch page named scratch-state at the end, put a button at row 1 column 0 whose text shows the current value of that variable and whose background turns green (and is dark grey otherwise) when the value is LIVE, and a button at row 1 column 1 labelled GO LIVE that sets the variable to LIVE. Don't press anything. Tell me what you made.
