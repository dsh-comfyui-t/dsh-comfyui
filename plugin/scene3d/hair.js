import * as THREE from 'three';
import {SkirtDynamics} from './skirt.js';

// Hair strands share the time step and constraint solver, with independent
// chains (no skirt-style circular edges) and an authored pose beneath motion.
export class HairDynamics{
 constructor(root,settings,bones,penetration){
  this.root=root;this.settings=settings;this.byName=new Map(bones.map(b=>[b.name,b]));
  this.spring=new SkirtDynamics(root,{...settings,connectNeighbours:false},bones,()=>this.colliders(),penetration);
  this.rest=this.spring.rest;this.applied=new Map();this.remember();
 }
 remember(){for(const [b] of this.rest)this.applied.set(b,b.quaternion.clone());}
 captureBoneEdit(bone){
  const authored=this.rest.get(bone),last=this.applied.get(bone);if(!authored||!last||Math.abs(last.clone().normalize().dot(bone.quaternion.clone().normalize()))>1-1e-10)return false;
  const delta=bone.quaternion.clone().normalize().multiply(last.clone().normalize().invert());authored.premultiply(delta).normalize();this.applied.set(bone,bone.quaternion.clone());this.edited=true;return true;
 }
 captureEdits(){for(const [b] of this.rest)this.captureBoneEdit(b);}
 setAuthored(bone,quaternion){if(!this.rest.has(bone))return false;this.rest.get(bone).copy(quaternion).normalize();bone.quaternion.copy(quaternion).normalize();this.applied.set(bone,bone.quaternion.clone());this.edited=true;return true;}
 authored(bone){this.captureBoneEdit(bone);return this.rest.get(bone);}
 wake(){if(this.edited){this.spring.rebase();this.edited=false;}this.spring.wake();}
 tick(dt){if(this.edited)this.wake();const changed=this.spring.tick(dt);if(changed)this.remember();return changed;}
 colliders(){
  this.root.updateWorldMatrix(true,false);this.root.updateMatrixWorld(true);const inverse=this.root.matrixWorld.clone().invert(),margin=this.settings.margin??.004;
  const shapes=[];
  for(const row of this.settings.ellipsoids||[]){const bone=this.byName.get(row.bone);if(!bone)continue;const toRoot=new THREE.Matrix4().multiplyMatrices(inverse,bone.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(...row.center));shapes.push({toRoot,toLocal:toRoot.clone().invert(),radii:new THREE.Vector3(...row.radii).addScalar(margin)});}
  for(const row of this.settings.capsules||[]){const a=this.byName.get(row.a),b=this.byName.get(row.b);if(!a||!b)continue;shapes.push({a:a.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse),b:b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse),radius:row.radius+margin});}
  return shapes;
 }
 get diagnostics(){
  const d=this.spring.diagnostics,inverse=this.root.matrixWorld.clone().invert(),shapes=this.colliders();let maxPenetration=0;
  for(const {bones} of this.spring.chains)for(let i=1;i<=bones.length;i++){const bone=bones[Math.min(i,bones.length-1)],p=i<bones.length?bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse):new THREE.Vector3(0,this.spring.tipLength(bone),0).applyMatrix4(bone.matrixWorld).applyMatrix4(inverse);for(const shape of shapes)maxPenetration=Math.max(maxPenetration,this.spring.penetration(p,shape));}
  return {strands:d.chains,bones:d.bones,active:d.active,motion:d.motion,maxPenetration};
 }
}
