import xml from "../../public/models/mg400/mg400_description/urdf/mg400_description.urdf?raw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import URDFLoader from "urdf-loader";
import { Box3, BoxGeometry, Mesh, Quaternion, Vector3, type Group, type Scene, type BufferGeometry, type PerspectiveCamera } from "three";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import { MG400Kinematics } from "./mg400Kinematics";
import type { JointAngles } from "../domain";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { SimulatorScene, type SceneStatus } from "./SimulatorScene";

vi.mock("three", async (importOriginal) => {
  const three = await importOriginal<typeof import("three")>();
  return { ...three, WebGLRenderer: class {
    shadowMap = {};
    setPixelRatio() {} setClearColor() {} setSize() {} render() {} dispose() {}
  } };
});
vi.mock("three/examples/jsm/controls/OrbitControls.js", async () => {
  const { Vector3 } = await import("three");
  return { OrbitControls: class { target = new Vector3(); update() {} dispose() {} } };
});

const stl = "solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle";
const NativeRequest = Request;
beforeEach(() => {
  vi.stubGlobal("Request", class extends NativeRequest {
    constructor(input: string, init?: RequestInit) { super(new URL(input, "http://localhost").href, init); }
  });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  // Keep Three loaders in the test realm; external URDF imports otherwise use
  // Node's native fetch rather than the jsdom fetch stub.
  vi.spyOn(URDFLoader.prototype, "defaultMeshLoader").mockImplementation((url, manager, material, done) => {
    new STLLoader(manager).load(url, (geometry) => done(new Mesh(geometry, material)), undefined, (error) => done(null!, error as Error));
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("finishes both overlapping scenes only after all nine real STL callbacks attach", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const fetch = vi.fn(async () => { await pending; return new Response(stl); });
  vi.stubGlobal("fetch", fetch);
  const statuses: SceneStatus[][] = [[], []];
  const scenes = statuses.map((list) => SimulatorScene.create(document.createElement("canvas"), xml, (status) => list.push(status)));
  expect(fetch).toHaveBeenCalledTimes(9);
  expect(statuses.every((list) => list.at(-1)?.kind === "loading")).toBe(true);
  finish();
  const views = await Promise.all(scenes);
  expect(statuses.every((list) => list.at(-1)?.kind === "ready")).toBe(true);
  for (const view of views) {
    let count = 0;
    (view as unknown as { robot: import("urdf-loader").URDFRobot }).robot.traverse((object) => {
      if ((object as import("three").Mesh).isMesh) count++;
    });
    expect(count).toBe(9);
    view.dispose();
  }
});

it("reports a failed STL and never emits ready", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const responses: Promise<Response>[] = [];
  vi.stubGlobal("fetch", (request: Request) => {
    const response = request.url.toLowerCase().endsWith("base_link.stl")
      ? Promise.resolve(new Response("missing", { status: 404 }))
      : pending.then(() => new Response(stl));
    responses.push(response);
    return response;
  });
  const statuses: SceneStatus[] = [];
  const view = await SimulatorScene.create(document.createElement("canvas"), xml, (status) => statuses.push(status));
  expect(statuses.some((status) => status.kind === "ready")).toBe(false);
  expect(statuses.at(-1)?.kind).toBe("error");
  release();
  await Promise.all(responses);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(statuses.at(-1)?.kind).toBe("error");
  view.dispose();
});


for (const withPuck of [false, true]) it(`preserves first non-magnet Body1 world transforms (preceding magnet=${withPuck})`, async () => {
  vi.stubGlobal("fetch", async () => new Response(stl));
  const view=await SimulatorScene.create(document.createElement("canvas"),xml,()=>undefined);
  const internals=view as unknown as {scene:Scene;toolGroup:Group;block:Mesh;localForkBlockGeometry:BufferGeometry;appliedLocalMeshes:{blockProfile:"body1"};applyRobotAndTool:()=>void};
  const geometry=new BoxGeometry(40,40,40);geometry.translate(0,0,20);
  internals.localForkBlockGeometry=geometry;internals.appliedLocalMeshes={blockProfile:"body1"};
  const project=structuredClone(DEFAULT_PROJECT);project.tool.mode="fork";
  if (withPuck) project.scene.blocks.unshift({id:"magnet-first",kind:"magnet",source:"pickup",color:"neutral",position:{x:200,y:0},r:0});
  const model=MG400Kinematics.fromUrdf(xml);const home=project.points[0];
  const seed=home.kind==="joint"?home.joints:[0,0,0,0] as JointAngles;
  const load=model.solve({x:300,y:-80,z:155,r:-90},seed,project.tool.flangeOffset,project.tool.tcpOffsets.fork);
  expect(load.ok).toBe(true);
  const state={joints:load.joints,project,blockPosition:{x:300,y:-80},attached:false,target:null};
  view.setState(state);internals.applyRobotAndTool();internals.scene.updateMatrixWorld(true);
  const before=internals.block.getWorldPosition(new Vector3());const yaw=internals.block.getWorldQuaternion(new Quaternion());
  view.setState({...state,attached:true,attachedCellBlockId:"tower-1"});internals.applyRobotAndTool();internals.scene.updateMatrixWorld(true);
  expect(internals.block.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(.5);
  expect(internals.block.getWorldQuaternion(new Quaternion()).angleTo(yaw)).toBeLessThan(.001);
  const place=model.solve({x:300,y:80,z:155,r:0},load.joints,project.tool.flangeOffset,project.tool.tcpOffsets.fork);expect(place.ok).toBe(true);
  view.setState({...state,joints:place.joints,attached:true,attachedCellBlockId:"tower-1"});internals.applyRobotAndTool();internals.scene.updateMatrixWorld(true);
  const held=internals.block.getWorldPosition(new Vector3());const heldYaw=internals.block.getWorldQuaternion(new Quaternion());
  const blockIndex=project.scene.blocks.findIndex(block=>block.id==="tower-1");
  project.scene.blocks[blockIndex]={...project.scene.blocks[blockIndex],position:{x:300,y:80},r:90};
  view.setState({...state,joints:place.joints,attached:false,attachedCellBlockId:null});internals.applyRobotAndTool();internals.scene.updateMatrixWorld(true);
  expect(internals.block.getWorldPosition(new Vector3()).distanceTo(held)).toBeLessThan(.5);
  expect(internals.block.getWorldQuaternion(new Quaternion()).angleTo(heldYaw)).toBeLessThan(.005);
  expect(internals.block.position.z).toBe(130);
  view.dispose();
});

it("uses one shared front platform and keeps explicit magnetic objects above it in fork mode",async()=>{
 vi.stubGlobal("fetch",async()=>new Response(stl));
 const view=await SimulatorScene.create(document.createElement("canvas"),xml,()=>undefined);
 const project=structuredClone(DEFAULT_PROJECT);project.tool.mode="fork";
 project.scene.blocks=[project.scene.blocks[0],{id:"magnet",kind:"magnet",color:"neutral",source:"pickup",position:{x:480,y:220},z:25,r:0}];
 view.setState({joints:[0,0,0,0],project,blockPosition:project.scene.block,attached:false,target:null});
 const internals=view as unknown as {teachingPlatform:Mesh;magnetStands:Map<string,Mesh>;additionalBlocks:Map<string,Mesh>};
 expect(internals.teachingPlatform.visible).toBe(true);
 expect(internals.teachingPlatform.scale.z).toBe(110);
 expect(internals.teachingPlatform.position.z).toBe(55);
 const geometry=internals.teachingPlatform.geometry as BoxGeometry;
 expect(geometry.parameters.width).toBe(340);expect(geometry.parameters.height).toBe(320);
 expect(internals.teachingPlatform.position.x+geometry.parameters.width*internals.teachingPlatform.scale.x/2).toBe(440);
 expect(internals.magnetStands.size).toBe(0);
 expect(internals.additionalBlocks.get("magnet")?.position.z).toBe(137);
 view.dispose();
});

it("keeps the platform fixed while supply pieces move and projects placement onto its top", async () => {
 vi.stubGlobal("fetch", async () => new Response(stl));
 const canvas = document.createElement("canvas");
 vi.spyOn(canvas,"getBoundingClientRect").mockReturnValue({left:0,top:0,width:800,height:600,right:800,bottom:600,x:0,y:0,toJSON:()=>({})});
 const view = await SimulatorScene.create(canvas,xml,()=>undefined);
 const project = structuredClone(DEFAULT_PROJECT);
 const state = {joints:[0,0,0,0] as JointAngles,project,blockPosition:project.scene.block,attached:false,target:null};
 view.setState(state);
 const internals = view as unknown as {teachingPlatform:Mesh;camera:PerspectiveCamera};
 const position = internals.teachingPlatform.position.clone();
 const scale = internals.teachingPlatform.scale.clone();
 project.scene.blocks = project.scene.blocks.map(block=>({...block,source:"unloaded",position:{x:300,y:80}}));
 view.setState(state);
 expect(internals.teachingPlatform.position.toArray()).toEqual(position.toArray());
 expect(internals.teachingPlatform.scale.toArray()).toEqual(scale.toArray());
 internals.camera.lookAt(new Vector3(300,0,110));
 internals.camera.updateMatrixWorld(true);
 expect(view.tablePositionFromPointer(400,300)).toEqual({x:300,y:0});
 view.dispose();
});

it("keeps the platform fixed and renders every Body1 layer from the supplied STL without support posts",async()=>{
 vi.stubGlobal("fetch",async()=>new Response(stl));
 const view=await SimulatorScene.create(document.createElement("canvas"),xml,()=>undefined);
 const {prepareLessonProject}=await import("../training/practiceSetup");
 const project=prepareLessonProject("intermediate-three-layer-tower");
 const internals=view as unknown as {block:Mesh;additionalBlocks:Map<string,Mesh>;localForkBlockGeometry:BufferGeometry;teachingPlatform:Mesh;forkFixtures:Group;target:Group};
 // Exact asset geometry, unlike the scene's generic procedural cube.
 // @ts-expect-error Asset evidence uses the Node-only test runtime.
 const {readFileSync}=await import("node:fs");
 const bytes=readFileSync("public/models/tools/Body1.stl");internals.localForkBlockGeometry=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 internals.localForkBlockGeometry.computeBoundingBox();const bounds=internals.localForkBlockGeometry.boundingBox!;internals.localForkBlockGeometry.translate(-(bounds.min.x+bounds.max.x)/2,-(bounds.min.y+bounds.max.y)/2,-bounds.min.z);
 project.scene.blocks.forEach((block,i)=>{block.source="output";block.position={x:300,y:80};block.stackLevel=i;block.r=i===1?90:0;});
 view.setState({joints:[0,0,0,0],project,blockPosition:project.scene.block,attached:false,target:{x:300,y:80,z:150,r:0}});
 expect(internals.block.geometry).toBe(internals.localForkBlockGeometry);
 expect(internals.block.position.z).toBe(110);
 expect([...internals.additionalBlocks.values()].map(mesh=>mesh.position.z)).toEqual([150,190]);
 expect([...internals.additionalBlocks.values()].every(mesh=>mesh.geometry.getAttribute("position").count===internals.localForkBlockGeometry.getAttribute("position").count)).toBe(true);
 expect(internals.forkFixtures.visible).toBe(false);
 expect(internals.target.position.z).toBeGreaterThan(150);
 expect(internals.teachingPlatform.position.toArray()).toEqual([270,0,55]);expect(internals.teachingPlatform.scale.toArray()).toEqual([1,1,110]);
 project.tool.mode="magnet";
 view.setState({joints:[0,0,0,0],project,blockPosition:project.scene.block,attached:false,target:null});
 expect(internals.block.geometry).toBe(internals.localForkBlockGeometry);
 expect(internals.block.position.z).toBe(110);
 expect([...internals.additionalBlocks.values()].every(mesh=>mesh.geometry.getAttribute("position").count===132)).toBe(true);
 expect([...internals.additionalBlocks.values()].map(mesh=>mesh.position.z)).toEqual([150,190]);
 project.scene.blocks[0].position={x:480,y:220};project.scene.platformHeightMm=0;
 view.setState({joints:[0,0,0,0],project,blockPosition:project.scene.block,attached:false,target:null});
 expect(internals.teachingPlatform.position.toArray()).toEqual([270,0,55]);expect(internals.teachingPlatform.scale.toArray()).toEqual([1,1,110]);
 view.dispose();
});

it("frames the actual output arrangement and its stack height while leaving the teaching platform fixed", async () => {
 vi.stubGlobal("fetch", async () => new Response(stl));
 const view = await SimulatorScene.create(document.createElement("canvas"), xml, () => undefined);
 const project = structuredClone(DEFAULT_PROJECT);
 project.scene.blocks = [
  {id:"output-lower",kind:"block",color:"neutral",source:"output",position:{x:230,y:-60},r:0,stackLevel:0},
  {id:"output-upper",kind:"block",color:"white",source:"output",position:{x:230,y:-60},r:90,stackLevel:1},
  {id:"output-single",kind:"block",color:"black",source:"output",position:{x:390,y:45},r:0,stackLevel:0},
 ];
 view.setState({joints:[0,0,0,0],project,blockPosition:project.scene.block,attached:false,target:null});
 const internals = view as unknown as {scene:Scene;block:Mesh;additionalBlocks:Map<string,Mesh>;camera:PerspectiveCamera;controls:{target:Vector3;minDistance:number};teachingPlatform:Mesh;robotRoot:Group};
 internals.scene.updateMatrixWorld(true);
 const bounds = new Box3().expandByObject(internals.block);
 for (const mesh of internals.additionalBlocks.values()) bounds.expandByObject(mesh);
 const center = bounds.getCenter(new Vector3());
 const platformPosition = internals.teachingPlatform.position.clone();
 const platformScale = internals.teachingPlatform.scale.clone();
 const robotPosition = internals.robotRoot.position.clone();

 view.focusPlacedWorkpieces();

 expect(internals.controls.target.distanceTo(center)).toBeLessThan(0.001);
 expect(internals.camera.position.distanceTo(center)).toBeGreaterThan(internals.controls.minDistance);
 internals.camera.updateMatrixWorld(true);
 const verticalFov = internals.camera.fov * Math.PI / 180;
 const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * internals.camera.aspect);
 for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
  const point = new Vector3(x,y,z).applyMatrix4(internals.camera.matrixWorldInverse);
  const depth = -point.z;
  expect(Math.abs(point.x / depth)).toBeLessThan(Math.tan(horizontalFov / 2));
  expect(Math.abs(point.y / depth)).toBeLessThan(Math.tan(verticalFov / 2));
 }
 expect(internals.teachingPlatform.position.toArray()).toEqual(platformPosition.toArray());
 expect(internals.teachingPlatform.scale.toArray()).toEqual(platformScale.toArray());
 expect(internals.teachingPlatform.position.toArray()).toEqual([270,0,55]);
 expect(internals.teachingPlatform.scale.toArray()).toEqual([1,1,110]);
 expect(internals.robotRoot.position.toArray()).toEqual(robotPosition.toArray());

 project.scene.blocks = project.scene.blocks.map(block => ({...block,source:"pickup"}));
 view.setState({joints:[0,0,0,0],project,blockPosition:project.scene.block,attached:false,target:null});
 view.resetCamera();
 const overviewPosition = internals.camera.position.clone();
 const overviewTarget = internals.controls.target.clone();
 view.focusPlacedWorkpieces();
 expect(internals.camera.position.toArray()).toEqual(overviewPosition.toArray());
 expect(internals.controls.target.toArray()).toEqual(overviewTarget.toArray());
 view.dispose();
});
