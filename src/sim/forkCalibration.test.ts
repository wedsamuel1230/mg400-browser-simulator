import { expect, it } from "vitest";
import { effectiveForkContactProfile, forkProfileAfterImport, type CellBlock } from "../domain";
it("resets measured calibration when either fork or block STL is replaced",()=>{
 expect(forkProfileAfterImport("body1","fork")).toBe("reference");
 expect(forkProfileAfterImport("body1","block")).toBe("reference");
 expect(forkProfileAfterImport("body1","magnet")).toBe("body1");
});
it("binds calibration only to the first non-puck imported workpiece",()=>{
 const blocks:CellBlock[]=[{id:"puck",kind:"puck",color:"neutral",source:"pickup",position:{x:0,y:0},r:0},{id:"known",color:"neutral",source:"pickup",position:{x:300,y:-80},r:0},{id:"other",color:"neutral",source:"pickup",position:{x:350,y:0},r:0}];
 expect(effectiveForkContactProfile("body1",blocks,"known")).toBe("body1");
 expect(effectiveForkContactProfile("body1",blocks,"puck")).toBe("reference");
 expect(effectiveForkContactProfile("body1",blocks,"other")).toBe("reference");
 expect(effectiveForkContactProfile("body1",[],undefined)).toBe("reference");
});
