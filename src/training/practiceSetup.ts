import { DEFAULT_PROJECT } from "../data/defaultProject";
import { authoredPythonProgram, type ProgramLanguage, type ProjectDocument, type ToolMode } from "../domain";
import { forkContactPose, forkEntryPose } from "../sim/forkTool";

export const BODY1_LESSONS = ["intermediate-passive-fork", "intermediate-rotate-carried-block", "intermediate-three-layer-tower"];
export const SORT_BINS = { black: { x: 250, y: 80 }, white: { x: 350, y: 80 } };

/** Fresh teaching cells; importing an existing project never calls this preparation. */
export function prepareLessonProject(id: string, activeTool?: ToolMode): ProjectDocument {
  const project = structuredClone(DEFAULT_PROJECT);
  const fork = BODY1_LESSONS.includes(id) || (id === "foundation-first-robot-move" && activeTool === "fork");
  project.tool.mode = fork ? "fork" : "magnet";
  project.scene.body1SupportHeightMm = 0;
  if (fork) {
    const xs = id === "intermediate-three-layer-tower" ? [300, 250, 350] : [300];
    project.scene.blocks = xs.map((x, i) => ({ id: `tower-${i+1}`, kind: "block", geometry: "body1", color: "neutral", source: "pickup", position: { x, y: -80 }, r: 0 }));
    project.scene.block = { ...project.scene.blocks[0].position };
    const pick = forkContactPose(project.scene.block, 0, "body1", false, 110, 0);
    if (id === "intermediate-three-layer-tower") pick.r = 90;
    const place = forkContactPose(project.scene.drop, 0, "body1", true, 110, 0);
    place.r=id==="intermediate-three-layer-tower"?90:id==="intermediate-rotate-carried-block"?0:-90;
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

export function body1LessonProgram(language: ProgramLanguage, id: string): string {
  const tower=id==="intermediate-three-layer-tower",rotate=id==="intermediate-rotate-carried-block";
  if(!tower) {
    const back=rotate?[-60,0]:[0,60];
    if(language==="lua")return [
      "local function task()",
      "  local P1 = {coordinate={x=300,y=-20,z=255,r=-90}} -- 安全入口",
      "  MovL(P1)","  MovL(PickApproach)","  MovL(PickPoint)",
      "  RelMovL({0,0,2.5,0}) -- 先承托","  RelMovL({0,0,80,0}) -- 抬高",
      ...(rotate?["  RelMovL({0,0,0,90},{SpeedL=25}) -- 取件後才轉90°"]:[]),
      "  MovL(PlaceApproach,{SpeedL=25}) -- 載件慢速轉運","  MovL(PlacePoint)",
      "  RelMovL({0,0,-2.5,0}) -- 放低，留出槽內間隙",
      `  RelMovL({${back[0]},${back[1]},0,0}) -- 水平後退退出`,
      "  RelMovL({0,0,255-132.5,0}) -- 再原地抬高",
      "  MovL(P1)","  JointMovJ(Home)","  Sync()","end","task()",
    ].join("\n");
    return ["def task():",
      "    P1 = {'coordinate': {'x': 300, 'y': -20, 'z': 255, 'r': -90}} # 安全入口",
      "    mov_l(P1)","    mov_l(PickApproach)","    mov_l(PickPoint)",
      "    rel_mov_l([0, 0, 2.5, 0]) # 先承托","    rel_mov_l([0, 0, 80, 0]) # 抬高",
      ...(rotate?["    rel_mov_l([0, 0, 0, 90], speed_l=25) # 取件後才轉90°"]:[]),
      "    mov_l(PlaceApproach, speed_l=25) # 載件慢速轉運","    mov_l(PlacePoint)",
      "    rel_mov_l([0, 0, -2.5, 0]) # 放低，留出槽內間隙",
      `    rel_mov_l([${back[0]}, ${back[1]}, 0, 0]) # 水平後退退出`,
      "    rel_mov_l([0, 0, 255 - 132.5, 0]) # 再原地抬高",
      "    mov_l(P1)","    joint_mov_j(Home)","    sync()","task()",
    ].join("\n");
  }
  const heading=tower?90:-90,entryY=tower?-140:-20;
  const calls=tower?[[300,135,0],[250,175,90],[350,215,0]]:[[300,135,rotate?90:0]];
  if(language==="lua")return [
    "-- point 建立座標；stackBlock 完成一次取件及放置。",
    "local function point(x,y,z,r)","  return {coordinate={x=x,y=y,z=z,r=r}}","end",
    "local function stackBlock(x,z,turn)",`  local r = ${heading}+turn`,
    `  MovL(point(x,${entryY},255,${heading}))`,
    `  MovL(point(x,${entryY},132.5,${heading}))`,
    `  MovL(point(x,-80,132.5,${heading}))`,
    "  RelMovL({0,0,2.5,0}) -- 先承托，再抬高80 mm",
    "  RelMovL({0,0,80,0})","  if turn ~= 0 then RelMovL({0,0,0,turn},{SpeedL=25}) end",
    "  MovL(point(300,80,z+80,r),{SpeedL=25}) -- 載件慢速轉運，減少滑移","  MovL(point(300,80,z,r))",
    "  RelMovL({0,0,-2.5,0}) -- 放低，留出槽內間隙",
    "  -- 沿工具後方退出60 mm，再原地抬高。",
    "  local backX = -60*math.cos(math.rad(r))","  local backY = -60*math.sin(math.rad(r))",
    "  RelMovL({backX,backY,0,0})","  RelMovL({0,0,255-(z-2.5),0})","end",
    "",...calls.map(([x,z,turn])=>`stackBlock(${x},${z},${turn})`),"JointMovJ(Home)","Sync()",
  ].join("\n");
  return [
    "import math","# point 建立座標；stack_block 完成一次取件及放置。",
    "def point(x, y, z, r):","    return {'coordinate': {'x': x, 'y': y, 'z': z, 'r': r}}",
    "","def stack_block(x, z, turn):",`    r = ${heading} + turn`,
    `    mov_l(point(x, ${entryY}, 255, ${heading}))`,
    `    mov_l(point(x, ${entryY}, 132.5, ${heading}))`,
    `    mov_l(point(x, -80, 132.5, ${heading}))`,
    "    rel_mov_l([0, 0, 2.5, 0]) # 先承托，再抬高80 mm",
    "    rel_mov_l([0, 0, 80, 0])","    if turn != 0:","        rel_mov_l([0, 0, 0, turn], speed_l=25)",
    "    mov_l(point(300, 80, z + 80, r), speed_l=25) # 載件慢速轉運，減少滑移","    mov_l(point(300, 80, z, r))",
    "    rel_mov_l([0, 0, -2.5, 0]) # 放低，留出槽內間隙",
    "    # 沿工具後方退出60 mm，再原地抬高。",
    "    back_x = -60 * math.cos(math.radians(r))","    back_y = -60 * math.sin(math.radians(r))",
    "    rel_mov_l([back_x, back_y, 0, 0])","    rel_mov_l([0, 0, 255 - (z - 2.5), 0])",
    "","def task():",...calls.map(([x,z,turn])=>`    stack_block(${x}, ${z}, ${turn})`),"    joint_mov_j(Home)","    sync()","task()",
  ].join("\n");
}

export function sortingProgram(language: ProgramLanguage): string {
  if (language === "lua") return [
    "-- Four spaced 35×35×4 plates: black, white, black, white. Keep two separate stacks.",
    "local sourceX = {250,300,350,400}", "local counts = {0,0}", "for i=1,4 do",
    "  local color = 1", "  local x = 250", "  local r = 0",
    "  if i % 2 == 0 then color=2; x=350; r=45 end",
    "  MovJ({coordinate={x=sourceX[i],y=-100,z=194,r=0}})", "  MovL({coordinate={x=sourceX[i],y=-100,z=114,r=0}})", "  DO(1,ON)",
    "  RelMovL({0,0,80,0})", "  if color == 2 then RelMovL({0,0,0,45}) end",
    "  local z = 114 + 4*counts[color]",
    "  MovJ({coordinate={x=x,y=80,z=z+80,r=r}})",
    "  MovL({coordinate={x=x,y=80,z=z,r=r}})", "  DO(1,OFF)",
    "  counts[color] = counts[color]+1", "  RelMovL({0,0,80,0})", "end", "JointMovJ(Home)", "Sync()",
  ].join("\n");
  return authoredPythonProgram([
    "# Four spaced 35×35×4 plates; independent black and white height counts.", "counts = [0,0]",
    "for i, source_x in enumerate([250,300,350,400]):", "    color = i % 2", "    x = 350 if color else 250", "    r = 45 if color else 0",
    "    mov_j({'coordinate':{'x':source_x,'y':-100,'z':194,'r':0}})", "    mov_l({'coordinate':{'x':source_x,'y':-100,'z':114,'r':0}})", "    do(1,ON)",
    "    rel_mov_l([0,0,80,0])", "    if color: rel_mov_l([0,0,0,45])",
    "    z = 114 + 4*counts[color]",
    "    mov_j({'coordinate':{'x':x,'y':80,'z':z+80,'r':r}})",
    "    mov_l({'coordinate':{'x':x,'y':80,'z':z,'r':r}})", "    do(1,OFF)",
    "    counts[color] += 1", "    rel_mov_l([0,0,80,0])", "joint_mov_j(Home)", "sync()",
  ].join("\n"));
}
