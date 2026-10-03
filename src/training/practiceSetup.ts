import { DEFAULT_PROJECT } from "../data/defaultProject";
import { type ProgramLanguage, type ProjectDocument } from "../domain";
import { forkContactPose, forkEntryPose } from "../sim/forkTool";

export const BODY1_LESSONS = ["intermediate-passive-fork", "intermediate-rotate-carried-block", "intermediate-three-layer-tower"];
export const SORT_BINS = { black: { x: 250, y: 80 }, white: { x: 350, y: 80 } };

/** Fresh teaching cells; importing an existing project never calls this preparation. */
export function prepareLessonProject(id: string): ProjectDocument {
  const project = structuredClone(DEFAULT_PROJECT);
  const fork = BODY1_LESSONS.includes(id);
  project.tool.mode = fork ? "fork" : "magnet";
  project.scene.body1SupportHeightMm = 0;
  if (fork) {
    const xs = id === "intermediate-three-layer-tower" ? [250, 300, 350] : [300];
    project.scene.blocks = xs.map((x, i) => ({ id: `tower-${i+1}`, kind: "block", geometry: "body1", color: "neutral", source: "pickup", position: { x, y: -80 }, r: 0 }));
    project.scene.block = { ...project.scene.blocks[0].position };
    const pick = forkContactPose(project.scene.block, 0, "body1", false, 110, 0);
    const place = forkContactPose(project.scene.drop, 0, "body1", true, 110, 0);
    const poses = { PickPoint: pick, PickApproach: forkEntryPose(pick), PlacePoint: place, PlaceApproach: { ...place, z: place.z+80 } };
    project.points = project.points.map(point => point.kind === "cartesian" && point.name in poses ? { ...point, pose: poses[point.name as keyof typeof poses] } : point);
  } else if (id === "intermediate-black-white-sort") {
    project.scene.blocks = [250,300,350,400].map((x,i) => ({ id: `feed-${i+1}`, kind: "magnet", color: i%2 ? "white" : "black", source: "feeder", position: { x, y: -100 }, r: 0 }));
  } else {
    project.scene.blocks = [{ ...project.scene.blocks[0], kind: "magnet" }];
  }
  project.scene.initialBlocks = structuredClone(project.scene.blocks);
  project.scene.feederOrder = project.scene.blocks.filter(block => block.source === "feeder").map(block => block.id);
  project.script = fork ? body1LessonProgram("lua", id) : id === "intermediate-black-white-sort" ? sortingProgram("lua") : project.script;
  project.pythonScript = fork ? body1LessonProgram("python", id) : id === "intermediate-black-white-sort" ? sortingProgram("python") : project.pythonScript;
  return project;
}

const authoredPython = (source: string) => "def task():\n" + source.replace(/\bawait /g, "").split("\n").map(line=>"    "+line).join("\n") + "\ntask()";

export function body1LessonProgram(language: ProgramLanguage, id: string): string {
  const tower = id === "intermediate-three-layer-tower", rotate = id === "intermediate-rotate-carried-block";
  if (language === "lua") return [
    "-- Supplied 40×40×40 Body1, directly on Z110; passive fork, no digital output.",
    `local sourceX = {${tower ? "250,300,350" : "300"}}`,
    `for layer = 1, ${tower ? 3 : 1} do`,
    `  local turn = ${tower ? "layer == 2" : rotate ? "true" : "false"}`,
    "  local r = -90", "  if turn then r = 0 end",
    "  MovJ({coordinate={x=sourceX[layer],y=-20,z=132.5,r=-90}}, {CP=0,SYNC=1})",
    "  MovL({coordinate={x=sourceX[layer],y=-80,z=132.5,r=-90}}, {CP=0,SYNC=1})",
    "  RelMovL({0,0,2.5,0}, {CP=0,SYNC=1}) -- take the load first",
    "  RelMovL({0,0,80,0}, {CP=0,SYNC=1})",
    "  if turn then RelMovL({0,0,0,90}, {CP=0,SYNC=1}) end",
    "  local z = 135 + 40*(layer-1)",
    "  MovJ({coordinate={x=300,y=80,z=z+80,r=r}}, {CP=0,SYNC=1})",
    "  MovL({coordinate={x=300,y=80,z=z,r=r}}, {CP=0,SYNC=1})",
    "  MovL({coordinate={x=300,y=80,z=z-2.5,r=r}}, {CP=0,SYNC=1})",
    "  MovL({coordinate={x=300-60*math.cos(math.rad(r)),y=80-60*math.sin(math.rad(r)),z=z-2.5,r=r}}, {CP=0,SYNC=1})",
    "  RelMovL({0,0,80,0}, {CP=0,SYNC=1})", "end", "JointMovJ(Home,{CP=0})", "Sync()",
  ].join("\n");
  return authoredPython([
    "import math", "# Supplied 40×40×40 Body1 on Z110; passive fork.",
    `for layer, x in enumerate([${tower ? "250,300,350" : "300"}]):`,
    `    turn = ${tower ? "layer == 1" : rotate ? "True" : "False"}`,
    "    r = 0 if turn else -90",
    "    await mov_j({'coordinate':{'x':x,'y':-20,'z':132.5,'r':-90}},cp=0)",
    "    await mov_l({'coordinate':{'x':x,'y':-80,'z':132.5,'r':-90}},cp=0)",
    "    await rel_mov_l([0,0,2.5,0],cp=0)", "    await rel_mov_l([0,0,80,0],cp=0)",
    "    if turn: await rel_mov_l([0,0,0,90],cp=0)", "    z = 135 + 40*layer",
    "    await mov_j({'coordinate':{'x':300,'y':80,'z':z+80,'r':r}},cp=0)",
    "    await mov_l({'coordinate':{'x':300,'y':80,'z':z,'r':r}},cp=0)",
    "    await mov_l({'coordinate':{'x':300,'y':80,'z':z-2.5,'r':r}},cp=0)",
    "    await mov_l({'coordinate':{'x':300-60*math.cos(math.radians(r)),'y':80-60*math.sin(math.radians(r)),'z':z-2.5,'r':r}},cp=0)",
    "    await rel_mov_l([0,0,80,0],cp=0)", "await joint_mov_j(Home,cp=0)", "await sync()",
  ].join("\n"));
}

export function sortingProgram(language: ProgramLanguage): string {
  if (language === "lua") return [
    "-- Four spaced 35×35×4 plates: black, white, black, white. Keep two separate stacks.",
    "local sourceX = {250,300,350,400}", "local counts = {0,0}", "for i=1,4 do",
    "  local color = 1", "  local x = 250", "  local r = 0",
    "  if i % 2 == 0 then color=2; x=350; r=45 end",
    "  MovJ({coordinate={x=sourceX[i],y=-100,z=114,r=0}}, {CP=0,SYNC=1})", "  DO(1,ON)",
    "  RelMovL({0,0,80,0}, {CP=0,SYNC=1})", "  if color == 2 then RelMovL({0,0,0,45}, {CP=0,SYNC=1}) end",
    "  local z = 114 + 4*counts[color]",
    "  MovJ({coordinate={x=x,y=80,z=z+80,r=r}}, {CP=0,SYNC=1})",
    "  MovL({coordinate={x=x,y=80,z=z,r=r}}, {CP=0,SYNC=1})", "  DO(1,OFF)",
    "  counts[color] = counts[color]+1", "  RelMovL({0,0,80,0}, {CP=0,SYNC=1})", "end", "JointMovJ(Home,{CP=0})", "Sync()",
  ].join("\n");
  return authoredPython([
    "# Four spaced 35×35×4 plates; independent black and white height counts.", "counts = [0,0]",
    "for i, source_x in enumerate([250,300,350,400]):", "    color = i % 2", "    x = 350 if color else 250", "    r = 45 if color else 0",
    "    await mov_j({'coordinate':{'x':source_x,'y':-100,'z':114,'r':0}},cp=0)", "    do(1,ON)",
    "    await rel_mov_l([0,0,80,0],cp=0)", "    if color: await rel_mov_l([0,0,0,45],cp=0)",
    "    z = 114 + 4*counts[color]",
    "    await mov_j({'coordinate':{'x':x,'y':80,'z':z+80,'r':r}},cp=0)",
    "    await mov_l({'coordinate':{'x':x,'y':80,'z':z,'r':r}},cp=0)", "    do(1,OFF)",
    "    counts[color] += 1", "    await rel_mov_l([0,0,80,0],cp=0)", "await joint_mov_j(Home,cp=0)", "await sync()",
  ].join("\n"));
}
