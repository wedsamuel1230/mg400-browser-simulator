// @vitest-environment node
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
// @ts-expect-error jsdom runtime is provided by the test environment package.
import {JSDOM} from "jsdom";
import {LuaFactory,type LuaEngine} from "wasmoon";
import {loadPyodide,type PyodideInterface} from "pyodide";
import xml from "../../public/models/mg400/mg400_description/urdf/mg400_description.urdf?raw";
import {MG400Kinematics} from "../sim/mg400Kinematics";
import {SimulationController,type ControllerEvents} from "../sim/SimulationController";
import {newTaskEvidence,observeTaskFrame,assessRobotTask} from "../sim/taskAssessment";
import {activeTcpOffset,type JointAngles,type Pose} from "../domain";
import type {MotionRequest} from "../sim/luaTypes";
import {prepareLessonProject,BODY1_LESSONS} from "./practiceSetup";
import {recommendPickAndPlace} from "../sim/codeRecommendation";

type Command={type:"motion";motion:MotionRequest}|{type:"io";value:boolean};
let lua:LuaEngine,python:PyodideInterface;
beforeAll(async()=>{[lua,python]=await Promise.all([new LuaFactory().createEngine(),loadPyodide()]);},60000);
afterAll(()=>{lua?.global.close();python?.globals.destroy();vi.unstubAllGlobals();});

it("keeps a valid prepared tower recommendation ready after a released block moves",()=>{
 const project=prepareLessonProject("intermediate-three-layer-tower");
 const reachable={solve:()=>({ok:true,joints:[0,0,0,0],positionErrorMm:0,angleErrorDeg:0})} as unknown as Pick<MG400Kinematics,"solve">;
 expect(recommendPickAndPlace(project,"lua",reachable,"","body1").ready).toBe(true);
 project.scene.block={...project.scene.drop};
 project.scene.blocks[0]={...project.scene.blocks[0],source:"output",position:{...project.scene.drop},stackLevel:0};
 expect(recommendPickAndPlace(project,"lua",reachable,"","body1").ready).toBe(false);
 expect(recommendPickAndPlace({...project,scene:{...project.scene,blocks:structuredClone(project.scene.initialBlocks),block:{...project.scene.initialBlocks[0].position}}},"lua",reachable,"","body1").ready).toBe(true);
});

describe("actual controller executions of prepared Lua/Python examples",()=>{
 for(const language of ["lua","python"] as const) for(const id of [...BODY1_LESSONS,"intermediate-black-white-sort"]){
  it(`${language}: ${id}`,async()=>{
   vi.stubGlobal("DOMParser",new JSDOM().window.DOMParser);
   const project=prepareLessonProject(id),before=structuredClone(project),model=MG400Kinematics.fromUrdf(xml);
   const home=project.points.find(point=>point.name==="Home")!;
   let joints=home.kind==="joint"?home.joints:[0,0,0,0] as JointAngles,attached=false,attachedId:string|null=null,location={...project.scene.block};
   const evidence=newTaskEvidence(),transitions:boolean[]=[],commands:Command[]=[];
   const observe=()=>observeTaskFrame(evidence,model.forward(joints,project.tool.flangeOffset,activeTcpOffset(project.tool)),attached?attachedId:null);
   const events:ControllerEvents={getProject:()=>project,getJoints:()=>joints,isAttached:()=>attached,getBlock:()=>location,getForkContactProfile:()=>"body1",getCellBlocks:()=>project.scene.blocks,
    setCellBlocks:blocks=>{project.scene.blocks=blocks;},setJoints:value=>{joints=value;observe();},setAttached:value=>{attached=value;transitions.push(value);observe();},setAttachedCellBlockId:value=>{attachedId=value;observe();},setBlock:value=>{location=value;},setDigitalOutput:()=>{},setStatus:()=>{},addLog:()=>{}};
   const controller=new SimulationController(model,events);
   const internal=controller as unknown as {stopped:boolean;generation:number;animateMotion:(motion:MotionRequest,generation:number)=>Promise<void>;resolveRelativeMotion:(motion:MotionRequest)=>MotionRequest;performToolAction:(action:"pick"|"place")=>void; updatePassiveFork:(previous:Pose,current:Pose)=>void; passiveForkState:unknown; attachedCellBlockId:string|null};
   internal.stopped=false;
   const trace:unknown[]=[], update=internal.updatePassiveFork.bind(internal);
   internal.updatePassiveFork=(previous,current)=>{update(previous,current);trace.push({world:current,attachedId:internal.attachedCellBlockId,phase:structuredClone(internal.passiveForkState),blocks:project.scene.blocks.map(block=>({id:block.id,source:block.source,level:block.stackLevel}))});};
   let clock=performance.now();
   vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>setTimeout(()=>callback(clock+=16),0));
   vi.stubGlobal("cancelAnimationFrame",(handle:number)=>clearTimeout(handle));
   const push=(command:MotionRequest["command"],target:unknown)=>{
    const value=target as {coordinate?:Pose;joints?:JointAngles};
    const motion:MotionRequest={commandId:commands.length+1,command,speed:100,acceleration:100,sync:true};
    if(command==="JointMovJ")motion.targetJoints=value.joints;
    else if(command==="RelMovL") {const a=target as number[];motion.relativeOffset={x:a[0],y:a[1],z:a[2],r:a[3]};}
    else motion.targetPose=value.coordinate;
    commands.push({type:"motion",motion});
   };
   if(language==="lua"){
    for(const command of ["MovJ","MovL","RelMovL","JointMovJ"] as const)lua.global.set(command,(target:unknown)=>push(command,target));
    lua.global.set("DO",(_index:number,value:boolean)=>commands.push({type:"io",value:Boolean(value)}));lua.global.set("ON",true);lua.global.set("OFF",false);lua.global.set("Sync",()=>{});
    for(const point of project.points)lua.global.set(point.name,point.kind==="joint"?{joints:point.joints}:{coordinate:point.pose});
    await lua.doString(project.script);
   }else{
    python.globals.set("__source",project.pythonScript);
    python.globals.set("__points",JSON.stringify(Object.fromEntries(project.points.map(point=>[point.name,point.kind==="joint"?{joints:point.joints}:{coordinate:point.pose}]))));
    const raw=python.runPython(`import json\n__commands=[]\nglobals().update(json.loads(__points))\nON=True\nOFF=False\ndef mov_j(p,**kw): __commands.append(['MovJ',p])\ndef mov_l(p,**kw): __commands.append(['MovL',p])\ndef rel_mov_l(p,**kw): __commands.append(['RelMovL',p])\ndef joint_mov_j(p,**kw): __commands.append(['JointMovJ',p])\ndef do(i,v): __commands.append(['DO',v])\ndef sync(): pass\nexec(__source)\njson.dumps(__commands)`);
    for(const [command,target] of JSON.parse(raw as string))if(command==="DO")commands.push({type:"io",value:target});else push(command,target);
   }
   if(project.tool.mode==="fork")expect(commands.filter(command=>command.type==="io")).toEqual([]);
   for(const command of commands){
    if(command.type==="io")internal.performToolAction(command.value?"pick":"place");
    else {clock=performance.now(); await internal.animateMotion(internal.resolveRelativeMotion(command.motion),internal.generation);}
   }
   expect(attached,JSON.stringify(trace.slice(-24))).toBe(false);
   expect(project.scene.blocks.every(block=>block.source==="output"), JSON.stringify({blocks:project.scene.blocks,cycles:evidence.cycles})).toBe(true);
   expect(evidence.cycles).toHaveLength(project.scene.blocks.length);
   expect(transitions.filter(value=>value)).toHaveLength(project.scene.blocks.length);
   expect(assessRobotTask(id,before,project,evidence,"body1").filter(check=>!check.passed)).toEqual([]);
   if(id.endsWith("tower")){expect(project.scene.blocks.map(block=>block.stackLevel)).toEqual([0,1,2]);expect(project.scene.blocks.map(block=>Math.round(block.r)||0)).toEqual([0,90,0]);expect(evidence.cycles.map(cycle=>Math.round(cycle.release!.z))).toEqual([135,175,215]);}
   if(id.endsWith("sort")){expect(project.scene.blocks.map(block=>block.stackLevel)).toEqual([0,0,1,1]);expect(project.scene.blocks.map(block=>Math.round(block.position.x))).toEqual([250,350,250,350]);expect(evidence.cycles.map(cycle=>Math.round(cycle.release!.z))).toEqual([114,114,118,118]);}
   vi.unstubAllGlobals();
  },60000);
 }
});
