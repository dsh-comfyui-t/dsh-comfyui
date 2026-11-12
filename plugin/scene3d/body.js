import * as T from 'three';

// Parameters describe the original bind shape, independently of pose or object scale.
// Geometry and bind inverses are owned by the instance; cached templates stay untouched.
export const BODY_FIELDS=[
 ['headSize','头部大小','头部',.65,1.4],['headWidth','宽度','头部',.65,1.4],['headHeight','长度','头部',.65,1.4],['headDepth','前后厚度','头部',.65,1.4],
 ['chestWidth','宽度','胸腔',.7,1.4],['chestDepth','厚度','胸腔',.7,1.4],['chestLength','长度','胸腔',.75,1.3],
 ['waistWidth','宽度','腰部',.65,1.4],['waistDepth','厚度','腰部',.65,1.4],['waistLength','长度','腰部',.75,1.3],
 ['hipWidth','宽度','骨盆',.7,1.4],['hipDepth','厚度','骨盆',.7,1.4],
 ...[['upperArm','上臂'],['forearm','前臂'],['thigh','大腿'],['calf','小腿']].flatMap(([key,label])=>[
  [key+'Length','长度',label,.7,1.3,true],[key+'Thickness','粗细',label,.65,1.4,true]]),
 ['handSize','大小','手',.6,1.5,true],['footSize','大小','脚',.6,1.5,true],
 ['breastSize','胸部大小','女性体型',.5,1.6,false,true],['gluteSize','臀部大小','女性体型',.5,1.6,false,true],
];
const controls=new WeakMap();
export function bodyShapeSupported(model){return ['bodykun','bodychan'].includes(typeof model==='string'?model:model?.id);}
export function normalizeBodyShape(raw,model){
 const value={version:1,linked:raw?.linked!==false,values:{}};
 if(!bodyShapeSupported(model))return value;
 for(const [key,,,min,max,paired,female] of BODY_FIELDS){
  if(female&&(typeof model==='string'?model:model?.id)!=='bodychan')continue;
  for(const name of paired?[key+'L',key+'R']:[key]){
   const n=raw?.values?.[name];value.values[name]=typeof n==='number'&&Number.isFinite(n)?T.MathUtils.clamp(n,min,max):1;
  }
 }
 return value;
}
export function bodyShapeSnapshot(root){const c=controls.get(root);return c?structuredClone(c.shape):undefined;}
export function configureBodyShape(root,model,raw){
 if(!bodyShapeSupported(model))return;
 const c=new BodyShape(root,model);controls.set(root,c);c.apply(normalizeBodyShape(raw,model));
}
export function applyBodyShape(root,value){const c=controls.get(root);if(c)c.apply(normalizeBodyShape(value,c.model));}
export function disposeBodyShape(root){controls.get(root)?.dispose();controls.delete(root);}
const update=root=>{root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);};
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

function chestShell(geometry,points){
 const parent=Int32Array.from({length:points.length},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{parent[find(b)]=find(a);},same=new Map();
 for(let i=0;i<points.length;i++){const p=points[i],key=[p.x,p.y,p.z].map(n=>n.toFixed(6)).join(',');if(same.has(key))join(i,same.get(key));else same.set(key,i);}
 const ids=geometry.index?.array||Array.from({length:points.length},(_,i)=>i);
 for(let i=0;i<ids.length;i+=3){join(ids[i],ids[i+1]);join(ids[i],ids[i+2]);}
 const groups=new Map();for(let i=0;i<points.length;i++){const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 const result=new Set();for(const indices of groups.values()){
  if(indices.length<300)continue;const box=new T.Box3().setFromPoints(indices.map(i=>points[i]));
  if(box.min.y>1.25&&box.max.y>1.49&&box.max.y<1.55&&box.min.x<-.12&&box.max.x>.12)for(const i of indices)result.add(i);
 }
 return result;
}

function roundedChestGeometry(item){
 const geometry=item.geometry.clone(),attributes=geometry.attributes;
 const data=Object.fromEntries(Object.entries(attributes).map(([name,a])=>[name,Array.from(name==='position'?item.position:name==='normal'?item.normal:a.array)]));
 const midpointCache=new Map(),chest=new Set(item.chest),faces=[];
 function midpoint(a,b){
  const key=a<b?a+','+b:b+','+a;if(midpointCache.has(key))return midpointCache.get(key);
  const index=data.position.length/3;midpointCache.set(key,index);chest.add(index);
  for(const [name,attr] of Object.entries(attributes)){
   if(name==='skinIndex'||name==='skinWeight')continue;
   const n=attr.itemSize,value=Array.from({length:n},(_,k)=>(data[name][a*n+k]+data[name][b*n+k])*.5);
   if(name==='normal'){const length=Math.hypot(...value)||1;value.forEach((v,k)=>value[k]=v/length);}
   data[name].push(...value);
  }
  const weights=new Map();for(const vertex of [a,b])for(let k=0;k<4;k++){const joint=data.skinIndex[vertex*4+k],w=data.skinWeight[vertex*4+k]*.5;if(w)weights.set(joint,(weights.get(joint)||0)+w);}
  const blend=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=blend.reduce((n,[,w])=>n+w,0);
  for(let k=0;k<4;k++){data.skinIndex.push(blend[k]?.[0]||0);data.skinWeight.push((blend[k]?.[1]||0)/sum);}
  return index;
 }
 const indices=geometry.index.array;
 for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];
  if(item.chest.has(a)&&item.chest.has(b)&&item.chest.has(c)){
   const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);faces.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
  }else faces.push(a,b,c);
 }
 for(const [name,a] of Object.entries(attributes))geometry.setAttribute(name,new T.BufferAttribute(new a.array.constructor(data[name]),a.itemSize,a.normalized));
 geometry.setIndex(faces);
 const neighbours=new Map([...chest].map(i=>[i,new Set()]));
 for(let i=0;i<faces.length;i+=3)for(const [a,b] of [[faces[i],faces[i+1]],[faces[i+1],faces[i+2]],[faces[i+2],faces[i]]]){neighbours.get(a)?.add(b);neighbours.get(b)?.add(a);}
 return {geometry,chest,neighbours,points:Array.from({length:data.position.length/3},(_,i)=>new T.Vector3(...data.position.slice(i*3,i*3+3)).applyMatrix4(item.toRoot)),position:new Float32Array(data.position),normal:new Float32Array(data.normal)};
}

function breastField(p){
 if(p.z<=.035||p.y<=1.279||p.y>=1.465||Math.abs(p.x)>=.16)return {w:0};
 const x=Math.abs(p.x)-.072,y=p.y-1.357,r=(x/.087)**2+(y/.09)**2;
 const w=(1-smooth(.65,1,r))*smooth(.035,.09,p.z)*smooth(1.279,1.31,p.y)*(1-smooth(1.40,1.465,p.y))*smooth(.008,.035,Math.abs(p.x));
 return {x,y,r,w};
}

class BodyShape{
 constructor(root,model){
  this.root=root;this.model=model;this.bones=[];this.meshes=[];update(root);
  const inv=root.matrixWorld.clone().invert();
  root.traverse(b=>{if(b.isBone)this.bones.push(b);});
  this.rest=new Map(this.bones.map(b=>{
   const matrix=new T.Matrix4().multiplyMatrices(inv,b.matrixWorld),position=new T.Vector3().setFromMatrixPosition(matrix);
   return [b,{position,matrix,localPosition:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}];
  }));
  this.boneOrder=[...this.bones].sort((a,b)=>{const depth=n=>{let d=0;while(n.parent){d++;n=n.parent;}return d;};return depth(a)-depth(b);});
  root.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;
   mesh.geometry=mesh.geometry.clone();mesh.userData.ownedGeometry=true;
   mesh.skeleton.boneInverses=mesh.skeleton.boneInverses.map(m=>m.clone());
   const toRoot=new T.Matrix4().multiplyMatrices(inv,mesh.matrixWorld),position=mesh.geometry.attributes.position;
   const points=Array.from({length:position.count},(_,i)=>new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(toRoot));
   this.meshes.push({mesh,geometry:mesh.geometry,toRoot,fromRoot:toRoot.clone().invert(),points,chest:this.model.id==='bodychan'?chestShell(mesh.geometry,points):new Set(),position:new Float32Array(position.array),normal:new Float32Array(mesh.geometry.attributes.normal.array)});
  });
 }
 linear(b,v){
  const n=b.name,diag=(x,y,z)=>new T.Matrix4().makeScale(x,y,z);
  if(n==='DEF-spine'||/^DEF-pelvis/.test(n))return diag(v.hipWidth,1,v.hipDepth);
  if(['DEF-spine001','DEF-spine002'].includes(n))return diag(v.waistWidth,v.waistLength,v.waistDepth);
  if(n==='DEF-spine003')return diag(v.chestWidth,v.chestLength,v.chestDepth);
  if(/^DEF-shoulder/.test(n))return diag(v.chestWidth,1,v.chestDepth);
  if(n==='DEF-spine006')return diag(v.headSize*v.headWidth,v.headSize*v.headHeight,v.headSize*v.headDepth);
  for(let parent=b;parent?.isBone;parent=parent.parent){
   const m=parent.name.match(/^DEF-(hand|foot)(L|R)$/);
   if(m){const s=v[(m[1]==='hand'?'handSize':'footSize')+m[2]];return diag(s,s,s);}
  }
  const m=n.match(/^DEF-(upper_arm|forearm|thigh|shin)(L|R)(001)?$/);
  if(m){
   const part={upper_arm:'upperArm',forearm:'forearm',thigh:'thigh',shin:'calf'}[m[1]],s=v[part+'Thickness'+m[2]],l=v[part+'Length'+m[2]];
   const q=new T.Quaternion(),unused=new T.Vector3();this.rest.get(b).matrix.decompose(unused,q,unused);
   const r=new T.Matrix4().makeRotationFromQuaternion(q);return r.clone().multiply(diag(s,l,s)).multiply(r.clone().invert());
  }
  return new T.Matrix4();
 }
 femalePoint(point,v,isChest=false){
  const p=point.clone();if(this.model.id!=='bodychan')return p;
  // Compact, continuous falloffs affect the breast and rear glute surfaces only.
  // They are applied before skeletal proportions, in the original bind space.
  if(isChest&&v.breastSize!==1&&p.z>.035&&p.y>1.279&&p.y<1.465&&Math.abs(p.x)<.16){
   const side=Math.sign(p.x),{x,y,r,w}=breastField(p),d=v.breastSize-1;
   if(d>0){
    const lower=.65+.35*(1-smooth(-.02,.07,y));
    p.x+=side*(x*.9+.003)*d*w;
    p.y+=(y*.5-.09*lower*Math.max(0,1-(x/.087)**2)**1.5)*d*w;
    p.z+=(.045*Math.sqrt(Math.max(0,1-r))+.25*Math.max(0,p.z-.06)+.01*lower)*d*w;
   }else{p.x+=side*x*d*.45*w;p.y+=y*d*.45*w;p.z+=(p.z-.055)*d*w;}
  }
  if(v.gluteSize!==1&&p.z<-.035&&p.y>.88&&p.y<1.16&&Math.abs(p.x)<.175){
   const x=Math.abs(p.x)-.078,y=p.y-1.01,r=(x/.105)**2+(y/.14)**2;
   const w=(1-smooth(.15,1,r))*smooth(.035,.095,-p.z),d=v.gluteSize-1;
   p.x+=Math.sign(p.x)*x*d*.25*w;p.y+=y*d*.2*w;p.z+=(p.z+.035)*d*w;
  }
  return p;
 }
 apply(shape){
  this.shape=shape;const v=shape.values,root=this.root;
  const posed=new Map(this.bones.map(b=>[b,b.quaternion.clone()]));
  for(const b of this.bones){const r=this.rest.get(b);b.position.copy(r.localPosition);b.quaternion.copy(r.quaternion);b.scale.copy(r.scale);}
  update(root);
  const linear=new Map(this.bones.map(b=>[b,this.linear(b,v)])),pivots=new Map(),affines=new Map();
  for(const b of this.boneOrder){
   const old=this.rest.get(b).position,parent=b.parent;
   const next=parent?.isBone?old.clone().sub(this.rest.get(parent).position).applyMatrix4(linear.get(parent)).add(pivots.get(parent)):old.clone();
   pivots.set(b,next);
   const matrix=linear.get(b).clone(),offset=next.clone().sub(old.clone().applyMatrix4(matrix));matrix.setPosition(offset);affines.set(b,matrix);
  }
  const neutral=Object.values(v).every(n=>n===1);let floor=Infinity;const changed=[];
  const active=this.meshes.map(item=>{
   if(this.model.id==='bodychan'&&v.breastSize>1){item.detail||=roundedChestGeometry(item);const detail={...item,...item.detail};item.mesh.geometry=detail.geometry;return detail;}
   item.mesh.geometry=item.geometry;return item;
  });
  for(const item of active){
   const {mesh,points}=item,skin=mesh.geometry.attributes.skinIndex,weight=mesh.geometry.attributes.skinWeight,vertices=[];
   const sources=points.map((point,i)=>this.femalePoint(point,v,item.chest.has(i)));
   if(item.neighbours&&v.breastSize>1){
    const movable=[...item.chest].map(i=>[i,breastField(points[i]).w]).filter(([,w])=>w>.01),amount=(v.breastSize-1)/.6;
    for(let pass=0;pass<6;pass++){
     const next=movable.map(([i,w])=>{const mean=new T.Vector3(),adj=item.neighbours.get(i);for(const j of adj)mean.add(sources[j]);mean.multiplyScalar(1/adj.size);return [i,sources[i].clone().lerp(mean,.35*amount*w)];});
     for(const [i,p] of next)sources[i]=p;
    }
   }
   for(let i=0;i<points.length;i++){
    const source=sources[i],p=new T.Vector3();
    for(let k=0;k<4;k++){const w=weight.getComponent(i,k);if(w)p.addScaledVector(source.clone().applyMatrix4(affines.get(mesh.skeleton.bones[skin.getComponent(i,k)])),w);}
    vertices.push(p);floor=Math.min(floor,p.y);
   }
   changed.push([item,vertices]);
  }
  const originalFloor=Math.min(...this.meshes.map(item=>item.points.reduce((min,p)=>Math.min(min,p.y),Infinity)));
  const lift=neutral?0:originalFloor-floor;
  for(const b of this.boneOrder){
   const world=pivots.get(b).clone();world.y+=lift;world.applyMatrix4(root.matrixWorld);
   b.position.copy(b.parent.worldToLocal(world));b.updateMatrixWorld(true);
  }
  update(root);
  const rebound=new Set();for(const {mesh} of this.meshes){if(!rebound.has(mesh.skeleton)){mesh.skeleton.calculateInverses();rebound.add(mesh.skeleton);}mesh.bind(mesh.skeleton,mesh.matrixWorld);}
  for(const [item,vertices] of changed){
   const {mesh,fromRoot}=item,attr=mesh.geometry.attributes.position;
   if(neutral){attr.array.set(item.position);mesh.geometry.attributes.normal.array.set(item.normal);mesh.geometry.attributes.normal.needsUpdate=true;}
   else{vertices.forEach((p,i)=>{p.y+=lift;p.applyMatrix4(fromRoot);attr.setXYZ(i,p.x,p.y,p.z);});mesh.geometry.computeVertexNormals();}
   attr.needsUpdate=true;mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  }
  for(const b of this.bones)b.quaternion.copy(posed.get(b));update(root);
  for(const {mesh} of this.meshes){mesh.computeBoundingBox();mesh.computeBoundingSphere();}
 }
 dispose(){for(const item of this.meshes)for(const geometry of [item.geometry,item.detail?.geometry])if(geometry&&geometry!==item.mesh.geometry)geometry.dispose();}
}
