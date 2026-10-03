# Supplied teaching models

The project maintainer supplied these files and explicitly requested that the app bundle and load them by default on 2026-10-02. This replaces the earlier local-import-only packaging decision. This authorization is not an upstream Dobot license or proof of CAD authorship. These are separate user-supplied teaching assets; no claim of Dobot endorsement or verified physical fit is made.

- `Body1.stl`: supplied workpiece, 40 × 40 × 40 mm, grooves at Z15–25.
- `Block.stl`: supplied passive fork, 5 mm plate, mounted beneath the flange.

Original source files: project maintainer's Downloads folder. Bundled files are byte-identical.

- `Body1.stl` SHA256: `b6a56256947fcc2dac165ba56d34d5c418bd5eaed248ac49ac7b83268491a185`
- `Block.stl` SHA256: `bc4b6488f05fc8649bb874b63ed0ec8d45149e307a40be27b1a8c1e5f767a325`

## Magnetic tool added 2026-10-03

The maintainer explicitly requested loading the supplied magnetic pickup model into the public website. `magnet.stl` is now bundled byte-identically from the maintainer's Downloads folder, using the same measured flange mounting datum as the fork.

- `magnet.stl`: magnetic pickup tool / 磁吸工具; SHA256 `6eb33378ef210da42458c57c86b09be94a82c296d4623a4e40c014754c342f06`.
- `Block.stl`: passive fork / 無動力叉臂 (not a workpiece despite the source filename).
- `Body1.stl`: grooved fork workpiece / 槽積木, 40×40×40 mm.
- Magnetic workpiece / 磁吸片: a project-authored marked rectangular geometry, 35×35×4 mm, generated directly in Three.js; it is separate from the printed magnetic tool.

This updates packaging authorization only; no upstream CAD license, authorship, endorsement, or physical fit is claimed. Custom imports remain browser-session-only and take priority over defaults.
