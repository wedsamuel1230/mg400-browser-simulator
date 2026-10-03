# MG400 Virtual Training Simulator

Licensed source: [MIT](LICENSE). The bundled Dobot MG400 visual model has its own preserved MIT notice; see [third-party notices](docs/third-party-notices.md).

A local browser training simulator for one Dobot MG400 pick-and-place cell. It loads vendor visual geometry, calculates four-axis forward/inverse kinematics, teaches named targets, and executes a bounded DobotStudio Pro 2.8 Lua subset in an isolated Web Worker.

The bundled MG400 URDF uses white visual materials. The colored link palette in `src/sim/modelPalette.ts` is a project-authored teaching visualization to make link groups easier to distinguish; it does not represent verified Dobot factory colors. See [model provenance](docs/model-provenance.md).

## Start locally

Requirements: Node.js 20.19+ (or 22.12+) and npm. From this directory:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). After dependencies are installed, model meshes, Monaco Editor and the Lua WebAssembly runtime are served by the local app; runtime use does not call cloud services or fetch remote fonts.

## Use the simulator

1. Edit the Lua program or select a point in **Teach points**.
2. Use **Jog** for Cartesian or joint increments. Select **Teach current pose** to save the current TCP position, or use the plus button to save current joint angles.
3. Edit the selected point numerically and choose **Go to** to place the simulated robot there.
4. Use **Teach pick pair** or **Teach place pair** to add surface and approach targets at the configured cell positions. **Tool & pickup** lets you change flange/TCP offsets, pickup tolerance, and block/drop coordinates.
5. Press **Run program** or `⌘/Ctrl + Enter`. Pause, resume, stop, and reset are available in the command bar.
6. Export a project JSON for backup or import a previously exported, validated project. The current project is also saved in this browser's local storage.

Fresh exercises use a shared teaching platform in front of the robot with its top at Z110 mm. Magnet mode uses marked 35 × 35 × 4 mm plates (centre Z112, top contact Z114) and virtual `DO(1, ON/OFF)` to attach/release. Fork mode automatically loads the supplied 40 × 40 × 40 mm Body1 grooved block and passive printed fork. Its 20 mm support pads sit on the platform: bottom Z130, insertion TCP Z152.5, load/release Z155. Fork mode does not use `DO`, `Pick()`, or `Place()`. Both modes use logical contact rules rather than contact physics. The workspace, editor and 3D view support a saved light/dark preference. Legacy custom projects retain their measured points and heights; prepare a fresh practice to use the new platform.

## AI coding coach

The optional coach can review code and explain a program. The **If / else** and **Loops** shortcuts open separate, focused free bilingual lessons directly, without an API key. To ask the live coach, expand **Connect AI for custom help** and enter an API key, a provider's full OpenAI-compatible **Chat Completions** URL ending in `/chat/completions`, and its model ID. The default URL is OpenRouter and the initial model is `stealth/space-bunny-alpha`; OpenRouter requests include its `reasoning_effort: low` option, while custom providers receive the standard request fields only. Providers must allow browser CORS. Provider model availability and pricing vary.

The key stays in the current page's memory and is sent directly from the browser to the configured provider; the app does not store it, and clearing it or refreshing the page removes it. Only use a provider you trust: it receives your question and may process or retain submitted data under its own policy, and may charge your account. OpenRouter says the third-party provider for Space Bunny Alpha may retain prompts and replies, so students should avoid names and personal details ([model data terms](https://openrouter.ai/stealth/space-bunny-alpha)). **Share current program, saved point names, setup checks, and recent run log** is off by default. Turn it on to send that context; run logs may contain text printed by the program. A run log is included only while the current project matches the state that ran, including its program, language, saved points, cell, and tool settings. With sharing off, program, saved point names, setup checks, run log, and earlier code-sharing exchanges are omitted. Recent chat messages stay in page memory until cleared or refreshed. The coach gives advisory explanations and examples, but does not edit or run student code. Every fenced Lua and Python example is checked according to its declared language in a separate Web Worker (Wasmoon for Lua and Pyodide's `ast.parse` for Python). Unsupported languages, syntax errors, common unsupported robot-style calls, and passive-fork `DO`/`Pick`/`Place` calls are withheld. Inline Lua checks also flag quoted point names or raw numeric motion coordinates, incorrectly cased motion option keys, and `RelMovL` tables missing X/Y/Z. When project sharing is enabled, direct named motion targets are also checked against shared point names and Cartesian/joint types; with sharing off, the reply labels point names as unchecked. Each code suggestion shows separate local-check labels for syntax, robot API names, saved points, reachability, whether the app ran the code, and—when using the fork—whether the approach/slide/lift/lower sequence was checked. These checks never execute the example and do not verify local values hidden behind variables, arbitrary function semantics, reachability, path collisions, timing, or complete program behavior. Students decide whether to copy or run suggestions and inspect the simulator's setup checks and run result; those are simulation evidence, not proof about a physical robot. AI advice is secondary and cannot override simulator errors.

## Supported Lua subset

The API is deliberately bounded and does not claim to be the same Lua VM as DobotStudio Pro. The embedded VM version was not established in the user guide. A worker can be terminated by **Stop**, including when a script is stuck in a loop.

```lua
JointMovJ(Home, {CP=0})
MovJ(PickApproach, {CP=0})
MovL(PickPoint, {CP=0})
DO(1, ON)
Wait(150)
MovL(PickApproach, {CP=0})
MovJ(PlaceApproach, {CP=0})
MovL(PlacePoint, {CP=0})
DO(1, OFF)
Sync()
```

With **Fork pickup** selected, the reference script instead uses the passive lift sequence and contains no DO command:

```lua
MovJ(PickApproach, {CP=0})
MovL(PickPoint, {CP=0}) -- slide under the raised block
RelMovL({0, 0, 80, 0}, {CP=0}) -- X, Y, Z mm; R degrees; lift to pick
MovJ(PlaceApproach, {CP=0})
MovL(PlacePoint, {CP=0}) -- lower onto the support pads to release
```

Lua control-flow basics use `then`, `do`, and `end`; equality is `==` and inequality is `~=`. Start with finite, print-only loops before adding robot moves:

```lua
local step = 2
if step == 1 then
  print("start")
elseif step == 2 then
  print("practice")
else
  print("check the step")
end

for count = 1, 3 do
  print("try", count)
end
```

Implemented commands: `MovJ`, `MovL`, `RelMovL`, `JointMovJ`, `DO`, `Sync`, `Wait`, `Sleep`, `GetPose`, `GetAngle`, `SpeedJ`, `SpeedL`, `AccJ`, `AccL`, `Pick`, `Place`, and `print`.

- Cartesian coordinates use millimetres and degrees. Joint points use radians, matching the guide's example.
- The DobotStudio Pro 2.8.0 MG400 guide documents `RelMovL({OffsetX, OffsetY, OffsetZ, OffsetR}, options)`; Lua examples use the four-value table in X, Y, Z, R order. This simulator resolves it in its base Cartesian frame when the queued motion starts. User/tool coordinate frames and continuous-path blending are not simulated.
- Motion options accept `CP=0`, speed and acceleration ratios from 1–100, and `SYNC=0/1`. Omitted `CP` produces a warning and uses simulator `CP=0`; nonzero blending is rejected.
- The separate `SpeedJ`/`SpeedL`/`AccJ`/`AccL` setting commands accept 0–100.
- `Wait(ms)` waits for queued motion to finish and delays the next command. `Sleep(ms)` delays the program while queued motion may continue. Both are affected by simulator time scale.
- In Magnet mode, `DO(1, ON/OFF)` controls the reference block. In Fork mode, `DO` is not needed: pick and place are recognized from passive insertion/lift and lowering onto the support pads. Other DO indexes are shown as virtual outputs only; none map to hardware.
- Unsupported options, unreachable targets, out-of-limit joint targets, and failed pickup/place commands appear in the run log.

The exact command subset and known differences are recorded in [`docs/dobotstudio-pro-28-subset.md`](docs/dobotstudio-pro-28-subset.md).

The evidence-backed delivery status is in [`docs/delivery-status.md`](docs/delivery-status.md). Wayfinder planning files remain local release engineering records and are excluded from the public source tree.

Learner and classroom instructions are available in the bilingual [student guide](docs/student-guide.md) and [instructor guide](docs/instructor-guide.md).

## Model, licensing and fidelity

The app bundles the MIT-licensed Dobot MG400 ROS URDF and nine STL visual meshes. Source revision, attribution, and local CAD-file handling are documented in [`docs/model-provenance.md`](docs/model-provenance.md). The owner's Creo archive and flange STEP stay outside this project because they are not browser-ready and redistribution terms were not established.

The owner-supplied `/Users/wed/Downloads/Block.stl` is the printed fork tool, and `/Users/wed/Downloads/magnet.stl` is the magnetic tool. Matching evidence copies remain under `.scratch/issue23-local-tools/`; the public build uses a generic fallback or client-only learner import. Their mesh hashes and measured bounds, the flange mounting datum, and the remaining CAD/physical verification limits are documented in [`docs/model-provenance.md`](docs/model-provenance.md). The files remain local because redistribution rights are unknown; see the [`public-release-checklist.md`](docs/public-release-checklist.md) and [`third-party-notices.md`](docs/third-party-notices.md) release gates. Robot timing is simulated; acceleration ratios change simulated duration, not real dynamics. There is no physics engine, safety-rated collision detection, physical calibration, hardware connection, telemetry, or robot command path.

Joint limits are sourced from Dobot MG400 User Guide V1.7 and intentionally override conflicting URDF limit fields. The rendering and kinematic reference vector are based on the vendor URDF; verify tool offsets and cell placement against the physical setup before using coordinates for real equipment.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run release:check
```
