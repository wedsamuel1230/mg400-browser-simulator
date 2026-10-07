# Teaching contact and workpiece contract

The fixed front teaching platform is 500 × 1200 mm, centred at (350, 0), with its top at Z110. Its footprint is X100–600, Y−600–600. The rear edge stays 5 mm ahead of the robot pedestal. The pinned URDF gives a conservative default-tool TCP XY radius of 524.507 mm; a rotating 40 mm square adds 28.284 mm, giving a 552.791 mm envelope and 47.209 mm outer margin. This covers the front teaching area, excluding the pedestal and the robot's rear. Custom extended TCPs require a new coverage assessment. Platform coverage does not establish IK reachability or collision clearance.

The platform geometry and robot position remain fixed; counts, imported positions and Free Play do not resize or reposition them. Camera zoom and framing can change how large the platform looks on screen without changing its dimensions.

The supplied `base_link.STL` has local metre bounds X/Y ±0.0949999988, Z0–0.1129999980. With the URDF's unchanged 1000 scale, its front edge is X95 mm and platform near edge is X100: a 5 mm gap. Evidence command: load the STL with `three/examples/jsm/loaders/STLLoader.js`, call `computeBoundingBox()`, and inspect min/max. The robot pedestal is unchanged.

## Body1

Every fresh teaching Body1 has `geometry: "body1"`, `kind: "block"`, dimensions 40 × 40 × 40, and uses the exact bundled `Body1.stl` geometry. The fork remains the exact bundled `Block.stl`, mounted with the existing 60 mm TCP offset. Body1's slots are local Z15–25; insertion TCP is bottom +22.5 and load/release is bottom +25.

`scene.body1SupportHeightMm: 0` means directly on the shared platform. Omission preserves historical 20 mm support calibration. No saved program or taught points are rewritten. On import, old platform heights normalize to110 and `platformMigrationFromMm` triggers an explicit re-teach notice; this supersedes historical platform0 operation. Legacy Body1 support20 remains explicit through the accessor default, yielding insertion152.5/release155 on Z110.

The normal fork lesson contains one Body1; it inserts at132.5, takes the load at135, lifts80, places at135, returns to132.5 and withdraws60 horizontally before lifting. Fork90 inserts in the original orientation, lifts80 after taking the load, then turns the held tool90. No fork lesson uses DO.

The tower has levels0/1/2 at one XY, with bottom heights110/150/190 and load/release135/175/215. Final world yaw is0/90/0: only the middle layer turns90 after pickup and the80 mm lift. All three instances render the supplied mesh; every release restores2.5 mm slot clearance then withdraws60 in tool−X.

## Magnetic sorting

Four35 ×35 ×4 plates are arranged50 mm apart at X250/300/350/400,Y−100. Disclosed parity is black/white/black/white. Bins are black(250,80), white(350,80),100 mm apart. A separate height count per color yields two levels0/1 and top contacts114/118. White plates lift80 then turn45. The final two stacks remain visible; there is no default unload pass.

## Free Play

A pile is authored from workpiece type, XY and count. Body1 accepts1–3; magnetic plates1–10. `pileId` groups positional edits; each piece gets a true vertical `stackLevel`. Platform footprint and the actual model/tool IK guard the contact and approach points; invalid counts or locations report errors rather than being silently clamped. Z/R remain advanced controls for existing custom data. Preview reports TCP vertical distance and the80 mm lift, not physical elapsed time.

The contact transitions are deterministic teaching rules; the engine does not calculate arbitrary STL collision, force or tower stability. Browser/WebGL appearance and worker integration need their own verification in addition to controller and scene tests.
