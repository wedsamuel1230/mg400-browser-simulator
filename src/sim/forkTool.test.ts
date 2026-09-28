import { describe, expect, it } from "vitest";
import { FORK_SUPPORT_HEIGHT_MM } from "../domain";
import { advancePassiveFork, EMPTY_PASSIVE_FORK_STATE, forkEntryPose } from "./forkTool";

const block = { x: 360, y: -80 };
const drop = { x: 360, y: 80 };
const tolerance = { xy: 12, z: 8 };
const pose = (x: number, y: number, z: number, r = 0) => ({ x, y, z, r });

describe("passive fork contact sequence", () => {
  it("requires an entry at the support plane from outside the block before lifting", () => {
    const verticalDescent = advancePassiveFork(
      EMPTY_PASSIVE_FORK_STATE,
      pose(block.x, block.y, 80),
      pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM),
      false,
      block,
      drop,
      tolerance,
    );
    const verticalLift = advancePassiveFork(
      verticalDescent.state,
      pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM),
      pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM + 1),
      false,
      block,
      drop,
      tolerance,
    );
    expect(verticalLift.action).toBeNull();
  });

  it("attaches only after sliding under the block at its raised support height and lifting", () => {
    const entry = forkEntryPose(pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM));
    const approach = advancePassiveFork(
      EMPTY_PASSIVE_FORK_STATE,
      pose(entry.x, entry.y, 10),
      entry,
      false,
      block,
      drop,
      tolerance,
    );
    expect(approach.action).toBeNull();
    expect(approach.state.sawEntryApproach).toBe(true);

    const inserted = advancePassiveFork(
      approach.state,
      entry,
      pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM),
      false,
      block,
      drop,
      tolerance,
    );
    expect(inserted.action).toBeNull();
    expect(inserted.state.inserted).toBe(true);

    const lifted = advancePassiveFork(
      inserted.state,
      pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM),
      pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM + 1),
      false,
      block,
      drop,
      tolerance,
    );
    expect(lifted.action).toBe("pick");
    expect(lifted.state).toEqual(EMPTY_PASSIVE_FORK_STATE);
  });

  it("accumulates a slow lift across small animation steps and clears an abandoned insertion", () => {
    const entry = forkEntryPose(pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM));
    const approached = advancePassiveFork(EMPTY_PASSIVE_FORK_STATE, entry, entry, false, block, drop, tolerance);
    const inserted = advancePassiveFork(approached.state, entry, pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM), false, block, drop, tolerance);
    const firstStep = advancePassiveFork(inserted.state, pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM), pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM + 0.3), false, block, drop, tolerance);
    const secondStep = advancePassiveFork(firstStep.state, pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM + 0.3), pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM + 0.6), false, block, drop, tolerance);
    expect(firstStep.action).toBeNull();
    expect(secondStep.action).toBe("pick");

    const abandoned = advancePassiveFork(inserted.state, pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM), pose(block.x + 20, block.y, FORK_SUPPORT_HEIGHT_MM), false, block, drop, tolerance);
    expect(abandoned.state.inserted).toBe(false);
    expect(abandoned.state.sawEntryApproach).toBe(true);

    const wanderedAbove = advancePassiveFork(firstStep.state, pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM + 0.3), pose(block.x + 20, block.y, FORK_SUPPORT_HEIGHT_MM + 1), false, block, drop, tolerance);
    expect(wanderedAbove.state.inserted).toBe(false);
    expect(wanderedAbove.action).toBeNull();
  });

  it("releases only when lowering onto the support pads at the drop zone", () => {
    const aboveDrop = pose(drop.x, drop.y, FORK_SUPPORT_HEIGHT_MM + 9);
    const onDrop = pose(drop.x, drop.y, FORK_SUPPORT_HEIGHT_MM);
    expect(advancePassiveFork(EMPTY_PASSIVE_FORK_STATE, aboveDrop, onDrop, true, block, drop, tolerance).action).toBe("place");
    expect(advancePassiveFork(EMPTY_PASSIVE_FORK_STATE, onDrop, pose(drop.x, drop.y, FORK_SUPPORT_HEIGHT_MM + 10), true, block, drop, tolerance).action).toBeNull();
    expect(advancePassiveFork(EMPTY_PASSIVE_FORK_STATE, pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM + 9), pose(block.x, block.y, FORK_SUPPORT_HEIGHT_MM), true, block, drop, tolerance).action).toBeNull();
  });

  it("builds the fork entry point 60 mm opposite the tool insertion direction", () => {
    const entry = forkEntryPose(pose(360, -80, FORK_SUPPORT_HEIGHT_MM, 90));
    expect(entry.x).toBeCloseTo(360);
    expect(entry.y).toBeCloseTo(-140);
    expect(entry.z).toBe(FORK_SUPPORT_HEIGHT_MM);
    expect(entry.r).toBe(90);
  });
});
