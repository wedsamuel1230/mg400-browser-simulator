import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import { assessRobotTask, newTaskEvidence, observeTaskFrame } from "./taskAssessment";
const pose = (z: number, r = 0) => ({x:300,y:-80,z,r});
const before = () => structuredClone(DEFAULT_PROJECT);
const outcome = () => { const project=before(); project.scene.blocks[0]={...project.scene.blocks[0],source:"output",position:{...project.scene.drop},stackLevel:0,r:90};return project; };
describe("observed robot task outcomes",()=>{
 it("does not confuse a finished no-motion program with successful pickup",()=>{const checks=assessRobotTask("intermediate-pick-and-place",before(),before(),newTaskEvidence());expect(checks.every(x=>x.passed)).toBe(false)});
 it("verifies carry, lift, rotation and exact release height from real sampled poses",()=>{const evidence=newTaskEvidence();observeTaskFrame(evidence,pose(114),"tower-1");observeTaskFrame(evidence,pose(194),"tower-1");observeTaskFrame(evidence,pose(194,90),"tower-1");observeTaskFrame(evidence,{x:300,y:80,z:114,r:90},null);const checks=assessRobotTask("intermediate-rotate-carried-block",before(),outcome(),evidence);expect(checks).toHaveLength(3);expect(checks.every(x=>x.passed)).toBe(true)});
 it("rejects rotation before the required lift even if final orientation looks right",()=>{const evidence=newTaskEvidence();observeTaskFrame(evidence,pose(114),"tower-1");observeTaskFrame(evidence,pose(114,90),"tower-1");observeTaskFrame(evidence,pose(194,90),"tower-1");observeTaskFrame(evidence,{x:300,y:80,z:114,r:90},null);expect(assessRobotTask("intermediate-rotate-carried-block",before(),outcome(),evidence).find(x=>x.id==="turn")?.passed).toBe(false)});
 it("rejects a turn before pickup and an air release above the stand",()=>{const evidence=newTaskEvidence();observeTaskFrame(evidence,pose(114,90),"tower-1");observeTaskFrame(evidence,pose(194,90),"tower-1");observeTaskFrame(evidence,{x:300,y:80,z:194,r:90},null);const checks=assessRobotTask("intermediate-rotate-carried-block",before(),outcome(),evidence);expect(checks.filter(x=>!x.passed).map(x=>x.id)).toEqual(["turn","placed"])});
 it("requires three distinct layers and three real carry cycles",()=>{expect(assessRobotTask("intermediate-three-layer-tower",before(),outcome(),newTaskEvidence()).every(x=>x.passed)).toBe(false)});
});
