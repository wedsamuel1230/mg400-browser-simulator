# Third-party notices

This file records the licenses that matter to the browser release audit. Dependency versions are pinned in `package.json` and `package-lock.json`; upstream package metadata and license files remain authoritative.

## Bundled 3D assets

- **Dobot MG400 ROS model** — MIT, copyright 2022 Dobot. The original notice is preserved at [`public/models/mg400/mg400_description/LICENSE`](../public/models/mg400/mg400_description/LICENSE). Source and pinned revision are recorded in [`model-provenance.md`](model-provenance.md).
- **Fork and magnet meshes** — owner-supplied local files with unknown author and redistribution terms. They are development-only until written permission or a permitted replacement is recorded. See [`model-provenance.md`](model-provenance.md).

## Browser runtime dependencies

| Package | Version | License |
| --- | ---: | --- |
| `@monaco-editor/react` | 4.7.0 | MIT |
| `lucide-react` | 1.48.0 | ISC |
| `monaco-editor` | 0.57.0 | MIT |
| `pyodide` | 314.0.7 | MPL-2.0 |
| `react` / `react-dom` | 19.3.0 | MIT |
| `three` | 0.186.1 | MIT |
| `urdf-loader` | 0.13.1 | Apache-2.0 |
| `wasmoon` | 1.16.0 | MIT |

Vite, TypeScript, test packages, and transitive dependencies remain pinned in the lockfile. A publication pipeline should regenerate a complete dependency notice from the lockfile before release.

This notice does not grant rights for the unknown tool meshes. Do not publish the current tree until Issue 23 is resolved.
