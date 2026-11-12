import {configureDeformation,updateDeformation,deformationAuthored,setDeformationAuthored,disposeDeformation} from './deformation.js';
import * as THREE from 'three';
import {SkirtDynamics} from './skirt.js';
import {HairDynamics} from './hair.js';

// Pose-driven collision correction: no accumulating simulation state is saved.
// All distances are in the normalized character's local space (height 1.8 m).
const controllers=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const collectBones=root=>{const bones=[];root.traverse(n=>{if(n.isBone)bones.push(n);});return bones;};
// SkinnedMesh refreshes its attached bind inverse in updateMatrixWorld, not
// updateWorldMatrix. Both parent transforms and that override must run before
// CPU skinning, especially for characters translated away from the origin.
const updateWorld=root=>{root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);};

export function capsulePenetration(point,capsule,correction){
 const a=capsule.a,b=capsule.b,r=capsule.radius;
 if(point.x<Math.min(a.x,b.x)-r||point.x>Math.max(a.x,b.x)+r||point.y<Math.min(a.y,b.y)-r||point.y>Math.max(a.y,b.y)+r||point.z<Math.min(a.z,b.z)-r||point.z>Math.max(a.z,b.z)+r){correction?.set(0,0,0);return 0;}
 const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,length=x*x+y*y+z*z,t=length?clamp(((point.x-a.x)*x+(point.y-a.y)*y+(point.z-a.z)*z)/length,0,1):0;
 const dx=point.x-a.x-x*t,dy=point.y-a.y-y*t,dz=point.z-a.z-z*t,distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
 const depth=capsule.radius-distance;
 if(depth<=0){correction?.set(0,0,0);return 0;}
 if(correction){if(distance<1e-9)correction.set(depth+1e-5,0,0);else correction.set(dx,dy,dz).multiplyScalar((depth+1e-5)/distance);}
 return depth;
}
export function collisionPenetration(point,shape,correction){
 if(!shape.toLocal)return capsulePenetration(point,shape,correction);
 const e=shape.toLocal.elements,half=shape.halfSize,x=e[0]*point.x+e[4]*point.y+e[8]*point.z+e[12],y=e[1]*point.x+e[5]*point.y+e[9]*point.z+e[13],z=e[2]*point.x+e[6]*point.y+e[10]*point.z+e[14];
 if(shape.radii){
  const r=shape.radii,length=Math.sqrt((x/r.x)**2+(y/r.y)**2+(z/r.z)**2);if(length>=1){correction?.set(0,0,0);return 0;}
  const scale=length>1e-9?1/length-1:0,dx=length>1e-9?x*scale:r.x,dy=y*scale,dz=z*scale,m=shape.toRoot.elements;
  const cx=m[0]*dx+m[4]*dy+m[8]*dz,cy=m[1]*dx+m[5]*dy+m[9]*dz,cz=m[2]*dx+m[6]*dy+m[10]*dz;correction?.set(cx,cy,cz).multiplyScalar(1.0001);return Math.hypot(cx,cy,cz);
 }
 const dx=half.x-Math.abs(x),dy=half.y-Math.abs(y),dz=half.z-Math.abs(z);
 if(dx<=0||dy<=0||dz<=0){correction?.set(0,0,0);return 0;}
 const axis=dx<=dy&&dx<=dz?0:dy<=dz?1:2,value=axis===0?x:axis===1?y:z,depth=Math.min(dx,dy,dz);
 if(correction){const amount=(value<0?-1:1)*(depth+1e-5),m=shape.toRoot.elements,column=axis*4;correction.set(m[column]*amount,m[column+1]*amount,m[column+2]*amount);}
 return depth;
}

function defaultTail(root,model,bones,restBones){
 const names=model.poseDefaults?.tailBones||[],angles=model.poseDefaults?.tailAngles||[];
 const byName=new Map(bones.map(b=>[b.name,b]));updateWorld(root);
 const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),flats=[];
 for(let i=0;i<angles.length;i++){
  const a=byName.get(names[i]),b=byName.get(names[i+1]);if(!a||!b)return new Set();
  const first=a.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse),second=b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
  const flat=second.sub(first);flat.y=0;if(flat.lengthSq()<1e-10)flat.set(0,0,1);flats.push(flat.normalize());
 }
 const changed=new Set();
 for(let i=0;i<angles.length;i++){
  updateWorld(root);const a=byName.get(names[i]),b=byName.get(names[i+1]);
  const from=b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();
  const angle=THREE.MathUtils.degToRad(angles[i]),to=flats[i].clone().multiplyScalar(Math.cos(angle));to.y=Math.sin(angle);to.transformDirection(root.matrixWorld);
  const q=new THREE.Quaternion().setFromUnitVectors(from,to).multiply(a.getWorldQuaternion(new THREE.Quaternion()));
  const parent=a.parent.getWorldQuaternion(new THREE.Quaternion()).invert();a.quaternion.copy(parent.multiply(q)).normalize();
  restBones.set(a,a.quaternion.clone());changed.add(a.name);
 }
 updateWorld(root);return changed;
}

export function configureCharacter(root,model,record,restBones){
 const bones=collectBones(root),raw=new Map(bones.map(b=>[b.name,b.quaternion.clone().normalize()]));
 const defaults=defaultTail(root,model||{},bones,restBones),revision=model?.poseDefaults?.version||0;
 const authoredRest=new Map(bones.map(b=>[b,b.quaternion.clone()]));
 const customLegacyTail=[...defaults].some(name=>record.bones?.[name]&&Math.abs(new THREE.Quaternion().fromArray(record.bones[name]).normalize().dot(raw.get(name)))<1-1e-7);
 const migrate=!!revision&&(!record.poseRevision||record.poseRevision<revision)&&!customLegacyTail;
 for(const bone of bones){
  if(model?.garmentCollision?.automaticPose&&bone.name.startsWith(model.garmentCollision.bonePrefix||'スカート')){bone.quaternion.copy(raw.get(bone.name));restBones.set(bone,bone.quaternion.clone());}
  else if(record.bones?.[bone.name]&&!(migrate&&defaults.has(bone.name)))bone.quaternion.fromArray(record.bones[bone.name]).normalize();
 }
 if(revision)root.userData.poseRevision=revision;
 if(model?.garmentCollision){const controller=new GarmentController(root,model.garmentCollision,bones,authoredRest,model.hairPhysics);controllers.set(root,controller);controller.solve();}
 configureDeformation(root,model,restBones);
}
export function updateCharacter(root,dt){updateDeformation(root);controllers.get(root)?.update(dt);}
export function characterBoneQuaternion(root,bone){const authored=deformationAuthored(root,bone);if(authored)return authored.toArray();const controller=controllers.get(root);return (controller?.hair?.authored(bone)||controller?.physics?.rest.get(bone)||bone.quaternion).toArray();}
export function setCharacterBoneQuaternion(root,bone,quaternion){if(setDeformationAuthored(root,bone,quaternion))return;if(!controllers.get(root)?.hair?.setAuthored(bone,quaternion))bone.quaternion.copy(quaternion);}
export function characterDiagnostics(root){const controller=controllers.get(root);return controller?{...controller.diagnostics,...(controller.physics?{physics:controller.physics.diagnostics}:{}),...(controller.hair?{hair:controller.hair.diagnostics}:{})}:undefined;}
export function disposeCharacter(root){disposeDeformation(root);controllers.delete(root);}

class GarmentController{
 constructor(root,settings,bones,authoredRest,hairSettings){
  this.root=root;this.settings=settings;this.byName=new Map(bones.map(b=>[b.name,b]));this.bones=bones;this.meshes=[];this.particles=[];this.edges=[];this.triangles=[];this.lastPose='';this.blend=new THREE.Matrix4();this.boneMatrix=new THREE.Matrix4();
  const shared=new Map(),edgeSet=new Set();
  updateWorld(root);const rootInverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;
   const skin=mesh.geometry.getAttribute('skinIndex'),weight=mesh.geometry.getAttribute('skinWeight'),position=mesh.geometry.getAttribute('position');
   const mobility=[];let movable=0;
   for(let i=0;i<position.count;i++){let sum=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[skin.getComponent(i,k)]?.name.startsWith(settings.bonePrefix||'スカート'))sum+=weight.getComponent(i,k);mobility.push(sum>.01?sum:0);if(sum>.01)movable++;}
   if(!movable)return;
   mesh.geometry=mesh.geometry.clone();mesh.userData.ownedGeometry=true;
   const item={mesh,rest:new Float32Array(position.array),normal:new Float32Array(mesh.geometry.getAttribute('normal').array),refs:[]};this.meshes.push(item);
   const toRoot=new THREE.Matrix4().multiplyMatrices(rootInverse,mesh.matrixWorld);
   for(let i=0;i<position.count;i++){
    const rest=new THREE.Vector3().fromBufferAttribute(position,i),base=rest.clone().applyMatrix4(toRoot);
    const influences=[];for(let k=0;k<4;k++)if(weight.getComponent(i,k)>0)influences.push(mesh.skeleton.bones[skin.getComponent(i,k)].name+':'+weight.getComponent(i,k).toFixed(5));
    const key=[base.x.toFixed(5),base.y.toFixed(5),base.z.toFixed(5),...influences.sort()].join('|');
    let particle=shared.get(key);
    const ref={mesh,index:i,rest,particle:null};
    if(!particle){particle={id:this.particles.length,target:new THREE.Vector3(),position:new THREE.Vector3(),mobility:mobility[i],ref};this.particles.push(particle);shared.set(key,particle);}
    particle.mobility=Math.max(particle.mobility,mobility[i]);ref.particle=particle;item.refs.push(ref);
   }
   const indices=mesh.geometry.index?.array||Array.from({length:position.count},(_,i)=>i);
   for(let i=0;i<indices.length;i+=3){const tri=[0,1,2].map(k=>item.refs[indices[i+k]].particle);if(!tri.some(p=>p.mobility))continue;this.triangles.push(tri);
    for(const [a,b] of [[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]]){if(a===b)continue;const key=[Math.min(a.id,b.id),Math.max(a.id,b.id)].join(':');if(!edgeSet.has(key)){edgeSet.add(key);this.edges.push({a,b,length:0});}}
   }
  });
  this.diagnostics={particles:this.particles.length,movable:this.particles.filter(p=>p.mobility).length};
  if(settings.bonePhysics){
   const posed=new Map(bones.map(b=>[b,b.quaternion.clone()]));for(const b of bones)b.quaternion.copy(authoredRest.get(b));updateWorld(root);
   this.physics=new SkirtDynamics(root,{...settings,...settings.bonePhysics},bones,()=>this.capsules(root.matrixWorld.clone().invert()),collisionPenetration);
   for(const b of bones)if(!this.physics.rest.has(b))b.quaternion.copy(posed.get(b));updateWorld(root);this.physics.wake();this.physics.settle();this.bodyPose=this.bodyKey();
  }
  if(hairSettings){this.hair=new HairDynamics(root,hairSettings,bones,collisionPenetration);this.bodyPose=this.bodyKey();}
 }
 bodyKey(){return [...this.root.position.toArray(),...this.root.quaternion.toArray(),...this.root.scale.toArray(),...this.bones.filter(b=>!this.physics?.rest.has(b)&&!this.hair?.rest.has(b)).flatMap(b=>[...b.quaternion.toArray(),...b.position.toArray(),...b.scale.toArray()])].join(',');}
 update(dt){
  this.hair?.captureEdits();const key=this.bodyKey();if(key!==this.bodyPose){this.bodyPose=key;this.physics?.wake();this.hair?.wake();}
  this.hair?.tick(dt??1/60);
  if(!this.physics)this.solve();else if(this.physics.tick(dt??1/60))this.solve(true);
 }
 skinMatrix(ref,result,rootInverse){
  const mesh=ref.mesh,skin=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
  const blend=this.blend;blend.elements.fill(0);const matrix=this.boneMatrix;
  for(let k=0;k<4;k++){const weight=weights.getComponent(ref.index,k);if(!weight)continue;const index=skin.getComponent(ref.index,k);matrix.multiplyMatrices(mesh.skeleton.bones[index].matrixWorld,mesh.skeleton.boneInverses[index]);for(let j=0;j<16;j++)blend.elements[j]+=matrix.elements[j]*weight;}
  result.multiplyMatrices(rootInverse,mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(blend).multiply(mesh.bindMatrix);return result;
 }
 capsules(rootInverse){
  const shapes=this.settings.capsules.flatMap(row=>{const a=this.byName.get(row.a),b=this.byName.get(row.b);if(!a||!b)return[];return[{a:a.getWorldPosition(new THREE.Vector3()).applyMatrix4(rootInverse),b:b.getWorldPosition(new THREE.Vector3()).applyMatrix4(rootInverse),radius:row.radius+(this.settings.margin||.004)}];});
  for(const row of this.settings.boxes||[]){const bone=this.byName.get(row.bone);if(!bone)continue;const toRoot=new THREE.Matrix4().multiplyMatrices(rootInverse,bone.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(...row.center));shapes.push({toRoot,toLocal:toRoot.clone().invert(),halfSize:new THREE.Vector3(...row.halfSize).addScalar(this.settings.margin||.004)});}
  return shapes;
 }
 solve(force=false){
  const key=this.bones.map(b=>[...b.quaternion.toArray(),...b.position.toArray(),...b.scale.toArray()].join(',')).join(';');if(!force&&key===this.lastPose)return;this.lastPose=key;
  updateWorld(this.root);const rootInverse=new THREE.Matrix4().copy(this.root.matrixWorld).invert(),matrix=new THREE.Matrix4(),correction=new THREE.Vector3();
  for(const particle of this.particles){particle.target.copy(particle.ref.rest).applyMatrix4(this.skinMatrix(particle.ref,matrix,rootInverse));particle.position.copy(particle.target);}
  for(const edge of this.edges)edge.length=edge.a.target.distanceTo(edge.b.target);
  const capsules=this.capsules(rootInverse),movable=this.particles.filter(p=>p.mobility),delta=new THREE.Vector3(),center=new THREE.Vector3();
  const project=()=>{let contacts=0;for(const p of movable)for(const capsule of capsules)if(collisionPenetration(p.position,capsule,correction)>.000001){p.position.add(correction);contacts++;}return contacts;};
  let initial=project();
  for(const tri of this.triangles){center.set(0,0,0);for(const p of tri)center.add(p.position);center.multiplyScalar(1/3);if(capsules.some(c=>collisionPenetration(center,c)>.0001))initial++;}
  if(initial){
   for(let iteration=0;iteration<10;iteration++){
    for(const p of movable)p.position.lerp(p.target,.025);
    for(const edge of this.edges){delta.subVectors(edge.b.position,edge.a.position);const length=delta.length(),mass=edge.a.mobility+edge.b.mobility;if(!mass||length<1e-9)continue;delta.multiplyScalar((length-edge.length)/length*.35/mass);edge.a.position.addScaledVector(delta,edge.a.mobility);edge.b.position.addScaledVector(delta,-edge.b.mobility);}
    for(const tri of this.triangles){center.set(0,0,0);let mass=0;for(const p of tri){center.add(p.position);mass+=p.mobility;}center.multiplyScalar(1/3);if(!mass)continue;
     for(const capsule of capsules)if(collisionPenetration(center,capsule,correction)>.0001){for(const p of tri)if(p.mobility)p.position.addScaledVector(correction,3*p.mobility/mass);center.add(correction);}
    }
    project();
   }
   // Contact cleanup follows the elastic pass so a long face cannot bridge
   // through a capsule even when all three corner vertices are outside it.
   for(let i=0;i<28;i++){
    let faceContacts=0;
    for(const tri of this.triangles){center.set(0,0,0);let mass=0;for(const p of tri){center.add(p.position);mass+=p.mobility;}center.multiplyScalar(1/3);if(!mass)continue;
     for(const capsule of capsules)if(collisionPenetration(center,capsule,correction)>.0001){faceContacts++;for(const p of tri)if(p.mobility)p.position.addScaledVector(correction,3*p.mobility/mass);center.add(correction);}
    }
    const contacts=project();if(!faceContacts&&!contacts)break;
   }
  }
  let maxPenetration=0,remaining=0,maxCorrection=0;
  for(const p of movable){maxCorrection=Math.max(maxCorrection,p.position.distanceTo(p.target));for(const capsule of capsules){const depth=collisionPenetration(p.position,capsule);maxPenetration=Math.max(maxPenetration,depth);if(depth>1e-4)remaining++;}}
  for(const item of this.meshes){const attr=item.mesh.geometry.getAttribute('position');attr.array.set(item.rest);
   for(const ref of item.refs){const p=ref.particle;if(!p.mobility||p.position.distanceToSquared(p.target)<1e-12)continue;this.skinMatrix(ref,matrix,rootInverse);if(Math.abs(matrix.determinant())<1e-10)continue;delta.copy(p.position).applyMatrix4(matrix.invert());attr.setXYZ(ref.index,delta.x,delta.y,delta.z);}
   attr.needsUpdate=true;if(initial)item.mesh.geometry.computeVertexNormals();else{item.mesh.geometry.getAttribute('normal').array.set(item.normal);item.mesh.geometry.getAttribute('normal').needsUpdate=true;}item.mesh.geometry.computeBoundingSphere();
  }
  let trianglePenetration=0;
  for(const tri of this.triangles){center.set(0,0,0);for(const p of tri)center.add(p.position);center.multiplyScalar(1/3);for(const capsule of capsules)trianglePenetration=Math.max(trianglePenetration,collisionPenetration(center,capsule));}
  this.diagnostics={...this.diagnostics,initialContacts:initial,remainingContacts:remaining,maxPenetration,trianglePenetration,maxCorrection,capsules:capsules.length};
 }
}
