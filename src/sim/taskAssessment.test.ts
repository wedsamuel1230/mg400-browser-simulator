import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import { cellBlockTopZ, magneticSurfaceHeight, platformHeight } from "../domain";
import { assessRobotTask, newTaskEvidence, observeTaskFrame } from "./taskAssessment";
const pose = (z: number, r = 0) => ({x:300,y:-80,z,r});
const before = () => structuredClone(DEFAULT_PROJECT);
const outcome = () => { const project=before(); project.scene.blocks[0]={...project.scene.blocks[0],source:"output",position:{...project.scene.drop},stackLevel:0,r:90};return project; };
const towerOutcome = (levels = [0, 1, 2]) => {
 const initial=before(), project=before(), evidence=newTaskEvidence();
 initial.scene.blocks.filter(block=>block.source==="pickup").slice(0,3).forEach((block,index)=>{
  const placed={...block,source:"output" as const,position:{...project.scene.drop},stackLevel:levels[index],r:90};
  project.scene.blocks[project.scene.blocks.findIndex(item=>item.id===block.id)]=placed;
  const pickZ=cellBlockTopZ(block,"magnet",magneticSurfaceHeight(initial.scene),platformHeight(initial.scene));
  observeTaskFrame(evidence,{...block.position,z:pickZ,r:0},block.id);
  observeTaskFrame(evidence,{...block.position,z:pickZ+80,r:0},block.id);
  observeTaskFrame(evidence,{...block.position,z:pickZ+80,r:90},block.id);
  observeTaskFrame(evidence,{...placed.position,z:cellBlockTopZ(placed,"magnet",magneticSurfaceHeight(project.scene),platformHeight(project.scene)),r:90},null);
 });
 return {initial,project,evidence};
};
const sortOutcome = () => {
 const initial=before(), project=before(), evidence=newTaskEvidence();
 initial.scene.blocks.filter(block=>block.source==="feeder").forEach(block=>{
  const r=block.color==="white"?45:0, bin={x:r?340:320,y:80};
  observeTaskFrame(evidence,{...block.position,z:114,r:0},block.id);
  observeTaskFrame(evidence,{...block.position,z:194,r:0},block.id);
  observeTaskFrame(evidence,{...bin,z:194,r},block.id);
  observeTaskFrame(evidence,{...bin,z:114,r},null);
  observeTaskFrame(evidence,{...bin,z:114,r},block.id);
  observeTaskFrame(evidence,{x:300,y:180,z:114,r:0},null);
  project.scene.blocks[project.scene.blocks.findIndex(item=>item.id===block.id)]={...block,source:"unloaded",position:{x:300,y:180},r:0};
 });
 return {initial,project,evidence};
};
describe("observed robot task outcomes",()=>{
 it("does not confuse a finished no-motion program with successful pickup",()=>{const checks=assessRobotTask("intermediate-pick-and-place",before(),before(),newTaskEvidence());expect(checks.every(x=>x.passed)).toBe(false)});
 it("verifies carry, lift, rotation and exact release height from real sampled poses",()=>{const evidence=newTaskEvidence();observeTaskFrame(evidence,pose(114),"tower-1");observeTaskFrame(evidence,pose(194),"tower-1");observeTaskFrame(evidence,pose(194,90),"tower-1");observeTaskFrame(evidence,{x:300,y:80,z:114,r:90},null);const checks=assessRobotTask("intermediate-rotate-carried-block",before(),outcome(),evidence);expect(checks).toHaveLength(3);expect(checks.every(x=>x.passed)).toBe(true)});
 it("rejects rotation before the required lift even if final orientation looks right",()=>{const evidence=newTaskEvidence();observeTaskFrame(evidence,pose(114),"tower-1");observeTaskFrame(evidence,pose(114,90),"tower-1");observeTaskFrame(evidence,pose(194,90),"tower-1");observeTaskFrame(evidence,{x:300,y:80,z:114,r:90},null);expect(assessRobotTask("intermediate-rotate-carried-block",before(),outcome(),evidence).find(x=>x.id==="turn")?.passed).toBe(false)});
 it("rejects a turn before pickup and an air release above the stand",()=>{const evidence=newTaskEvidence();observeTaskFrame(evidence,pose(114,90),"tower-1");observeTaskFrame(evidence,pose(194,90),"tower-1");observeTaskFrame(evidence,{x:300,y:80,z:194,r:90},null);const checks=assessRobotTask("intermediate-rotate-carried-block",before(),outcome(),evidence);expect(checks.filter(x=>!x.passed).map(x=>x.id)).toEqual(["turn","placed"])});
 it("requires three distinct layers and three real carry cycles",()=>{expect(assessRobotTask("intermediate-three-layer-tower",before(),outcome(),newTaskEvidence()).every(x=>x.passed)).toBe(false)});
 it.each(["intermediate-rotate-carried-block","intermediate-three-layer-tower"])("rejects an R0 release after the last held R90 frame in %s",lessonId=>{
  const {initial,project,evidence}=towerOutcome(); evidence.cycles[0].release!.r=0;
  expect(assessRobotTask(lessonId,initial,project,evidence).find(check=>check.id==="turn")?.passed).toBe(false);
 });
 it.each(["intermediate-rotate-carried-block","intermediate-three-layer-tower"])("rejects a final R0 workpiece despite held and release R90 in %s",lessonId=>{
  const {initial,project,evidence}=towerOutcome(); project.scene.blocks[0].r=0;
  expect(assessRobotTask(lessonId,initial,project,evidence).find(check=>check.id==="turn")?.passed).toBe(false);
 });
 it("rejects distinct tower layers 1, 2, 3 even at their matching contact heights",()=>{
  const {initial,project,evidence}=towerOutcome([1,2,3]);
  expect(assessRobotTask("intermediate-three-layer-tower",initial,project,evidence).find(check=>check.id==="tower")?.passed).toBe(false);
 });
 it("accepts exactly layers 0, 1, 2 with held turns and matching release poses",()=>{
  const {initial,project,evidence}=towerOutcome();
  expect(assessRobotTask("intermediate-three-layer-tower",initial,project,evidence).every(check=>check.passed)).toBe(true);
 });
 it.each([0,1,2])("rejects a wrong release height on tower layer %i",index=>{
  const {initial,project,evidence}=towerOutcome(); evidence.cycles[index].release!.z+=2;
  expect(assessRobotTask("intermediate-three-layer-tower",initial,project,evidence).find(check=>check.id==="release")?.passed).toBe(false);
 });
 it("rejects a tower release away from the target even when the final position is correct",()=>{
  const {initial,project,evidence}=towerOutcome(); evidence.cycles[0].release!.x+=2;
  expect(assessRobotTask("intermediate-three-layer-tower",initial,project,evidence).find(check=>check.id==="release")?.passed).toBe(false);
 });
 it("rejects a final tower position away from the target",()=>{
  const {initial,project,evidence}=towerOutcome(); project.scene.blocks[0].position.x+=2;
  expect(assessRobotTask("intermediate-three-layer-tower",initial,project,evidence).find(check=>check.id==="tower")?.passed).toBe(false);
 });
 it.each(["intermediate-rotate-carried-block","intermediate-three-layer-tower"])("accepts relative turns across wrapped angles within 2 degrees in %s",lessonId=>{
  const {initial,project,evidence}=towerOutcome();
  initial.scene.blocks[0].r=170; project.scene.blocks[0].r=-100;
  const cycle=evidence.cycles[0]; cycle.pick.r=180; cycle.turnDegrees=88; cycle.release!.r=-810;
  expect(assessRobotTask(lessonId,initial,project,evidence).every(check=>check.passed)).toBe(true);
 });
 it.each(["held","release","final"])("rejects a %s rotation beyond the 2 degree tolerance",field=>{
  const {initial,project,evidence}=towerOutcome();
  if(field==="held") evidence.cycles[0].turnDegrees=92.01;
  if(field==="release") evidence.cycles[0].release!.r=92.01;
  if(field==="final") project.scene.blocks[0].r=92.01;
  expect(assessRobotTask("intermediate-rotate-carried-block",initial,project,evidence).find(check=>check.id==="turn")?.passed).toBe(false);
 });
 it("wraps deeply negative held pose angles",()=>{
  const evidence=newTaskEvidence();
  observeTaskFrame(evidence,pose(114,180),"tower-1");
  observeTaskFrame(evidence,pose(194,180),"tower-1");
  observeTaskFrame(evidence,pose(194,-810),"tower-1");
  expect(evidence.active?.turnDegrees).toBe(90);
 });
 it.each(["intermediate-pick-and-place","intermediate-passive-fork"])("keeps nonrotation task behavior for %s",lessonId=>{
  const initial=before(), project=outcome(), evidence=newTaskEvidence();
  if(lessonId==="intermediate-passive-fork") { initial.tool.mode="fork"; project.tool.mode="fork"; }
  project.scene.blocks[0].r=0;
  observeTaskFrame(evidence,pose(114),"tower-1");
  observeTaskFrame(evidence,{x:300,y:80,z:lessonId==="intermediate-passive-fork"?130:114,r:0},null);
  expect(assessRobotTask(lessonId,initial,project,evidence).every(check=>check.passed)).toBe(true);
 });
 it("accepts a corrected pickup after an earlier air release",()=>{
  const {initial,project,evidence}=towerOutcome();
  const retry=structuredClone(evidence.cycles[0]); evidence.cycles[0].release!.z+=80;
  evidence.cycles.push(retry);
  expect(assessRobotTask("intermediate-pick-and-place",initial,project,evidence).every(check=>check.passed)).toBe(true);
 });
 it("rejects a later bad release instead of reusing a stale successful cycle",()=>{
  const {initial,project,evidence}=towerOutcome();
  const retry=structuredClone(evidence.cycles[0]); retry.release!.z+=80; evidence.cycles.push(retry);
  expect(assessRobotTask("intermediate-pick-and-place",initial,project,evidence).find(check=>check.id==="placed")?.passed).toBe(false);
 });
 it("rejects an unfinished reattachment after a successful placement",()=>{
  const {initial,project,evidence}=towerOutcome();
  observeTaskFrame(evidence,{...project.scene.drop,z:114,r:90},"tower-1");
  expect(assessRobotTask("intermediate-pick-and-place",initial,project,evidence).find(check=>check.id==="placed")?.passed).toBe(false);
 });
 it("accepts the normal sorting bin stage followed by unload",()=>{
  const {initial,project,evidence}=sortOutcome();
  expect(assessRobotTask("intermediate-black-white-sort",initial,project,evidence).every(check=>check.passed)).toBe(true);
 });
 it.each(["black","white"])("rejects an air release in the %s bin",color=>{
  const {initial,project,evidence}=sortOutcome();
  const id=initial.scene.blocks.find(block=>block.color===color)!.id;
  evidence.cycles.find(cycle=>cycle.id===id)!.release!.z+=80;
  expect(assessRobotTask("intermediate-black-white-sort",initial,project,evidence).find(check=>check.id===(color==="white"?"white-turn":"black-bin"))?.passed).toBe(false);
 });
 it("rejects passive fork release above the reference support plane",()=>{
  const {initial,project,evidence}=towerOutcome(); initial.tool.mode="fork"; project.tool.mode="fork";
  evidence.cycles[0].release!.z=100;
  expect(assessRobotTask("intermediate-passive-fork",initial,project,evidence).find(check=>check.id==="placed")?.passed).toBe(false);
 });
 it.each(["reference","body1"] as const)("checks the %s fork world support height with platform and block offsets",profile=>{
  const {initial,project,evidence}=towerOutcome(); initial.tool.mode="fork"; project.tool.mode="fork";
  project.scene.platformHeightMm=110; project.scene.blocks[0].z=10; project.scene.blocks[0].stackLevel=undefined;
  evidence.cycles[0].release!.z=110+10+(profile==="body1"?45:20);
  expect(assessRobotTask("intermediate-passive-fork",initial,project,evidence,profile).every(check=>check.passed)).toBe(true);
  evidence.cycles[0].release!.z+=20;
  expect(assessRobotTask("intermediate-passive-fork",initial,project,evidence,profile).find(check=>check.id==="placed")?.passed).toBe(false);
 });
 it("checks reference fork stack offsets using the domain block height",()=>{
  const {initial,project,evidence}=towerOutcome(); initial.tool.mode="fork"; project.tool.mode="fork";
  project.scene.blocks[0].stackLevel=2; evidence.cycles[0].release!.z=160;
  expect(assessRobotTask("intermediate-passive-fork",initial,project,evidence).every(check=>check.passed)).toBe(true);
 });
 it("rejects a sorting unload release above the support surface",()=>{
  const {initial,project,evidence}=sortOutcome(); evidence.cycles.at(-1)!.release!.z+=80;
  expect(assessRobotTask("intermediate-black-white-sort",initial,project,evidence).find(check=>check.id==="unload")?.passed).toBe(false);
 });
 it("rejects a sorting unload picked away from its bin",()=>{
  const {initial,project,evidence}=sortOutcome(); evidence.cycles.at(-1)!.pick.x+=20;
  expect(assessRobotTask("intermediate-black-white-sort",initial,project,evidence).find(check=>check.id==="unload")?.passed).toBe(false);
 });
 it("uses the latest sorting bin stage before unload after a corrected earlier attempt",()=>{
  const {initial,project,evidence}=sortOutcome(), successful=structuredClone(evidence.cycles[0]);
  evidence.cycles[0].release!.z+=80; evidence.cycles.splice(1,0,successful);
  expect(assessRobotTask("intermediate-black-white-sort",initial,project,evidence).every(check=>check.passed)).toBe(true);
 });
 it("rejects stale sorting success after an unfinished reattachment",()=>{
  const {initial,project,evidence}=sortOutcome();
  observeTaskFrame(evidence,{x:300,y:180,z:114,r:0},"feed-white-2");
  expect(assessRobotTask("intermediate-black-white-sort",initial,project,evidence).every(check=>check.passed)).toBe(false);
 });
});
