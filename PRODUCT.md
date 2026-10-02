# MG400 virtual training simulator

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Students new to Lua, Python and the MG400, including junior students learning pick-and-place. Traditional Chinese is the default; English remains available.

## Product Purpose
Teach programming and robot motion through a browser simulation with visible results. Success means a newcomer can identify the next action, complete a first program and progress to pick-and-place.

## Capabilities
React/TypeScript, Three.js MG400 URDF, local Lua/Python execution, teach/jog/Go-to, relative movement, passive fork/Body1 and magnet modes, tower and sorting missions, free object placement, course progress and optional BYOK code coaching. Body1/fork assets are bundled. Existing private user code and custom scene configurations must be protected during task changes.

## Constraints
No hardware connection, physical telemetry, general STL contact physics or arbitrary Dobot API compatibility. Python is simulator-only. The documented joint/TCP/contact logic must remain unchanged. Source and release provenance remain in docs/model-provenance.md.

## Confirmed brief
The user explicitly rejected the dense interface and asked for a complete UI refactor: users cannot tell what to do. Earlier instructions authorize autonomous routine decisions, public GitHub/Vercel delivery, larger text, Traditional Chinese default, free placement and fewer subagents.

## Operating assumptions
Classroom desktop/laptop use is primary; mobile web must remain usable. A guided first-use path and separately accessible expert tools are implementation decisions inferred from the confirmed brief, not claims from user interviews.
