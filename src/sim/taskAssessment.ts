import { platformHeight, magneticSurfaceHeight, cellBlockTopZ, cellBlockSize, effectiveForkContactProfile, BODY1_FORK_CONTACT, FORK_SUPPORT_HEIGHT_MM, type ForkContactProfile, type Pose, type ProjectDocument } from "../domain";

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
  const completedTurn = (cycle: CarryCycle) => {
    const original = before.scene.blocks.find(block => block.id === cycle.id);
    const placed = after.scene.blocks.find(block => block.id === cycle.id);
    return Boolean(turned(cycle) && cycle.release && original && placed
      && Math.abs(angleDelta(cycle.release.r - cycle.pick.r, 90)) <= 2
      && Math.abs(angleDelta(placed.r - original.r, 90)) <= 2);
  };
  const onMagneticStand = (cycle: CarryCycle) => { const placed = after.scene.blocks.find(block => block.id === cycle.id); return Boolean(placed && cycle.release && Math.abs(cycle.release.z - cellBlockTopZ(placed, "magnet", magneticSurfaceHeight(after.scene), platformHeight(after.scene))) <= 1); };
  const onForkSupport = (cycle: CarryCycle) => {
    const placed = after.scene.blocks.find(block => block.id === cycle.id);
    if (!placed || !cycle.release) return false;
    const profile = effectiveForkContactProfile(forkContactProfile, after.scene.blocks, cycle.id);
    // Passive Body1 release clears stackLevel; no stacked Body1 contact is modeled.
    if (profile === "body1" && (placed.stackLevel ?? 0) !== 0) return false;
    const supportZ = platformHeight(after.scene) + (placed.z ?? 0) + cellBlockSize(placed, "fork").z * (placed.stackLevel ?? 0)
      + (profile === "body1" ? BODY1_FORK_CONTACT.loadZ : FORK_SUPPORT_HEIGHT_MM);
    const error = cycle.release.z - supportZ;
    return profile === "body1" ? error >= -0.5 && error <= 0.05 : Math.abs(error) <= after.tool.pickupTolerance.z;
  };
  if (lessonId === "intermediate-three-layer-tower") {
    const sources = before.scene.blocks.filter(block => block.source === "pickup").slice(0,3);
    const cycles = sources.map(block => latestCycles.find(cycle => cycle.id === block.id));
    const placed = sources.map(block => after.scene.blocks.find(item => item.id === block.id));
    return [
      check("picked", cycles.length === 3 && cycles.every(Boolean), "三件工件均有實際取起", "All three workpieces were picked up"),
      check("turn", cycles.length === 3 && cycles.every(cycle => Boolean(cycle && completedTurn(cycle))), "每件先抬升 80 mm，再帶件旋轉 +90°", "Each was lifted 80 mm, then turned +90° while held"),
      check("tower", placed.length === 3 && placed.every(block => block?.source === "output" && near(block.position, after.scene.drop)) && [0,1,2].every(level => placed.some(block => block?.stackLevel === level)), "三層均放在目標位置", "Three layers were placed at the target"),
      check("release", cycles.length === 3 && cycles.every(cycle => Boolean(cycle?.release && near(cycle.release, after.scene.drop) && onMagneticStand(cycle))) && evidence.active === null, "各層在正確頂面高度釋放", "Each layer was released at its top surface"),
    ];
  }
  if (lessonId === "intermediate-black-white-sort") {
    const feeders = before.scene.blocks.filter(block=>block.source==="feeder");
    const binCycle = (id: string) => evidence.cycles.filter(cycle => cycle.id === id).at(-2);
    return [
      check("unload", evidence.active === null && feeders.length === 4 && feeders.every(block=>{
        const placed=after.scene.blocks.find(item=>item.id===block.id), cycle=latestCycles.find(item=>item.id===block.id);
        return Boolean(placed?.source==="unloaded" && cycle?.release && binCycle(block.id)?.release
          && near(cycle.pick,{x:block.color==="white"?340:320,y:80}) && near(cycle.release,placed.position) && onMagneticStand(cycle));
      }), "四件供料均已分類並取出", "All four feeder pieces were sorted and unloaded"),
      check("white-turn", feeders.filter(block=>block.color==="white").every(block=>{const cycle=binCycle(block.id);return Boolean(cycle && turned(cycle,45) && cycle.release && Math.abs(angleDelta(cycle.release.r,45))<=2 && near(cycle.release,{x:340,y:80}) && onMagneticStand(cycle));}), "白色工件先抬升，再以 +45° 放進白色區", "White pieces were lifted and placed at +45° in the white bin"),
      check("black-bin", feeders.filter(block=>block.color==="black").every(block=>{const cycle=binCycle(block.id);return Boolean(cycle?.release && near(cycle.release,{x:320,y:80}) && Math.abs(angleDelta(cycle.release.r,0))<=2 && onMagneticStand(cycle));}), "黑色工件以 0° 放進黑色區", "Black pieces were placed at 0° in the black bin"),
    ];
  }
  if (!["intermediate-pick-and-place","intermediate-rotate-carried-block","intermediate-passive-fork"].includes(lessonId ?? "")) return [];
  const original = before.scene.blocks.find(block => near(block.position,before.scene.block));
  const cycle = original && latestCycles.find(item=>item.id===original.id);
  const placed = original && after.scene.blocks.find(block=>block.id===original.id);
  const checks = [check("picked",Boolean(cycle),"有實際取起工件","The workpiece was picked up")];
  if (lessonId === "intermediate-rotate-carried-block") checks.push(check("turn",Boolean(cycle && completedTurn(cycle)),"先抬升 80 mm，再帶件旋轉 +90°","Lifted 80 mm before a +90° turn while held"));
  checks.push(check("placed",Boolean(evidence.active === null && cycle?.release && placed?.source==="output" && near(placed.position,after.scene.drop) && near(cycle.release,placed.position) && (after.tool.mode==="fork" ? onForkSupport(cycle) : onMagneticStand(cycle))),"在放置區正確高度放下並釋放","Placed and released at the target height"));
  return checks;
}
