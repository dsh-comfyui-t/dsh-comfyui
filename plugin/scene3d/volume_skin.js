import * as T from 'three';
const states=new WeakMap();
const patchedMaterials=new WeakSet();
const glsl=`
struct DshDQ { vec4 r; vec4 d; float s; };
vec4 dshMul(vec4 a,vec4 b){return vec4(a.w*b.xyz+b.w*a.xyz+cross(a.xyz,b.xyz),a.w*b.w-dot(a.xyz,b.xyz));}
vec4 dshQuat(mat3 m){
 float t=m[0][0]+m[1][1]+m[2][2];vec4 q;
 if(t>0.0){float s=sqrt(t+1.0)*2.0;q=vec4((m[1][2]-m[2][1])/s,(m[2][0]-m[0][2])/s,(m[0][1]-m[1][0])/s,.25*s);}
 else if(m[0][0]>m[1][1]&&m[0][0]>m[2][2]){float s=sqrt(1.0+m[0][0]-m[1][1]-m[2][2])*2.0;q=vec4(.25*s,(m[1][0]+m[0][1])/s,(m[2][0]+m[0][2])/s,(m[1][2]-m[2][1])/s);}
 else if(m[1][1]>m[2][2]){float s=sqrt(1.0+m[1][1]-m[0][0]-m[2][2])*2.0;q=vec4((m[1][0]+m[0][1])/s,.25*s,(m[2][1]+m[1][2])/s,(m[2][0]-m[0][2])/s);}
 else {float s=sqrt(1.0+m[2][2]-m[0][0]-m[1][1])*2.0;q=vec4((m[2][0]+m[0][2])/s,(m[2][1]+m[1][2])/s,.25*s,(m[0][1]-m[1][0])/s);}
 return normalize(q);
}
DshDQ dshFromMatrix(mat4 m){DshDQ q;q.s=max(length(m[0].xyz),.000001);q.r=dshQuat(mat3(m)/q.s);q.d=.5*dshMul(vec4(m[3].xyz,0.0),q.r);return q;}
DshDQ dshBlend(mat4 a,mat4 b,mat4 c,mat4 d,vec4 w){
 DshDQ q0=dshFromMatrix(a),q1=dshFromMatrix(b),q2=dshFromMatrix(c),q3=dshFromMatrix(d),q;
 vec4 ref=w.x>0.0?q0.r:(w.y>0.0?q1.r:(w.z>0.0?q2.r:q3.r));
 q.s=dot(vec4(q0.s,q1.s,q2.s,q3.s),w);vec4 signs=vec4(dot(ref,q0.r)<0.0?-1.0:1.0,dot(ref,q1.r)<0.0?-1.0:1.0,dot(ref,q2.r)<0.0?-1.0:1.0,dot(ref,q3.r)<0.0?-1.0:1.0);w*=signs;
 q.r=q0.r*w.x+q1.r*w.y+q2.r*w.z+q3.r*w.w;q.d=q0.d*w.x+q1.d*w.y+q2.d*w.z+q3.d*w.w;
 float l=max(length(q.r),.000001);q.r/=l;q.d/=l;q.d-=q.r*dot(q.r,q.d);return q;
}
vec3 dshRotate(vec4 q,vec3 p){return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
vec3 dshTranslate(DshDQ q){return 2.0*dshMul(q.d,vec4(-q.r.xyz,q.r.w)).xyz;}
bool dshRigid(mat4 m){float s=max(dot(m[0].xyz,m[0].xyz),.000001);return abs(dot(m[1].xyz,m[1].xyz)-s)<.002*s&&abs(dot(m[2].xyz,m[2].xyz)-s)<.002*s&&abs(dot(m[0].xyz,m[1].xyz))<.002*s&&dot(cross(m[0].xyz,m[1].xyz),m[2].xyz)>0.0;}
`;
const position=`#ifdef USE_SKINNING
{
 if(dshRigid(boneMatX)&&dshRigid(boneMatY)&&dshRigid(boneMatZ)&&dshRigid(boneMatW)){
 DshDQ dq=dshBlend(boneMatX,boneMatY,boneMatZ,boneMatW,skinWeight);
 vec3 p=(bindMatrix*vec4(transformed,1.0)).xyz;
 transformed=(bindMatrixInverse*vec4(dshRotate(dq.r,p*dq.s)+dshTranslate(dq),1.0)).xyz;
 }else{
 vec4 p=bindMatrix*vec4(transformed,1.0);transformed=(bindMatrixInverse*(boneMatX*p*skinWeight.x+boneMatY*p*skinWeight.y+boneMatZ*p*skinWeight.z+boneMatW*p*skinWeight.w)).xyz;
 }
}
#endif`;
const normal=`#ifdef USE_SKINNING
{
 if(dshRigid(boneMatX)&&dshRigid(boneMatY)&&dshRigid(boneMatZ)&&dshRigid(boneMatW)){
 DshDQ dq=dshBlend(boneMatX,boneMatY,boneMatZ,boneMatW,skinWeight);
 objectNormal=mat3(bindMatrixInverse)*dshRotate(dq.r,mat3(bindMatrix)*objectNormal);
 #ifdef USE_TANGENT
 objectTangent=mat3(bindMatrixInverse)*dshRotate(dq.r,mat3(bindMatrix)*objectTangent);
 #endif
 }else{
 mat4 sm=bindMatrixInverse*(skinWeight.x*boneMatX+skinWeight.y*boneMatY+skinWeight.z*boneMatZ+skinWeight.w*boneMatW)*bindMatrix;
 objectNormal=(sm*vec4(objectNormal,0.0)).xyz;
 #ifdef USE_TANGENT
 objectTangent=(sm*vec4(objectTangent,0.0)).xyz;
 #endif
 }
}
#endif`;
export function patchVolumeMaterial(material){
 if(patchedMaterials.has(material))return;patchedMaterials.add(material);
 const prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=shader=>{prior.call(material,shader);shader.vertexShader=glsl+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>',position).replace('#include <skinnormal_vertex>',normal);};
 material.customProgramCacheKey=()=>key()+'|dsh-dqs-v2';material.needsUpdate=true;
}
function refresh(state){
 const {mesh,dq}=state;mesh.skeleton.update();const matrix=new T.Matrix4(),q=new T.Quaternion(),t=new T.Vector3(),scale=new T.Vector3(),dual=new T.Quaternion();state.rigid=true;
 for(let i=0;i<mesh.skeleton.bones.length;i++){
  matrix.fromArray(mesh.skeleton.boneMatrices,i*16);matrix.decompose(t,q,scale);q.normalize();if(scale.x<=0||Math.max(Math.abs(scale.y-scale.x),Math.abs(scale.z-scale.x))>.001*Math.abs(scale.x))state.rigid=false;state.scales[i]=scale.x;
  dual.set(t.x,t.y,t.z,0).multiply(q);dq.set([q.x,q.y,q.z,q.w,dual.x*.5,dual.y*.5,dual.z*.5,dual.w*.5],i*8);
 }
}
export function blendDualQuaternion(dq,indices,weights,scales){
 const real=[0,0,0,0],dual=[0,0,0,0];let ref=indices[weights.findIndex(w=>w>0)]*8;
 for(let k=0;k<4;k++){const at=indices[k]*8;let dot=0;for(let j=0;j<4;j++)dot+=dq[ref+j]*dq[at+j];const w=weights[k]*(dot<0?-1:1);for(let j=0;j<4;j++){real[j]+=dq[at+j]*w;dual[j]+=dq[at+4+j]*w;}}
 const length=Math.hypot(...real)||1;for(let j=0;j<4;j++){real[j]/=length;dual[j]/=length;}const dot=real.reduce((s,v,j)=>s+v*dual[j],0);for(let j=0;j<4;j++)dual[j]-=real[j]*dot;return {real,dual,scale:scales?weights.reduce((sum,w,k)=>sum+w*scales[indices[k]],0):1};
}
export function transformDualQuaternion(vector,{real:r,dual:d,scale=1}){
 const x=vector.x*scale,y=vector.y*scale,z=vector.z*scale;
 const ux=2*(r[1]*z-r[2]*y),uy=2*(r[2]*x-r[0]*z),uz=2*(r[0]*y-r[1]*x);
 vector.set(x+r[3]*ux+r[1]*uz-r[2]*uy+2*(-d[3]*r[0]+d[0]*r[3]-d[1]*r[2]+d[2]*r[1]),y+r[3]*uy+r[2]*ux-r[0]*uz+2*(-d[3]*r[1]+d[0]*r[2]+d[1]*r[3]-d[2]*r[0]),z+r[3]*uz+r[0]*uy-r[1]*ux+2*(-d[3]*r[2]-d[0]*r[1]+d[1]*r[0]+d[2]*r[3]));return vector;
}
export function configureVolumeSkin(root,model){
 if(model?.deformation?.skinning!=='dual-quaternion')return;
 disposeVolumeSkin(root);
 const list=[];root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;
  for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))patchVolumeMaterial(material);
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}),distance=new T.MeshDistanceMaterial();patchVolumeMaterial(depth);patchVolumeMaterial(distance);mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;
  const state={mesh,depth,distance,dq:new Float64Array(mesh.skeleton.bones.length*8),scales:new Float64Array(mesh.skeleton.bones.length),original:mesh.applyBoneTransform,rigid:true};refresh(state);
  mesh.applyBoneTransform=function(index,vector){if(!state.rigid)return state.original.call(this,index,vector);const si=this.geometry.attributes.skinIndex,sw=this.geometry.attributes.skinWeight,idx=[],weights=[];for(let k=0;k<4;k++){idx.push(si.getComponent(index,k));weights.push(sw.getComponent(index,k));}vector.applyMatrix4(this.bindMatrix);transformDualQuaternion(vector,blendDualQuaternion(state.dq,idx,weights,state.scales));return vector.applyMatrix4(this.bindMatrixInverse);};
  list.push(state);
 });states.set(root,list);
}
export function updateVolumeSkin(root){for(const state of states.get(root)||[])refresh(state);}
export function disposeVolumeSkin(root){for(const state of states.get(root)||[]){state.mesh.applyBoneTransform=state.original;state.depth.dispose();state.distance.dispose();}states.delete(root);}
