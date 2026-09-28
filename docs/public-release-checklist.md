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

Current asset decision: **safe to proceed to a separate publication review**; no publication or deployment was made during this audit. Exact owner meshes remain prohibited from bundling.
