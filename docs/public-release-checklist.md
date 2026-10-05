# Public repository and Vercel release gate

## Historical package and deployment snapshot (2026-10-04; superseded)

- Public GitHub `main` contains the pinned Dobot MG400 ROS model and the exact maintainer-supplied `Body1.stl`, `Block.stl`, and `magnet.stl` files. The maintainer explicitly asked for these three files to load by default in the public project; their hashes and provenance are recorded in [`public/models/tools/README.md`](../public/models/tools/README.md). They are not claimed as Dobot assets, and no upstream license or independent authorship record was found for them.
- `npm run release:check` verifies the vendor license, the exact hashes of those maintainer-supplied files in `public/` and `dist/`, absence of other fork meshes, and credential-like strings. It verifies packaging state, not legal ownership or third-party licensing.
- GitHub `main` has advanced beyond Vercel's production deployment, which still serves commit `058db36` as of this check. The existing Vercel project is not connected to GitHub. Do not describe later commits as live until Vercel reports a successful deployment for the new source and the public URL is checked.
- Keep the project-authored code and vendor model notices intact. Do not describe the user-supplied meshes as Dobot-authored, Dobot-licensed, endorsed, or physically calibrated.

Before a new release, verify the vendor MG400 ROS `LICENSE` remains beside its nine meshes and URDF, the three user-supplied asset hashes remain unchanged, no `.env` file or credential enters the repository or deployment artifact, and dependency notices match the pinned lockfile. The release check is a deterministic packaging check; it does not establish rights beyond the maintainer's recorded request.

## 2026-10-05 current-candidate acceptance (pre-deployment snapshot)

- Candidate source: local `main` at `2553cdc41ed3a019666ed06b27019e613c01e88c` plus the uncommitted point-name validation and Lua motion-option diagnostics. The current candidate does not add or change any bundled model mesh.
- Verification passed: `npm run typecheck`; Vitest (34 files / 319 tests); production build; `npm run release:check`; the E2E suite (12/12) and focused point-rename E2E (2/2). The RelMovL worker E2E coverage passed 8/8. Build warnings remain for browser externalization of Pyodide/Wasmoon Node modules and the large Monaco chunk.
- In a fresh local production-preview browser, all eight task/language combinations completed: passive-fork pickup/place without DO, carried +90° rotation, a 0°/90°/0° three-layer tower, and black/white magnetic pieces in separate stacks, each in Lua and simulator-only Python. Model/runtime assets returned HTTP 200 with no recorded request, console, or page errors. This is simulator evidence, not hardware validation.
- A single cold local Chromium run at 1440×900 reached 3D viewport ready in 1.77 seconds; resources transferred about 4.61 MB. This is a localhost measurement, not a public-network performance guarantee. At 390×844 the document width matched the viewport; no horizontal overflow was found. Brave-specific manual testing and a public production timing run were not done at this point.
- GitHub secret-scanning reported zero alerts; the local packaging check passed, no `.env` file was present in the project, and a narrow source-history scan for common `sk-...` API-key patterns found no match. This is not a comprehensive historical secret scan.
- Jev's bounded review of the changed source/test files returned no findings. Poe's GPT-6.1-Sol review said the supplied functional evidence supports a controlled student trial; it initially blocked public release on asset-rights uncertainty, then withdrew that blocker for this unchanged asset set after the maintainer's explicit public-project instruction. The meshes remain excluded from the root MIT license and are not granted a general downstream reuse license.
- At this pre-deployment snapshot, the Vercel production URL still served `f641ef47b9ba29367d1f1963eadcffe108201c2b`; the candidate was not yet pushed or deployed. Student feedback, screen-reader testing, real robot calibration, and physical validation remain open follow-up work.

## Historical packaging decisions

The 2026-09-29 release candidate excluded the unknown-rights fork and magnet files and used a generic placeholder or client-only import. This decision was superseded by the maintainer's explicit 2026-10-02 request to bundle Body1 and the fork, followed by the 2026-10-03 request to bundle the magnetic tool. Custom imports remain browser-session-only and are not exported.

The repository includes `vercel.json` for the static SPA fallback and `.github/workflows/release-smoke.yml` for `npm ci`, full tests, typecheck, build, and the public asset gate.

Historical asset decision: exact owner meshes were excluded until the maintainer requested default bundling on 2026-10-02.

## 2026-09-29 publication execution

- Public GitHub repository: https://github.com/wedsamuel1230/mg400-browser-simulator
- Verify the current public `main` head with `git ls-remote origin refs/heads/main`; do not hardcode a commit SHA in this checklist because later documentation edits change it.
- GitHub visibility and `main` contents were verified through the GitHub API. The tree contains no `.scratch`, `.env`, `dist`, `fork.stl`, or `magnet.stl` paths.
- `npm run release:check` passed before the commit. The repository contains the MIT root license, the pinned vendor model license, SPA `vercel.json`, and the release smoke workflow.
- Current production URL: https://mg400-browser-simulator.vercel.app. The release evidence supplied for this status records deployment `dpl_Gc538GnCC4gYGGGrSzeWW8BH44mm` as `READY` for commit `0a6b815` (reconciled 2026-09-29). This hardening pass did not query Vercel or create a deployment. The earlier CLI-login failure describes an earlier execution attempt, not the current release state.
- Hardening commit `f658caf` was pushed to `origin/main`, but a post-push Vercel listing still showed `0a6b815` as the latest READY production build. No Vercel CLI is installed, and the deploy connector returned `Tool deploy_to_vercel not found`; this commit is not confirmed deployed.

## 2026-10-02 and 2026-10-03 supplied asset updates

The maintainer requested automatic loading of the supplied Body1 workpiece, passive fork, and magnetic tool. `public/models/tools/README.md` records the source and exact SHA256 hashes. The current release check accepts only those exact files, retains the vendor license checks, and rejects any other fork mesh or credential-like source pattern. Proprietary CAD remains local. Custom STL imports still stay in browser memory.
