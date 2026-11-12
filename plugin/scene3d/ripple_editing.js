import * as THREE from './vendor/three.module.js';
import {TransformControls} from './vendor/addons/controls/TransformControls.js';
import {sceneIcon} from './interface.js';
import {randomRippleRings} from './ground_ripples.js';
export function clampRipplePosition(x,z,radius){const length=Math.hypot(x,z),factor=length>radius?radius/length:1;return {x:x*factor,z:z*factor};}
export function initializeRippleEditing(hooks){
 const $=id=>document.getElementById(id),{scene,renderer,get,change,commit,preview,clearSelection,meshes,error}=hooks,proxy=new THREE.Object3D(),control=new TransformControls(get().camera,renderer.domElement),helper=control.getHelper();let selected='',uiKey='';
 scene.add(proxy,helper);control.setMode('translate');control.setSpace('world');control.showY=false;control.showX=true;control.showZ=true;helper.visible=false;
 const iconButton=(button,icon,label)=>{button.replaceChildren(sceneIcon(icon));button.classList.add('viewport-icon');button.setAttribute('aria-label',label);button.dataset.tooltip=label;};
 iconButton($('ripple-add'),'plus','添加手动涟漪');
 function deselect(){selected='';control.detach();helper.visible=false;renderUI();}
 function select(id){const {ground}=get();if(ground.pattern!=='mirror'||!ground.manualRipples.some(r=>r.id===id))return;clearSelection();selected=id;refresh();control.attach(proxy);renderUI();}
 function remove(id){if(get().busy)return;change({manualRipples:get().ground.manualRipples.filter(r=>r.id!==id)});if(selected===id)deselect();commit();}
 $('ripple-add').onclick=()=>{try{const {ground,orbit,busy}=get();if(busy||ground.pattern!=='mirror')return;if(ground.manualRipples.length>=16)throw Error('最多添加 16 组手动涟漪');const p=clampRipplePosition(orbit.target.x,orbit.target.z,ground.radius),id=crypto.randomUUID();change({ripples:true,manualRipples:[...ground.manualRipples,{id,...p,size:1,rings:randomRippleRings()}]});select(id);commit();}catch(e){error(e);}};
 $('manual-ripple-size').onchange=()=>{if(get().busy||!selected)return;const size=Math.max(.25,Math.min(20,Number($('manual-ripple-size').value)||1));change({manualRipples:get().ground.manualRipples.map(r=>r.id===selected?{...r,size}:r)});commit();};
 control.addEventListener('dragging-changed',e=>{get().orbit.enabled=!e.value&&!get().photo;if(!e.value){hooks.dragEnded?.();commit();}});
 control.addEventListener('objectChange',()=>{if(!selected||get().busy)return;const {ground}=get(),p=clampRipplePosition(proxy.position.x,proxy.position.z,ground.radius);proxy.position.set(p.x,0,p.z);change({manualRipples:ground.manualRipples.map(r=>r.id===selected?{...r,...p}:r)});preview();});
 function renderUI(){const {ground}=get();$('manual-ripple-controls').hidden=ground.pattern!=='mirror';const row=ground.manualRipples.find(r=>r.id===selected);$('manual-ripple-size-row').hidden=!row;if(row&&document.activeElement!==$('manual-ripple-size'))$('manual-ripple-size').value=row.size;
  const key=ground.manualRipples.map(r=>r.id+':'+r.rings).join('|')+'|'+selected;if(key===uiKey)return;uiKey=key;
  $('manual-ripple-list').replaceChildren(...ground.manualRipples.map((r,i)=>{const line=document.createElement('div');line.className='manual-ripple-row';const button=document.createElement('button');button.textContent='涟漪 '+(i+1)+' · '+r.rings+' 圈';button.setAttribute('aria-pressed',String(r.id===selected));button.dataset.tooltip='选择后用地面箭头沿 X/Z 移动';button.onclick=()=>select(r.id);const del=document.createElement('button');iconButton(del,'trash','删除涟漪 '+(i+1));del.onclick=()=>remove(r.id);line.append(button,del);return line;}));
 }
 function refresh(){const state=get();control.camera=state.camera;const row=state.ground.manualRipples.find(r=>r.id===selected);if(selected&&!row){deselect();return;}if(state.ground.pattern!=='mirror'&&selected){deselect();return;}
  if(row&&!control.dragging)proxy.position.set(row.x,0,row.z);control.enabled=!state.busy&&!state.photo;helper.visible=!!row&&state.ground.pattern==='mirror'&&state.ground.ripples&&!state.photo&&!state.busy;renderUI();
 }
 return {helper,refresh,select,deselect,dragging:()=>control.dragging,pick(raycaster,objects){if(get().ground.pattern!=='mirror'||!get().ground.ripples)return null;const hit=raycaster.intersectObjects(meshes(),false)[0],model=raycaster.intersectObjects(objects,true)[0];if(!hit||Math.hypot(hit.point.x,hit.point.z)>get().ground.radius||model&&hit.distance>=model.distance)return null;const rows=hit.object.userData.rippleDescriptors||[],candidates=rows.filter(r=>r.manual&&Math.hypot((hit.point.x-r.x)/r.rx,(hit.point.z-r.z)/r.rz)<=1);candidates.sort((a,b)=>Math.hypot(hit.point.x-a.x,hit.point.z-a.z)-Math.hypot(hit.point.x-b.x,hit.point.z-b.z));return candidates[0]?.id||null;},suspend(){const was=helper.visible;helper.visible=false;return()=>{helper.visible=was;refresh();};},dispose(){control.dispose();proxy.removeFromParent();helper.removeFromParent();}};
}
