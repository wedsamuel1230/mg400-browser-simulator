import { describe, expect, it } from "vitest";
import { BODY1_FORK_CONTACT, FORK_SUPPORT_HEIGHT_MM } from "../domain";
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


describe("measured Body1 groove contact", () => {
  const block = { x: 300, y: -80, r: 0 }, drop = { x: 300, y: 80 };
  const step = (state: typeof EMPTY_PASSIVE_FORK_STATE, a: ReturnType<typeof pose>, b: ReturnType<typeof pose>, attached = false) => advancePassiveFork(state, a, b, attached, block, drop, tolerance, "body1");
  const entry = pose(300, -20, BODY1_FORK_CONTACT.insertionZ, -90);
  const contact = pose(300, -80, BODY1_FORK_CONTACT.insertionZ, -90);
  it("requires aligned forward insertion and the measured 2.5 mm load rise", () => {
    const approached = step(EMPTY_PASSIVE_FORK_STATE, entry, entry);
    const inserted = step(approached.state, entry, contact);
    expect(inserted.state.inserted).toBe(true);
    const partial = step(inserted.state, contact, { ...contact, z: 44 });
    expect(partial.action).toBeNull();
    expect(step(partial.state, { ...contact, z: 44 }, { ...contact, z: 45 }).action).toBe("pick");
    const wrongEntry = { ...entry, r: 0 }, wrongContact = { ...contact, r: 0 };
    const wrong = step(EMPTY_PASSIVE_FORK_STATE, wrongEntry, wrongContact);
    expect(step(wrong.state, wrongContact, { ...wrongContact, z: 45 }).action).toBeNull();
    const side = step(EMPTY_PASSIVE_FORK_STATE, { ...contact, x: 360 }, contact);
    expect(step(side.state, contact, { ...contact, z: 45 }).action).toBeNull();
    expect(step(EMPTY_PASSIVE_FORK_STATE, { ...contact, z: 45 }, contact).state.inserted).toBe(false);
  });
  it("releases at TCP45 and stays unarmed through lowering/re-lift until horizontal exit", () => {
    const placed = pose(300, 80, 45, -90);
    const release = step(EMPTY_PASSIVE_FORK_STATE, { ...placed, z: 46 }, placed, true);
    expect(release.action).toBe("place");
    const clear = { ...placed, z: 42.5 };
    const lowered = step(release.state, placed, clear);
    expect(step(lowered.state, clear, placed).action).toBeNull();
    const exited = step(lowered.state, clear, { ...clear, y: 140 });
    expect(exited.state.releasePose).toBeUndefined();
  });
});

it("revokes Body1 insertion after retreat before any high return",()=>{
 let state={...EMPTY_PASSIVE_FORK_STATE};const b={x:300,y:-80,r:0};
 const step=(a:ReturnType<typeof pose>,c:ReturnType<typeof pose>)=>{const t=advancePassiveFork(state,a,c,false,b,drop,tolerance,"body1");state=t.state;return t.action};
 const entry=pose(300,-20,42.5,-90),center=pose(300,-80,42.5,-90),high=pose(300,-80,60,-90);
 step(entry,entry);step(entry,center);step(center,entry);step(entry,{...entry,z:60});step({...entry,z:60},high);
 expect(step(high,{...high,z:61})).toBeNull();expect(state.inserted).toBe(false);
});
it("does not rearm Body1 after lifting through slot or sideways withdrawal",()=>{
 const release=pose(360,80,45,-90);
 for(const bad of [pose(360,140,80,-90),pose(390,140,42.5,-90)]){
  const state={...EMPTY_PASSIVE_FORK_STATE,releasePose:release};
  const t=advancePassiveFork(state,release,bad,false,block,drop,tolerance,"body1");
  expect(t.state.releasePose).toEqual(release);
 }
});

it("requires an uninterrupted aligned clearance withdrawal after release",()=>{
 const release=pose(360,80,45,-90),clear=pose(360,80,42.5,-90),high=pose(360,80,80,-90);
 let state={...EMPTY_PASSIVE_FORK_STATE,releasePose:release};
 const step=(a:ReturnType<typeof pose>,b:ReturnType<typeof pose>)=>{const t=advancePassiveFork(state,a,b,false,block,drop,tolerance,"body1");state=t.state as typeof state;};
 step(release,clear);step(clear,high);step(high,pose(360,140,80,-90));expect(state.releasePose).toEqual(release);
 step(pose(360,140,80,-90),clear);step(clear,pose(360,140,42.5,-90));expect(state.releasePose).toBeUndefined();
});
