# MG400 model provenance

**Current packaging (2026-10-02):** the supplied Body1 and passive fork load by default. See the final section and `public/models/tools/README.md`. Earlier local-only tool decisions below are historical; the magnetic tool is also bundled following the maintainer’s explicit request on 2026-10-03; proprietary CAD remains local.

## Browser-ready model

- Source repository: https://github.com/Dobot-Arm/MG400_ROS
- Pinned source revision: `2bcf6a988311096a6096a2dc4de60dc76f72e80e`
- Files bundled in `public/models/mg400/mg400_description/`: URDF and nine STL meshes.
- License: MIT, copyright (c) 2022 Dobot. The original `LICENSE` file is preserved beside the model.
- The model supplies visual link geometry, axes/origins and mimic-joint relationships. Its URDF joint limits are not used as product limits because they conflict with Dobot’s versioned user guide/product data.
- The pinned URDF assigns white visual materials to the robot links. The colors in `src/sim/modelPalette.ts` are project-authored teaching-visualization overlays used to distinguish link groups; they are not sourced from Dobot and do not claim factory-color fidelity.

## Published joint ranges and source URDF ranges

The top-level URDF motion joints use wider or narrower ranges than the versioned MG400 product limits. URDF radians are converted to degrees and rounded to two decimal places here; the regression test reads the same four source joints from the pinned file.

| Axis | URDF joint | Pinned URDF range | MG400 User Guide V1.7 product range |
|---|---|---:|---:|
| J1 | `j1` | −179.91° to +179.91° | −160° to +160° |
| J2 | `j2` | −8.02° to +79.64° | −25° to +85° |
| J3 | `j3` | 0° to +79.64° | −25° to +105° |
| J4 | `j4` | −179.91° to +179.91° | −360° to +360° |

The simulator enforces the product ranges in `src/domain.ts` for teach controls and IK. The URDF ranges remain source data for the robot chain's visual geometry, joint axes/origins and mimic relationships; the rendered robot ignores the URDF limit fields so its links follow the simulator's constrained joint state. The selected product profile is documented in the [MG400 User Guide V1.7](https://download.dobot.cc/DobotStudio-pro/20231116/Dobot%20MG400%20User%20Guide%20V1.7_20231116_en.pdf). These software limits are not a physical safety system or a robot calibration result.

## Owner-local official CAD files

These are retained in `/Users/wed/Downloads` and are not copied into this app because they use Creo proprietary formats and their redistribution terms are not established:

- `MG400 Model (Creo4.0)-20210406.zip`
- `MG400_End_Flange_3D.stp`

macOS download metadata for both records the official Dobot domain `https://www.dobot-robots.com/`. Their SHA256 checksums are recorded in the run baseline at `/Users/wed/.codex/workflows/01a0de91-015a-76e3-8be3-cc6c203d515b/baseline.md`.

## Tool model and TCP

The project maintainer supplied these meshes from `/Users/wed/Downloads` and explicitly requested their default inclusion in the public project on 2026-10-02 and 2026-10-03. The bundled copies are byte-identical to the recorded sources:

| Role | Owner source | App copy | SHA256 | Measured source bounds (mm) |
|---|---|---|---|---|
| Body1 grooved fork workpiece | `Body1.stl` | `public/models/tools/Body1.stl` | `b6a56256947fcc2dac165ba56d34d5c418bd5eaed248ac49ac7b83268491a185` | 40 × 40 × 40; grooves at Z15–25 |
| Passive printed fork | `Block.stl` | `public/models/tools/Block.stl` | `bc4b6488f05fc8649bb874b63ed0ec8d45149e307a40be27b1a8c1e5f767a325` | X −20..20, Y −82.3112..15.2751, Z 4.7346..9.7346 |
| Magnetic end effector | `magnet.stl` | `public/models/tools/magnet.stl` | `6eb33378ef210da42458c57c86b09be94a82c296d4623a4e40c014754c342f06` | X −20..20, Y −84.6982..15.2751, Z 4.7346..9.7346 |

The maintainer's explicit instruction authorizes these exact supplied files for this project; it is not an upstream license or independent proof of authorship or ownership. These three meshes are not covered by the root MIT license, and no general downstream reuse license is asserted. `npm run release:check` validates only their approved hashes and packaging boundaries; it does not verify legal ownership. The UI names the roles as Body1 grooved block, passive fork, and magnetic end effector; the models load by default from same-origin static assets. Both tools use millimetre scale, flange mounting datum `(0, −4.711512, 9.734621) mm`, working direction local `+X`, flange `Z=0`, and the active TCP offset. Optional STL imports stay in page memory and are not uploaded or included in project export.

The hashes, transform math, scene attachment path, and browser placement are checked. A fresh STEP-topology/mating-face recheck was not possible because a CAD geometry kernel is unavailable. No physical robot/tool fit or TCP calibration was performed.

## Issue 23 release-rights audit (2026-09-29)

The 2026-09-29 audit found no upstream author record, license file, or reliable source URL for the fork and magnet. The filename and geometry do not establish Dobot authorship, and no Dobot contact was made because the available source evidence does not identify Dobot as the rights holder. On 2026-10-02/03 the project maintainer explicitly instructed that the exact Body1, fork, and magnet files be included in this public project. The project records that authorization without treating it as an open-source license or independent proof of ownership.

The vendor model is a separate releasable asset set: its pinned revision, URDF hash (`d8ab4d690d0eef6232dd5d34f5a3a54bf0f2ead94aad6540ddbe06fb3628084b`), and preserved MIT notice are recorded above. `public/favicon.svg` is a small project-authored generic mark; no Dobot logo file is bundled. Product names such as “Dobot MG400” are descriptive references to the simulator target and do not grant trademark rights.

**Historical exclusion decision (superseded by the maintainer's 2026-10-02/03 project instructions):** the 2026-09-29 public-safe build excluded the fork and magnet meshes and used a generic placeholder or client-only import. The public project now includes only the exact maintainer-supplied hashes listed above. This documents the requested packaging scope; it does not assign the files an MIT or other reusable license. If the maintainer withdraws authorization or reliable evidence identifies a conflicting rights holder, review the affected public assets before the next release.

The project contains no `.env` file. A source scan excluding dependencies, generated build output, scratch evidence, and local runtime bundles found only runtime key-handling code, documentation, and test placeholders; no embedded production credential was found. `OPENROUTER_API_KEY` is read from the server environment only when configured and is not bundled by Vite. The root `.gitignore` excludes local `.env` files while allowing a future `.env.example`.

## Local Body1 fork contact profile

The browser offers an explicit **Body1 槽積木** calibration after importing a local workpiece and fork mesh. This is a user selection for the measured owner-local Body1 geometry, not filename detection or analysis of arbitrary STL files. Body1 is 40×40×40 mm with grooves along local Y, at local Z15..25; the imported fork plate is 5 mm thick. At the simulator's resting bottom Z20, insertion TCP Z42.5 leaves 2.5 mm clearance above and below the plate. Load and release use TCP Z45, with the attached workpiece bottom at TCP Z−25.

Auto-teaching aligns the fork at workpiece R−90°. The Lua and Python examples release at Z45, lower to Z42.5, withdraw 60 mm along tool −X, then lift. Attachment requires aligned forward insertion and lift; release stays unarmed until withdrawal. Cell identity, position and world yaw are retained across attachment and release. The generic reference profile retains Z20 and uses pickup R−90° / placement R+90° at the default cell; magnetic mode retains the 15 mm reference block and top contact.

Optional custom imports and calibration selection are page-session data. Replacing either a custom fork or workpiece resets the profile. Calibration applies only to the first non-puck cell workpiece; other cells retain generic contact. Project import resets custom calibration; reopening requires reimporting local meshes, reselecting the profile, and re-teaching the points. The bundled default assets remain repository/static production assets. This measured contact sequence does not implement general STL collision physics or physical robot calibration.

## Default Body1 and fork assets (2026-10-02)

The project maintainer explicitly requested “just 匯入 by the app by default” after the local-only release. This authorizes bundling the supplied `Body1.stl` and `Block.stl` for this project and replaces their earlier packaging exclusion. The exact source hashes and supplied-asset notice are retained in `public/models/tools/README.md`; this records the maintainer's request, not an upstream Dobot license or independently established authorship. The magnetic mesh was separately added after the maintainer's 2026-10-03 request; proprietary CAD remains excluded.

Both meshes load from same-origin static assets automatically; the Body1 profile is selected without a file chooser. Fork mode renders the supplied Body1 workpiece and flange-mounted passive fork. The first non-puck calibration boundary remains; magnetic workpieces retain the existing geometry. Custom imports take precedence, reset the measured calibration and remain browser-session-only. Project import retains Body1 calibration when the bundled pair is active. Existing custom scripts and teach points are not overwritten: re-teach a pick/place pair after changing tools. A saved stock generic fork program upgrades to the matching Body1 template on startup.

This measured sequence remains a logical contact simulation, not general STL collision physics or physical calibration.

## Magnetic tool and plate release (2026-10-03)

The maintainer explicitly requested “the magnet suck model ... load it to the website” and specified a 35×35×4 mm magnetic workpiece. This supersedes the prior magnet-only packaging exclusion. The exact supplied `magnet.stl` hash is checked by `release:check`; the measured mounting face is placed under the flange using the same datum as the fork. Source filenames are retained for provenance, while the UI names the roles: 磁吸工具 / 無動力叉臂 / 槽積木.

Fresh magnetic exercises use 35×35×4 mm marked plates, on visible 20 mm teaching stands, with centre Z22 and contact Z24. Three-layer tower programs move to contacts Z24/Z28/Z32 after lifting and rotating the held tool. The scene and controller derive geometry, carrying offset, contact and stack heights from workpiece kind. Schema 10 explicitly preserves schema 9 unspecified-kind workpieces as 40×40×15 mm reference blocks without changing learner programs or taught coordinates. Custom tool imports take precedence and remain local to the browser.

These are logical training contacts and attachment transforms; no magnetic force or general collision physics is added.

## 2026-10-03 shared front platform and workpiece update

Fresh schema-11 exercises use one shared teaching platform in front of the robot, with top Z110 mm. Its footprint covers the initial and current workcell fixtures and remains stable during normal task movement. Magnetic plates are 35×35×4 mm: bottom Z110, centre Z112, contact Z114; tower contacts are Z114/Z118/Z122. The exact supplied Body1/fork/magnet STL bytes remain unchanged. Body1 retains measured local geometry, with 20 mm pads on the platform (bottom Z130, insertion TCP Z152.5, load/release Z155).

The legacy Ø28×8 round option and rendering are removed. Historical round entries convert to magnetic plates with an explicit re-teach notice, preserving scripts and points. Untouched stock magnetic setups migrate to the raised platform; customized old cells preserve their prior heights and coordinates. Workspace theme changes reuse the existing scene and meshes. Task outcomes use observed attachment, lift, turn and release poses; they remain logical simulation evidence, not physical collision or magnetic-force validation. Earlier dated sections document historical releases.
