import { FORK_SUPPORT_HEIGHT_MM, type Pose } from "../domain";

export const FORK_INSERTION_DISTANCE_MM = 60;
const MIN_LIFT_MM = 0.5;

export type PassiveForkState = {
  sawEntryApproach: boolean;
  inserted: boolean;
  insertedAtZ: number | null;
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
 * Model only the contact sequence needed for the training cell: enter beneath
 * the 40 x 40 x 15 mm block at the 20 mm support plane, then lift; lower to
 * the matching support pads to release. This is not rigid-body physics.
 */
export function advancePassiveFork(
  state: PassiveForkState,
  previous: Pose,
  current: Pose,
  attached: boolean,
  block: { x: number; y: number },
  drop: { x: number; y: number },
  tolerance: { xy: number; z: number },
): PassiveForkTransition {
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
