import * as T from './vendor/three.module.js';
export const isCaptureMode=mode=>mode==='photo'||mode==='firstPerson';
export const normalizeFrameRoll=value=>{const n=Number(value)||0;return Math.round((((n+180)%360+360)%360-180)*100)/100;};
export const firstPersonHiddenBone=name=>/^DEF-spine00[456]$/.test(name);
/** Remove only bodies owned by the current shot; switching between shots never deletes them. */
export function partitionFirstPersonBodies(objects,shotId){
 const removed=[],remaining=[];
 for(const obj of objects){(obj.userData?.firstPersonFor===shotId?removed:remaining).push(obj);}
 return {removed,remaining};
}

// Keep the real skeleton as an anchor, but remove head/neck triangles from this instance.
export function prepareFirstPersonBody(root){
 let removed=0;
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;const geometry=mesh.geometry,index=geometry.index,skin=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;if(!index||!skin||!weights)return;
  const hidden=new Set(mesh.skeleton.bones.flatMap((bone,i)=>firstPersonHiddenBone(bone.name)?[i]:[]));
  const cut=new Uint8Array(skin.count);for(let i=0;i<skin.count;i++){let amount=0;for(let k=0;k<4;k++)if(hidden.has(skin.getComponent(i,k)))amount+=weights.getComponent(i,k);cut[i]=amount>.02;}
  const kept=[];for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(cut[a]||cut[b]||cut[c]){removed++;continue;}kept.push(a,b,c);}
  if(kept.length===index.count)return;const next=geometry.clone();next.setIndex(kept);next.clearGroups();mesh.geometry=next;mesh.userData.ownedGeometry=true;
 });
 root.userData.firstPersonBody=true;return removed;
}
export function firstPersonAnchor(root){
 root.updateWorldMatrix(true,true);let head;root.traverse(n=>{if(n.isBone&&n.name==='DEF-spine006')head=n;});if(!head)throw Error('第一人称素体缺少头部锚点');
 const local=root.worldToLocal(head.getWorldPosition(new T.Vector3()));local.add(new T.Vector3(0,.075,.075));return root.localToWorld(local);
}
export function placeFirstPersonBody(root,position,direction){
 root.rotation.y=Math.atan2(direction.x,direction.z);root.updateMatrixWorld(true);const eye=firstPersonAnchor(root);root.position.add(position.clone().sub(eye));root.updateMatrixWorld(true);return root;
}
export function syncFirstPersonCamera(camera,orbit,root,settings){
 const yaw=T.MathUtils.degToRad(Number(settings.firstPersonYaw)||0),pitch=T.MathUtils.degToRad(T.MathUtils.clamp(Number(settings.firstPersonPitch)||0,-89,89));
 const direction=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).applyQuaternion(root.getWorldQuaternion(new T.Quaternion()));
 camera.position.copy(firstPersonAnchor(root));camera.up.set(0,1,0);orbit.target.copy(camera.position).add(direction);camera.lookAt(orbit.target);camera.updateMatrixWorld(true);return camera.position;
}
export function rotateCaptureCamera(camera,angle){
 const quaternion=camera.quaternion.clone();camera.rotateZ(-T.MathUtils.degToRad(normalizeFrameRoll(angle)));camera.updateMatrixWorld(true);
 return ()=>{camera.quaternion.copy(quaternion);camera.updateMatrixWorld(true);};
}
export function installFirstPersonLook({element,get,change,commit,busy,win=window}){
 let drag=null;
 const down=e=>{const s=get();if(e.button!==0||s.mode!=='firstPerson'||s.viewLocked||busy())return;e.preventDefault();element.focus?.({preventScroll:true});e.stopImmediatePropagation();drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:s.firstPersonYaw||0,pitch:s.firstPersonPitch||0,moved:false};element.setPointerCapture?.(e.pointerId);};
 const move=e=>{if(!drag||drag.id!==e.pointerId||busy()||get().viewLocked)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)<1)return;drag.moved=true;change({firstPersonYaw:normalizeFrameRoll(drag.yaw-dx*.22),firstPersonPitch:T.MathUtils.clamp(drag.pitch-dy*.22,-89,89)});};
 const end=e=>{if(!drag||e?.pointerId!==undefined&&drag.id!==e.pointerId)return;const before=drag;drag=null;if(element.hasPointerCapture?.(before.id))element.releasePointerCapture(before.id);if(before.moved)commit();};
 const menu=e=>{if(get().mode==='firstPerson')e.preventDefault();};
 element.addEventListener('pointerdown',down,true);element.addEventListener('pointermove',move,true);element.addEventListener('pointerup',end,true);element.addEventListener('pointercancel',end,true);element.addEventListener('contextmenu',menu);win.addEventListener('blur',end);
 return {finish:()=>end(),dispose(){end();element.removeEventListener('pointerdown',down,true);element.removeEventListener('pointermove',move,true);element.removeEventListener('pointerup',end,true);element.removeEventListener('pointercancel',end,true);element.removeEventListener('contextmenu',menu);win.removeEventListener('blur',end);}};
}
export function installFrameRollControls({viewport,get,change,commit,busy,doc=document,win=window}){
 let held=false,dirty=false,timer=null;const editing=e=>e.target?.closest?.('input,textarea,select,button,a,[contenteditable],dialog[open],[role=button],[aria-modal="true"]')||doc.querySelector?.('dialog[open],[aria-modal="true"]');
 function flush(){clearTimeout(timer);timer=null;if(dirty){dirty=false;commit();}}
 function step(amount){change(normalizeFrameRoll((get().frameRoll||0)+amount));dirty=true;clearTimeout(timer);timer=setTimeout(flush,180);}
 const keydown=e=>{const key=e.key.toLowerCase(),modifier=e.ctrlKey||e.metaKey;if(editing(e)||busy())return;if(modifier&&key==='z'){flush();return;}if(!isCaptureMode(get().mode))return;
  if(modifier&&key==='r'){e.preventDefault();e.stopImmediatePropagation();change(0);dirty=true;flush();return;}
  if(!modifier&&key==='r'){held=true;e.preventDefault();e.stopImmediatePropagation();return;}
  if(held&&(key==='arrowup'||key==='arrowdown')){e.preventDefault();e.stopImmediatePropagation();step((key==='arrowup'?1:-1)*(e.shiftKey?5:1));}
 };
 const keyup=e=>{if(e.key.toLowerCase()==='r'){held=false;flush();}},blur=()=>{held=false;flush();};
 const wheel=e=>{if(!held||busy()||!isCaptureMode(get().mode))return;e.preventDefault();e.stopImmediatePropagation();step((e.deltaY>0?-1:1)*(e.shiftKey?5:1));};
 doc.addEventListener('keydown',keydown,true);doc.addEventListener('keyup',keyup,true);win.addEventListener('blur',blur);viewport.addEventListener('wheel',wheel,{capture:true,passive:false});
 return {flush,dispose(){blur();doc.removeEventListener('keydown',keydown,true);doc.removeEventListener('keyup',keyup,true);win.removeEventListener('blur',blur);viewport.removeEventListener('wheel',wheel,true);}};
}

/** First-person locomotion operates on the body anchor, never on OrbitControls. */
export function installFirstPersonNavigation({element,get,getCamera,getBody,change,preview,commit,busy,doc=document,win=window}){
 const keys=new Set();let space=false,modified=false,timer=null,rollHeld=false;
 const editing=e=>!!(e.target?.closest?.('input,textarea,select,button,a,[role=button],[role=menuitem],[contenteditable]:not([contenteditable="false"]),dialog[open],[aria-modal="true"]'))||!!doc.querySelector?.('dialog[open],[aria-modal="true"]')||!!(doc.activeElement&&!['BODY','HTML'].includes(doc.activeElement.tagName)&&doc.activeElement!==element&&doc.activeElement!==e.target&&doc.activeElement.closest?.('button,a,input,textarea,select,[tabindex],[contenteditable]'));
 const active=()=>get().mode==='firstPerson'&&!get().viewLocked&&!busy()&&!!getBody();
 const schedule=()=>{modified=true;clearTimeout(timer);timer=setTimeout(flush,260);};
 const flush=()=>{clearTimeout(timer);timer=null;if(modified){modified=false;commit();}};
 const down=e=>{
  if(editing(e)||e.ctrlKey||e.metaKey||e.altKey||!active()){keys.clear();space=false;return;}
  const key=e.key.toLowerCase();
  if(key==='r'){rollHeld=true;return;}
  if(key===' '){space=true;e.preventDefault();return;}
  if(['w','a','s','d','shift'].includes(key)){keys.add(key);if(key!=='shift')e.preventDefault();return;}
  if(['arrowup','arrowdown'].includes(key)){
   // Preserve the existing R+Arrow frame-roll handler even if event order changes.
   if(rollHeld)return;
   e.preventDefault();const body=getBody(),position=getCamera().position;
   const delta=key==='arrowup'?.1:-.1;
   if(position.y+delta>.15&&position.y+delta<30){body.position.y+=delta;preview();schedule();}
  }
 };
 const up=e=>{const key=e.key.toLowerCase();if(key==='r')rollHeld=false;if(key===' ')space=false;if(keys.delete(key)&&!['w','a','s','d'].some(k=>keys.has(k)))flush();};
 const wheel=e=>{
  if(!active()||editing(e)||rollHeld)return;
  e.preventDefault();e.stopImmediatePropagation();
  const step=e.deltaY<0?1:-1;
  if(space){const body=getBody(),position=getCamera().position,delta=.12*step;if(position.y+delta>.15&&position.y+delta<30){body.position.y+=delta;preview();schedule();}}
  else{const s=get();if(s.orthographic)return;const fov=Math.max(10,Math.min(90,Math.round((Number(s.fov)||35)-step*1.5)));if(fov!==s.fov){change({fov});schedule();}}
 };
 const blur=()=>{keys.clear();space=false;rollHeld=false;flush();};
 doc.addEventListener('keydown',down,true);doc.addEventListener('keyup',up,true);win.addEventListener('blur',blur);
 element.addEventListener('wheel',wheel,{passive:false,capture:true});
 function tick(delta){if(!active()||editing({target:doc.activeElement})||!keys.size){if(!active()||editing({target:doc.activeElement}))keys.clear();return false;}
  const front=keys.has('w')?1:keys.has('s')?-1:0,right=keys.has('d')?1:keys.has('a')?-1:0;
  if(!front&&!right)return false;
  const body=getBody(),camera=getCamera(),forward=camera.getWorldDirection(new T.Vector3());forward.y=0;
  if(forward.lengthSq()<.001)return false;forward.normalize();
  const sideways=new T.Vector3(-forward.z,0,forward.x);
  const motion=forward.multiplyScalar(front).addScaledVector(sideways,right).normalize();
  const speed=keys.has('shift')?3.6:1.6;
  body.position.addScaledVector(motion,Math.min(.08,Math.max(0,delta))*speed);
  preview();schedule();return true;
 }
 return {tick,flush,reset:blur,dispose(){blur();doc.removeEventListener('keydown',down,true);doc.removeEventListener('keyup',up,true);win.removeEventListener('blur',blur);element.removeEventListener('wheel',wheel,true);}};
}
