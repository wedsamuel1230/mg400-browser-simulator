import { type CellBlock, type ProjectDocument, type Pose, TEACHING_PLATFORM, activeTcpOffset } from "../domain";
import { forkContactPose, forkEntryPose } from "./forkTool";
import type { MG400Kinematics } from "./mg400Kinematics";

export function createWorkpiecePile(kind: "body1" | "magnet", count: number, x: number, y: number, pileId: string): CellBlock[] {
  const limit = kind === "body1" ? 3 : 10, half = kind === "body1" ? 20 : 17.5;
  if (!Number.isInteger(count) || count < 1 || count > limit) throw new Error(`件數必須為1–${limit} / Count must be1–${limit}.`);
  const insidePlatform = Number.isFinite(x) && Number.isFinite(y)
    && x - half >= TEACHING_PLATFORM.x - TEACHING_PLATFORM.width / 2
    && x + half <= TEACHING_PLATFORM.x + TEACHING_PLATFORM.width / 2
    && y - half >= TEACHING_PLATFORM.y - TEACHING_PLATFORM.depth / 2
    && y + half <= TEACHING_PLATFORM.y + TEACHING_PLATFORM.depth / 2;
  if (!insidePlatform) throw new Error("工件必須完全位於固定500×1200 mm平台內 / Keep the complete footprint inside the fixed 500×1200 mm platform.");
  return Array.from({length:count},(_,stackLevel)=>({id:`${pileId}-${stackLevel+1}`,pileId,kind:kind === "body1" ? "block" : "magnet",...(kind === "body1" ? {geometry:"body1" as const}:{}),color:"neutral",source:"pickup",position:{x,y},r:0,z:0,stackLevel}));
}

export function teachPile(project: ProjectDocument, pile: CellBlock[], kinematics?: Pick<MG400Kinematics,"solve">): ProjectDocument {
  const top=pile.at(-1)!;
  const fork=top.geometry === "body1", height=fork?40:4;
  const pick:Pose = fork ? forkContactPose(top.position,top.r,"body1",false,110+height*(top.stackLevel??0),0) : {...top.position,z:114+height*(top.stackLevel??0),r:0};
  const place:Pose = fork ? forkContactPose(project.scene.drop,0,"body1",true,110,0) : {...project.scene.drop,z:114,r:0};
  const poses={PickPoint:pick,PickApproach:fork?forkEntryPose(pick):{...pick,z:pick.z+80},PlacePoint:place,PlaceApproach:{...place,z:place.z+80}};
  const next={...project,tool:{...project.tool,mode:fork?"fork" as const:"magnet" as const},scene:{...project.scene,platformHeightMm:110,magnetStandHeightMm:0,body1SupportHeightMm:0,block:{...top.position}}};
  if(kinematics){
    const home=project.points.find(point=>point.kind==="joint");
    const seed=home?.kind==="joint"?home.joints:[0,0,0,0] as [number,number,number,number];
    for(const [name,pose] of Object.entries(poses)) if(!kinematics.solve(pose,seed,next.tool.flangeOffset,activeTcpOffset(next.tool)).ok) throw new Error(`${name} 超出目前機械臂／工具可達範圍 / Outside the current robot/tool reach.`);
  }
  const points=project.points.map(point=>point.kind==="cartesian" && point.name in poses?{...point,pose:poses[point.name as keyof typeof poses]}:point);
  for(const [name,pose] of Object.entries(poses)) if(!points.some(point=>point.name===name)) points.push({id:name.toLowerCase(),name,kind:"cartesian",pose});
  if(!points.some(point=>point.name==="Home")) points.unshift({id:"home",name:"Home",kind:"joint",joints:[0,Math.PI/6,Math.PI/4,0]});
  return {...next,points};
}
