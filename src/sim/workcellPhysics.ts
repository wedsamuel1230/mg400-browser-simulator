import RAPIER from "@dimforge/rapier3d-compat";
import { Matrix4, Quaternion, Vector3, type BufferGeometry } from "three";
import { type CellBlock, type PhysicalPose, type ProjectDocument } from "../domain";
import { fixedSolids, supportSolids, workpieceSolids } from "./collisionInterlock";

// Educational defaults, not measured material or hardware parameters.
export const PHYSICS = { step:1/120, maxFrame:0.25, friction:0.8, restitution:0, density:700 } as const;
let initialization: Promise<void> | undefined;
export const initializePhysics = () => initialization ??= RAPIER.init();
const rotation = (matrix:Matrix4) => new Quaternion().setFromRotationMatrix(matrix);

export class WorkcellPhysics {
  readonly world = new RAPIER.World({x:0,y:0,z:-9.81});
  private readonly bodies = new Map<string,RAPIER.RigidBody>();
  private readonly tool: RAPIER.RigidBody;
  private readonly toolColliders: RAPIER.Collider[]=[];
  private accumulator=0;
  private toolTarget=new Matrix4();
  private magnetJoint?: RAPIER.ImpulseJoint;
  private magnetId: string | null=null;
  private readonly quietTime=new Map<string,number>();

  constructor(project:ProjectDocument, geometry:BufferGeometry, flange:Matrix4) {
    this.world.timestep=PHYSICS.step;
    this.world.integrationParameters.numSolverIterations=12;
    this.world.integrationParameters.contact_natural_frequency=300;
    // The default 20 mm prediction bridges the 2.5 mm slot clearance; 2 mm preserves it.
    this.world.integrationParameters.normalizedPredictionDistance=.002;
    this.world.integrationParameters.maxCcdSubsteps=4;
    // 0.01 mm penetration allowance, below the existing 0.05 mm arm guard.
    this.world.integrationParameters.normalizedAllowedLinearError=0.00001;
    for(const solid of [...fixedSolids(),...supportSolids(project,project.scene.blocks)]) {
      const size=solid.box.getSize(new Vector3()), centre=solid.box.getCenter(new Vector3()).applyMatrix4(solid.matrix);
      const collider=RAPIER.ColliderDesc.cuboid(size.x/2000,size.y/2000,size.z/2000).setTranslation(centre.x/1000,centre.y/1000,centre.z/1000).setRotation(rotation(solid.matrix)).setFriction(PHYSICS.friction).setRestitution(0);
      this.world.createCollider(collider);
    }
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(.095,.095,.0565).setTranslation(0,0,.0565));
    // Keep the small, bounded cell awake so narrow-slot contacts are updated during insertion.
    for(const block of project.scene.blocks) {
      const solids=workpieceSolids(block,project);
      const position=new Vector3().setFromMatrixPosition(solids[0].matrix), quaternion=rotation(solids[0].matrix);
      const descriptor=RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setTranslation(...position.toArray().map(v=>v/1000) as [number,number,number]).setRotation(quaternion).setCcdEnabled(true).setLinearDamping(.1).setAngularDamping(.2);
      const body=this.world.createRigidBody(descriptor);
      for(const solid of solids) {
        const size=solid.box.getSize(new Vector3()), centre=solid.box.getCenter(new Vector3());
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x/2000,size.y/2000,size.z/2000).setTranslation(centre.x/1000,centre.y/1000,centre.z/1000).setDensity(PHYSICS.density).setFriction(PHYSICS.friction).setRestitution(0),body);
      }
      if(block.physicalPose?.outsideCell)body.setEnabled(false);
      this.bodies.set(block.id,body);
    }
    this.toolTarget.copy(flange);
    const p=new Vector3().setFromMatrixPosition(flange);
    this.tool=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setCanSleep(false).setTranslation(p.x/1000,p.y/1000,p.z/1000).setRotation(rotation(flange)).setCcdEnabled(true));
    const attribute=geometry.getAttribute("position"), vertices=new Float32Array(attribute.count*3);
    for(let i=0;i<attribute.count;i++) {vertices[i*3]=attribute.getX(i)/1000;vertices[i*3+1]=attribute.getY(i)/1000;vertices[i*3+2]=attribute.getZ(i)/1000;}
    if(project.tool.mode === "fork") {
      // shortcut: rounded tips and bolt holes are simplified; retain the open U gap.
      for(const y of [-16.25,16.25]) this.toolColliders.push(this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(.0195,.00375,.0025).setTranslation(.0545,y/1000,-.0025).setFriction(PHYSICS.friction),this.tool));
      const back:number[]=[];
      for(let i=0;i<vertices.length;i+=3) if(vertices[i]<=.035) back.push(vertices[i],vertices[i+1],vertices[i+2]);
      const hull=RAPIER.ColliderDesc.convexHull(new Float32Array(back));
      if(!hull) throw new Error("叉具物理模型無法建立。");
      this.toolColliders.push(this.world.createCollider(hull.setFriction(PHYSICS.friction),this.tool));
    } else {
      // A solid hull avoids two-sided triangle contacts pulling a released thin plate.
      const hull=RAPIER.ColliderDesc.convexHull(vertices);
      if(!hull)throw new Error("磁吸工具物理模型無法建立。");
      this.toolColliders.push(this.world.createCollider(hull.setFriction(PHYSICS.friction),this.tool));
    }
  }

  setToolTarget(flange:Matrix4) {this.toolTarget.copy(flange);}
  advance(seconds:number) {
    this.accumulator+=Math.max(0,Math.min(PHYSICS.maxFrame,seconds));
    const steps=Math.floor((this.accumulator+1e-10)/PHYSICS.step);
    if(!steps)return;
    const start=this.tool.translation(), from=new Quaternion().copy(this.tool.rotation());
    const to=new Vector3().setFromMatrixPosition(this.toolTarget).multiplyScalar(.001), orientation=rotation(this.toolTarget);
    for(let i=1;i<=steps;i++) {
      const t=i/steps;
      this.tool.setNextKinematicTranslation({x:start.x+(to.x-start.x)*t,y:start.y+(to.y-start.y)*t,z:start.z+(to.z-start.z)*t});
      this.tool.setNextKinematicRotation(from.clone().slerp(orientation,t));
      this.world.step();
      for(const [id,body] of this.bodies) {
        const p=body.translation();
        // Bound discarded pieces outside the teaching cell; preserve their last falling pose for export.
        if(body.isEnabled() && (Math.abs(p.x)>2 || Math.abs(p.y)>2 || p.z< -1))body.setEnabled(false);
        const v=body.linvel(),w=body.angvel();
        const quiet=Math.hypot(v.x,v.y,v.z)<.0002 && Math.hypot(w.x,w.y,w.z)<.01;
        this.quietTime.set(id,quiet ? (this.quietTime.get(id)??0)+PHYSICS.step : 0);
      }
    }
    this.accumulator-=steps*PHYSICS.step;
  }
  pose(id:string):PhysicalPose | undefined {
    const body=this.bodies.get(id);if(!body)return;
    const p=body.translation(),q=body.rotation();
    return {position:{x:p.x*1000,y:p.y*1000,z:p.z*1000},quaternion:{x:q.x,y:q.y,z:q.z,w:q.w},settled:body.isEnabled() && (body.isSleeping() || (this.quietTime.get(id)??0)>=.5),outsideCell:!body.isEnabled()};
  }
  blocks(metadata:CellBlock[]) {return metadata.map(block=>({...block,physicalPose:this.pose(block.id)??block.physicalPose}));}
  contactWithTool(id:string) {
    const body=this.bodies.get(id);if(!body)return false;
    let touching=false;
    for(const tool of this.toolColliders)for(let i=0;i<body.numColliders();i++)this.world.contactPair(tool,body.collider(i),manifold=>{for(let j=0;j<manifold.numContacts();j++) if(manifold.contactImpulse(j)>1e-9)touching=true;});
    return touching;
  }
  hasExternalSupport(id:string) {return this.externalContact(id,"below");}
  hasSideContact(id:string) {return this.externalContact(id,"side");}
  private externalContact(id:string,direction:"below"|"side") {
    const body=this.bodies.get(id);if(!body)return false;
    const toolHandles=new Set(this.toolColliders.map(c=>c.handle));
    const centre=body.worldCom();let found=false;
    for(let i=0;i<body.numColliders();i++) {
      const own=body.collider(i);
      this.world.contactPairsWith(own,other=>{
        if(toolHandles.has(other.handle) || other.parent()?.handle===body.handle)return;
        const contact=own.contactCollider(other,.00015);
        if(!contact)return;
        if(direction==="below" ? contact.normal1.z<-.5 && contact.point1.z<centre.z-.001 : Math.abs(contact.normal1.z)<.5)found=true;
      });
    }
    return found;
  }
  supportedByTool(id:string) {return this.contactWithTool(id) && !this.hasExternalSupport(id);}
  attachMagnet(id:string) {
    if(this.magnetJoint)throw new Error("磁吸工具已有工件。");
    const body=this.bodies.get(id);if(!body)throw new Error("物理工件不存在。");
    // Preserve the contact pose; neither body is teleported to a scripted centre.
    const toolQ=new Quaternion().copy(this.tool.rotation()), bodyQ=new Quaternion().copy(body.rotation());
    const a=new Vector3().copy(body.translation()).sub(new Vector3().copy(this.tool.translation())).applyQuaternion(toolQ.clone().invert());
    this.magnetJoint=this.world.createImpulseJoint(RAPIER.JointData.fixed(a,toolQ.clone().invert().multiply(bodyQ),{x:0,y:0,z:0},{x:0,y:0,z:0,w:1}),this.tool,body,true);
    this.magnetJoint.setContactsEnabled(false);this.magnetId=id;
  }
  releaseMagnet() {if(this.magnetJoint)this.world.removeImpulseJoint(this.magnetJoint,true);this.magnetJoint=undefined;this.magnetId=null;}
  get attachedMagnetId() {return this.magnetId;}
  dispose(){this.world.free();}
}
