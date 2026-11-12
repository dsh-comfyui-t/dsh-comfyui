import * as THREE from './vendor/three.module.js';
const validVector=(v,limit)=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=limit);
export function validatePoseOperations(operations,context){
 if(!Array.isArray(operations)||operations.length>48)throw Error('AI 姿势指令数量无效');const joints=new Map(context.joints.map(j=>[j.id,j]));
 for(const op of operations){if(!op||typeof op!=='object')throw Error('AI 姿势指令格式无效');
  if(op.type==='joint'){if(!joints.has(op.joint)||!validVector(op.rotation,180))throw Error('AI 返回未知关节或无效角度');}
  else if(op.type==='reach'){if(new Set([op.root,op.mid,op.end]).size!==3||![op.root,op.mid,op.end].every(id=>joints.has(id))||!joints.get(op.mid).ancestors.includes(op.root)||!joints.get(op.end).ancestors.includes(op.mid)||!validVector(op.target,10000)||('pole'in op&&!validVector(op.pole,10000)))throw Error('AI 肢体链或目标无效');}
  else if(op.type==='transform'){if(!('position'in op||'rotation'in op)||'position'in op&&(!validVector(op.position,10000)||op.position.some((v,i)=>Math.abs(v-context.position[i])>3))||'rotation'in op&&!validVector(op.rotation,180))throw Error('AI 整体变换超出范围');}
  else if(op.type!=='reset')throw Error('AI 返回不支持的姿势操作');
 }return operations;
}
export function solveTwoBoneReach(root,mid,end,target,pole,setLocal,refresh){
 refresh();const a=root.getWorldPosition(new THREE.Vector3()),b=mid.getWorldPosition(new THREE.Vector3()),c=end.getWorldPosition(new THREE.Vector3()),goal=new THREE.Vector3().fromArray(target),l1=a.distanceTo(b),l2=b.distanceTo(c);
 if(l1<1e-5||l2<1e-5)throw Error('该肢体链长度不足，无法求解');let direction=goal.clone().sub(a),distance=direction.length();if(distance<1e-6){direction.copy(c).sub(a);if(direction.lengthSq()<1e-9)direction.set(0,0,1);}direction.normalize();const d=THREE.MathUtils.clamp(distance,Math.abs(l1-l2)+1e-5,l1+l2-1e-5),bend=(pole?new THREE.Vector3().fromArray(pole):b.clone()).sub(a);bend.addScaledVector(direction,-bend.dot(direction));if(bend.lengthSq()<1e-8){bend.set(0,0,1);bend.addScaledVector(direction,-bend.dot(direction));if(bend.lengthSq()<1e-8)bend.set(1,0,0).addScaledVector(direction,-direction.x);}bend.normalize();
 const cosine=THREE.MathUtils.clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1),elbow=a.clone().addScaledVector(direction,l1*cosine).addScaledVector(bend,l1*Math.sqrt(Math.max(0,1-cosine*cosine))),clamped=a.clone().addScaledVector(direction,d);
 const aim=(bone,from,to)=>{if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;const delta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta),parent=bone.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();setLocal(bone,parent.invert().multiply(world).normalize());refresh();};
 aim(root,b.clone().sub(a),elbow.clone().sub(a));const middle=mid.getWorldPosition(new THREE.Vector3()),tip=end.getWorldPosition(new THREE.Vector3());aim(mid,tip.sub(middle),clamped.sub(middle));return Math.abs(distance-d)>.001;
}
export function applyPoseOperations(operations,context,hooks){
 validatePoseOperations(operations,context);const {root,joints,readLocal,setLocal,setControl,rest,refresh}=hooks,original=new Map([...joints.values()].map(n=>[n,readLocal(n).clone()])),position=root.position.clone(),quaternion=root.quaternion.clone();let clamped=0;
 try{for(const op of operations){if(op.type==='joint'){const n=joints.get(op.joint);setControl(n,new THREE.Quaternion().setFromEuler(new THREE.Euler(...op.rotation.map(THREE.MathUtils.degToRad),n.rotation.order)));refresh();}
  else if(op.type==='reach')clamped+=Number(solveTwoBoneReach(joints.get(op.root),joints.get(op.mid),joints.get(op.end),op.target,op.pole,setLocal,refresh));
  else if(op.type==='reset'){for(const n of joints.values())setLocal(n,rest(n).clone());refresh();}
  else {if(op.position)root.position.fromArray(op.position);if(op.rotation)root.quaternion.setFromEuler(new THREE.Euler(...op.rotation.map(THREE.MathUtils.degToRad),root.rotation.order));refresh();}}
  return {changed:operations.length>0,clamped};
 }catch(error){root.position.copy(position);root.quaternion.copy(quaternion);for(const [n,q]of original)setLocal(n,q);refresh();throw error;}
}
