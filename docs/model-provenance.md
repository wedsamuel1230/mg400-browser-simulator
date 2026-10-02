# MG400 model provenance

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

The owner-supplied meshes were found in `/Users/wed/Downloads` and copied into the local app:

| Role | Owner source | App copy | SHA256 | Measured source bounds (mm) |
|---|---|---|---|---|
| Passive printed fork | `Block.stl` | local evidence copy in `.scratch/issue23-local-tools/fork.stl` | `bc4b6488f05fc8649bb874b63ed0ec8d45149e307a40be27b1a8c1e5f767a325` | X −20..20, Y −82.3112..15.2751, Z 4.7346..9.7346 |
| Magnetic end effector | `magnet.stl` | local evidence copy in `.scratch/issue23-local-tools/magnet.stl` | `6eb33378ef210da42458c57c86b09be94a82c296d4623a4e40c014754c342f06` | X −20..20, Y −84.6982..15.2751, Z 4.7346..9.7346 |

The local evidence copies are byte-identical to their owner sources at the recorded hashes. They are excluded from `public/` and production output. The public-safe scene uses a generic distributable teaching placeholder by default; a learner can import an STL locally in the browser for inspection. Imported bytes stay in page memory and are not uploaded or included in project export. Both paths use the same millimetre scale, flange mounting datum `(0, −4.711512, 9.734621) mm`, working direction local `+X`, flange `Z=0`, and active TCP offset. A geometry test checks the transformed bounds when an STL is supplied; the placeholder is not represented as the owner's printed tool.

This verifies the source mesh bytes, transform math, scene attachment path, and browser placement. A fresh STEP-topology/mating-face recheck was not possible in this environment because its CAD geometry kernel is unavailable, and no physical robot/tool fit or TCP calibration was performed. Redistribution rights for the supplied meshes are unknown; keep them local and do not publish the app with these meshes without permission.

## Issue 23 release-rights audit (2026-09-29)

The two tool meshes are owner-supplied files found in the local Downloads folder. Their byte sources and app copies match the hashes above, but no author record, license file, written permission, or reliable upstream URL was found for either file. The filename, geometry, and use in an educational simulator do not establish Dobot ownership or redistribution permission. No Dobot contact was made because the evidence does not identify Dobot as the author or rights holder.

The vendor model is a separate releasable asset set: its pinned revision, URDF hash (`d8ab4d690d0eef6232dd5d34f5a3a54bf0f2ead94aad6540ddbe06fb3628084b`), and preserved MIT notice are recorded above. `public/favicon.svg` is a small project-authored generic mark; no Dobot logo file is bundled. Product names such as “Dobot MG400” are descriptive references to the simulator target and do not grant trademark rights.

**Current release decision:** the current public-safe build excludes the unknown meshes and defaults to generic placeholders. The learner-supplied local import path is client-only and does not upload the files. A future release may use the exact meshes only after written redistribution permission from the actual rights holder is recorded with the exact hashes. Educational intent alone is not permission; every production artifact must continue to prove that the unknown meshes are absent unless that permission gate changes.

The project contains no `.env` file. A source scan excluding dependencies, generated build output, scratch evidence, and local runtime bundles found only runtime key-handling code, documentation, and test placeholders; no embedded production credential was found. `OPENROUTER_API_KEY` is read from the server environment only when configured and is not bundled by Vite. The root `.gitignore` excludes local `.env` files while allowing a future `.env.example`.

## Local Body1 fork contact profile

The browser offers an explicit **Body1 槽積木** calibration after importing a local workpiece and fork mesh. This is a user selection for the measured owner-local Body1 geometry, not filename detection or analysis of arbitrary STL files. Body1 is 40×40×40 mm with grooves along local Y, at local Z15..25; the imported fork plate is 5 mm thick. At the simulator's resting bottom Z20, insertion TCP Z42.5 leaves 2.5 mm clearance above and below the plate. Load and release use TCP Z45, with the attached workpiece bottom at TCP Z−25.

Auto-teaching aligns the fork at workpiece R−90°. The Lua and Python examples release at Z45, lower to Z42.5, withdraw 60 mm along tool −X, then lift. Attachment requires aligned forward insertion and lift; release stays unarmed until withdrawal. Cell identity, position and world yaw are retained across attachment and release. The generic reference profile retains Z20 and uses pickup R−90° / placement R+90° at the default cell; magnetic mode retains the 15 mm reference block and top contact.

Calibration and mesh bytes are page-session data. Replacing either the fork or workpiece import resets the profile. Calibration applies only to the first non-puck cell workpiece; other cells retain generic contact. Project import resets calibration; reopening requires reimporting the local meshes, reselecting the profile and re-teaching the points. Raw owner meshes remain excluded from repository assets and production output. This measured contact sequence does not implement general STL collision physics or physical robot calibration.
