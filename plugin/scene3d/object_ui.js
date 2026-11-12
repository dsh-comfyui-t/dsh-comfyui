import {rebuildTextObject,faceTextObject} from './text.js';
export function initializeObjectControls(hooks){
 const $=id=>document.getElementById(id),{get,commit,error,job}=hooks;
 const safe=fn=>async(...args)=>{try{await fn(...args);}catch(e){error(e);}};
 $('toggle-inspector').onclick=()=>{const open=$('objects-panel').hidden;$('objects-panel').hidden=!open;$('toggle-inspector').setAttribute('aria-expanded',String(open));};
 $('toggle-inspector').setAttribute('aria-expanded','true');$('objects-panel').hidden=false;
 $('object-color').onchange=()=>{const object=get().selected;if(!object)return;object.userData.color=$('object-color').value;if(object.userData.text)object.userData.text.color=object.userData.color;hooks.color(object);commit();};
 $('flip-object').onclick=()=>{const object=get().selected;if(!object)return;object.scale.x*=-1;hooks.transforms();commit();};
 for(const [id,key,kind] of [['edit-text-content','content','text'],['edit-text-font','font','text'],['edit-text-depth','depth','number'],['edit-text-size','size','number'],['edit-text-receive','receiveShadow','check'],['edit-text-cast','castShadow','check']])$(id).onchange=safe(()=>job(async()=>{
  const object=get().selected;if(!object?.userData.text)return;const input=$(id),value=kind==='check'?input.checked:kind==='number'?Number(input.value):input.value;
  if(key==='content'&&!value.trim())throw Error('文字不能为空');await rebuildTextObject(object,{...object.userData.text,[key]:value});hooks.color(object);commit();
 }));
 function face(follow){const {selected,shots,activeShot,camera}=get();if(!selected?.userData.text)return;const id=$('text-target-camera').value,index=shots.findIndex(s=>s.id===id),shot=shots[index];if(!shot)return;const target=index===activeShot?{...shot,camera:{...shot.camera,position:camera.position.toArray()}}:shot;faceTextObject(selected,target,follow);hooks.transforms();commit();}
 $('text-face-once').onclick=()=>face(false);$('text-face-follow').onclick=()=>face(true);
 $('text-upright').onclick=()=>{const o=get().selected;if(!o?.userData.text)return;o.userData.text.followCamera=false;o.rotation.x=0;o.rotation.z=0;hooks.transforms();commit();};
 async function flush(){
  const object=get().selected;if(!object?.userData.text)return;
  const next={...object.userData.text,content:$('edit-text-content').value,font:$('edit-text-font').value,depth:Number($('edit-text-depth').value),size:Number($('edit-text-size').value),receiveShadow:$('edit-text-receive').checked,castShadow:$('edit-text-cast').checked};
  if(JSON.stringify(next)!==JSON.stringify(object.userData.text)){if(!next.content.trim())throw Error('文字不能为空');await rebuildTextObject(object,next);hooks.color(object);commit();}
 }
 return {flush,render(){
  const {selected,shots,settings}=get();$('object-controls').hidden=!selected;if(!selected)return;
  $('object-color').value=selected.userData.color||selected.userData.text?.color||settings.clay;
  const text=selected.userData.text;$('text-object-fields').hidden=!text;
  if(text){for(const [id,key] of [['edit-text-content','content'],['edit-text-font','font'],['edit-text-depth','depth'],['edit-text-size','size']])$(id).value=text[key];$('edit-text-receive').checked=text.receiveShadow;$('edit-text-cast').checked=text.castShadow;$('edit-text-receive').disabled=text.depth===0;
   $('text-target-camera').replaceChildren(...shots.map(s=>{const option=document.createElement('option');option.value=s.id;option.textContent=s.name;return option;}));$('text-target-camera').value=text.faceCameraId||shots[get().activeShot]?.id;
  }
 }};
}
