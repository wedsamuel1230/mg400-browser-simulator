import { afterEach, expect, it, vi } from "vitest";
import { BoxGeometry, Matrix4 } from "three";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import { assertCollisionFree, assertPlacementClear, type CollisionGeometry } from "./collisionInterlock";
import { SimulationController, type ControllerEvents } from "./SimulationController";
import type { MG400Kinematics } from "./mg400Kinematics";
import type { JointAngles } from "../domain";
const tool=new BoxGeometry(1,1,1);tool.computeBoundingBox();
const assets:CollisionGeometry={links:new Map([["test-link",[tool]]]),tools:{magnet:tool,fork:tool},supported:true};
const model={forward:(j:JointAngles)=>({x:j[0]*100,y:j[1]*100,z:200+j[2]*100,r:j[3]*180/Math.PI}),solve:(p:{x:number;y:number;z:number;r:number})=>({ok:true,joints:[p.x/100,p.y/100,(p.z-200)/100,p.r*Math.PI/180],positionErrorMm:0,angleErrorDeg:0}),linkMatrices:(j:JointAngles)=>new Map([["test-link",new Matrix4().makeTranslation(j[0]*100,j[1]*100,200+j[2]*100)]]),flangeMatrix:(j:JointAngles)=>new Matrix4().makeTranslation(j[0]*100,j[1]*100,200+j[2]*100)} as unknown as MG400Kinematics;
afterEach(()=>vi.unstubAllGlobals());
function harness(kinematics = model){
 const project=structuredClone(DEFAULT_PROJECT);project.tool.mode="magnet";project.scene.blocks=[{id:"thin",kind:"magnet",source:"pickup",color:"neutral",position:{x:200,y:0},r:0,z:88}];
 let joints:JointAngles=[1,0,0,0],attached=false,status="ready";const outputs: boolean[]=[];
 const events:ControllerEvents={getCollisionGeometry:()=>assets,getProject:()=>project,getJoints:()=>joints,isAttached:()=>attached,getBlock:()=>project.scene.block,getCellBlocks:()=>project.scene.blocks,setCellBlocks:b=>{project.scene.blocks=b;},setJoints:j=>{joints=j;},setAttached:a=>{attached=a;},setBlock:()=>{},setDigitalOutput:(_,v)=>{outputs.push(v);},setStatus:s=>{status=s;},addLog:()=>{}};
 let clock=performance.now();vi.stubGlobal("requestAnimationFrame",(cb:FrameRequestCallback)=>setTimeout(()=>cb(clock+=10000),0));vi.stubGlobal("cancelAnimationFrame",clearTimeout);
 return {controller:new SimulationController(kinematics,events),project,joints:()=>joints,status:()=>status,outputs,events,attached:()=>attached};
}
it("stops GoTo and both jog paths at the last safe substep despite a delayed frame",async()=>{
 for(const mode of ["go","joint","cartesian"]){const h=harness();const point={id:"target",name:"Target",kind:"joint" as const,joints:[2.7,0,0,0] as JointAngles};
 if(mode==="go")await h.controller.goToPoint(point);else if(mode==="joint")await h.controller.jog(point);else await h.controller.jog({id:"c",name:"C",kind:"cartesian",pose:{x:300,y:0,z:200,r:0}},true);
 expect(h.status()).toBe("error");expect(h.joints()[0]).toBeGreaterThan(1);expect(h.joints()[0]).toBeLessThan(1.83);expect(h.outputs).toEqual([]);
 }
});
it("stops queued Lua/Python motion and output after a collision",async()=>{
 for(const language of ["lua","python"] as const){let worker: {onmessage:((event:MessageEvent)=>void)|null}|undefined;
 vi.stubGlobal("Worker",class{onmessage=null;postMessage(){}terminate(){}constructor(){worker=this;}});
 const h=harness();h.controller.run("queued",[],language);
 const emit=(data:unknown)=>worker!.onmessage?.({data} as MessageEvent);
 emit({type:"motion",motion:{commandId:1,command:"JointMovJ",targetJoints:[2.7,0,0,0],speed:100,acceleration:100,sync:false}});emit({type:"io",index:1,value:true});emit({type:"script-complete"});
 await vi.waitFor(()=>expect(h.status()).toBe("error"));expect(h.outputs).toEqual([]);const held=[...h.joints()];await new Promise(r=>setTimeout(r,5));expect(h.joints()).toEqual(held);
 }
});
it("rejects platform penetration and a rotating carried corner; allows support contact",()=>{
 const project=structuredClone(DEFAULT_PROJECT);project.tool.mode="magnet";project.scene.blocks=[];
 expect(()=>assertCollisionFree(model,[2,0,-1,0],project,[],assets,null,0)).toThrow(/平台/);
 const carried={id:"carried",kind:"block" as const,source:"pickup" as const,color:"neutral" as const,position:{x:300,y:0},r:0};
 const obstacle={...carried,id:"obstacle",position:{x:345,y:0},z:75};
 expect(()=>assertCollisionFree(model,[3,0,0,0],project,[carried,obstacle],assets,"carried",0)).not.toThrow();
 expect(()=>assertCollisionFree(model,[3,0,0,Math.PI/4],project,[carried,obstacle],assets,"carried",0)).toThrow(/承載工件/);
 const placed={...carried,position:{x:300,y:0}};
 expect(()=>assertPlacementClear(placed,[placed,{...placed,id:"upper",stackLevel:1}],project)).not.toThrow();
 expect(()=>assertPlacementClear(placed,[placed,{...placed,id:"overlap",position:{x:310,y:0}}],project)).toThrow(/重疊/);
});
it("rejects missing or unsupported geometry explicitly",()=>{
 expect(()=>assertCollisionFree(model,[3,0,0,0],DEFAULT_PROJECT,[],{...assets,supported:false},null,0)).toThrow(/未支援/);
});

it("bounds actual nonlinear IK jumps before a large frame can cross an obstacle",async()=>{
 const nonlinear={...model,solve:(p:{x:number;y:number;z:number;r:number})=>({ok:true,joints:[p.x>100&&p.x<101?2.7:p.x/100,0,0,0],positionErrorMm:0,angleErrorDeg:0})} as unknown as MG400Kinematics;
 const h=harness(nonlinear),positions:JointAngles[]=[];
 const original=h.events.setJoints;
 h.events.setJoints=j=>{positions.push(j);original(j);};
 await h.controller.jog({id:"nonlinear",name:"Nonlinear",kind:"cartesian",pose:{x:101,y:0,z:200,r:0}},true);
 expect(h.status()).toBe("error");expect(h.joints()[0]).toBeLessThan(1.83);
 expect(positions.length).toBeGreaterThan(1);
 let previous=1;
 for(const position of positions){expect(Math.abs(position[0]-previous)).toBeLessThanOrEqual(0.5/1200+1e-9);previous=position[0];}
});
it("checks the prospective pickup before attachment or DO mutation",async()=>{
 let worker:{onmessage:((event:MessageEvent)=>void)|null}|undefined;
 vi.stubGlobal("Worker",class{onmessage=null;postMessage(){}terminate(){}constructor(){worker=this;}});
 const h=harness();
 h.project.scene.blocks=[{id:"source",kind:"magnet",source:"pickup",color:"neutral",position:{x:200,y:0},r:0,z:88},{id:"neighbour",kind:"magnet",source:"pickup",color:"neutral",position:{x:240,y:0},r:0,z:88}];
 h.events.setJoints([2.1,0,.025,0]);h.controller.run("pick",[]);
 worker!.onmessage?.({data:{type:"io",index:1,value:true}} as MessageEvent);
 await vi.waitFor(()=>expect(h.status()).toBe("error"));
 expect(h.attached()).toBe(false);expect(h.outputs).toEqual([]);
});
it("rejects an airborne release without teleporting or detaching the workpiece",()=>{
 const h=harness();h.project.scene.blocks=[{id:"source",kind:"magnet",source:"pickup",color:"neutral",position:{x:200,y:0},r:0,z:88}];
 const internal=h.controller as unknown as {performToolAction:(action:"pick"|"place")=>void};
 h.events.setJoints([2,0,.025,0]);internal.performToolAction("pick");
 expect(h.attached()).toBe(true);
 h.events.setJoints([2,0,.3,0]);const before=structuredClone(h.project.scene.blocks);
 expect(()=>internal.performToolAction("place")).toThrow(/空中/);
 expect(h.attached()).toBe(true);expect(h.project.scene.blocks).toEqual(before);
});
it("checks released occupied volumes against fixed fixtures",()=>{
 const project=structuredClone(DEFAULT_PROJECT);project.scene.platformHeightMm=0;
 const buried={id:"buried",kind:"block" as const,source:"pickup" as const,color:"neutral" as const,position:{x:300,y:0},r:0};
 expect(()=>assertPlacementClear(buried,[buried],project)).toThrow(/平台/);
});

it("rejects an obstacle-free IK branch jump instead of bending MovL off its line",async()=>{
 const nonlinear={...model,solve:(p:{x:number})=>({ok:true,joints:[p.x>100&&p.x<101?2.7:p.x/100,0,0,0],positionErrorMm:0,angleErrorDeg:0})} as unknown as MG400Kinematics;
 const h=harness(nonlinear);h.project.scene.blocks=[];
 const positions:JointAngles[]=[];const set=h.events.setJoints;
 h.events.setJoints=j=>{positions.push(j);set(j);};
 await h.controller.jog({id:"line",name:"Line",kind:"cartesian",pose:{x:101,y:0,z:200,r:0}},true);
 expect(h.status()).toBe("error");
 for(const joints of positions){const p=model.forward(joints,h.project.tool.flangeOffset,h.project.tool.tcpOffsets.magnet);expect(p.x).toBeGreaterThanOrEqual(99.5);expect(p.x).toBeLessThanOrEqual(101.5);expect(Math.hypot(p.y,p.z-200)).toBeLessThanOrEqual(.5);}
 expect(h.joints()[0]).toBeLessThan(1.02);
});
