# Third-party notices

This file records source-specific notices for bundled assets and browser dependencies. Dependency versions are pinned in `package.json` and `package-lock.json`; upstream package metadata and license files remain authoritative. The root MIT license applies to project-authored software and documentation; it does not automatically relicense separately identified model assets.

## Bundled 3D assets

- **Dobot MG400 ROS model** — MIT, copyright 2022 Dobot. The original notice is preserved at [`public/models/mg400/mg400_description/LICENSE`](../public/models/mg400/mg400_description/LICENSE). Source and pinned revision are recorded in [`model-provenance.md`](model-provenance.md).
- **Body1, fork, and magnet meshes** — files supplied by the project maintainer and bundled at the maintainer's explicit direction on 2026-10-02/03. No upstream license or independently verified authorship is recorded. These files are not under the root MIT license, and no general downstream reuse license is asserted. The project-specific packaging instruction and exact hashes are recorded in [`model-provenance.md`](model-provenance.md) and [`public/models/tools/README.md`](../public/models/tools/README.md).

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

The release check confirms that only the exact maintainer-approved mesh hashes are bundled; it does not establish legal ownership or create a reusable license for those meshes. The vendor MG400 model has its own preserved MIT license. Do not treat that vendor license or the repository's root MIT license as applying to the separately identified Body1, fork, or magnet meshes.
