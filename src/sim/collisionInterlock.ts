import { Box3, Matrix4, Quaternion, Ray, Triangle, Vector3, type BufferGeometry } from "three";
import { OBB } from "three/examples/jsm/math/OBB.js";
import { activeTcpOffset, body1SupportHeight, cellBlockSize, cellBlockBottomZ, magneticSurfaceHeight, rad, TEACHING_PLATFORM, type CellBlock, type JointAngles, type ProjectDocument } from "../domain";
import type { MG400Kinematics } from "./mg400Kinematics";

export type CollisionGeometry = { links: Map<string, BufferGeometry[]>; tools: Partial<Record<"fork" | "magnet", BufferGeometry>>; supported: boolean };
const CONTACT = 0.05;
type Solid = { name: string; box: Box3; matrix: Matrix4 };
const box = (x: number, y: number, z: number, a: number, b: number, c: number) => new Box3(new Vector3(x,y,z), new Vector3(a,b,c));
const transform = (x: number, y: number, z: number, r = 0) => new Matrix4().makeTranslation(x,y,z).multiply(new Matrix4().makeRotationZ(rad(r)));
function overlaps(a: Solid, b: Solid) {
  const obb = (solid: Solid) => {
    const volume = new OBB().fromBox3(solid.box.clone().expandByScalar(-CONTACT / 2));
    const centre = volume.center.clone().applyMatrix4(solid.matrix);
    volume.applyMatrix4(solid.matrix);
    volume.center.copy(centre);
    return volume;
  };
  return obb(a).intersectsOBB(obb(b), 1e-10);
}
const triangleBounds = new WeakMap<BufferGeometry, Float32Array>();
function meshIntersects(geometry: BufferGeometry, matrix: Matrix4, obstacle: Solid) {
  const local = obstacle.matrix.clone().invert().multiply(matrix);
  const positions = geometry.getAttribute("position"), index = geometry.index;
  const count = index?.count ?? positions.count;
  const triangle = new Triangle(), hit = new Vector3();
  const read = (n: number, target: Vector3) => target.fromBufferAttribute(positions, index ? index.getX(n) : n);
  let bounds = triangleBounds.get(geometry);
  if (!bounds) {
    bounds = new Float32Array(count*2);
    for (let i=0;i<count;i+=3) {
      read(i,triangle.a); read(i+1,triangle.b); read(i+2,triangle.c);
      for (let axis=0;axis<3;axis++) {
        bounds[i*2+axis]=Math.min(triangle.a.getComponent(axis),triangle.b.getComponent(axis),triangle.c.getComponent(axis));
        bounds[i*2+axis+3]=Math.max(triangle.a.getComponent(axis),triangle.b.getComponent(axis),triangle.c.getComponent(axis));
      }
    }
    triangleBounds.set(geometry,bounds);
  }
  const inner = obstacle.box.clone().expandByScalar(-CONTACT);
  const inverse = local.clone().invert();
  const localBox = inner.clone().applyMatrix4(inverse);
  const centre = inner.getCenter(new Vector3()).applyMatrix4(inverse);
  const enclosed = geometry.boundingBox!.containsPoint(centre);
  const ray = new Ray(centre, new Vector3(1,0.371,0.193).normalize());
  const distances: number[] = [];
  for (let i=0;i<count;i+=3) {
    const offset=i*2;
    const nearby = bounds[offset]<=localBox.max.x && bounds[offset+3]>=localBox.min.x
      && bounds[offset+1]<=localBox.max.y && bounds[offset+4]>=localBox.min.y
      && bounds[offset+2]<=localBox.max.z && bounds[offset+5]>=localBox.min.z;
    if (!nearby && !enclosed) continue;
    read(i,triangle.a); read(i+1,triangle.b); read(i+2,triangle.c);
    if (enclosed && ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit)) distances.push(hit.distanceTo(centre));
    if (!nearby) continue;
    triangle.a.applyMatrix4(local); triangle.b.applyMatrix4(local); triangle.c.applyMatrix4(local);
    if (inner.intersectsTriangle(triangle)) return true;
  }
  distances.sort((a,b)=>a-b);
  return distances.filter((value,i)=>!i || value-distances[i-1]>1e-6).length % 2 === 1;
}
export function workpieceSolids(block: CellBlock, project: ProjectDocument, matrix?: Matrix4): Solid[] {
  const size = cellBlockSize(block, project.tool.mode);
  const world = matrix ?? (block.physicalPose ? new Matrix4().compose(new Vector3().copy(block.physicalPose.position),new Quaternion().copy(block.physicalPose.quaternion),new Vector3(1,1,1)) : transform(block.position.x,block.position.y,cellBlockBottomZ(block, project.tool.mode, magneticSurfaceHeight(project.scene), project.scene.platformHeightMm ?? 0, body1SupportHeight(project.scene)),block.r));
  const boxes = block.geometry === "body1" ? [box(-20,-20,0,20,20,15),box(-7.5,-20,15,7.5,20,25),box(-20,-20,25,20,20,40)] : [box(-size.x/2,-size.y/2,0,size.x/2,size.y/2,size.z)];
  return boxes.map(bounds=>({ name: block.id, box: bounds, matrix: world }));
}
export function fixedSolids(): Solid[] {
  const p = TEACHING_PLATFORM;
  return [
    {name:"教學平台",box:box(p.x-p.width/2,p.y-p.depth/2,0,p.x+p.width/2,p.y+p.depth/2,p.top),matrix:new Matrix4()},
    {name:"工作台",box:box(-380,-700,-40,670,700,0),matrix:new Matrix4()},
  ];
}
export function supportSolids(project: ProjectDocument, blocks: CellBlock[]) {
  const stands: Solid[] = [];
  for (const block of blocks) {
    if (cellBlockSize(block,project.tool.mode).z===4 && (project.scene.platformHeightMm ?? 0)===0) stands.push({name:"磁吸教學座",box:box(-19,-19,0,19,19,magneticSurfaceHeight(project.scene)),matrix:transform(block.position.x,block.position.y,block.z??0,block.r)});
  }
  if (project.tool.mode==="fork" && body1SupportHeight(project.scene)>0) for (const location of [project.scene.block,project.scene.drop]) for (const [x,y] of [[-15,-18],[-15,18],[15,0]]) stands.push({name:"承托座",box:box(x-5,y-1.5,0,x+5,y+1.5,20),matrix:transform(location.x,location.y,project.scene.platformHeightMm??0)});
  return stands;
}
export function assertPlacementClear(block: CellBlock, blocks: CellBlock[], project: ProjectDocument) {
  for (const a of workpieceSolids(block,project)) for (const fixed of [...fixedSolids(),...supportSolids(project,blocks),{name:"機座",box:box(-95,-95,0,95,95,113),matrix:new Matrix4()}]) {
    if (overlaps(a,fixed)) throw new Error(`碰撞停止：放置工件與 ${fixed.name} 重疊。`);
  }
  for (const a of workpieceSolids(block,project)) for (const other of blocks.filter(b=>b.id!==block.id)) for (const b of workpieceSolids(other,project)) {
    if (overlaps(a,b)) throw new Error(`碰撞停止：放置工件與 ${other.id} 重疊。`);
  }
}
export function assertCollisionFree(kinematics: MG400Kinematics, joints: JointAngles, project: ProjectDocument, blocks: CellBlock[], assets: CollisionGeometry, attachedId: string | null, attachedYaw: number, toolContactId: string | null = null) {
  const tool = assets.tools[project.tool.mode];
  if (!assets.supported || !tool || assets.links.size === 0) throw new Error("碰撞檢查未就緒或自訂模型未支援；請載入內置模型。");
  const fixed = fixedSolids();
  const stands = supportSolids(project,blocks);
  const pieces = blocks.filter(b=>b.id!==attachedId).flatMap(b=>workpieceSolids(b,project));
  const matrices = kinematics.linkMatrices(joints);
  const obstacles = [...fixed,...stands,...pieces];
  for (const [name,geometries] of assets.links) {
    if (name==="base_link") continue;
    const matrix = matrices.get(name);
    if (!matrix) throw new Error(`碰撞模型缺少 ${name}。`);
    for (const geometry of geometries) {
      const arm = {name,box:geometry.boundingBox!,matrix};
      for (const obstacle of obstacles) if (overlaps(arm,obstacle) && meshIntersects(geometry,matrix,obstacle)) throw new Error(`碰撞停止：${name} 接觸 ${obstacle.name}。`);
    }
  }
  const flange = kinematics.flangeMatrix(joints,project.tool.flangeOffset);
  const toolSolid = {name:"工具",box:tool.boundingBox!,matrix:flange};
  const base = {name:"機座",box:box(-95,-95,0,95,95,113),matrix:new Matrix4()};
  for (const obstacle of [...fixed,...stands,base,...blocks.filter(b=>b.id!==attachedId && b.id!==toolContactId).flatMap(b=>workpieceSolids(b,project))]) if (overlaps(toolSolid,obstacle) && meshIntersects(tool,flange,obstacle)) throw new Error(`碰撞停止：工具接觸 ${obstacle.name}。`);
  const carried = blocks.find(b=>b.id===attachedId);
  // Dynamic payload side contacts stop through the physics callback; support contacts remain physical.
  if (carried && !carried.physicalPose) {
    const tcp = kinematics.forward(joints,project.tool.flangeOffset,activeTcpOffset(project.tool));
    const height = cellBlockSize(carried,project.tool.mode).z;
    const bottom = tcp.z - (project.tool.mode==="magnet" ? height : carried.geometry==="body1" ? 25 : 0);
    for (const solid of workpieceSolids(carried,project,transform(tcp.x,tcp.y,bottom,tcp.r+attachedYaw))) for (const obstacle of [...fixed,...stands,base,...pieces]) if (overlaps(solid,obstacle)) throw new Error(`碰撞停止：承載工件接觸 ${obstacle.name}。`);
  }
}
