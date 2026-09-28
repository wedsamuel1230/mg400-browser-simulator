# DobotStudio Pro 2.8 training compatibility

This app supports a documented educational subset. It does not promise VM identity or arbitrary script compatibility. The bundled runtime is isolated in a terminable browser worker; unsupported system, filesystem, network and hardware APIs are unavailable.

## Verified from DobotStudio Pro User Guide V2.8.0 (2024-02-26)

- `MovJ(P, options)`: Cartesian target, joint point-to-point motion; TCP path is not linear.
- `MovL(P, options)`: Cartesian linear motion.
- `JointMovJ(P, options)`: joint-angle target.
- These motion commands default to `SYNC=0` (asynchronous); `SYNC=1` waits for completion.
- `Sync()` blocks the program until queued commands complete.
- `Sleep(time)` delays the next command; `Wait(time)` delays motion delivery or delays the next command until the current motion completes. Both use milliseconds.
- `GetPose()` returns current Cartesian posture; `GetAngle()` returns joint posture.
- Motion-command `SpeedJ`/`SpeedL` and `AccJ`/`AccL` options accept 1–100. The separate setter commands accept 0–100. This app labels all motion timing as simulated.
- `CP` is documented as 0–100 and shown as 1 by default. V1 only accepts explicit `CP=0`; nonzero continuous-path blending is rejected. Omitted `CP` uses simulator CP=0 with a visible warning, so examples set `CP=0`.
- `Wait(time)` waits for queued motion to finish, then delays delivery of the next command; `Sleep(time)` delays the program while already queued motion may continue. Both use milliseconds.
- `DO(index,status)` is virtual simulator IO. In this reference cell, only `DO(1, ON)` (attach block) and `DO(1, OFF)` (release block) are mapped to the logical pickup tool. This is not a hardware port mapping.

## `RelMovL` verified in DobotStudio Pro V2.8.0

- The official MG400/M1 Pro guide documents `RelMovL({OffsetX, OffsetY, OffsetZ, OffsetR}, {CP=1, SpeedL=50, AccL=20, SYNC=0})` on page 172. It describes a straight-line move from the current position to the Cartesian offset position; X/Y/Z offsets are millimetres and R is degrees. `SYNC=0` is asynchronous and `SYNC=1` waits for motion completion.
- Native Lua examples use a four-value positional table, such as `RelMovL({0, 0, 20, 0}, {CP=0, SpeedL=50, AccL=20})`. This simulator also accepts named fields as a convenience extension, but those are not used in the documented Dobot-compatible examples.
- The simulator evaluates the relative target when the queued motion starts, adding the offsets to its current TCP pose in the base Cartesian frame, then uses its straight-line interpolation and workspace/IK checks. This matches the guide's relative Cartesian linear-motion description for the simulator's modeled frame; user/tool coordinate systems are not implemented.
- The simulator accepts only `CP=0`; the guide documents `CP=0..100` and a default of 1. `SpeedL`, `AccL`, and `SYNC=0/1` are supported within the documented ranges. Timing remains simulated, and no physical controller/firmware execution has been tested.
- Automated regression coverage checks relative-pose resolution and generated Lua examples; browser smoke verification checks that the native tuple is accepted by the Lua worker and completes through the simulation scheduler.

The searchable text of the official V2.8.0 guide does not establish the exact embedded Lua VM build. The official MG400 product page lists a 2021 Lua Syntax Guide, the V2.8.0 user guide, and DobotStudio Pro 2.8.3 (2024), but the official `download.dobot.cc` host returned HTTP 403 for the Lua guide and installer in this environment. Runtime-specific or version-identical compatibility is therefore not claimed.

## User-visible joint limits

Use the versioned MG400 User Guide V1.7 (2023-11-16), not the URDF limit fields: J1 ±160°, J2 −25° to +85°, J3 −25° to +105°, J4 ±360°. These are simulator constraints and not a robot safety system.

## Explicitly unsupported in V1

Continuous-path blending (`CP>0`), arc/circle/jump motion, IO-triggered motion, Modbus, sockets, filesystem, operating-system execution, real robot IO, real hardware connection, and selectable tool/user coordinate systems. `RelMovL` is supported only with the bounded base-frame semantics described above. Unsupported commands or options should produce a visible diagnostic.

## Sources

- DobotStudio Pro User Guide V2.8.0 (SHA256 `4679ecfaf5fa454c5d6ceafa9642ec4c57dccff957b1b5d00ca7cac510b04410`): https://download.dobot.cc/2024/04/DobotStudio%20Pro%20User%20Guide%20%28MG400%26M1%20Pro%29%20V2.8.0_20240226_en.pdf — `RelMovL` p. 172; other motion semantics pp. 156–159, Sync p. 165, setter ranges pp. 166–168, GetPose/GetAngle pp. 168–169, Sleep/Wait pp. 189–190.
- MG400 User Guide V1.7: https://download.dobot.cc/DobotStudio-pro/20231116/Dobot%20MG400%20User%20Guide%20V1.7_20231116_en.pdf.
- Current official product data: https://www.dobot-robots.com/products/desktop-four-axis/mg400.html.
