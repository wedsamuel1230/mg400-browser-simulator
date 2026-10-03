import { platformHeight, magneticSurfaceHeight, cellBlockTopZ, type Pose, type ProjectDocument } from "../domain";

export type CarryCycle = { id: string; pick: Pose; maxLiftMm: number; firstTurnLiftMm: number | null; turnDegrees: number; release: Pose | null };
export type TaskEvidence = { cycles: CarryCycle[]; active: CarryCycle | null };
export type TaskCheck = { id: string; passed: boolean; zh: string; en: string };
export const newTaskEvidence = (): TaskEvidence => ({ cycles: [], active: null });
const angleDelta = (a: number, b: number) => ((a - b + 540) % 360) - 180;

/** Observe actual poses/attachment transitions, never source text or interpreter completion. */
export function observeTaskFrame(evidence: TaskEvidence, pose: Pose, attachedId: string | null): void {
  if (!attachedId) {
    if (evidence.active) evidence.active.release = { ...pose };
    evidence.active = null;
    return;
  }
  if (evidence.active?.id !== attachedId) {
    const cycle: CarryCycle = { id: attachedId, pick: { ...pose }, maxLiftMm: 0, firstTurnLiftMm: null, turnDegrees: 0, release: null };
    evidence.cycles.push(cycle);
    evidence.active = cycle;
  }
  const cycle = evidence.active;
  cycle.maxLiftMm = Math.max(cycle.maxLiftMm, pose.z - cycle.pick.z);
  cycle.turnDegrees = angleDelta(pose.r, cycle.pick.r);
  if (cycle.firstTurnLiftMm === null && Math.abs(cycle.turnDegrees) > 2) cycle.firstTurnLiftMm = pose.z - cycle.pick.z;
}

export function assessRobotTask(lessonId: string | null, before: ProjectDocument, after: ProjectDocument, evidence: TaskEvidence): TaskCheck[] {
  const check = (id: string, passed: boolean, zh: string, en: string): TaskCheck => ({ id, passed, zh, en });
  const near = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x-b.x, a.y-b.y) <= 1;
  const firstCycles = before.scene.blocks.map(block => evidence.cycles.find(cycle => cycle.id === block.id)).filter((cycle): cycle is CarryCycle => Boolean(cycle));
  const turned = (cycle: CarryCycle, target = 90) => cycle.firstTurnLiftMm !== null && cycle.firstTurnLiftMm >= 79 && Math.abs(angleDelta(cycle.turnDegrees, target)) <= 2;
  const onMagneticStand = (cycle: CarryCycle) => { const placed = after.scene.blocks.find(block => block.id === cycle.id); return Boolean(placed && cycle.release && Math.abs(cycle.release.z - cellBlockTopZ(placed, "magnet", magneticSurfaceHeight(after.scene), platformHeight(after.scene))) <= 1); };
  if (lessonId === "intermediate-three-layer-tower") {
    const sources = before.scene.blocks.filter(block => block.source === "pickup").slice(0,3);
    const cycles = sources.map(block => firstCycles.find(cycle => cycle.id === block.id));
    const placed = sources.map(block => after.scene.blocks.find(item => item.id === block.id));
    return [
      check("picked", cycles.length === 3 && cycles.every(Boolean), "三件工件均有實際取起", "All three workpieces were picked up"),
      check("turn", cycles.length === 3 && cycles.every(cycle => Boolean(cycle && turned(cycle))), "每件先抬升 80 mm，再帶件旋轉 +90°", "Each was lifted 80 mm, then turned +90° while held"),
      check("tower", placed.every(block => block?.source === "output" && near(block.position, after.scene.drop)) && new Set(placed.map(block=>block?.stackLevel)).size === 3 && placed.every(block=>block?.stackLevel !== undefined), "三層均放在目標位置", "Three layers were placed at the target"),
      check("release", cycles.every(cycle => Boolean(cycle && onMagneticStand(cycle))) && evidence.active === null, "各層在正確頂面高度釋放", "Each layer was released at its top surface"),
    ];
  }
  if (lessonId === "intermediate-black-white-sort") {
    const feeders = before.scene.blocks.filter(block=>block.source==="feeder");
    return [
      check("unload", feeders.length === 4 && feeders.every(block=>after.scene.blocks.find(item=>item.id===block.id)?.source==="unloaded"), "四件供料均已分類並取出", "All four feeder pieces were sorted and unloaded"),
      check("white-turn", feeders.filter(block=>block.color==="white").every(block=>{const cycle=firstCycles.find(item=>item.id===block.id);return Boolean(cycle && turned(cycle,45) && cycle.release && Math.abs(angleDelta(cycle.release.r,45))<=2 && near(cycle.release,{x:340,y:80}));}), "白色工件先抬升，再以 +45° 放進白色區", "White pieces were lifted and placed at +45° in the white bin"),
      check("black-bin", feeders.filter(block=>block.color==="black").every(block=>{const cycle=firstCycles.find(item=>item.id===block.id);return Boolean(cycle?.release && near(cycle.release,{x:320,y:80}) && Math.abs(angleDelta(cycle.release.r,0))<=2);}), "黑色工件以 0° 放進黑色區", "Black pieces were placed at 0° in the black bin"),
    ];
  }
  if (!["intermediate-pick-and-place","intermediate-rotate-carried-block","intermediate-passive-fork"].includes(lessonId ?? "")) return [];
  const original = before.scene.blocks.find(block => near(block.position,before.scene.block));
  const cycle = original && firstCycles.find(item=>item.id===original.id);
  const placed = original && after.scene.blocks.find(block=>block.id===original.id);
  const checks = [check("picked",Boolean(cycle),"有實際取起工件","The workpiece was picked up")];
  if (lessonId === "intermediate-rotate-carried-block") checks.push(check("turn",Boolean(cycle && turned(cycle)),"先抬升 80 mm，再帶件旋轉 +90°","Lifted 80 mm before a +90° turn while held"));
  checks.push(check("placed",Boolean(cycle?.release && placed?.source==="output" && near(placed.position,after.scene.drop) && (after.tool.mode==="fork" || onMagneticStand(cycle))),"在放置區正確高度放下並釋放","Placed and released at the target height"));
  return checks;
}
