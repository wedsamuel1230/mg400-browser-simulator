// @vitest-environment node
import {beforeAll,expect,it} from "vitest";
// @ts-expect-error Node fixtures only.
import {readFileSync} from "node:fs";
import {Matrix4,Quaternion,Vector3} from "three";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import {validateCellBlocks,resetCell} from "./multiBlockCell";
import {exportProject,parseProjectFile} from "../projectStore";
import {DEFAULT_PROJECT} from "../data/defaultProject";
import {rad,type CellBlock,type Pose} from "../domain";
import {prepareFlangeMountedToolGeometry} from "./toolMount";
import {initializePhysics,PHYSICS,WorkcellPhysics} from "./workcellPhysics";
const bytes=readFileSync("public/models/tools/Block.stl");
const fork=prepareFlangeMountedToolGeometry(new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));
beforeAll(initializePhysics);
const block=(id:string,x:number,y=0,stackLevel=0,r=0):CellBlock=>({id,geometry:"body1",kind:"block",source:"pickup",color:"neutral",position:{x,y},r,stackLevel});
const flange=(pose:Pose)=>new Matrix4().compose(new Vector3(pose.x-60*Math.cos(rad(pose.r)),pose.y-60*Math.sin(rad(pose.r)),pose.z),new Quaternion().setFromAxisAngle(new Vector3(0,0,1),rad(pose.r)).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.000018)),new Vector3(1,1,1));
function cell(blocks:CellBlock[]) {const p=structuredClone(DEFAULT_PROJECT);p.tool.mode="fork";p.scene.body1SupportHeightMm=0;p.scene.blocks=blocks;return new WorkcellPhysics(p,fork,flange({x:300,y:-200,z:300,r:0}));}
function seconds(world:WorkcellPhysics,n:number){for(let i=0;i<n/PHYSICS.step;i++)world.advance(PHYSICS.step);}
function move(world:WorkcellPhysics,from:Pose,to:Pose,duration=1){for(let i=1;i<=duration/.016;i++){const t=i/(duration/.016),s=t*t*(3-2*t);world.setToolTarget(flange({x:from.x+(to.x-from.x)*s,y:from.y+(to.y-from.y)*s,z:from.z+(to.z-from.z)*s,r:from.r+(to.r-from.r)*s}));world.advance(.016);}}
it("keeps a real compound Body1 0/90/0 tower upright for30 simulated seconds",()=>{
 const world=cell([block("a",300),block("b",300,0,1,90),block("c",300,0,2)]);
 seconds(world,30);
 for(const [i,id] of ["a","b","c"].entries()){const pose=world.pose(id)!;expect(pose.position.z).toBeCloseTo(110+40*i,0);expect(Math.abs(new Vector3(0,0,1).applyQuaternion(new Quaternion().copy(pose.quaternion)).z)).toBeGreaterThan(.99);}
 world.dispose();
});
it("actually tips an overhanging body and retains its full pose",()=>{
 const world=cell([block("base",590),block("overhang",620,0,1)]);seconds(world,8);
 const pose=world.pose("overhang")!;
 expect(pose.position.z).toBeLessThan(145);
 expect(Math.abs(new Vector3(0,0,1).applyQuaternion(new Quaternion().copy(pose.quaternion)).z)).toBeLessThan(.9);
 expect(world.blocks([block("overhang",620,0,1)])[0].physicalPose).toEqual(pose);
 world.dispose();
});
it.each([-90,90])("supports the measured passive fork contact proxy heading %i without a weld",heading=>{
 const world=cell([block("forked",300,-80),block("second",250,-80),block("third",350,-80)]);
 let p:Pose={x:300,y:heading===90?-140:-20,z:132.5,r:heading};world.setToolTarget(flange(p));seconds(world,1);
 const go=(to:Pose,duration=1)=>{move(world,p,to,duration);p=to;};
 go({...p,y:-80},.75);expect(Math.abs(world.pose("forked")!.position.y+80)).toBeLessThan(1);go({...p,z:135},.5);go({...p,z:215},1.5);
 expect(world.pose("forked")!.position.z,JSON.stringify({body:world.pose("forked"),tool:(world as unknown as {tool:{translation:()=>unknown}}).tool.translation(),contact:world.contactWithTool("forked")})).toBeGreaterThan(185);
 expect(world.contactWithTool("forked")).toBe(true);
 go({...p,r:heading+90},2);
 const pose=world.pose("forked")!,x=new Vector3(1,0,0).applyQuaternion(new Quaternion().copy(pose.quaternion));
 expect(Math.abs(Math.atan2(x.y,x.x)*180/Math.PI)).toBeGreaterThan(80);
 expect(pose.position.z).toBeGreaterThan(185);
 // Passive support retains the load without promising a welded centre.
 expect(Math.hypot(pose.position.x-300,pose.position.y+80),JSON.stringify(pose)).toBeLessThan(12);
 expect(new Vector3(0,0,1).applyQuaternion(new Quaternion().copy(pose.quaternion)).z).toBeGreaterThan(.99);
 world.dispose();
});

it("releases magnetic pieces into gravity and preserves a fallen pose on reload",()=>{
 const project=structuredClone(DEFAULT_PROJECT);project.tool.mode="magnet";
 project.scene.blocks=[{id:"plate",kind:"magnet",color:"black",source:"pickup",position:{x:300,y:-80},r:0}];
 const bytes=readFileSync("public/models/tools/magnet.stl");
 const magnet=prepareFlangeMountedToolGeometry(new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));
 const start={x:300,y:-80,z:119,r:0};
 const world=new WorkcellPhysics(project,magnet,flange(start));seconds(world,1);
 world.attachMagnet("plate");move(world,start,{...start,z:219},2);
 expect(world.pose("plate")!.position.z).toBeGreaterThan(200);
 world.releaseMagnet();seconds(world,3);
 expect(world.pose("plate")!.position.z).toBeCloseTo(110,0);
 expect(world.pose("plate")!.settled).toBe(true);
 const persisted=world.blocks(project.scene.blocks);world.dispose();
 project.scene.blocks=persisted;const restored=new WorkcellPhysics(project,magnet,flange({...start,z:219}));
 expect(restored.pose("plate")!.position.z).toBeCloseTo(persisted[0].physicalPose!.position.z,4);
 restored.dispose();
});

it("validates full physical snapshots, preserves a fallen orientation and resets to the original cell",()=>{
 const project=structuredClone(DEFAULT_PROJECT),b=project.scene.blocks[0];
 b.physicalPose={position:{x:300,y:-80,z:-1010},quaternion:{x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2},settled:false,outsideCell:true};
 const restored=parseProjectFile(exportProject(project));
 expect(restored.scene.blocks[0].physicalPose).toEqual(b.physicalPose);
 expect(resetCell(restored).scene.blocks[0].physicalPose).toBeUndefined();
 b.physicalPose.quaternion.w=0;
 expect(()=>validateCellBlocks(project.scene.blocks,project.scene.feederOrder)).toThrow(/physical/);
});

it("retains a finite discarded pose after a piece falls beyond the bounded workcell",()=>{
 const lost={...block("lost",580),physicalPose:{position:{x:750,y:0,z:110},quaternion:{x:0,y:0,z:0,w:1},settled:false}};
 const world=cell([lost]);seconds(world,3);const pose=world.pose("lost")!;
 expect(pose.outsideCell).toBe(true);expect(pose.settled).toBe(false);expect(pose.position.z).toBeLessThan(-1000);expect(pose.position.z).toBeGreaterThan(-1500);
 seconds(world,3);expect(world.pose("lost")).toEqual(pose);world.dispose();
});
it("detects actual payload side contact independently from ordinary vertical support",()=>{
 const item={...block("edge",580),physicalPose:{position:{x:620,y:0,z:90},quaternion:{x:0,y:0,z:0,w:1},settled:false}};
 const world=cell([item]);world.advance(PHYSICS.step);expect(world.hasSideContact("edge")).toBe(true);world.dispose();
});
