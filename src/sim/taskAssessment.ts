import { body1SupportHeight, platformHeight, magneticSurfaceHeight, cellBlockTopZ, cellBlockSize, effectiveForkContactProfile, BODY1_FORK_CONTACT, FORK_SUPPORT_HEIGHT_MM, type ForkContactProfile, type Pose, type ProjectDocument } from "../domain";

export type CarryCycle = { id: string; pick: Pose; maxLiftMm: number; firstTurnLiftMm: number | null; turnDegrees: number; release: Pose | null };
export type TaskEvidence = { cycles: CarryCycle[]; active: CarryCycle | null };
export type TaskCheck = { id: string; passed: boolean; zh: string; en: string };
export const newTaskEvidence = (): TaskEvidence => ({ cycles: [], active: null });
const angleDelta = (a: number, b: number) => (((a - b) % 360 + 540) % 360) - 180;

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

export function assessRobotTask(lessonId: string | null, before: ProjectDocument, after: ProjectDocument, evidence: TaskEvidence, forkContactProfile: ForkContactProfile = "reference"): TaskCheck[] {
  const check = (id: string, passed: boolean, zh: string, en: string): TaskCheck => ({ id, passed, zh, en });
  const near = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x-b.x, a.y-b.y) <= 1;
  const latestCycles = before.scene.blocks.map(block => evidence.cycles.filter(cycle => cycle.id === block.id).at(-1)).filter((cycle): cycle is CarryCycle => Boolean(cycle));
  const turned = (cycle: CarryCycle, target = 90) => cycle.firstTurnLiftMm !== null && cycle.firstTurnLiftMm >= 79 && Math.abs(angleDelta(cycle.turnDegrees, target)) <= 2;
  const completedTurn = (cycle: CarryCycle, target = 90) => {
    const original = before.scene.blocks.find(block => block.id === cycle.id);
    const placed = after.scene.blocks.find(block => block.id === cycle.id);
    return Boolean((target === 0 ? Math.abs(cycle.turnDegrees) <= 2 && cycle.firstTurnLiftMm === null : turned(cycle, target)) && cycle.release && original && placed
      && Math.abs(angleDelta(cycle.release.r - cycle.pick.r, target)) <= 2
      && Math.abs(angleDelta(placed.r - original.r, target)) <= 2);
  };
  const onMagneticStand = (cycle: CarryCycle) => { const placed = after.scene.blocks.find(block => block.id === cycle.id); return Boolean(placed && cycle.release && Math.abs(cycle.release.z - cellBlockTopZ(placed, "magnet", magneticSurfaceHeight(after.scene), platformHeight(after.scene))) <= 1); };
  const onForkSupport = (cycle: CarryCycle) => {
    const placed = after.scene.blocks.find(block => block.id === cycle.id);
    if (!placed || !cycle.release) return false;
    const profile = effectiveForkContactProfile(forkContactProfile, after.scene.blocks, cycle.id);
    const supportZ = platformHeight(after.scene) + (placed.z ?? 0) + (profile === "body1" ? 40 : cellBlockSize(placed, "fork").z) * (placed.stackLevel ?? 0)
      + (profile === "body1" ? body1SupportHeight(after.scene) + BODY1_FORK_CONTACT.loadZ : FORK_SUPPORT_HEIGHT_MM);
    const error = cycle.release.z - supportZ;
    return profile === "body1" ? error >= -0.5 && error <= 0.05 : Math.abs(error) <= after.tool.pickupTolerance.z;
  };
  if (lessonId === "intermediate-three-layer-tower") {
    const sources = before.scene.blocks.filter(block => block.source === "pickup").slice(0,3);
    const cycles = sources.map(block => latestCycles.find(cycle => cycle.id === block.id));
    const placed = sources.map(block => after.scene.blocks.find(item => item.id === block.id));
    return [
      check("picked", cycles.length === 3 && cycles.every(Boolean), "三件工件均有實際取起", "All three workpieces were picked up"),
      check("turn", cycles.length === 3 && after.tool.mode === "fork" && cycles.every(cycle => { const placed=after.scene.blocks.find(block=>block.id===cycle?.id); return Boolean(cycle && placed && completedTurn(cycle,placed.stackLevel === 1 ? 90 : 0)); }), "上下層保持0°；中層先抬升80 mm再帶件旋轉90°", "Outer layers stay0°; middle lifts80 mm before a held90° turn"),
      check("tower", placed.length === 3 && placed.every(block => block?.source === "output" && near(block.position, after.scene.drop)) && [0,1,2].every(level => placed.some(block => block?.stackLevel === level)), "三層均放在目標位置", "Three layers were placed at the target"),
      check("release", cycles.length === 3 && cycles.every(cycle => Boolean(cycle?.release && near(cycle.release, after.scene.drop) && onForkSupport(cycle))) && evidence.active === null, "各層在正確頂面高度釋放", "Each layer was released at its top surface"),
    ];
  }
  if (lessonId === "intermediate-black-white-sort") {
    const feeders = before.scene.blocks.filter(block=>block.source==="feeder");
    return [
      check("stacks", evidence.active === null && feeders.length === 4 && ["black","white"].every(color=>{
        const group=feeders.filter(block=>block.color===color), x=color==="black"?250:350;
        const placed=group.map(block=>after.scene.blocks.find(item=>item.id===block.id));
        return group.length===2 && placed.every(block=>block?.source==="output" && near(block.position,{x,y:80})) && [0,1].every(level=>placed.some(block=>block?.stackLevel===level));
      }), "黑白各兩片，在相隔100 mm的兩區各堆兩層", "Two independent two-plate stacks,100 mm apart"),
      check("white-turn", feeders.filter(block=>block.color==="white").every(block=>{const cycle=latestCycles.find(item=>item.id===block.id);return Boolean(cycle && turned(cycle,45) && cycle.release && Math.abs(angleDelta(cycle.release.r,45))<=2 && near(cycle.release,{x:350,y:80}) && onMagneticStand(cycle));}), "白片先抬高80，再轉45°並在正確頂面釋放", "White plates lift80, turn45° and release at the correct top"),
      check("black-bin", feeders.filter(block=>block.color==="black").every(block=>{const cycle=latestCycles.find(item=>item.id===block.id);return Boolean(cycle?.release && near(cycle.release,{x:250,y:80}) && Math.abs(angleDelta(cycle.release.r,0))<=2 && onMagneticStand(cycle));}), "黑片保持0°，在黑色堆疊頂面釋放", "Black plates stay0° and release at the black stack top"),
    ];
  }
  if (!["intermediate-pick-and-place","intermediate-rotate-carried-block","intermediate-passive-fork"].includes(lessonId ?? "")) return [];
  const original = before.scene.blocks.find(block => near(block.position,before.scene.block));
  const cycle = original && latestCycles.find(item=>item.id===original.id);
  const placed = original && after.scene.blocks.find(block=>block.id===original.id);
  const checks = [check("picked",Boolean(cycle),"有實際取起工件","The workpiece was picked up")];
  if (lessonId === "intermediate-rotate-carried-block") checks.push(check("turn",Boolean(after.tool.mode === "fork" && cycle && completedTurn(cycle)),"先抬升 80 mm，再帶件旋轉 +90°","Lifted 80 mm before a +90° turn while held"));
  checks.push(check("placed",Boolean(evidence.active === null && cycle?.release && placed?.source==="output" && near(placed.position,after.scene.drop) && near(cycle.release,placed.position) && (after.tool.mode==="fork" ? onForkSupport(cycle) : onMagneticStand(cycle))),"在放置區正確高度放下並釋放","Placed and released at the target height"));
  return checks;
}
