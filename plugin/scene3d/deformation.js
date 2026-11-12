import * as T from 'three';
import {configureVolumeSkin,updateVolumeSkin,disposeVolumeSkin}from'./volume_skin.js';
const controllers=new WeakMap();
const identity=new T.Quaternion(),up=new T.Vector3(0,1,0);
function twist(q,axis){const amount=q.x*axis.x+q.y*axis.y+q.z*axis.z,t=new T.Quaternion(axis.x*amount,axis.y*amount,axis.z*amount,q.w);if(t.lengthSq()<1e-12)return new T.Quaternion();t.normalize();if(t.w<0)t.set(-t.x,-t.y,-t.z,-t.w);return t;}
export function configureDeformation(root,model,rest){
 if(!model?.deformation)return;
 const c=new Deformation(root,model,rest);controllers.set(root,c);configureVolumeSkin(root,model);c.update();
}
export function updateDeformation(root){controllers.get(root)?.update();}
export function deformationAuthored(root,bone){return controllers.get(root)?.authoredQuaternion(bone);}
export function setDeformationAuthored(root,bone,q){const c=controllers.get(root);if(!c)return false;c.set(bone,q);return true;}
export function captureDeformation(root){controllers.get(root)?.capture();}
export function disposeDeformation(root){controllers.delete(root);disposeVolumeSkin(root);}
export function deformationDiagnostics(root){return controllers.get(root)?.diagnostics;}
class Deformation{
 constructor(root,model,rest){
  this.root=root;this.model=model;this.bones=new Map();this.meshes=[];this.state=new Map();this.restDirections=new Map();root.traverse(o=>{if(o.isBone){this.bones.set(o.name,o);this.state.set(o,{rest:rest.get(o).clone(),authored:o.quaternion.clone(),output:o.quaternion.clone(),prefix:new T.Quaternion()});}if(o.isSkinnedMesh)this.meshes.push(o);});
  for(const [b,s]of this.state)b.quaternion.copy(s.rest);root.updateMatrixWorld(true);const rootInv=root.getWorldQuaternion(new T.Quaternion()).invert();
  for(const [b,s]of this.state)s.parentRest=rootInv.clone().multiply(b.parent.getWorldQuaternion(new T.Quaternion())).normalize();
  for(const side of ['L','R'])for(const[part,end]of [['upper_arm','forearm'],['forearm','hand'],['thigh','shin'],['shin','foot']]){const b=this.bones.get('DEF-'+part+side),c=this.bones.get('DEF-'+end+side),child=this.bones.get('DEF-'+part+side+'001');if(!b||!c)continue;const direction=c.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize(),state=this.state.get(b);state.longAxis=direction.clone().applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert());if(child)state.childAxis=direction.clone().applyQuaternion(child.getWorldQuaternion(new T.Quaternion()).invert());if(part==='upper_arm')this.restDirections.set(side,direction.clone().applyQuaternion(rootInv));}
  for(const [b,s]of this.state)b.quaternion.copy(s.authored);root.updateMatrixWorld(true);this.diagnostics={skinning:'dual-quaternion',correctiveTargets:0,shoulderFollowDegrees:{L:0,R:0}};
 }
 capture(){for(const[b,s]of this.state)if(1-Math.abs(b.quaternion.dot(s.output))/Math.sqrt(b.quaternion.lengthSq()*s.output.lengthSq())>1e-10){s.authored.copy(s.prefix).invert().multiply(b.quaternion).normalize();s.output.copy(b.quaternion);}}
 authoredQuaternion(b){this.capture();return this.state.get(b)?.authored.clone();}
 set(b,q){const s=this.state.get(b);if(!s)return;s.authored.copy(q).normalize();if(s.authored.angleTo(s.rest)<1e-7)s.twistAngle=0;b.quaternion.copy(s.prefix).multiply(s.authored);s.output.copy(b.quaternion);}
 update(){
  this.capture();for(const[b,s]of this.state)b.quaternion.copy(s.authored);this.root.updateMatrixWorld(true);
  const rootInv=this.root.getWorldQuaternion(new T.Quaternion()).invert();
  for(const side of ['L','R']){
   const shoulder=this.bones.get('DEF-shoulder'+side),arm=this.bones.get('DEF-upper_arm'+side);if(!shoulder||!arm)continue;
   const before=arm.getWorldQuaternion(new T.Quaternion()),direction=this.state.get(arm).longAxis.clone().applyQuaternion(before).applyQuaternion(rootInv).normalize(),restDir=this.restDirections.get(side);
   const elevation=Math.acos(T.MathUtils.clamp(-direction.dot(up),-1,1))-Math.acos(T.MathUtils.clamp(-restDir.dot(up),-1,1));
   const follow=T.MathUtils.clamp((elevation-.20)*.28,0,.38);this.diagnostics.shoulderFollowDegrees[side]=T.MathUtils.radToDeg(follow);
   if(follow>0){
    const axis=new T.Vector3().crossVectors(restDir,direction);if(axis.lengthSq()>1e-8){axis.normalize().applyQuaternion(this.root.getWorldQuaternion(new T.Quaternion()));const delta=new T.Quaternion().setFromAxisAngle(axis,follow),parent=shoulder.parent.getWorldQuaternion(new T.Quaternion()),world=shoulder.getWorldQuaternion(new T.Quaternion());
     shoulder.quaternion.copy(parent.clone().invert().multiply(delta).multiply(world));this.root.updateMatrixWorld(true);arm.quaternion.copy(arm.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(before));this.root.updateMatrixWorld(true);
    }
   }
  }
  for(const side of ['L','R'])for(const part of ['upper_arm','forearm','thigh','shin']){
   const b=this.bones.get('DEF-'+part+side),next=this.bones.get('DEF-'+part+side+'001');if(!b||!next)continue;const s=this.state.get(b),delta=s.rest.clone().invert().multiply(b.quaternion),roll=twist(delta,s.longAxis),swing=delta.clone().multiply(roll.clone().invert());
   let angle=2*Math.atan2(roll.x*s.longAxis.x+roll.y*s.longAxis.y+roll.z*s.longAxis.z,roll.w);
   // q and -q represent the same rotation. Split one continuous signed angle
   // between both segments; mixing slerp's shortest arc with raw atan2 flips limbs.
   if(Number.isFinite(s.twistAngle))angle+=Math.round((s.twistAngle-angle)/(2*Math.PI))*2*Math.PI;s.twistAngle=angle;
   const half=new T.Quaternion().setFromAxisAngle(s.longAxis,angle*.5);
   b.quaternion.copy(s.rest).multiply(swing).multiply(half);next.quaternion.multiply(new T.Quaternion().setFromAxisAngle(s.childAxis,angle*.5));
  }
  this.root.updateMatrixWorld(true);let active=0;
  const weights=[];const totals=new Map();
  for(const target of this.model.deformation.correctives||[]){const b=this.bones.get(target.bone),s=this.state.get(b);if(!s)continue;const q=target.space==='model'?s.parentRest.clone().multiply(s.authored).multiply(s.rest.clone().invert()).multiply(s.parentRest.clone().invert()).normalize():s.rest.clone().invert().multiply(s.authored).normalize(),axis=new T.Vector3().fromArray(target.axis);let angle=2*Math.atan2(q.x*axis.x+q.y*axis.y+q.z*axis.z,q.w);if(angle>Math.PI)angle-=2*Math.PI;let t=T.MathUtils.clamp(angle/target.angle,0,1);t=t*t*(3-2*t);weights.push([target,t]);totals.set(target.bone,(totals.get(target.bone)||0)+t);}
  for(const mesh of this.meshes){
   if(!mesh.morphTargetInfluences)continue;mesh.morphTargetInfluences.fill(0);
   for(const[target,w]of weights){const index=mesh.morphTargetDictionary?.[target.target];if(index===undefined)continue;const value=w/Math.max(1,totals.get(target.bone));mesh.morphTargetInfluences[index]=value;if(value>.001)active++;}
  }
  this.diagnostics.correctiveTargets=active;
  for(const[b,s]of this.state){s.output.copy(b.quaternion);s.prefix.copy(s.output).multiply(s.authored.clone().invert()).normalize();}
  updateVolumeSkin(this.root);
 }
}
