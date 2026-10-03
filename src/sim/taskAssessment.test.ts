import {describe,expect,it} from "vitest";
import {assessRobotTask,newTaskEvidence,observeTaskFrame} from "./taskAssessment";
import {prepareLessonProject,BODY1_LESSONS} from "../training/practiceSetup";
import {DEFAULT_PROJECT} from "../data/defaultProject";

function result(id:string){
 const before=prepareLessonProject(id),after=structuredClone(before),evidence=newTaskEvidence();
 before.scene.blocks.forEach((block,i)=>{
  const tower=id.endsWith("tower"),sort=id.endsWith("sort"),fork=BODY1_LESSONS.includes(id);
  const level=tower?i:sort?Math.floor(i/2):0;
  const turn=tower?(i===1?90:0):id.includes("rotate")?90:sort&&block.color==="white"?45:0;
  const pickR=fork?-90:0,releaseZ=fork?135+40*level:114+4*level;
  const position=sort?{x:block.color==="white"?350:250,y:80}:after.scene.drop;
  observeTaskFrame(evidence,{...block.position,z:fork?135:114,r:pickR},block.id);
  observeTaskFrame(evidence,{...block.position,z:(fork?135:114)+80,r:pickR},block.id);
  observeTaskFrame(evidence,{...block.position,z:(fork?135:114)+80,r:pickR+turn},block.id);
  observeTaskFrame(evidence,{...position,z:releaseZ,r:pickR+turn},null);
  after.scene.blocks[i]={...block,source:"output",position:{...position},r:turn,stackLevel:level};
 });
 return {before,after,evidence};
}
describe("prepared task outcome gates",()=>{
 it.each([...BODY1_LESSONS,"intermediate-black-white-sort","intermediate-pick-and-place"])("accepts the prepared final outcome of %s",id=>{
  const {before,after,evidence}=result(id);expect(assessRobotTask(id,before,after,evidence,"body1").every(check=>check.passed)).toBe(true);
 });
 it.each(["release","final","held"])("rejects incorrect %s rotation for Body1 quarter-turn",field=>{
  const {before,after,evidence}=result(BODY1_LESSONS[1]);
  if(field==="release")evidence.cycles[0].release!.r=-90;
  if(field==="final")after.scene.blocks[0].r=0;
  if(field==="held")evidence.cycles[0].turnDegrees=0;
  expect(assessRobotTask(BODY1_LESSONS[1],before,after,evidence,"body1").find(check=>check.id==="turn")?.passed).toBe(false);
 });
 it("rejects turning the middle layer before lifting80",()=>{const x=result(BODY1_LESSONS[2]);x.evidence.cycles[1].firstTurnLiftMm=0;expect(assessRobotTask(BODY1_LESSONS[2],x.before,x.after,x.evidence,"body1").every(c=>c.passed)).toBe(false);});
 it.each([0,2])("rejects a rotated outer tower layer%i",i=>{const x=result(BODY1_LESSONS[2]);x.after.scene.blocks[i].r=90;expect(assessRobotTask(BODY1_LESSONS[2],x.before,x.after,x.evidence,"body1").every(c=>c.passed)).toBe(false);});
 it("rejects layers1/2/3",()=>{const x=result(BODY1_LESSONS[2]);x.after.scene.blocks.forEach(b=>b.stackLevel!++);expect(assessRobotTask(BODY1_LESSONS[2],x.before,x.after,x.evidence,"body1").find(c=>c.id==="tower")?.passed).toBe(false);});
 it.each([0,1,2])("rejects wrong tower contact height at layer%i",i=>{const x=result(BODY1_LESSONS[2]);x.evidence.cycles[i].release!.z+=4;expect(assessRobotTask(BODY1_LESSONS[2],x.before,x.after,x.evidence,"body1").find(c=>c.id==="release")?.passed).toBe(false);});
 it("rejects stale success after an unfinished reattachment",()=>{const x=result(BODY1_LESSONS[0]);observeTaskFrame(x.evidence,{x:300,y:80,z:135,r:-90},"tower-1");expect(assessRobotTask(BODY1_LESSONS[0],x.before,x.after,x.evidence,"body1").every(c=>c.passed)).toBe(false);});
 it("accepts a corrected latest pickup cycle",()=>{const x=result(BODY1_LESSONS[0]);const retry=structuredClone(x.evidence.cycles[0]);x.evidence.cycles[0].release!.z+=80;x.evidence.cycles.push(retry);expect(assessRobotTask(BODY1_LESSONS[0],x.before,x.after,x.evidence,"body1").every(c=>c.passed)).toBe(true);});
 it("requires fork mode for the Body1 rotation",()=>{const x=result(BODY1_LESSONS[1]);x.after.tool.mode="magnet";expect(assessRobotTask(BODY1_LESSONS[1],x.before,x.after,x.evidence,"body1").every(c=>c.passed)).toBe(false);});
 it("rejects overlapping black/white final stacks",()=>{const x=result("intermediate-black-white-sort");x.after.scene.blocks.filter(b=>b.color==="white").forEach(b=>b.position.x=250);expect(assessRobotTask("intermediate-black-white-sort",x.before,x.after,x.evidence).find(c=>c.id==="stacks")?.passed).toBe(false);});
 it("rejects unloaded pieces as a sorting endpoint",()=>{const x=result("intermediate-black-white-sort");x.after.scene.blocks.forEach(b=>b.source="unloaded");expect(assessRobotTask("intermediate-black-white-sort",x.before,x.after,x.evidence).find(c=>c.id==="stacks")?.passed).toBe(false);});
 it.each(["black","white"])("rejects air release above the %s stack",color=>{const x=result("intermediate-black-white-sort"),i=x.before.scene.blocks.findIndex(b=>b.color===color);x.evidence.cycles[i].release!.z+=80;expect(assessRobotTask("intermediate-black-white-sort",x.before,x.after,x.evidence).every(c=>c.passed)).toBe(false);});
 it("retains historical Body1 support datum when absent",()=>{const x=result(BODY1_LESSONS[0]);delete x.after.scene.body1SupportHeightMm;x.evidence.cycles[0].release!.z=155;expect(assessRobotTask(BODY1_LESSONS[0],x.before,x.after,x.evidence,"body1").every(c=>c.passed)).toBe(true);});
 it("never accepts a no-motion pickup",()=>expect(assessRobotTask("intermediate-pick-and-place",DEFAULT_PROJECT,DEFAULT_PROJECT,newTaskEvidence()).every(c=>c.passed)).toBe(false));
});
