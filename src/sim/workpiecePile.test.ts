import {expect,it} from "vitest";
import {createWorkpiecePile,teachPile} from "./workpiecePile";
import {prepareLessonProject} from "../training/practiceSetup";
import {cellBlockSize} from "../domain";
import {validateProject} from "../projectStore";
it.each(["body1","magnet"] as const)("generates true vertical %s piles and teaches their top contact",kind=>{
 const pile=createWorkpiecePile(kind,kind==="body1"?3:10,300,-80,"pile-test");
 expect(pile.map(block=>block.stackLevel)).toEqual(pile.map((_,i)=>i));
 expect(pile.every(block=>block.position.x===300&&block.position.y===-80)).toBe(true);
 expect(cellBlockSize(pile[0],"fork").z).toBe(kind==="body1"?40:4);
 const project=teachPile(prepareLessonProject("intermediate-passive-fork"),pile);
 expect(project.points.find(point=>point.name==="PickPoint")).toMatchObject({pose:{z:kind==="body1"?212.5:150}});
});
it("rejects counts and platform positions without clamping",()=>{
 expect(()=>createWorkpiecePile("body1",4,300,0,"pile")).toThrow();
 expect(()=>createWorkpiecePile("magnet",11,300,0,"pile")).toThrow();
 expect(()=>createWorkpiecePile("body1",1,590,0,"pile")).toThrow();
 expect(()=>createWorkpiecePile("body1",1,300,590,"pile")).toThrow();
});
it("rejects unreachable pile contacts rather than preparing guessed poses",()=>expect(()=>teachPile(prepareLessonProject("intermediate-passive-fork"),createWorkpiecePile("body1",3,300,-80,"pile"),{solve:()=>({ok:false,joints:[0,0,0,0],positionErrorMm:1,angleErrorDeg:1})})).toThrow(/reach/));
it("normalizes old platform height and preserves custom code and points with a re-teach datum",()=>{
 const project=prepareLessonProject("intermediate-passive-fork");project.scene.platformHeightMm=0;project.script="print('custom')";const points=structuredClone(project.points);
 const imported=validateProject(project);expect(imported.scene.platformHeightMm).toBe(110);expect(imported.scene.platformMigrationFromMm).toBe(0);expect(imported.script).toBe(project.script);expect(imported.points).toEqual(points);
});
it("creates missing named contacts for an empty custom point list",()=>{
 const project=prepareLessonProject("intermediate-passive-fork");project.points=[];
 const next=teachPile(project,createWorkpiecePile("body1",2,300,-80,"pile"));
 expect(next.points.map(point=>point.name)).toEqual(["Home","PickPoint","PickApproach","PlacePoint","PlaceApproach"]);
});
it("retargets the named pickup contacts and scene datum when a free pile moves",()=>{
 const project=prepareLessonProject("intermediate-passive-fork");
 const next=teachPile(project,createWorkpiecePile("body1",2,350,-40,"moved-pile"));
 expect(next.scene.block).toEqual({x:350,y:-40});
 expect(next.points.find(point=>point.name==="PickPoint")).toMatchObject({pose:{x:350,y:-40}});
 expect(next.points.find(point=>point.name==="PickApproach")).toMatchObject({pose:{x:350,y:20}});
});
