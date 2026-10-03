import xml from "../../public/models/mg400/mg400_description/urdf/mg400_description.urdf?raw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import URDFLoader from "urdf-loader";
import { BoxGeometry, Mesh, Quaternion, Vector3, type Group, type Scene, type BufferGeometry, type PerspectiveCamera } from "three";
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
 expect(geometry.parameters.width).toBe(260);expect(geometry.parameters.height).toBe(320);
 expect(internals.teachingPlatform.position.x+geometry.parameters.width*internals.teachingPlatform.scale.x/2).toBeGreaterThanOrEqual(505);
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
