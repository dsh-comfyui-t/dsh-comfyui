import * as T from 'three';
const frames=new WeakMap();
export function configureJointFrames(root,model){
 if(!model?.deformation?.anatomicalJoints)return;
 root.updateWorldMatrix(true,true);const bones=new Map();root.traverse(o=>{if(o.isBone)bones.set(o.name,o)});const rootQ=root.getWorldQuaternion(new T.Quaternion());
 for(const side of ['L','R'])for(const [proximal,joint,distal]of [['upper_arm','forearm','hand'],['thigh','shin','foot']]){
  const a=bones.get('DEF-'+proximal+side),b=bones.get('DEF-'+joint+side),c=bones.get('DEF-'+distal+side);if(!a||!b||!c)continue;
  const upper=b.getWorldPosition(new T.Vector3()).sub(a.getWorldPosition(new T.Vector3())).normalize(),lower=c.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize();
  let x=joint==='shin'?new T.Vector3(1,0,0).applyQuaternion(rootQ):new T.Vector3().crossVectors(upper,lower);
  if(x.lengthSq()<.0004)x=new T.Vector3(1,0,0).applyQuaternion(rootQ);x.addScaledVector(lower,-x.dot(lower)).normalize();if(joint==='forearm'){if(new T.Vector3().crossVectors(x,lower).dot(new T.Vector3(0,0,1).applyQuaternion(rootQ))<0)x.negate();}else if(x.dot(new T.Vector3(1,0,0).applyQuaternion(rootQ))<0)x.negate();
  const z=new T.Vector3().crossVectors(x,lower).normalize(),y=new T.Vector3().crossVectors(z,x).normalize();const frameQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
  const correction=b.getWorldQuaternion(new T.Quaternion()).invert().multiply(frameQ).normalize();const base=b.quaternion.clone().multiply(correction).normalize();frames.set(b,{correction,base,kind:joint==='shin'?'knee':'elbow'});
 }
 // Saved calibration axes are expressed in asset/model space. Centres are
 // baked into the GLB bind pose; this changes only the editor's control frame.
 for(const[name,values]of Object.entries(model.jointCalibration?.frames||{})){
  const b=bones.get(name);if(!b||!Array.isArray(values)||values.length!==4)continue;
  const desired=rootQ.clone().multiply(new T.Quaternion().fromArray(values).normalize()),correction=b.getWorldQuaternion(new T.Quaternion()).invert().multiply(desired).normalize();
  frames.set(b,{correction,base:b.quaternion.clone().multiply(correction).normalize(),kind:'calibrated'});
 }
}
export function hasJointFrame(bone){return !!bone&&frames.has(bone);}
export function jointFrameQuaternion(bone,authored){const f=frames.get(bone),world=authored?bone.parent.getWorldQuaternion(new T.Quaternion()).multiply(authored):bone.getWorldQuaternion(new T.Quaternion());return world.multiply(f.correction).normalize();}
export function jointFrameToLocal(bone,world){const f=frames.get(bone);return bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world).multiply(f.correction.clone().invert()).normalize();}
export function jointFrameDelta(bone,authored){const f=frames.get(bone);return f.base.clone().invert().multiply(authored).multiply(f.correction).normalize();}
export function jointFrameFromDelta(bone,delta){const f=frames.get(bone);return f.base.clone().multiply(delta).multiply(f.correction.clone().invert()).normalize();}
export function jointFrameKind(bone){return frames.get(bone)?.kind;}
