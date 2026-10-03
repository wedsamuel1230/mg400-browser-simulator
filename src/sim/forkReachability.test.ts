import { expect, it } from "vitest";
import urdf from "../../public/models/mg400/mg400_description/urdf/mg400_description.urdf?raw";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import { MG400Kinematics } from "./mg400Kinematics";
import { advancePassiveFork, EMPTY_PASSIVE_FORK_STATE, forkContactPose, forkEntryPose } from "./forkTool";
import { BODY1_FORK_CONTACT, type ForkContactProfile, type JointAngles, type Pose } from "../domain";
const model = MG400Kinematics.fromUrdf(urdf);
const home = DEFAULT_PROJECT.points.find(p => p.kind === "joint")!;
const seed = home.kind === "joint" ? home.joints : [0,0,0,0] as JointAngles;
for (const profile of ["reference", "body1"] as ForkContactProfile[]) {
  it(`reaches the actual default X300 ${profile} insertion, lift, release and withdrawal path`, () => {
    let joints=seed;
    let previous=model.forward(joints,DEFAULT_PROJECT.tool.flangeOffset,DEFAULT_PROJECT.tool.tcpOffsets.fork);
    let state={...EMPTY_PASSIVE_FORK_STATE};let attached=false;let picks=0;let places=0;
    let location={...DEFAULT_PROJECT.scene.block,r:0};
    const solve=(pose:Pose)=>{
      const result=model.solve(pose,joints,DEFAULT_PROJECT.tool.flangeOffset,DEFAULT_PROJECT.tool.tcpOffsets.fork, profile === "body1" ? 0.01 : 0.5);
      expect(result.ok,JSON.stringify({profile,pose,error:result.positionErrorMm})).toBe(true);
      joints=result.joints;
      const actual=model.forward(joints,DEFAULT_PROJECT.tool.flangeOffset,DEFAULT_PROJECT.tool.tcpOffsets.fork);
      const transition=advancePassiveFork(state,previous,actual,attached,location,DEFAULT_PROJECT.scene.drop,DEFAULT_PROJECT.tool.pickupTolerance,profile);
      state=transition.state;
      if(transition.action==="pick"){attached=true;picks++}
      if(transition.action==="place"){attached=false;places++;location={x:actual.x,y:actual.y,r:0}}
      previous=actual;
    };
    const line=(a:Pose,b:Pose)=>{
      for(let step=1;step<=32;step++){const t=step/32;solve({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,r:a.r+(b.r-a.r)*t})}
    };
    const pick=forkContactPose(location,0,profile);
    const entry=forkEntryPose(pick);
    const lifted={...pick,z:pick.z+80};
    const place=forkContactPose(DEFAULT_PROJECT.scene.drop,0,profile,true);
    const above={...place,z:place.z+80};
    solve(entry);line(entry,pick);line(pick,lifted);solve(above);line(above,place);
    expect(picks).toBe(1);expect(places).toBe(1);expect(attached).toBe(false);
    if(profile==="body1") {
      const clear={...place,z:place.z-(BODY1_FORK_CONTACT.loadZ-BODY1_FORK_CONTACT.insertionZ)};const exit=forkEntryPose(clear);
      line(place,clear);line(clear,exit);line(exit,{...exit,z:exit.z+80});
      expect(state.releasePose).toBeUndefined();
      const secondPick=forkContactPose(location,0,profile);const secondEntry=forkEntryPose(secondPick);
      solve(secondEntry);line(secondEntry,secondPick);line(secondPick,{...secondPick,z:secondPick.z+80});
      expect(picks).toBe(2);expect(attached).toBe(true);
    }
  });
}
