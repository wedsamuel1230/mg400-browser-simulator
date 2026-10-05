import { BODY1_FORK_CONTACT, FORK_SUPPORT_HEIGHT_MM, type ForkContactProfile, type Pose } from "../domain";

export const FORK_INSERTION_DISTANCE_MM = 60;
const MIN_LIFT_MM = 0.5;

export type PassiveForkState = {
  sawEntryApproach: boolean;
  inserted: boolean;
  insertedAtZ: number | null;
  releasePose?: Pose;
  releaseCleared?: boolean;
};

export const EMPTY_PASSIVE_FORK_STATE: PassiveForkState = {
  sawEntryApproach: false,
  inserted: false,
  insertedAtZ: null,
};

export type PassiveForkTransition = {
  state: PassiveForkState;
  action: "pick" | "place" | null;
};

/**
 * Model only the contact sequence needed for the training cell. The generic
 * profile enters beneath a 40 x 40 x 15 mm reference block at the 20 mm support
 * plane; the Body1 profile uses its measured 40 x 40 x 40 mm grooves. Both
 * attach on lift and release at their support surface. This is not rigid-body
 * physics.
 */
export function advancePassiveFork(
  state: PassiveForkState,
  previous: Pose,
  current: Pose,
  attached: boolean,
  block: { x: number; y: number; r?: number },
  drop: { x: number; y: number },
  tolerance: { xy: number; z: number },
  profile: ForkContactProfile = "reference",
  platformHeightMm = 0,
  supportHeightMm = 20,
): PassiveForkTransition {
  if (profile === "body1") { platformHeightMm += supportHeightMm; supportHeightMm = 0; }
  if (platformHeightMm !== 0) {
    const local = (pose: Pose) => ({ ...pose, z: pose.z - platformHeightMm });
    const result = advancePassiveFork({ ...state, insertedAtZ: state.insertedAtZ === null ? null : state.insertedAtZ - platformHeightMm, releasePose: state.releasePose && local(state.releasePose) }, local(previous), local(current), attached, block, drop, tolerance, profile, 0, 0);
    return { ...result, state: { ...result.state, insertedAtZ: result.state.insertedAtZ === null ? null : result.state.insertedAtZ + platformHeightMm, releasePose: result.state.releasePose && { ...result.state.releasePose, z: result.state.releasePose.z + platformHeightMm } } };
  }
  if (profile === "body1") return advanceBody1Fork(state, previous, current, attached, block, drop);
  if (attached) {
    const isLowering = current.z < previous.z;
    const atSupport = Math.abs(current.z - FORK_SUPPORT_HEIGHT_MM) <= tolerance.z;
    const dropDistance = Math.hypot(current.x - drop.x, current.y - drop.y);
    if (isLowering && atSupport && dropDistance <= tolerance.xy) {
      return { state: EMPTY_PASSIVE_FORK_STATE, action: "place" };
    }
    return { state: EMPTY_PASSIVE_FORK_STATE, action: null };
  }

  let sawEntryApproach = state.sawEntryApproach;
  let inserted = state.inserted;
  let insertedAtZ = state.insertedAtZ;
  const blockDistance = Math.hypot(current.x - block.x, current.y - block.y);
  const atSupportHeight = Math.abs(current.z - FORK_SUPPORT_HEIGHT_MM) <= tolerance.z;

  if (inserted && blockDistance > tolerance.xy) {
    inserted = false;
    insertedAtZ = null;
    sawEntryApproach = atSupportHeight;
  }
  if (atSupportHeight && blockDistance > tolerance.xy) {
    sawEntryApproach = true;
    inserted = false;
    insertedAtZ = null;
  }
  if (!inserted && atSupportHeight && blockDistance <= tolerance.xy && sawEntryApproach) {
    inserted = true;
    insertedAtZ = current.z;
    sawEntryApproach = false;
  }
  if (!atSupportHeight && !inserted) {
    sawEntryApproach = false;
  }

  const lifted = insertedAtZ !== null && current.z > previous.z && current.z - insertedAtZ >= MIN_LIFT_MM;
  if (inserted && lifted && blockDistance <= tolerance.xy) {
    return { state: EMPTY_PASSIVE_FORK_STATE, action: "pick" };
  }

  return { state: { sawEntryApproach, inserted, insertedAtZ }, action: null };
}

export function forkEntryPose(contact: Pose): Pose {
  const angle = (contact.r * Math.PI) / 180;
  return {
    ...contact,
    x: contact.x - FORK_INSERTION_DISTANCE_MM * Math.cos(angle),
    y: contact.y - FORK_INSERTION_DISTANCE_MM * Math.sin(angle),
  };
}


/** Known measured Body1 grooves only; no inference for arbitrary imported STL. */
function advanceBody1Fork(state: PassiveForkState, previous: Pose, current: Pose, attached: boolean,
  block: { x: number; y: number; r?: number }, drop: { x: number; y: number }): PassiveForkTransition {
  const empty = () => ({ state: EMPTY_PASSIVE_FORK_STATE, action: null });
  if (attached) {
    if (current.z < previous.z && current.z <= BODY1_FORK_CONTACT.loadZ + 0.05 && current.z >= BODY1_FORK_CONTACT.loadZ - 0.5 && Math.hypot(current.x - drop.x, current.y - drop.y) <= 1) {
      return { state: { ...EMPTY_PASSIVE_FORK_STATE, releasePose: { ...current } }, action: "place" };
    }
    return empty();
  }
  const angle = current.r * Math.PI / 180;
  const local = (pose: Pose, origin: { x: number; y: number }) => ({
    along: (pose.x - origin.x) * Math.cos(angle) + (pose.y - origin.y) * Math.sin(angle),
    across: -(pose.x - origin.x) * Math.sin(angle) + (pose.y - origin.y) * Math.cos(angle),
  });
  if (state.releasePose) {
    const exit = local(current, state.releasePose);
    const beforeExit = local(previous, state.releasePose);
    const alignedExit = Math.abs(current.r - state.releasePose.r) <= 1 && Math.abs(exit.across) <= 1;
    const atClearance = Math.abs(current.z - BODY1_FORK_CONTACT.insertionZ) <= 0.5;
    const releaseCleared = alignedExit && atClearance && (state.releaseCleared || Math.abs(exit.along) <= 1);
    if (!releaseCleared || exit.along > 1 || (state.releaseCleared && exit.along > beforeExit.along + 0.0001)) {
      return { state: { ...state, releaseCleared: false }, action: null };
    }
    return exit.along <= -FORK_INSERTION_DISTANCE_MM + 0.5 ? empty() : { state: { ...state, releaseCleared: true }, action: null };
  }
  const yawError = Math.abs((((current.r - (block.r ?? 0) + 90) % 180) + 270) % 180 - 90);
  const now = local(current, block), before = local(previous, block);
  const aligned = yawError <= 1 && Math.abs(now.across) <= 1;
  const atInsertion = Math.abs(current.z - BODY1_FORK_CONTACT.insertionZ) <= 0.5;
  if (!aligned) return empty();
  let sawEntryApproach = state.sawEntryApproach;
  let inserted = state.inserted && Math.abs(now.along) <= 1 && current.z >= BODY1_FORK_CONTACT.insertionZ - 0.5;
  if (atInsertion && now.along <= -40) sawEntryApproach = true;
  if (atInsertion && sawEntryApproach && Math.abs(now.along) <= 1 && now.along > before.along + 0.0001) inserted = true;
  if (inserted && Math.abs(now.along) <= 1 && current.z > previous.z && current.z >= BODY1_FORK_CONTACT.loadZ - 0.05) {
    return { state: EMPTY_PASSIVE_FORK_STATE, action: "pick" };
  }
  if ((!atInsertion && !inserted) || now.along > 1) return empty();
  return { state: { sawEntryApproach, inserted, insertedAtZ: inserted ? BODY1_FORK_CONTACT.insertionZ : null }, action: null };
}

export function forkContactPose(location: { x: number; y: number }, blockR: number, profile: ForkContactProfile = "reference", placing = false, platformHeightMm = 0, supportHeightMm = 20): Pose {
  return { ...location, z: platformHeightMm + (profile === "body1" ? supportHeightMm + (placing ? BODY1_FORK_CONTACT.loadZ : BODY1_FORK_CONTACT.insertionZ) : FORK_SUPPORT_HEIGHT_MM), r: blockR + (profile === "reference" && placing ? 90 : -90) };
}
