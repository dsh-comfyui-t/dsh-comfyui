import * as THREE from 'three';

// Spring/PBD lattice on the actual 16 skirt chains. The final virtual point
// rotates each chain's last bone, which also carries the lace below its joint.
// Dynamics are transient; authored/rest rotations are the saved representation.
const step=1/120;
const position=(bone,inverse)=>bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
const update=root=>{root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);};
export class SkirtDynamics{
 constructor(root,settings,bones,contacts,penetration){
  this.root=root;this.settings=settings;this.contacts=contacts;this.penetration=penetration;
  this.points=[];this.chains=[];this.edges=[];this.rest=new Map();this.time=0;this.quiet=0;this.active=true;this.changed=true;
  update(root);this.lastWorld=root.matrixWorld.clone();const inverse=root.matrixWorld.clone().invert();
  const prefix=settings.bonePrefix||'スカート',starts=bones.filter(b=>b.name.startsWith(prefix)&&!b.parent?.name.startsWith(prefix)).sort((a,b)=>a.name.localeCompare(b.name));
  for(const first of starts){
   const chain=[];for(let b=first;b;b=b.children.find(c=>c.isBone&&c.name.startsWith(prefix))){chain.push(b);this.rest.set(b,b.quaternion.clone());}
   if(chain.length<2)continue;
   const parent=first.parent,toParent=new THREE.Matrix4().multiplyMatrices(inverse,parent.matrixWorld).invert(),nodes=[];
   for(let i=0;i<=chain.length;i++){
    const bone=chain[Math.min(i,chain.length-1)];let p;
    if(i<chain.length)p=position(bone,inverse);
    else{const length=this.tipLength(chain.at(-1));p=new THREE.Vector3(0,length,0).applyMatrix4(bone.matrixWorld).applyMatrix4(inverse);}
    const point={p:p.clone(),previous:p.clone(),goal:p.clone(),local:p.clone().applyMatrix4(toParent),parent,mass:i?1:0,id:this.points.length};
    this.points.push(point);nodes.push(point);
   }
   this.chains.push({bones:chain,nodes});
  }
  const edge=(a,b,stiffness)=>this.edges.push({a,b,length:a.p.distanceTo(b.p),stiffness});
  for(const chain of this.chains){const p=chain.nodes;for(let i=1;i<p.length;i++)edge(p[i-1],p[i],1);for(let i=2;i<p.length;i++)edge(p[i-2],p[i],settings.bendStiffness??.22);}
  // Neighbouring panels share motion all the way through the lace/hem ring.
  if(settings.connectNeighbours!==false)for(let i=0;i<this.chains.length;i++)for(let j=1;j<this.chains[i].nodes.length;j++)edge(this.chains[i].nodes[j],this.chains[(i+1)%this.chains.length].nodes[j],.6);
  this.poseKey='';this.refreshGoals();this.shapes=this.contacts();this.reset();this.settle();
 }
 tipLength(bone){return this.settings.tips?.[bone.name]??bone.position.length();}
 rebase(){
  const posed=new Map([...this.rest].map(([b])=>[b,b.quaternion.clone()]));for(const [b,q] of this.rest)b.quaternion.copy(q);update(this.root);const inverse=this.root.matrixWorld.clone().invert();
  for(const {bones,nodes} of this.chains)for(let i=0;i<nodes.length;i++){
   const p=nodes[i],bone=bones[Math.min(i,bones.length-1)];if(i<bones.length)p.goal.copy(position(bone,inverse));else p.goal.set(0,this.tipLength(bone),0).applyMatrix4(bone.matrixWorld).applyMatrix4(inverse);
   const parentInverse=new THREE.Matrix4().multiplyMatrices(inverse,p.parent.matrixWorld).invert();p.local.copy(p.goal).applyMatrix4(parentInverse);
  }
  for(const e of this.edges)e.length=e.a.goal.distanceTo(e.b.goal);for(const [b,q] of posed)b.quaternion.copy(q);update(this.root);
 }
 refreshGoals(){
  update(this.root);const inverse=this.root.matrixWorld.clone().invert(),carry=new THREE.Matrix4().multiplyMatrices(inverse,this.lastWorld);
  const oldP=new THREE.Vector3(),oldQ=new THREE.Quaternion(),oldS=new THREE.Vector3(),newP=new THREE.Vector3(),newQ=new THREE.Quaternion(),newS=new THREE.Vector3();this.lastWorld.decompose(oldP,oldQ,oldS);this.root.matrixWorld.decompose(newP,newQ,newS);
  const teleport=oldP.distanceTo(newP)>.5||oldQ.angleTo(newQ)>.45||oldS.distanceTo(newS)>.1;
  if(!this.root.matrixWorld.equals(this.lastWorld))for(const p of this.points){p.p.applyMatrix4(carry);p.previous.applyMatrix4(carry);}
  this.lastWorld.copy(this.root.matrixWorld);
  for(const p of this.points){p.goal.copy(p.local).applyMatrix4(p.parent.matrixWorld).applyMatrix4(inverse);if(!p.mass)p.p.copy(p.goal);}
  if(teleport)this.reset();
  this.gravity=new THREE.Vector3(0,-(this.settings.gravity??1),0).transformDirection(inverse).multiplyScalar(this.settings.gravity??1);
 }
 reset(){for(const p of this.points){p.p.copy(p.goal);p.previous.copy(p.goal);}this.active=true;this.quiet=0;}
 settle(){for(let i=0;i<(this.settings.settleSteps??100);i++)this.integrate(step);this.apply();this.active=false;this.quiet=0;}
 wake(){
  this.active=true;this.quiet=0;this.refreshGoals();const next=this.contacts();let travel=0;
  for(let i=0;i<next.length;i++){const a=this.shapes[i],b=next[i];if(a?.a&&b.a)travel=Math.max(travel,a.a.distanceTo(b.a),a.b.distanceTo(b.b));else if(a?.toRoot&&b.toRoot)travel=Math.max(travel,new THREE.Vector3().setFromMatrixPosition(a.toRoot).distanceTo(new THREE.Vector3().setFromMatrixPosition(b.toRoot)));}
  // Sweep abrupt pose changes through intermediate colliders. Projecting only
  // the final leg pose can put a raised thigh on the wrong side of the hem.
  const count=Math.min(16,Math.max(1,Math.ceil(travel/.025)));
  for(let j=1;j<=count;j++){const t=j/count,shapes=next.map((b,i)=>{const a=this.shapes[i];if(a?.a&&b.a)return {...b,a:a.a.clone().lerp(b.a,t),b:a.b.clone().lerp(b.b,t)};if(a?.toRoot&&b.toRoot){const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(),bp=new THREE.Vector3(),bq=new THREE.Quaternion(),bs=new THREE.Vector3();a.toRoot.decompose(p,q,s);b.toRoot.decompose(bp,bq,bs);const toRoot=new THREE.Matrix4().compose(p.lerp(bp,t),q.slerp(bq,t),s.lerp(bs,t));return {...b,toRoot,toLocal:toRoot.clone().invert()};}return b;});this.integrate(step,shapes);}
  this.shapes=next;
 }
 integrate(dt,shapes=this.shapes){
  const correction=new THREE.Vector3(),velocity=new THREE.Vector3(),delta=new THREE.Vector3();
  let motion=0;
  for(const p of this.points){if(!p.mass){p.p.copy(p.goal);p.previous.copy(p.goal);continue;}
   const old=p.p.clone();velocity.subVectors(p.p,p.previous).multiplyScalar(Math.exp(-(this.settings.damping??7)*dt));p.p.add(velocity).addScaledVector(this.gravity,dt*dt).addScaledVector(delta.subVectors(p.goal,p.p),(this.settings.stiffness??32)*dt*dt);p.previous.copy(old);
  }
  const contact=()=>{for(const p of this.points)if(p.mass)for(const shape of shapes)if(this.penetration(p.p,shape,correction)>.00001)p.p.add(correction);};
  for(let iteration=0;iteration<(this.settings.iterations??8);iteration++){
   for(const e of this.edges){delta.subVectors(e.b.p,e.a.p);const length=delta.length(),mass=e.a.mass+e.b.mass;if(!mass||length<1e-9)continue;delta.multiplyScalar((length-e.length)/length*e.stiffness/mass);if(e.a.mass)e.a.p.addScaledVector(delta,e.a.mass);if(e.b.mass)e.b.p.addScaledVector(delta,-e.b.mass);}
   // Sample the segments, not only the joints, so a leg/tail cannot pass
   // between two skirt joints. Free endpoints share the contact impulse.
   for(const {nodes} of this.chains)for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i];for(const t of [.25,.5,.75]){const sample=a.p.clone().lerp(b.p,t);for(const shape of shapes)if(this.penetration(sample,shape,correction)>.00001){const mass=a.mass*(1-t)**2+b.mass*t*t;if(!mass)continue;if(a.mass)a.p.addScaledVector(correction,a.mass*(1-t)/mass);if(b.mass)b.p.addScaledVector(correction,b.mass*t/mass);sample.add(correction);}}
   }
   contact();
  }
  const maxDisplacement=this.settings.maxDisplacement??.6;for(const p of this.points)if(p.mass){motion=Math.max(motion,p.p.distanceToSquared(p.previous));const d=p.p.distanceTo(p.goal);if(d>maxDisplacement){p.p.lerp(p.goal,1-maxDisplacement/d);p.previous.copy(p.p);}}
  return motion;
 }
 tick(dt){
  if(!this.active)return false;
  this.refreshGoals();this.time+=Math.min(Math.max(Number(dt)||0,0),1/15);let count=0,motion=0;
  while(this.time>=step&&count++<8){motion=Math.max(motion,this.integrate(step));this.time-=step;}
  if(!count)return false;
  this.motion=Math.sqrt(motion);this.apply();if(motion<2.5e-7)this.quiet++;else this.quiet=0;if(this.quiet>25)this.active=false;
  return true;
 }
 apply(){
  update(this.root);const worldTarget=new THREE.Vector3(),start=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),rotation=new THREE.Quaternion(),parentQ=new THREE.Quaternion();
  for(const {bones,nodes} of this.chains)for(let i=0;i<bones.length;i++){
   const bone=bones[i];bone.quaternion.copy(this.rest.get(bone));bone.updateWorldMatrix(true,true);
   bone.getWorldPosition(start);
   if(i+1<bones.length)bones[i+1].getWorldPosition(from);else from.set(0,this.tipLength(bone),0).applyMatrix4(bone.matrixWorld);
   from.sub(start).normalize();worldTarget.copy(nodes[i+1].p).applyMatrix4(this.root.matrixWorld);to.copy(worldTarget).sub(start).normalize();
   if(from.lengthSq()<.5||to.lengthSq()<.5)continue;
   rotation.setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));parentQ.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion())).invert();bone.quaternion.copy(parentQ.multiply(rotation)).normalize();
   const limit=i===0?(this.settings.maxRootAngle??this.settings.maxAngle):this.settings.maxAngle;if(limit){const rest=this.rest.get(bone),angle=rest.angleTo(bone.quaternion);if(angle>limit){const desired=bone.quaternion.clone();bone.quaternion.copy(rest).slerp(desired,limit/angle).normalize();}}
   bone.updateWorldMatrix(false,true);
  }
  update(this.root);
 }
 get diagnostics(){return {chains:this.chains.length,bones:this.rest.size,hemPoints:this.chains.length,active:this.active,motion:this.motion||0};}
}
