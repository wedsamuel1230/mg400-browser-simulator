import { expect, it } from "vitest";
import { effectiveForkContactProfile, forkProfileAfterImport, type CellBlock } from "../domain";
it("resets measured calibration when either fork or block STL is replaced",()=>{
 expect(forkProfileAfterImport("body1","fork")).toBe("reference");
 expect(forkProfileAfterImport("body1","block")).toBe("reference");
 expect(forkProfileAfterImport("body1","magnet")).toBe("body1");
});
it("binds calibration only to the first non-magnet imported workpiece",()=>{
 const blocks:CellBlock[]=[{id:"magnet",kind:"magnet",color:"neutral",source:"pickup",position:{x:0,y:0},r:0},{id:"known",color:"neutral",source:"pickup",position:{x:300,y:-80},r:0},{id:"other",color:"neutral",source:"pickup",position:{x:350,y:0},r:0}];
 expect(effectiveForkContactProfile("body1",blocks,"known")).toBe("body1");
 expect(effectiveForkContactProfile("body1",blocks,"magnet")).toBe("reference");
 expect(effectiveForkContactProfile("body1",blocks,"other")).toBe("reference");
 expect(effectiveForkContactProfile("body1",[],undefined)).toBe("reference");
});

it("raises measured Body1 contacts onto the shared platform while preserving the passive sequence", async () => {
 const { forkContactPose, advancePassiveFork, EMPTY_PASSIVE_FORK_STATE, forkEntryPose } = await import("./forkTool");
 const pickup=forkContactPose({x:300,y:-80},0,"body1",false,110);
 const release=forkContactPose({x:300,y:80},0,"body1",true,110);
 expect(pickup.z).toBe(152.5);expect(release.z).toBe(155);
 const entry=forkEntryPose(pickup);
 const step=(state:typeof EMPTY_PASSIVE_FORK_STATE,previous:typeof entry,current:typeof entry,attached=false)=>advancePassiveFork(state,previous,current,attached,{x:300,y:-80,r:0},{x:300,y:80},{xy:12,z:8},"body1",110);
 const approach=step(EMPTY_PASSIVE_FORK_STATE,entry,entry);
 const inserted=step(approach.state,entry,pickup);
 expect(step(inserted.state,pickup,{...pickup,z:155}).action).toBe("pick");
 expect(step(EMPTY_PASSIVE_FORK_STATE,{...release,z:200},release,true).action).toBe("place");
 expect(step(EMPTY_PASSIVE_FORK_STATE,entry,{...pickup,z:42.5}).action).toBe(null);
});
