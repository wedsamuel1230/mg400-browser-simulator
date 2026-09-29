# Public repository and Vercel release gate

Issue 23 is a rights and packaging gate for the later publication issue. The current public-safe build excludes the two owner-supplied tool meshes, which remain local evidence files:

- `.scratch/issue23-local-tools/fork.stl` — SHA256 `bc4b6488f05fc8649bb874b63ed0ec8d45149e307a40be27b1a8c1e5f767a325`
- `.scratch/issue23-local-tools/magnet.stl` — SHA256 `6eb33378ef210da42458c57c86b09be94a82c296d4623a4e40c014754c342f06`

No license or written redistribution permission is attached to either exact file. The public app uses a freely distributable generic placeholder and offers client-only STL import; imported bytes never leave the browser or enter project export.

## Permitted paths

1. Record written permission from the actual rights holder, retain the message or license with the exact hashes, and rerun the asset and secret checks.
2. Keep the public-safe build excluding both files, using the generic placeholder or learner-supplied local import. This path is implemented and requires the production artifact exclusion check below before Issue 24 publication work.

Before publishing, verify the vendor MG400 ROS `LICENSE` remains beside its nine meshes and URDF, the chosen tool-mesh path has source/author/license/hash, no `.env` file or credential is in the repository or deployment artifact, the production artifact contains only approved assets, and dependency notices are regenerated from the pinned lockfile.

The candidate includes `vercel.json` for the static SPA fallback and `.github/workflows/release-smoke.yml` for `npm ci`, full tests, typecheck, build, and the public asset gate. These prepare release automation; they do not publish or deploy.

Current asset decision: **safe to proceed to a separate publication review**; exact owner meshes remain prohibited from bundling.

## 2026-09-29 publication execution

- Public GitHub repository: https://github.com/wedsamuel1230/mg400-browser-simulator
- Verify the current public `main` head with `git ls-remote origin refs/heads/main`; do not hardcode a commit SHA in this checklist because later documentation edits change it.
- GitHub visibility and `main` contents were verified through the GitHub API. The tree contains no `.scratch`, `.env`, `dist`, `fork.stl`, or `magnet.stl` paths.
- `npm run release:check` passed before the commit. The repository contains the MIT root license, the pinned vendor model license, SPA `vercel.json`, and the release smoke workflow.
- Current production URL: https://mg400-browser-simulator.vercel.app. The release evidence supplied for this status records deployment `dpl_Gc538GnCC4gYGGGrSzeWW8BH44mm` as `READY` for commit `0a6b815` (reconciled 2026-09-29). This hardening pass did not query Vercel or create a deployment. The earlier CLI-login failure describes an earlier execution attempt, not the current release state.
- Hardening commit `f658caf` was pushed to `origin/main`, but a post-push Vercel listing still showed `0a6b815` as the latest READY production build. No Vercel CLI is installed, and the deploy connector returned `Tool deploy_to_vercel not found`; this commit is not confirmed deployed.
