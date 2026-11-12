import {createSceneCommandRunner} from './control_bridge.js';
import {renderWithFallback} from './render_fallback.js';
import {initializeSceneSelectInputs,syncSceneSelectInputs} from './select_input.js';
import {captureAspect,ratioText} from './capture_size.js';
import {preserveFrameProjection} from './frame_resize.js';
import {normalizeSceneLights,createSceneLightManager,sceneLightRange} from './lighting.js';
import {createSceneFisheye,FISHEYE_MAX} from './fisheye.js';
import {prepareSceneAssets} from './load_transaction.js';
import {isCaptureMode,normalizeFrameRoll,prepareFirstPersonBody,firstPersonAnchor,placeFirstPersonBody,syncFirstPersonCamera,rotateCaptureCamera,installFrameRollControls,installFirstPersonLook,installFirstPersonNavigation,partitionFirstPersonBodies} from './camera_modes.js';
import {initializePoseChat} from './pose_chat.js';
import {applyPoseOperations} from './pose_control.js';
import {initializeRippleEditing} from './ripple_editing.js';
import {createGroundEffects} from './ground_effects.js';
import {createGroundFloor,createGroundGrid,updateGroundGrid,normalizeGroundGrid} from './ground_grid.js';
import {initializeSceneNumberInputs} from './number_input.js';
import {initializeCameraStudio} from './camera_studio.js';
import {initializeObjectControls} from './object_ui.js';
import {createTextObject,rebuildTextObject,faceTextObject,updateTextFacing,filterCSS,drawShotTexts,loadTextFont,copySelectedLimbPose} from './text.js';
import {configureJointFrames,hasJointFrame,jointFrameQuaternion,jointFrameToLocal,jointFrameDelta,jointFrameFromDelta} from './joint_frames.js';
import {captureDeformation} from './deformation.js';
import {migrateRigPose} from './rig_pose.js';
import {toSceneJointDelta,fromSceneJointDelta} from './joint_axes.js';
import {configureBodyShape,bodyShapeSnapshot,disposeBodyShape} from './body.js';
import {renderBodyShape,flushBodyShapeInputs,setupAnimatedDisclosure} from './body_ui.js';
import {prepareObjectAppearance,updateClayColor} from './appearance.js';
import {configureCharacter,updateCharacter,disposeCharacter,characterBoneQuaternion,setCharacterBoneQuaternion} from './garment.js';
import {initializeSceneInterface,jointControlBones} from './interface.js';
import {fullViewportLayout} from './viewport.js';
import {SceneDraftSession} from './drafts.js';
import {showErrorToast} from './notices.js';
import * as THREE from 'three';
import {isModule,buildModule,moduleFacingAngle,moduleEdgeOffset,moduleDef,MODULE_LABELS,MODULE_FACINGS} from './modules.js?v=5';
import {TILE_TYPES,TILE_LABELS,isWallTile,tileKey,wallMask,buildTile} from './tiles.js?v=3';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const $=id=>document.getElementById(id),args=new URLSearchParams(location.hash.slice(1));
const ANIMA_MODE=args.get('anima')==='1';
// Anima 模式只保留人偶/光源/相机，隐藏与黑底截图无关的全局面板。
if(ANIMA_MODE){
 requestAnimationFrame(()=>{
  ['ground-grid-card','ground-ripples-card','global-text-card'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});
  const bg=document.getElementById('background');if(bg){const lab=bg.closest('label');if(lab)lab.hidden=true;}
 });
}
window.addEventListener('error',e=>{const el=document.getElementById('status');if(el){el.textContent='JS 错误：'+(e.message||e.error||'未知');el.hidden=false;}});
window.addEventListener('unhandledrejection',e=>{const el=document.getElementById('status');if(el){el.textContent='Promise 错误：'+((e.reason&&(e.reason.message||e.reason))||'未知');el.hidden=false;}});
const SCENE_OBJECT_LIMIT=512;
const draftMode=args.get('draft')==='1';
const channel=args.get('channel')||'',owner=args.get('origin')||'';let instance=args.get('instance')||'';
function applySceneTheme(tokens){
 if(!tokens||typeof tokens!=='object')return;
 const accent=tokens['--cc-accent'];
 for(const [key,value] of Object.entries(tokens))if(/^--cc-[a-z-]+$/.test(key)&&typeof value==='string'&&value.length<200&&key!=='--cc-accent-bg')document.documentElement.style.setProperty(key,value);
 if(typeof accent==='string'&&/^#[0-9a-fA-F]{6}$/.test(accent))document.documentElement.style.setProperty('--cc-accent-bg',`color-mix(in srgb, ${accent} 10%, var(--cc-surface, #272728))`);
}
try{const themeArg=args.get('theme');if(themeArg)applySceneTheme(JSON.parse(themeArg));}catch{}
let ownerURL;try{ownerURL=new URL(owner);}catch{}
const ownerAllowed=ownerURL&&['http:','https:'].includes(ownerURL.protocol)&&['127.0.0.1','localhost','[::1]'].includes(ownerURL.hostname);
const headers=()=>instance?{'X-DSH-Instance-Id':instance}:{};
async function refreshInstance(){try{const response=await fetch('/health',{cache:'no-store'});const value=await response.json();if(response.ok&&typeof value.instanceId==='string'&&value.instanceId)instance=value.instanceId;}catch{}}
let statusTimer=null;
const status=(text,error=false)=>{const el=$('status');if(!el)return;el.textContent=text;const bar=el.parentElement;if(bar)bar.hidden=!text;el.classList.toggle('error',error);window.dshScene3DBoot?.stage(text);if(error)showErrorToast(text);if(statusTimer)clearTimeout(statusTimer);if(!error)statusTimer=setTimeout(()=>{if(el.textContent===text){el.textContent='';if(bar)bar.hidden=true;}},3500);};
async function api(path,data,retry=true){let response=await fetch('/scene3d/'+path,{method:data===undefined?'GET':'POST',headers:{...headers(),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});let value=await response.json();if(response.status===409&&retry){await refreshInstance();return api(path,data,false);}if(!response.ok)throw Error(value.error||'场景读取失败');return value;}
const hostWindow=window.opener||window.parent;
async function notify(type,body={}){let data={type,channel,...body};if(!draftMode&&channel&&['dsh-scene3d-saved','dsh-scene3d-apply'].includes(type))data=await api('transfer',data);if(ownerAllowed&&hostWindow&&hostWindow!==window)hostWindow.postMessage(data,owner);}
window.addEventListener('message',event=>{if(event.source!==hostWindow||event.origin!==owner||event.data?.channel!==channel)return;if(event.data.type==='dsh-scene3d-theme'){applySceneTheme(event.data.theme);}if(event.data.type==='dsh-scene3d-accepted')status('镜头截图已用于生成，编辑器可继续使用');});
let renderer,scene,camera,orbit,gizmo,helper,grid,floor,keyLight,sunLight=null,sunShadowLight=null,sunPivot=null,activeSun=false,sceneSun=null,objects=[],selected=null,bone=null,restBones=new WeakMap(),catalog=[],cache=new Map(),dirty=false,loading=false,documentId=args.get('scene')||'',documentName='未命名场景',isPreset=false,history=[],historyIndex=-1,documentEpoch=0,lastTransform=0;
const jointProxy=new THREE.Object3D();
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),markers=new THREE.Group();
const defaults={width:Math.min(4096,Math.max(64,Number(args.get('w'))||896)),height:Math.min(4096,Math.max(64,Number(args.get('h'))||1152)),background:ANIMA_MODE?'#000000':'#ffffff',clay:'#aeb3bc',fov:35,fisheye:0,orthographic:false,lightAngle:-35,lightHeight:55,lightPower:2.5,floor:!ANIMA_MODE,grid:!ANIMA_MODE,mode:'view',frameRoll:0,frameProjectionScale:1,firstPersonYaw:0,firstPersonPitch:0,lockRatio:true,frameScale:.92,filter:{style:'none',brightness:1,contrast:1,saturation:1},shotTexts:[]};
let groundGrid=normalizeGroundGrid(),groundRevision=0,rippleEditor,lightManager,sceneFisheye,liveLayout,lightSources=normalizeSceneLights(),activeLightId="light-primary",sceneEnvironment={background:ANIMA_MODE?'#000000':'#ffffff'};
const groundEffects=createGroundEffects({error:e=>status(e.message||String(e),true),onRipplesChanged:()=>{if(!loading&&!componentEnded){dirty=true;updateDocumentTitle();if(draftMode)drafts.mark();if(history[historyIndex])history[historyIndex]=JSON.stringify(serialize());}}});
let settings={...defaults},pendingJob=0,shots=[],activeShot=0,studio,objectUI,poseChat,frameRollControls,firstPersonLook,firstPersonNavigation;
const safe=fn=>(...a)=>Promise.resolve().then(()=>fn(...a)).catch(e=>status(e.message||String(e),true));
function bind(id,fn,event='click'){$(id).addEventListener(event,safe(fn));}
const drafts=new SceneDraftSession({channel,api,snapshot:()=>serialize(),metadata:()=>({name:documentName,presetId:documentId,presetDirty:dirty}),onError:e=>{if(!componentEnded)status('临时场景保存失败：'+(e.message||e),true);},onSaved:()=>{}});
function updateDocumentTitle(){$('scene-title').textContent=documentName;$('scene-title').dataset.tooltip=documentName+' · 双击改名';$('scene-title').removeAttribute('title');$('scene-title').setAttribute('aria-label','场景名称：'+documentName+'，双击改名');$('document-dirty').hidden=!dirty;document.title=documentName+' · '+(shots[activeShot]?.name||'3D 参考');}
function commitDocumentName(){if($('scene-name').hidden)return true;const value=$('scene-name').value.trim();if(!value){$('scene-name').setCustomValidity('场景名称不能为空');$('scene-name').reportValidity();return false;}const changed=value!==documentName;documentName=value;$('scene-name').hidden=true;$('scene-title').hidden=false;if(changed)setDirty();updateDocumentTitle();return true;}
function closeFileMenu(){$('file-options').hidden=true;$('file-menu').setAttribute('aria-expanded','false');$('load-scene').setAttribute('aria-expanded','false');}
bind('file-menu',()=>{const open=$('file-options').hidden;$('file-options').hidden=!open;$('file-menu').setAttribute('aria-expanded',String(open));if(open)$('new').focus();});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.document-menu'))closeFileMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('file-options').hidden){e.preventDefault();e.stopImmediatePropagation();closeFileMenu();$('file-menu').focus();}});
for(const id of ['new','save','preset'])$(id).addEventListener('click',closeFileMenu);
bind('scene-title',()=>{if(loading||pendingJob)return;$('scene-title').hidden=true;$('scene-name').hidden=false;$('scene-name').value=documentName;$('scene-name').focus();$('scene-name').select();},'dblclick');
bind('scene-name',commitDocumentName,'blur');
$('scene-name').addEventListener('input',()=>$('scene-name').setCustomValidity(''));
$('scene-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitDocumentName();}if(e.key==='Escape'){e.preventDefault();$('scene-name').hidden=true;$('scene-title').hidden=false;$('scene-title').focus();}});
function setDirty(){if(loading||componentEnded)return;objects.forEach(o=>updateCharacter(o));groundRevision++;dirty=true;updateDocumentTitle();if(draftMode)drafts.mark();}
function pushHistory(){if(loading||historyBusy)return;const raw=JSON.stringify(serialize());if(history[historyIndex]===raw)return;history=history.slice(0,historyIndex+1);history.push(raw);if(history.length>40)history.shift();historyIndex=history.length-1;$('undo').disabled=historyIndex<=0;$('redo').disabled=true;setDirty();}
function cameraSnapshot(){return {position:camera.position.toArray(),target:orbit.target.toArray(),zoom:camera.zoom};}
function shotSnapshot(){return {...cameraSnapshot(),width:settings.width,height:settings.height,settings:structuredClone(settings)};}
function saveActiveShot(){if(shots[activeShot])shots[activeShot]={...shots[activeShot],camera:cameraSnapshot(),width:settings.width,height:settings.height,settings:structuredClone(settings)};}
function renderShots(){const select=$('shot-select');select.replaceChildren(...shots.map((shot,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=shot.name;return option;}));select.value=String(activeShot);$('delete-shot').disabled=shots.length<=1;const badge=$('shot-count');if(badge)badge.textContent=String(shots.length);studio?.renderShots();objectUI?.render();}
function adoptShots(data){const incoming=Array.isArray(data?.shots)?data.shots:[];if(incoming.length){shots=incoming.slice(0,4).map((shot,i)=>({id:/^[a-zA-Z0-9_-]{1,80}$/.test(shot.id||'')?shot.id:crypto.randomUUID(),name:String(shot.name||('镜头 '+(i+1))).slice(0,64),camera:shot.camera,width:shot.width,height:shot.height,settings:structuredClone(shot.settings||data.settings||defaults)}));activeShot=Math.max(0,Math.min(shots.length-1,Number(data.activeShot)||0));}else{const camera=data?.camera||cameraSnapshot(),settings=data?.settings||settings;shots=[{id:crypto.randomUUID(),name:'镜头 1',camera:{position:[...camera.position],target:[...camera.target],zoom:Number(camera.zoom)||1},width:settings.width,height:settings.height,settings:structuredClone(settings)}];activeShot=0;}const shot=shots[activeShot];settings={...defaults,...structuredClone(shot.settings||settings),width:shot.width,height:shot.height};camera.position.fromArray(shot.camera.position);orbit.target.fromArray(shot.camera.target);camera.zoom=Number(shot.camera.zoom)||1;renderShots();}
function switchShot(index){frameRollControls?.flush();firstPersonLook?.finish();firstPersonNavigation?.reset();if(loading||pendingJob||!shots[index]||index===activeShot)return;saveActiveShot();activeShot=index;const shot=shots[index];settings={...defaults,...structuredClone(shot.settings||settings),width:shot.width,height:shot.height};camera.position.fromArray(shot.camera.position);orbit.target.fromArray(shot.camera.target);camera.zoom=Number(shot.camera.zoom)||1;syncSettings();renderShots();updateCamera();updateLighting();setDirty();status('已切换到 '+shot.name+' · 截图 '+shot.width+'×'+shot.height);}
function addShot(){
 if(loading||pendingJob)return;if(shots.length>=4){status('最多4个镜头',true);return;}
 frameRollControls?.flush();firstPersonLook?.finish();saveActiveShot();const previousIndex=activeShot,previousSettings=structuredClone(settings),previousCamera=cameraSnapshot();let added;
 return studioJob(async()=>{try{
  settings={...settings,mode:'view',viewLocked:false};let number=1;while(shots.some(shot=>shot.name==='镜头 '+number))number++;
  added={id:crypto.randomUUID(),name:'镜头 '+number,camera:cameraSnapshot(),width:settings.width,height:settings.height,settings:structuredClone(settings)};shots.push(added);activeShot=shots.length-1;
  renderShots();syncSettings();updateCamera();pushHistory();status('已新建 '+shots[activeShot].name+'；可设置尺寸并拍摄截图');
 }catch(error){if(added){const owned=objects.filter(o=>o.userData.firstPersonFor===added.id);for(const object of owned){scene.remove(object);releaseObject(object);}objects=objects.filter(o=>!owned.includes(o));shots=shots.filter(shot=>shot!==added);}activeShot=previousIndex;settings=previousSettings;camera.position.fromArray(previousCamera.position);orbit.target.fromArray(previousCamera.target);camera.zoom=previousCamera.zoom;syncSettings();renderShots();updateCamera();throw error;}});
}
async function deleteShot(){if(shots.length<=1)return;if(!await confirmAction('删除当前镜头？其他镜头和物体不受影响。'))return;const removedId=shots[activeShot].id;const {removed:owned,remaining}=partitionFirstPersonBodies(objects,removedId);if(owned.includes(selected))selectObject(null);for(const object of owned){scene.remove(object);releaseObject(object);}objects=remaining;for(const object of objects){if(object.userData.text?.faceCameraId===removedId){object.userData.text.followCamera=false;object.userData.text.faceCameraId='';}}shots.splice(activeShot,1);shots.forEach((shot,i)=>{if(/^镜头 \d+$/.test(shot.name))shot.name='镜头 '+(i+1);});activeShot=Math.max(0,Math.min(activeShot,shots.length-1));const shot=shots[activeShot];settings={...defaults,...structuredClone(shot.settings||settings),width:shot.width,height:shot.height};camera.position.fromArray(shot.camera.position);orbit.target.fromArray(shot.camera.target);camera.zoom=Number(shot.camera.zoom)||1;syncSettings();renderShots();updateCamera();updateLighting();setDirty();status('已删除镜头，当前为 '+shot.name);}
function serialize(){flushBodyShapeInputs();saveActiveShot();return {version:1,groundGrid:structuredClone(groundGrid),sceneLights:structuredClone(lightSources),sceneSun:sceneSun?{...sceneSun}:null,sceneEnvironment:{...sceneEnvironment},albumSession:channel,objects:objects.map(o=>{const bones={};o.traverse(n=>{if(n.isBone)bones[n.name]=characterBoneQuaternion(o,n);});return {id:o.userData.id,model:o.userData.model,...(o.userData.firstPersonBody?{firstPersonBody:true}:{}),...(o.userData.firstPersonFor?{firstPersonFor:o.userData.firstPersonFor}:{}),name:o.userData.label,rigRevision:catalog.find(row=>row.id===o.userData.model)?.rigRevision||0,...(o.userData.poseRevision?{poseRevision:o.userData.poseRevision}:{}),position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),...(bodyShapeSnapshot(o)?{bodyShape:bodyShapeSnapshot(o)}:{}),...(o.userData.text?{text:structuredClone(o.userData.text)}:{}),...(o.userData.color?{color:o.userData.color}:{}),...(o.userData.cell?{cell:o.userData.cell,facing:o.userData.facing}:{}),...(o.userData.tile?{tile:o.userData.tile}:{}),bones};}),camera:cameraSnapshot(),settings:{...settings},shots:shots.map(shot=>({id:shot.id,name:shot.name,camera:{...shot.camera},width:shot.width,height:shot.height,settings:structuredClone(shot.settings||{})})),activeShot};}
function primitive(kind){let geo;switch(kind){case'box':geo=new THREE.BoxGeometry(.8,.8,.8);break;case'sphere':geo=new THREE.SphereGeometry(.45,32,24);break;case'cylinder':geo=new THREE.CylinderGeometry(.35,.35,1,32);break;case'cone':geo=new THREE.ConeGeometry(.4,1,32);break;case'plane':geo=new THREE.BoxGeometry(1,.05,1);break;case'torus':geo=new THREE.TorusGeometry(.35,.12,16,40);break;default:throw Error('未知几何体');}const group=new THREE.Group(),mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#aeb3bc',roughness:.85}));mesh.position.y=kind==='cone'?.5:0;group.add(mesh);return group;}
async function modelTemplate(id){if(cache.has(id))return cache.get(id);const record=catalog.find(x=>x.id===id);if(!record)throw Error('模型资源不存在');const promise=new GLTFLoader().loadAsync('/scene3d/'+record.file).then(g=>{g.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});g.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(g.scene),height=box.max.y-box.min.y;if(!(height>0))throw Error('模型尺寸无效');const wrapper=new THREE.Group();wrapper.add(g.scene);g.scene.scale.multiplyScalar(1.8/height);g.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g.scene),center=bounds.getCenter(new THREE.Vector3());g.scene.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));return wrapper;}).catch(e=>{cache.delete(id);throw e;});cache.set(id,promise);return promise;}
function grayObject(object,model){prepareObjectAppearance(object,{preserveMaterials:model?.materialMode==='original',opaqueMaterials:model?.opaqueMaterials||[],clay:'#aeb3bc',restBones,shadowProfile:model?.skinShadowProfile});}
async function createObject(record){const isModel=catalog.some(x=>x.id===record.model),object=record.model==='text'?await createTextObject(record):record.model==='tile'&&record.tile?buildTile({...record.tile,mask:0}):isModule(record.model)?buildModule(record.model,record.color):isModel?clone(await modelTemplate(record.model)):primitive(record.model);if(record.model!=='text')grayObject(object,catalog.find(x=>x.id===record.model));object.userData={...object.userData,id:record.id||crypto.randomUUID(),model:record.model,...(record.color?{color:record.color}:{}),...(record.firstPersonBody?{firstPersonBody:true}:{}),...(record.firstPersonFor?{firstPersonFor:record.firstPersonFor}:{}),label:record.name||catalog.find(x=>x.id===record.model)?.label||primitiveNames[record.model]||record.model};if(record.cell)object.userData.cell=record.cell;if(record.facing)object.userData.facing=record.facing;if(record.tile)object.userData.tile=record.tile;if(record.model==='tile')object.userData.model='tile';configureJointFrames(object,catalog.find(x=>x.id===record.model));if(record.firstPersonBody)prepareFirstPersonBody(object);configureBodyShape(object,catalog.find(x=>x.id===record.model),record.bodyShape);if(record.position)object.position.fromArray(record.position);if(record.quaternion)object.quaternion.fromArray(record.quaternion);if(record.scale)object.scale.fromArray(record.scale);if(record.model!=='text')configureCharacter(object,catalog.find(x=>x.id===record.model),migrateRigPose(record,catalog.find(x=>x.id===record.model)),restBones);applyObjectColor(object);return object;}
function activeFirstPersonBody(){return objects.find(o=>o.userData.firstPersonFor===shots[activeShot]?.id);}
function syncActiveFirstPerson(){if(settings.mode==='firstPerson'){const body=activeFirstPersonBody();if(body)syncFirstPersonCamera(camera,orbit,body,settings);}}
async function ensureFirstPersonBody(){
 const existing=activeFirstPersonBody();if(existing)return existing;if(objects.length>=SCENE_OBJECT_LIMIT)throw Error('场景已满，无法添加第一人称素体');
 const epoch=documentEpoch,shotId=shots[activeShot].id,position=camera.position.clone(),direction=orbit.target.clone().sub(position).normalize();
 const object=await createObject({model:'bodykun',name:shots[activeShot].name+' · 第一人称素体',firstPersonBody:true,firstPersonFor:shotId});
 if(epoch!==documentEpoch||shots[activeShot]?.id!==shotId){releaseObject(object);throw Error('场景已变化，请重新选择第一人称模式');}
 placeFirstPersonBody(object,position,direction);
 settings.firstPersonYaw=0;settings.firstPersonPitch=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(direction.y,-1,1))),-89,89);objects.push(object);scene.add(object);listObjects();return object;
}
async function changeCameraMode(mode){
 if(!['view','photo','firstPerson'].includes(mode))return;frameRollControls?.flush();firstPersonLook?.finish();firstPersonNavigation?.reset();
 await studioJob(async()=>{
  const leaving=settings.mode==='firstPerson'&&mode!=='firstPerson';
  if(mode==='firstPerson')await ensureFirstPersonBody();
  if(leaving){const shotId=shots[activeShot]?.id,{removed:owned,remaining}=partitionFirstPersonBodies(objects,shotId);
   if(owned.includes(selected))selectObject(null);
   for(const o of owned){scene.remove(o);releaseObject(o);}objects=remaining;listObjects();}
  changeCamera({mode});
 });
}
const primitiveNames={box:'立方体',sphere:'球体',cylinder:'圆柱',cone:'圆锥',torus:'圆环'};
async function addObject(model){
 if(loading||pendingJob)return;if(objects.length>=SCENE_OBJECT_LIMIT){status('场景最多512个物体',true);return;}
 pendingJob++;const unlock=captureLock();
 try{const epoch=documentEpoch;status('正在添加模型…');const object=await createObject({model});if(epoch!==documentEpoch||objects.length>=SCENE_OBJECT_LIMIT){releaseObject(object);return;}object.position.x=objects.length?Math.min(4,objects.length*.7):0;objects.push(object);scene.add(object);selectObject(object);$('apply').disabled=false;pushHistory();}
 finally{pendingJob--;unlock();}
}
function normalizeSun(value){
 if(!value||typeof value!=='object')return null;
 const raw=Array.isArray(value.direction)&&value.direction.length===3?value.direction.map(Number):[8,12,6];
 const clean=raw.every(v=>Number.isFinite(v))?raw:[8,12,6];
 const len=Math.hypot(clean[0],clean[1],clean[2]);
 if(!(len>1e-6))return {direction:[8,12,6].map(v=>v/Math.hypot(8,12,6)),color:/^#[0-9a-fA-F]{6}$/.test(value.color||'')?value.color:'#ffffff',intensity:Number.isFinite(Number(value.intensity))?Math.max(0,Math.min(10,Number(value.intensity))):2.6,castShadow:value.castShadow!==false};
 return {direction:clean.map(v=>v/len),color:/^#[0-9a-fA-F]{6}$/.test(value.color||'')?value.color:'#ffffff',intensity:Number.isFinite(Number(value.intensity))?Math.max(0,Math.min(10,Number(value.intensity))):2.6,castShadow:value.castShadow!==false};
}
function applySun(){
 if(!scene)return;
 if(!sunLight){
  sunLight=new THREE.DirectionalLight(0xffffff,1.8);sunLight.castShadow=false;sunLight.target.position.set(0,0,0);scene.add(sunLight,sunLight.target);
  sunShadowLight=new THREE.PointLight(0xffffff,1.2,0,0);sunShadowLight.castShadow=true;sunShadowLight.shadow.mapSize.set(4096,4096);sunShadowLight.shadow.camera.near=.5;sunShadowLight.shadow.camera.far=140;sunShadowLight.shadow.bias=-.0002;sunShadowLight.shadow.normalBias=.02;scene.add(sunShadowLight);
  sunPivot=new THREE.Object3D();sunPivot.position.set(0,1.2,0);scene.add(sunPivot);
  const mat=new THREE.MeshStandardMaterial({color:0xffc857,transparent:true,opacity:.85,roughness:.6});
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1.5,10),mat);shaft.position.y=-.25;sunPivot.add(shaft);
  const head=new THREE.Mesh(new THREE.ConeGeometry(.2,.55,14),mat);head.position.y=.775;sunPivot.add(head);
 }
 if(!sceneSun){sunLight.visible=false;sunShadowLight.visible=false;sunPivot.visible=false;return;}
 sunLight.visible=true;sunLight.color.set(sceneSun.color);sunLight.intensity=sceneSun.intensity;sunLight.castShadow=false;
 sunShadowLight.visible=true;sunShadowLight.color.set(sceneSun.color);sunShadowLight.intensity=Math.max(0.2,sceneSun.intensity*0.45);sunShadowLight.castShadow=!!sceneSun.castShadow;
 const dir=new THREE.Vector3(...sceneSun.direction).normalize();
 sunLight.position.copy(dir).multiplyScalar(18);sunShadowLight.position.copy(dir).multiplyScalar(15);
 const rayDir=dir.clone().negate();
 if(!gizmo||gizmo.object!==sunPivot||!gizmo.dragging)sunPivot.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),rayDir));
 sunPivot.visible=activeSun&&!isCaptureMode(settings.mode);
 syncSunUI();
 
}
function syncSunUI(){
 const active=!!sceneSun;
 for(const id of ['sun-color','sun-intensity','sun-shadow','sun-remove']){const el=$(id);if(el)el.disabled=!active;}
 if(sceneSun){const sc=$('sun-color'),si=$('sun-intensity'),ss=$('sun-shadow');if(sc)sc.value=sceneSun.color;if(si)si.value=String(sceneSun.intensity);if(ss)ss.checked=!!sceneSun.castShadow;}
 const sunAdd=$('sun-add');if(sunAdd)sunAdd.disabled=!!sceneSun;
}
function selectSun(){
 if(!sceneSun)return;
 activeSun=true;selected=null;activeLightId='';bone=null;gizmo.detach();
 if(settings.mode==='view'){gizmo.setMode('rotate');toolsUI.mode('rotate');gizmo.attach(sunPivot);}
 applySun();syncSunUI();listObjects();transformFields();boneFields();renderModeHelp();status('已选中太阳光 · 拖动旋转手柄调整方向');
}
function removeSun(){
 if(!sceneSun)return;
 sceneSun=null;activeSun=false;gizmo.detach();applySun();syncSunUI();listObjects();pushHistory();status('已删除太阳光');
}
function makeListIcon(kind){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','14');svg.setAttribute('height','14');svg.setAttribute('aria-hidden','true');
 svg.setAttribute('class','object-row-icon object-row-icon-'+kind);
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');
 path.setAttribute('fill','currentColor');
 path.setAttribute('d',kind==='sun'
  ?'M12 4.5a1 1 0 0 1 1 1V7a1 1 0 1 1-2 0V5.5a1 1 0 0 1 1-1Zm-5.3 2.2a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 1 1-1.4 1.4L6.7 8.1a1 1 0 0 1 0-1.4Zm10.6 0a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 1 1-1.4-1.4l1.1-1.1a1 1 0 0 1 1.4 0ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-8 3a1 1 0 0 1 1-1h1.5a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm15 0a1 1 0 0 1 1-1h1.5a1 1 0 1 1 0 2H20a1 1 0 0 1-1-1Zm-3.6 3.8a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 1 1-1.4 1.4l-1.1-1.1a1 1 0 0 1 0-1.4Zm-6.8 0a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 1 1-1.4-1.4l1.1-1.1a1 1 0 0 1 1.4 0ZM12 17a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V18a1 1 0 0 1 1-1Z'
  :'M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2Zm-4.5 18a1.5 1.5 0 0 1 0-3h9a1.5 1.5 0 0 1 0 3h-9Z');
 svg.append(path);return svg;
}
let objectControlsCache=null,lightControlsCache=null,sunControlsCache=null;
function listObjects(){
 const host=$('objects');if(!host)return;
 if(!objectControlsCache)objectControlsCache=$('object-controls');
 if(!lightControlsCache)lightControlsCache=$('light-object-controls');
 if(!sunControlsCache)sunControlsCache=$('sun-object-controls');
 const controls=objectControlsCache,lightControls=lightControlsCache;
 if(controls)controls.remove();
 if(lightControls)lightControls.remove();
 const rows=[];
 if(sceneSun){
  const row=document.createElement('div');row.className='object-row scene-light-object-row';
  const b=document.createElement('button');b.append(makeListIcon('sun'),document.createTextNode('太阳光'));b.classList.toggle('selected',activeSun);b.setAttribute('aria-label','选择太阳光');
  b.onclick=()=>selectSun();row.append(b);if(activeSun&&sunControlsCache)row.append(sunControlsCache);rows.push(row);
 }
 const objectGroup=o=>o.userData.text?3:(primitiveNames[o.userData.model]?2:1);
 const ordered=[...objects].sort((a,b)=>objectGroup(a)-objectGroup(b));
 for(const o of ordered){
  const row=document.createElement('div');row.className='object-row';const b=document.createElement('button');b.dataset.objectId=o.userData.id;
  b.dataset.tooltip='双击改名';b.title='双击改名';b.onclick=()=>{const current=objects.find(item=>item.userData.id===b.dataset.objectId);if(current&&selected!==current)selectObject(current);};
  b.textContent=o.userData.label;b.classList.toggle('selected',selected===o);row.append(b);if(selected===o)row.append(controls);rows.push(row);
 }
 for(const source of lightSources){
  const row=document.createElement('div');row.className='object-row scene-light-object-row';
  const b=document.createElement('button');b.dataset.lightId=source.id;b.append(makeListIcon('light'),document.createTextNode(source.name));
  const isActive=gizmo?.object?.userData.sceneLightId===source.id;
  b.classList.toggle('selected',isActive);b.setAttribute('aria-label','选择光源 '+source.name);
  b.onclick=()=>selectLight(source.id);row.append(b);if(isActive)row.append(lightControls);rows.push(row);
 }
 try{
 host.replaceChildren(...rows);
 const sunControls=$('sun-object-controls');if(sunControls)sunControls.hidden=!activeSun;
 }finally{
 if(controls&&!controls.parentElement)$('objects-panel')?.append(controls);
 if(lightControls&&!lightControls.parentElement)$('objects-panel')?.append(lightControls);
 if(sunControlsCache&&!sunControlsCache.parentElement)$('objects-panel')?.append(sunControlsCache);
 }
 if(!selected&&controls)$('objects-panel').append(controls);if(controls)controls.hidden=!selected;
 if(lightControls){if(!lightControls.parentElement)$('objects-panel').append(lightControls);lightControls.hidden=!gizmo?.object?.userData.sceneLightId;}
}
$('objects').addEventListener('dblclick',e=>{
 const button=e.target.closest('button[data-object-id]');if(!button||loading||pendingJob)return;
 const object=objects.find(o=>o.userData.id===button.dataset.objectId);if(!object)return;
 const input=document.createElement('input');input.className='object-rename';input.maxLength=80;input.value=object.userData.label;input.setAttribute('aria-label','物体名称');button.replaceWith(input);input.focus();input.select();let finished=false;
 const finish=save=>{if(finished)return;finished=true;const name=input.value.trim();if(save&&name&&name!==object.userData.label){object.userData.label=name;pushHistory();}listObjects();};
 input.onblur=()=>finish(true);input.onkeydown=event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();finish(true);}else if(event.key==='Escape'){event.preventDefault();finish(false);}};
});
function applyObjectColor(object){if(object.userData.color)object.traverse(n=>{if(n.isMesh)for(const material of (Array.isArray(n.material)?n.material:[n.material]))material.color?.set(object.userData.color);});else if(!object.userData.text)updateClayColor(object,'#aeb3bc');}
function allBones(){const a=[];selected?.traverse(n=>{if(n.isBone)a.push(n);});return a;}
function controlBones(){return jointControlBones(selected,catalog.find(row=>row.id===selected?.userData.model));}
function jointLabel(name){const custom=catalog.find(row=>row.id===selected?.userData.model)?.jointLabels?.[name];if(custom)return custom;let n=name.replace(/^mixamorig:/,'').replace(/^DEF-/, '').replace(/_\d+$/,'');const names=[['upper_arm','上臂'],['forearm','前臂'],['Left','左'],['Right','右'],['Shoulder','肩'],['UpperArm','上臂'],['ForeArm','前臂'],['upperArm','上臂'],['foreArm','前臂'],['Arm','臂'],['Hand','手'],['Thumb','拇指'],['Index','食指'],['Middle','中指'],['Ring','无名指'],['Pinky','小指'],['UpLeg','大腿'],['Leg','腿'],['Foot','脚'],['ToeBase','脚趾'],['Hips','骨盆'],['Spine','脊柱'],['Neck','颈'],['Head','头'],['hip','骨盆'],['waist','腰'],['chest','胸'],['head','头'],['clavicle','锁骨'],['shoulder','肩'],['upperArm','上臂'],['foreArm','前臂'],['palm','手掌'],['thumb','拇指'],['index','食指'],['middle','中指'],['ring','无名指'],['pinky','小指'],['thigh','大腿'],['calf','小腿'],['foot','脚'],['shin','小腿'],['hand','手'],['spine','脊柱']];for(const [from,to] of names)n=n.replace(from,to);n=n.replace(/L$/, ' · 左').replace(/R$/, ' · 右').replace(/Knot/g,'连接').replace(/Root/g,'根部').replace(/Base/g,'根节').replace(/Mid/g,'中节').replace(/Tip/g,'末节').replace(/knee/g,'膝');return n;}
function rebuildMarkers(){for(const marker of markers.children){marker.geometry.dispose();marker.material.dispose();}markers.clear();if(!selected)return;for(const n of controlBones()){if(/end|knot|tip/i.test(n.name))continue;const marker=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),new THREE.MeshBasicMaterial({color:n===bone?0xffd36a:0x5396dc,depthTest:false,transparent:true,opacity:.85}));marker.userData.bone=n;marker.renderOrder=5;markers.add(marker);}}
function selectObject(object){rippleEditor?.deselect();activeSun=false;if(sunPivot)sunPivot.visible=false;selected=object;bone=null;gizmo.detach();if(object)gizmo.attach(object);toolsUI.mode(gizmo.getMode());listObjects();rebuildMarkers();transformFields();boneFields();renderBodyShape($('body-shape-fields'),selected,{busy:()=>loading||pendingJob>0,preview:()=>{setDirty();},commit:pushHistory,error:e=>status(e.message||String(e),true)});objectUI?.render();poseChat?.refresh();renderModeHelp();}
function usesSceneJointAxes(){return catalog.find(row=>row.id===selected?.userData.model)?.jointControlSpace==='world';}
function jointControlSpace(){return hasJointFrame(bone)?'local':usesSceneJointAxes()?'world':'local';}
function syncJointProxy(){if(!bone||!hasJointFrame(bone)||gizmo?.dragging)return;selected.updateMatrixWorld(true);jointProxy.position.copy(bone.getWorldPosition(new THREE.Vector3()));jointProxy.quaternion.copy(jointFrameQuaternion(bone,new THREE.Quaternion().fromArray(characterBoneQuaternion(selected,bone))));}
function jointControlQuaternion(n=bone){
 const raw=new THREE.Quaternion().fromArray(characterBoneQuaternion(selected,n));
 if(hasJointFrame(n))return jointFrameDelta(n,raw);
 if(!usesSceneJointAxes())return raw;
 selected.updateMatrixWorld(true);return toSceneJointDelta(raw,restBones.get(n),n.parent.getWorldQuaternion(new THREE.Quaternion()));
}
function setJointControlQuaternion(n,value){
 if(hasJointFrame(n)){setCharacterBoneQuaternion(selected,n,jointFrameFromDelta(n,value));return;}
 if(usesSceneJointAxes()){selected.updateMatrixWorld(true);value=fromSceneJointDelta(value,restBones.get(n),n.parent.getWorldQuaternion(new THREE.Quaternion()));}
 setCharacterBoneQuaternion(selected,n,value);
}
const poseDegrees=q=>new THREE.Euler().setFromQuaternion(q,'XYZ').toArray().slice(0,3).map(v=>Math.max(-180,Math.min(180,Math.round(THREE.MathUtils.radToDeg(v)*1e6)/1e6)));
function poseTargetPeek(){if(!selected)return null;return {scene:{id:selected.userData.id,name:selected.userData.label},busy:loading||!!pendingJob||historyBusy||!!removalUnlock||componentEnded};}
function sceneSnapshot(){const round=v=>Math.round(v*1000)/1000;const list=objects.map(o=>({id:o.userData.id,model:o.userData.model,name:o.userData.label,position:o.position.toArray().map(round),rotation:poseDegrees(o.quaternion),scale:o.scale.toArray().map(round),color:o.userData.color||'',cell:o.userData.cell||[Math.round(o.position.x),Math.round(o.position.y/3),Math.round(o.position.z)],facing:o.userData.facing||'',tile:o.userData.tile||null}));return {busy:loading||!!pendingJob,scene:{id:documentId||'scene',name:documentName||'当前场景',objects:list,selectedId:selected?.userData.id||'',camera:camera&&orbit?{position:camera.position.toArray().map(round),target:orbit.target.toArray().map(round)}:null},signature:JSON.stringify({epoch:documentEpoch,objects:list.map(o=>[o.id,o.position,o.rotation,o.scale])})};}
function scenePeek(){const value=sceneSnapshot();return {busy:value.busy,scene:value.scene};}
function sceneCellKey(cell){return cell.join(',');}
function initializeControlBridge(){
 let busy=false;
 const unavailable=()=>!renderer||componentEnded||loading||pendingJob||historyBusy||removalUnlock;
 const run=createSceneCommandRunner({busy:unavailable,apply:operations=>applyAIScene(operations,{}),snapshot:()=>sceneSnapshot().scene,
  capture:async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return renderer.domElement.toDataURL('image/png');},
  finish:result=>api('control/done',{channel,...result})});
 const tick=async()=>{
  if(busy||unavailable())return;
  busy=true;
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
   let res;
   try{
    const response=await fetch('/scene3d/control/pending',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({channel}),signal:controller.signal});
    if(!response.ok)return;
    res=await response.json();
   }finally{clearTimeout(timer);}
   await run(Array.isArray(res?.commands)?res.commands:[]);
  }catch{}
  finally{busy=false;}
 };
 setInterval(tick,700);
}
function placeSceneModule(module,cell,facing='n',color,name){
 if(!isModule(module))throw Error('未知模块：'+module);
 if(objects.length>=SCENE_OBJECT_LIMIT)throw Error('场景最多512个物体');
 if(!Array.isArray(cell)||cell.length!==3||cell.some(v=>!Number.isInteger(v)||Math.abs(v)>64))throw Error('格子坐标无效');
 if(!MODULE_FACINGS.includes(facing))throw Error('朝向无效');
 const def=moduleDef(module),key=sceneCellKey(cell);
 const same=objects.filter(o=>o.userData.cell&&sceneCellKey(o.userData.cell)===key);
 if(def.edge){
  if(same.some(o=>{const d=moduleDef(o.userData.model);return d&&d.edge&&o.userData.facing===facing;}))throw Error('该格该朝向已有墙体');
  const OPPOSITE={n:'s',s:'n',e:'w',w:'e'},STEP={n:[0,0,-1],s:[0,0,1],e:[1,0,0],w:[-1,0,0]},step=STEP[facing];
  const neighbour=objects.find(o=>{
   const d=moduleDef(o.userData.model);
   if(!d||!d.edge||!o.userData.cell)return false;
   const [ox,oy,oz]=o.userData.cell;
   return ox===cell[0]+step[0]&&oy===cell[1]&&oz===cell[2]+step[2]&&o.userData.facing===OPPOSITE[facing];
  });
  if(neighbour)throw Error('相邻格同一墙面已有墙体');
 }else if(same.some(o=>{const d=moduleDef(o.userData.model);return d&&!d.edge&&(d.slot||'floor')===(def.slot||'floor');})){
  throw Error('该格已有同类模块');
 }
 const object=buildModule(module,color);
 const offset=def.edge?moduleEdgeOffset(facing):[0,0,0];
 object.position.set(cell[0]+offset[0],cell[1]*3+offset[1],cell[2]+offset[2]);
 object.rotation.y=moduleFacingAngle(facing);
 object.userData={id:crypto.randomUUID(),model:module,cell:[...cell],facing,color:color||'',label:name||MODULE_LABELS[module]||module};
 objects.push(object);scene.add(object);
 return object;
}
function tileAt(cell){
 const key=tileKey(cell);
 return objects.find(o=>o.userData.tile&&tileKey(o.userData.tile.cell)===key);
}
function hasWallTile(cell){
 const object=tileAt(cell);
 return !!(object&&isWallTile(object.userData.tile.type));
}
function rebuildTile(cell){
 const object=tileAt(cell);
 if(!object)return;
 const tile=object.userData.tile;
 const mask=isWallTile(tile.type)?wallMask(cell,hasWallTile):0;
 const fresh=buildTile({type:tile.type,cell,tile,color:tile.color,mask});
 object.clear();
 for(const child of [...fresh.children])object.add(child);
 object.userData.tile={...tile,mask};
}
function rebuildAllTiles(){for(const object of [...objects])if(object.userData.tile)rebuildTile(object.userData.tile.cell);}
function placeTile({type,cell,color}){
 if(!TILE_TYPES.includes(type))throw Error('未知瓦片类型');
 if(objects.length>=SCENE_OBJECT_LIMIT)throw Error('场景最多512个物体');
 if(!Array.isArray(cell)||cell.length!==3||cell.some(v=>!Number.isInteger(v)||Math.abs(v)>64))throw Error('格子坐标无效');
 if(tileAt(cell))throw Error('该格已有瓦片');
 const mask=isWallTile(type)?wallMask(cell,hasWallTile):0;
 const object=buildTile({type,cell,mask,color});
 object.userData.id=crypto.randomUUID();
 object.userData.model='tile';
 object.userData.tile={type,cell:[...cell],color:color||'',mask};
 object.userData.label=TILE_LABELS[type]||type;
 objects.push(object);scene.add(object);
 for(const d of [[0,-1],[1,0],[0,1],[-1,0]])rebuildTile([cell[0]+d[0],cell[1],cell[2]+d[1]]);
 return object;
}
function removeTile(cell){
 const object=tileAt(cell);
 if(!object)throw Error('该格没有瓦片');
 if(selected===object)selectObject(null);
 scene.remove(object);releaseObject(object);objects=objects.filter(o=>o!==object);
 for(const d of [[0,-1],[1,0],[0,1],[-1,0]])rebuildTile([cell[0]+d[0],cell[1],cell[2]+d[1]]);
}
function paintTile(cell,color){
 const object=tileAt(cell);
 if(!object)throw Error('该格没有瓦片');
 object.userData.tile.color=color;
 rebuildTile(cell);
}
async function applyAIScene(operations,context){
 if(loading||pendingJob)throw Error('场景忙，请稍后再试');
 const rad=d=>d*Math.PI/180,rotation=v=>new THREE.Euler(rad(v[0]),rad(v[1]),rad(v[2]),'XYZ');
 let applied=0;
 try{for(const op of operations){
  if(op.type==='place'){placeSceneModule(op.module,op.cell,op.facing,op.color,op.name);applied++;}
  else if(op.type==='place_tile'){placeTile({type:op.tile,cell:op.cell,color:op.color});applied++;}
  else if(op.type==='remove_tile'){removeTile(op.cell);applied++;}
  else if(op.type==='paint_tile'){paintTile(op.cell,op.color);applied++;}
  else if(op.type==='remove'){
   const object=objects.find(o=>o.userData.id===op.id);if(!object)throw Error('目标物体不存在');if(selected===object)selectObject(null);scene.remove(object);releaseObject(object);objects=objects.filter(o=>o!==object);applied++;
  }else if(op.type==='paint'){
   const object=objects.find(o=>o.userData.id===op.id);if(!object)throw Error('目标物体不存在');object.userData.color=op.color;applyObjectColor(object);applied++;
  }else if(op.type==='transform'){
   const object=objects.find(o=>o.userData.id===op.id);if(!object)throw Error('目标物体不存在');if(op.position)object.position.fromArray(op.position);if(op.rotation)object.quaternion.setFromEuler(rotation(op.rotation));if(op.scale)object.scale.fromArray(op.scale);applied++;
  }else if(op.type==='delete'){
   const object=objects.find(o=>o.userData.id===op.id);if(!object)throw Error('目标物体不存在');if(selected===object)selectObject(null);scene.remove(object);releaseObject(object);objects=objects.filter(o=>o!==object);applied++;
  }else if(op.type==='reload'){applied++;setTimeout(()=>location.reload(),80);
  }else if(op.type==='clear'){
   for(const object of [...objects]){if(!isModule(object.userData.model))continue;if(selected===object)selectObject(null);scene.remove(object);releaseObject(object);objects=objects.filter(o=>o!==object);applied++;}
  }else if(op.type==='camera'){
   if(op.position)camera.position.fromArray(op.position);if(op.target)orbit.target.fromArray(op.target);updateCamera();applied++;
  }
 }
 }catch(error){error.applied=applied;throw error;}
 finally{if(applied){listObjects();pushHistory();setDirty();}}
 if(applied)status('AI 已搭建场景 · '+applied+' 项');
 return {applied};
}
function poseTargetSnapshot(){
 if(!selected)return null;selected.updateWorldMatrix(true,true);const editable=controlBones().slice(0,192),read=n=>new THREE.Quaternion().fromArray(characterBoneQuaternion(selected,n)),round=v=>Math.round(v*1e6)/1e6;
 const joints=editable.map(n=>{const raw=read(n),rest=restBones.get(n)||new THREE.Quaternion(),basis=hasJointFrame(n)?jointFrameQuaternion(n,rest):usesSceneJointAxes()?new THREE.Quaternion():n.parent.getWorldQuaternion(new THREE.Quaternion()),ancestors=[];for(let parent=n.parent;parent&&parent!==selected;parent=parent.parent)if(parent.isBone)ancestors.push(parent.name);const euler=new THREE.Euler().setFromQuaternion(jointControlQuaternion(n),n.rotation.order);return {id:n.name,label:jointLabel(n.name),parent:n.parent?.isBone?n.parent.name:'',ancestors,position:n.getWorldPosition(new THREE.Vector3()).toArray().map(round),rotation:[euler.x,euler.y,euler.z].map(v=>Math.max(-180,Math.min(180,round(THREE.MathUtils.radToDeg(v))))),order:n.rotation.order,frame:hasJointFrame(n)?'calibrated rest-relative':usesSceneJointAxes()?'world rest-relative':'parent-local absolute',axes:Object.fromEntries(['x','y','z'].map((axis,i)=>{const vector=new THREE.Vector3();vector.setComponent(i,1);return [axis,vector.applyQuaternion(basis).normalize().toArray().map(round)];}))};});
 return {busy:poseTargetPeek().busy,scene:{id:selected.userData.id,name:selected.userData.label,model:selected.userData.model,position:selected.position.toArray(),rotation:poseDegrees(selected.quaternion),joints},signature:JSON.stringify({epoch:documentEpoch,id:selected.userData.id,position:selected.position.toArray(),quaternion:selected.quaternion.toArray(),scale:selected.scale.toArray(),bones:editable.map(n=>[n.name,read(n).toArray()])})};
}
function applyAIPose(operations,context){
 if(!selected||selected.userData.id!==context.id||poseTargetPeek().busy)throw Error('当前模型不可编辑');const joints=new Map(controlBones().map(n=>[n.name,n])),refresh=()=>{updateCharacter(selected);selected.updateWorldMatrix(true,true);};
 const result=applyPoseOperations(operations,context,{root:selected,joints,readLocal:n=>new THREE.Quaternion().fromArray(characterBoneQuaternion(selected,n)),setLocal:(n,q)=>setCharacterBoneQuaternion(selected,n,q),setControl:setJointControlQuaternion,rest:n=>restBones.get(n)||new THREE.Quaternion(),refresh});if(result.changed){syncJointProxy();rebuildMarkers();transformFields();boneFields();objectUI?.render();pushHistory();status('AI 姿势已应用，可用 Ctrl+Z 撤回');}return result;
}
function selectBone(n,source){if(!controlBones().includes(n))return;bone=n;gizmo.setMode('rotate');toolsUI.mode('rotate');gizmo.setSpace(jointControlSpace());syncJointProxy();gizmo.attach(hasJointFrame(n)?jointProxy:n);rebuildMarkers();boneFields();renderModeHelp();}
let axisKeys=[],axisHistoryTimer=null,pendingJoint=null,suppressPickUntil=0;
function jointAt(clientX,clientY){
 if(!markers.visible)return null;
 const rect=renderer.domElement.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObjects(markers.children)[0];return hit?.object?.userData?.bone||null;
}
function renderModeHelp(modeOverride){
 const mode=modeOverride||(!$('mode-help').hidden&&$('mode-help').dataset.mode)||gizmo?.getMode()||'translate',name={translate:'移动',rotate:'旋转',scale:'缩放'}[mode];
 $('mode-help-title').textContent=name;$('mode-help').dataset.mode=mode;
 const items=[mode==='rotate'?'点击关节编辑姿势；选择整个物体可旋转物体。':'拖动轴手柄调整'+name+'。','按住 X / Y / Z + 滚轮或 ↑ / ↓ 调整对应轴；选中范围右下方显示数值。','R 重置当前'+name+'；轴键 + R 只重置当前模式对应轴。','Ctrl+R 重置当前物体的移动、旋转、缩放和所有关节；Ctrl+Z 撤回，Ctrl+Shift+Z 重做。'];
 $('mode-help-list').replaceChildren(...items.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
}
function updateAxisHud(){
 const hud=$('axis-hud');if(!hud)return;
 if(!selected||loading||isCaptureMode(settings.mode)){hud.hidden=true;return;}
 const mode=gizmo.getMode(),joint=mode==='rotate'&&bone;
 const rect=renderer.domElement.getBoundingClientRect();let x=-Infinity,y=-Infinity;
 const box=new THREE.Box3().setFromObject(selected),points=[];
 if(joint)points.push(bone.getWorldPosition(new THREE.Vector3()));
 else for(const a of [box.min.x,box.max.x])for(const b of [box.min.y,box.max.y])for(const c of [box.min.z,box.max.z])points.push(new THREE.Vector3(a,b,c));
 for(const point of points){point.project(camera);if(point.z<-1||point.z>1)continue;x=Math.max(x,rect.left+(point.x+1)*rect.width/2);y=Math.max(y,rect.top+(1-point.y)*rect.height/2);}
 if(!Number.isFinite(x)||!Number.isFinite(y)){hud.hidden=true;return;}hud.hidden=false;
 hud.style.left=Math.max(8,Math.min(x+(joint?58:8),innerWidth-hud.offsetWidth-8))+'px';hud.style.top=Math.max(8,Math.min(y+(joint?42:8),innerHeight-hud.offsetHeight-8))+'px';
 const values=mode==='rotate'?(joint?new THREE.Euler().setFromQuaternion(jointControlQuaternion(),bone.rotation.order):selected.rotation):mode==='scale'?selected.scale:selected.position;
 hud.dataset.mode=mode;hud.setAttribute('aria-label',({translate:'移动',rotate:'旋转',scale:'缩放'})[mode]+'数值');
 const hover=String(gizmo.axis||'').toLowerCase();for(const chip of hud.querySelectorAll('.axis-chip')){const axis=chip.dataset.axis,value=values[axis];chip.querySelector('.axis-angle').textContent=mode==='rotate'?((Math.round(THREE.MathUtils.radToDeg(value))%360+360)%360)+'°':mode==='scale'?'×'+value.toFixed(2):value.toFixed(2);chip.classList.toggle('grow',axisKeys.includes(axis)||hover.includes(axis));}
}
function resetJointRotation(axis){
 if(!bone)return;const rest=restBones.get(bone);if(!rest)return;
 if(axis){const current=new THREE.Euler().setFromQuaternion(jointControlQuaternion(),bone.rotation.order),base=new THREE.Euler().setFromQuaternion(hasJointFrame(bone)||usesSceneJointAxes()?new THREE.Quaternion():rest,bone.rotation.order);current[axis]=base[axis];setJointControlQuaternion(bone,new THREE.Quaternion().setFromEuler(current));}
 else setCharacterBoneQuaternion(selected,bone,rest);
 syncJointProxy();boneFields();pushHistory();renderModeHelp();
}
function resetCurrentTransform(axis){
 if(!selected)return;flushAxisHistory();const mode=gizmo.getMode();
 if(mode==='rotate'&&bone){resetJointRotation(axis);return;}
 const value=mode==='scale'?1:0,target=mode==='translate'?selected.position:mode==='scale'?selected.scale:selected.rotation;
 for(const key of axis?[axis]:['x','y','z'])target[key]=value;
 if(mode==='rotate'&&selected.userData.text)selected.userData.text.followCamera=false;
 captureDeformation(selected);transformFields();pushHistory();
}
function resetObjectTransforms(){
 if(!selected)return;flushAxisHistory();selected.position.set(0,0,0);selected.quaternion.identity();selected.scale.set(1,1,1);
 if(selected.userData.text)selected.userData.text.followCamera=false;
 allBones().forEach(n=>{const rest=restBones.get(n);if(rest)setCharacterBoneQuaternion(selected,n,rest);});captureDeformation(selected);syncJointProxy();transformFields();pushHistory();
}
function rotateJointByAxis(axis,degrees){
 if(!bone||!axis)return;
 const vector=new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);
 const current=jointControlQuaternion(),step=new THREE.Quaternion().setFromAxisAngle(vector,THREE.MathUtils.degToRad(degrees));
 if(usesSceneJointAxes()&&!hasJointFrame(bone))current.premultiply(step);else current.multiply(step);current.normalize();
 setJointControlQuaternion(bone,current);
 boneFields();setDirty();renderModeHelp();
 clearTimeout(axisHistoryTimer);axisHistoryTimer=setTimeout(()=>{axisHistoryTimer=null;pushHistory();},220);
}
function axisTransformReady(){if(isCaptureMode(settings.mode))return false;
 const mode=gizmo?.getMode();return !!selected&&(mode==='translate'||mode==='scale'||mode==='rotate');
}
function scheduleAxisHistory(){clearTimeout(axisHistoryTimer);axisHistoryTimer=setTimeout(()=>{axisHistoryTimer=null;pushHistory();},220);}
function applyAxisStep(axis,direction){
 if(!selected||!axis)return;
 const mode=gizmo.getMode();
 if(mode==='rotate'&&bone){
  rotateJointByAxis(axis,direction*2);return;
 }
 if(mode==='rotate'){selected.rotation[axis]+=THREE.MathUtils.degToRad(direction*2);if(selected.userData.text)selected.userData.text.followCamera=false;captureDeformation(selected);setDirty();scheduleAxisHistory();return;}
 if(mode==='translate'){
  selected.position[axis]+=direction*.02;transformFields();setDirty();scheduleAxisHistory();return;
 }
 if(mode==='scale'){
  const factor=direction>0?1.02:1/1.02,value=Math.sign(selected.scale[axis])*THREE.MathUtils.clamp(Math.abs(selected.scale[axis])*factor,.01,100);
  selected.scale[axis]=value;transformFields();setDirty();scheduleAxisHistory();return;
 }
}
function resetAllJoints(){
 if(!selected)return;allBones().forEach(n=>setCharacterBoneQuaternion(selected,n,restBones.get(n)));boneFields();renderModeHelp();pushHistory();status('已重置所有关节');
}
function transformFields(){updateAxisHud();}
function boneFields(){updateAxisHud();}
function selectedLight(){return lightSources.find(x=>x.id===activeLightId)||null;}
function syncLightUI(){
 const source=selectedLight();
 const fields=['light-x','light-y','light-z','light-color','light-power','light-shadow','light-remove'];
 for(const id of fields)$(id).disabled=!source;
 if(source){
  for(let i=0;i<3;i++)$('light-'+['x','y','z'][i]).value=String(source.position[i]);
  $('light-color').value=source.color;$('light-power').value=String(source.power);
  $('light-shadow').checked=!!source.shadow;
 }
 $('light-add').disabled=lightSources.length>=8;
}
function selectLight(id){
 const actor=lightManager?.get(id);if(!actor)return;activeLightId=id;selectObject(null);
 if(settings.mode!=='view'){syncLightUI();status('请在视角模式使用 XYZ 手柄调整光源位置');return;}
 gizmo.setMode('translate');toolsUI.mode('translate');gizmo.attach(actor);
 syncLightUI();listObjects();status('已选中光源 · 拖动 XYZ 轴移动');
}
function removeSelectedLight(){
 const source=selectedLight();if(!source)return;
 if(gizmo.object===lightManager.get(source.id))gizmo.detach();
 lightSources=lightSources.filter(x=>x.id!==source.id);lightManager.sync(lightSources);
 activeLightId=lightSources[0]?.id||'';
 if(activeLightId)selectLight(activeLightId);else{selectObject(null);syncLightUI();}
 listObjects();pushHistory();
}
function updateLightValue(patch,record=true){const source=selectedLight();if(!source)return;
 Object.assign(source,patch);source.falloff=true;source.range=sceneLightRange(source.power);
 lightManager?.sync(lightSources);syncLightUI();if(record)pushHistory();}
function setupLightControls(){
 $('light-add').onclick=()=>{if(lightSources.length>=8)return;let index=1;while(lightSources.some(row=>row.name==='光源 '+index))index++;const dir=camera.getWorldDirection(new THREE.Vector3());const center=camera.position.clone().add(dir.multiplyScalar(4));const source={id:crypto.randomUUID(),name:'光源 '+index,position:[center.x,Math.max(0.3,center.y),center.z],color:'#ffffff',power:0.5,shadow:false,falloff:true,range:sceneLightRange(0.5)};lightSources.push(source);lightManager.sync(lightSources);selectLight(source.id);pushHistory();};
 $('sun-add').onclick=()=>{if(sceneSun)return;sceneSun=normalizeSun({direction:[8,12,6],color:'#ffffff',intensity:2.6,castShadow:true});applySun();syncSunUI();listObjects();pushHistory();status('已添加太阳光');};
 $('sun-color').oninput=e=>{if(!sceneSun)return;sceneSun.color=e.target.value;applySun();setDirty();};
 $('sun-intensity').oninput=e=>{if(!sceneSun)return;const v=Number(e.target.value);if(Number.isFinite(v)){sceneSun.intensity=Math.max(0,Math.min(10,v));applySun();setDirty();}};
 $('sun-shadow').onchange=e=>{if(!sceneSun)return;sceneSun.castShadow=e.target.checked;applySun();setDirty();};
 $('sun-remove').onclick=()=>removeSun();
 syncSunUI();

 $('light-remove').onclick=removeSelectedLight;
 ['x','y','z'].forEach((axis,i)=>{const field=$('light-'+axis);const apply=record=>{const source=selectedLight();if(!source)return;const value=Number(field.value);if(!field.value.trim()||!Number.isFinite(value))return;const position=source.position.slice();position[i]=Math.max(-100,Math.min(100,value));updateLightValue({position},record);};field.addEventListener('input',()=>apply(false));field.addEventListener('change',()=>apply(true));});
 $('light-color').addEventListener('input',()=>updateLightValue({color:$('light-color').value},false));
 $('light-color').addEventListener('change',()=>updateLightValue({color:$('light-color').value},true));
 $('light-power').addEventListener('input',()=>{const field=$('light-power');if(field.value.trim())updateLightValue({power:Math.max(0,Math.min(10,Number(field.value)||0))},false);});
 $('light-power').addEventListener('change',()=>updateLightValue({power:Math.max(0,Math.min(10,Number($('light-power').value)||0))},true));
 $('light-shadow').addEventListener('change',()=>updateLightValue({shadow:$('light-shadow').checked},true));
 syncLightUI();
}
function updateLighting(){
 if(ANIMA_MODE){scene.background=new THREE.Color('#000000');floor.visible=false;grid.visible=false;return;}
 scene.background=new THREE.Color(sceneEnvironment.background);
 lightManager?.setGroundRadius(groundGrid.radius);lightManager?.sync(lightSources);
 floor.visible=groundGrid.floorVisible||groundGrid.pattern==='mirror';grid.visible=groundGrid.visible;
 floor.material.color.set(groundGrid.floorColor||'#ffffff');
 objects.forEach(applyObjectColor);
 syncLightUI();
}
function updateCamera(){syncActiveFirstPerson();const position=camera.position.clone(),target=orbit.target.clone(),oldZoom=camera.zoom;orbit.dispose();const aspect=settings.width/settings.height,distance=position.distanceTo(target),height=2*distance*Math.tan(THREE.MathUtils.degToRad(settings.fov/2));camera=settings.orthographic?new THREE.OrthographicCamera(-height*aspect/2,height*aspect/2,height/2,-height/2,.01,200):new THREE.PerspectiveCamera(settings.fov,aspect,.01,200);camera.userData.shotHalfHeight=height/2;camera.position.copy(position);camera.zoom=oldZoom;camera.lookAt(target);camera.updateProjectionMatrix();orbit=new OrbitControls(camera,renderer.domElement);orbit.target.copy(target);orbit.enabled=settings.mode!=='firstPerson'&&!(isCaptureMode(settings.mode)&&settings.viewLocked===true);orbit.addEventListener('end',()=>pushHistory());gizmo.camera=camera;resize();}
function updateHint(){const hint=$('hint');if(!hint)return;hint.textContent=(isCaptureMode(settings.mode)?'按 C 拍摄 · ':'')+'左键旋转镜头 · 右键平移 · 滚轮缩放 · 点击物体或关节进行编辑 · 1-4 切换镜头';}
function syncSettings(){lightManager?.setHelpersVisible(settings.mode==='view');applySun();if(helper)helper.visible=!isCaptureMode(settings.mode);if(gizmo)gizmo.enabled=!isCaptureMode(settings.mode)&&!pendingJob;markers.visible=!isCaptureMode(settings.mode);for(const [id,key] of [['fov','fov'],['fisheye','fisheye']])$(id).value=settings[key];$('orthographic').checked=settings.orthographic;for(const id of ['fov','fisheye','fov-reset','fisheye-reset'])$(id).disabled=!!settings.orthographic;$('background').value=sceneEnvironment.background;$('floor').checked=groundGrid.floorVisible;$('fov-value').value=settings.fov+'°';$('fisheye-value').textContent=Number(settings.fisheye||0).toFixed(2);updateHint();}
function projectCamera(aspect,verticalScale=1,offsetX=0){
 camera.userData.editorProjection={aspect,verticalScale,offsetX};camera.far=Math.max(200,groundGrid.radius*2+camera.position.length()*2);
 if(camera.isPerspectiveCamera){camera.aspect=aspect;camera.fov=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(settings.fov/2))*verticalScale)*180/Math.PI;}
 else{const half=(camera.userData.shotHalfHeight||1)*verticalScale;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;}
 camera.updateProjectionMatrix();if(camera.isPerspectiveCamera)camera.projectionMatrix.elements[8]+=offsetX;else camera.projectionMatrix.elements[12]-=offsetX;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
function refreshCameraClipping(){const far=Math.max(200,groundGrid.radius*2+camera.position.length()*2);if(Math.abs(far-camera.far)>2){const p=camera.userData.editorProjection;if(p)projectCamera(p.aspect,p.verticalScale,p.offsetX);}}
function resize(){
 const rect=$('viewport').getBoundingClientRect(),sidebar=0,layout=fullViewportLayout(Math.round(rect.width),Math.round(rect.height),captureAspect(settings),1,settings.fov,sidebar,settings.frameScale??.92,isCaptureMode(settings.mode)?settings.frameRoll||0:0);
 liveLayout={...layout.frame,viewportWidth:layout.width,viewportHeight:layout.height};renderer.setSize(layout.width,layout.height,false);projectCamera(layout.aspect,layout.verticalScale*(settings.frameProjectionScale||1),layout.offsetX);
 const frame=$('camera-frame');for(const key of ['left','top','width','height'])frame.style[key]=layout.frame[key]+'px';frame.style.transform='rotate('+(isCaptureMode(settings.mode)?normalizeFrameRoll(settings.frameRoll):0)+'deg)';$('frame-roll-display').hidden=!isCaptureMode(settings.mode);$('frame-roll-display').textContent='取景框 '+normalizeFrameRoll(settings.frameRoll).toFixed(1)+'°';frame.setAttribute('aria-label','当前镜头取景比例 '+ratioText(settings));$('frame-label').textContent=(shots[activeShot]?.name||'当前镜头')+' · '+ratioText(settings);
 clampFloatingPanels();studio?.renderOverlay();
}
function documentURL(id){const params=new URLSearchParams(location.hash.slice(1));params.set('scene',id);window.history.replaceState(null,'','#'+params.toString());}
function releaseObject(object){flushBodyShapeInputs();disposeBodyShape(object);disposeCharacter(object);const materials=new Set(),skeletons=new Set();object.traverse(n=>{if(n.isMesh){for(const m of (Array.isArray(n.material)?n.material:[n.material]))materials.add(m);if(n.userData.ownedGeometry||!catalog.some(row=>row.id===object.userData.model))n.geometry.dispose();}if(n.isSkinnedMesh)skeletons.add(n.skeleton);});materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());}
async function loadScene(data,{resetHistory=false}={}){
 const selectedId=selected?.userData.id,epoch=++documentEpoch;
 loading=true;status('正在载入场景…');gizmo.detach();
 try{
  if(data?.version!==1||!Array.isArray(data.objects)||data.objects.length>SCENE_OBJECT_LIMIT||!data.camera||!Array.isArray(data.camera.position)||!Array.isArray(data.camera.target))throw Error('场景数据无效');
  // Compute scene-wide state first, but do not mutate the live scene while meshes are loading.
  // A failed file/model load must never leave an unrelated background or lighting state behind.
  const nextSettings={...defaults,...data.settings},nextGround=normalizeGroundGrid(data.groundGrid,data.settings?.grid);
  const legacyShotSettings=data.shots?.[Math.max(0,Number(data.activeShot)||0)]?.settings||data.settings||{};
  if(data.groundGrid?.floorVisible===undefined)nextGround.floorVisible=legacyShotSettings.floor!==false;
  if(data.groundGrid?.floorColor===undefined)nextGround.floorColor=legacyShotSettings.background||'#ffffff';
  const nextEnvironment={background:/^#[0-9a-fA-F]{6}$/.test(data.sceneEnvironment?.background||'')?data.sceneEnvironment.background:(legacyShotSettings.background||'#ffffff')};
  const nextSun='sceneSun' in data?normalizeSun(data.sceneSun):normalizeSun({direction:[8,12,6],color:'#ffffff',intensity:2.6,castShadow:true});
  const nextLights=normalizeSceneLights(data.sceneLights,legacyShotSettings);
  const next=await prepareSceneAssets(data.objects,createObject,releaseObject);
  if(epoch!==documentEpoch){next.forEach(releaseObject);return;}
  settings=nextSettings;groundGrid=nextGround;sceneEnvironment=nextEnvironment;lightSources=nextLights;activeLightId=nextLights[0]?.id||'';
 sceneSun=nextSun;applySun();
  for(const o of objects){scene.remove(o);releaseObject(o);}
  objects=next;groundRevision++;objects.forEach(o=>scene.add(o));
  camera.position.fromArray(data.camera.position);orbit.target.fromArray(data.camera.target);camera.zoom=data.camera.zoom||1;
  rebuildAllTiles();adoptShots(data);syncSettings();updateCamera();updateLighting();selectObject(objects.find(o=>o.userData.id===selectedId)||null);
  if(resetHistory){history=[JSON.stringify(serialize())];historyIndex=0;$('undo').disabled=true;$('redo').disabled=true;}
  status('场景已载入');
 }catch(e){if(epoch===documentEpoch&&selected)selectObject(selected);throw e;}
 finally{if(epoch===documentEpoch)loading=false;}
}
async function confirmAction(text){$('confirm-text').textContent=text;$('confirm-dialog').showModal();return new Promise(resolve=>$('confirm-dialog').addEventListener('close',()=>resolve($('confirm-dialog').returnValue==='yes'),{once:true}));}
async function askName(title){$('dialog-title').textContent=title;$('document-name').value=documentName;$('name-dialog').showModal();return new Promise(resolve=>$('name-dialog').addEventListener('close',()=>resolve($('name-dialog').returnValue==='save'?$('document-name').value.trim():null),{once:true}));}
// Auto-generated scene cover from the editor view. Never creates a photo/capture record.
function automaticSceneCover(){
 const canvas=document.createElement('canvas');canvas.width=432;canvas.height=270;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法生成场景封面');
 const oldHelper=helper.visible,oldMarkers=markers.visible,oldSunPivot=sunPivot?sunPivot.visible:false;
 helper.visible=false;markers.visible=false;if(sunPivot)sunPivot.visible=false;lightManager?.setHelpersVisible(false);
 try{
  // Render the current editor camera directly, not the photo-mode capture pipeline.
  sceneFisheye.render(renderer,scene,camera,settings.fisheye,null,0);
  ctx.fillStyle=sceneEnvironment.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  const source=renderer.domElement,w=source.width,h=source.height;
  const ratio=Math.min(canvas.width/w,canvas.height/h),dw=w*ratio,dh=h*ratio;
  ctx.drawImage(source,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
  return canvas.toDataURL('image/jpeg',.73);
 }finally{helper.visible=oldHelper;markers.visible=oldMarkers;if(sunPivot)sunPivot.visible=oldSunPivot;lightManager?.setHelpersVisible(settings.mode==='view');}
}
async function saveDocument(asNew=false){
 if(loading||pendingJob||!commitDocumentName())return;
 const name=asNew||!documentId?await askName(asNew?'另存为场景预设':'保存场景预设'):documentName;
 if(!name)return;
 pendingJob++;const unlock=captureLock();
 try{
  await objectUI.flush();const cover=automaticSceneCover();const record=await api('scenes',{id:asNew?'':documentId,name,preset:true,scene:serialize(),cover,captureSource:{channel,sceneId:documentId}});
  documentId=record.id;documentName=record.name;isPreset=true;dirty=false;
  if(draftMode){drafts.mark();await drafts.flush();}
  updateDocumentTitle();
  status(asNew?'已另存为新预设':'场景预设已保存');await listDocuments();await studio.refreshAlbum();return record;
 }finally{pendingJob--;unlock();}
}
async function listDocuments(result){
 if(!result)result=await api('scenes');
 const host=$('documents');host.replaceChildren();
 for(const row of result.items){
  const card=document.createElement('article');card.className='scene-library-card';
  const open=document.createElement('button');open.type='button';open.className='scene-library-open';
  open.setAttribute('aria-label','载入场景 '+row.name);
  const preview=document.createElement('div');preview.className='scene-library-preview';
  const fallback=document.createElement('span');fallback.className='scene-library-placeholder';fallback.textContent='3D 场景';preview.append(fallback);
  if(row.hasCover){
   const image=document.createElement('img');image.loading='lazy';image.alt='保存时自动截取的场景封面：'+row.name;
   image.src='/scene3d/scenes/'+encodeURIComponent(row.id)+'/cover?updated='+Math.round(Number(row.updated)||0);
   image.onerror=()=>image.remove();image.onload=()=>fallback.hidden=true;preview.append(image);
  }
  const info=document.createElement('div');info.className='scene-library-info';
  const label=document.createElement('strong');label.textContent=(row.preset?'':'旧场景 · ')+row.name;
  const time=document.createElement('time');time.textContent=new Date(row.updated*1000).toLocaleString();info.append(label,time);
  open.append(preview,info);
  open.onclick=safe(async()=>{
   if(loading||pendingJob)return;
   if(objects.length&&!await confirmAction('载入“'+row.name+'”将替换当前场景；未保存到预设的修改会被替换。继续？'))return;
   pendingJob++;const unlock=captureLock();
   try{
    if(draftMode)await drafts.flush();
    const record=await api('scenes/'+row.id);await loadScene(record.scene,{resetHistory:true});
    documentId=row.id;documentName=record.name;isPreset=true;dirty=false;updateDocumentTitle();
    if(draftMode){drafts.mark();await drafts.flush();}
    await studio.refreshAlbum();$('scene-library-dialog').close();status('已载入场景；编辑只临时保留，点击保存才更新预设');
   }finally{pendingJob--;unlock();}
  });
  const remove=document.createElement('button');remove.type='button';remove.className='scene-library-remove';remove.textContent='删除';
  remove.setAttribute('aria-label','删除场景 '+row.name);remove.dataset.tooltip='删除场景及其截图';
  remove.onclick=safe(async()=>{if(!await confirmAction('删除场景预设“'+row.name+'”及其全部截图？此操作不能撤回。'))return;
   await studioJob(async()=>{await api('scenes',{action:'delete',id:row.id});if(documentId===row.id){documentId='';isPreset=false;setDirty();await studio.refreshAlbum();}await listDocuments();status('场景预设及截图已删除');});
  });
  card.append(open,remove);host.append(card);
 }
 if(!result.items.length){const empty=document.createElement('p');empty.className='scene-library-empty';empty.textContent='还没有保留的场景。保存场景后，封面会自动出现在这里。';host.append(empty);}
}
window.addEventListener('scene3d-open-library',safe(async()=>{
 await listDocuments();$('scene-library-dialog').showModal();
}));
$('scene-library-close').addEventListener('click',()=>$('scene-library-dialog').close());
function captureLock(){const controls=[...document.querySelectorAll('header button,header input,#camera-toolbar button,#camera-sidebar button,#camera-sidebar input,#camera-sidebar select,#camera-sidebar textarea,#scene-object-rail button,#scene-object-rail input,#scene-object-rail textarea,#scene-object-rail select,#tool-rail button,#panel-rail button,#library button,#inspector button,#inspector input,#inspector select,#view-menu button')],disabled=controls.map(c=>c.disabled),orbitEnabled=orbit.enabled,gizmoEnabled=gizmo.enabled,lockedMode=settings.mode;controls.forEach(c=>c.disabled=true);orbit.enabled=false;gizmo.enabled=false;renderer.domElement.style.pointerEvents='none';return()=>{controls.forEach((c,i)=>c.disabled=disabled[i]);orbit.enabled=(settings.mode!==lockedMode||orbitEnabled)&&settings.mode!=='firstPerson'&&!(isCaptureMode(settings.mode)&&settings.viewLocked===true);gizmo.enabled=(settings.mode!==lockedMode||gizmoEnabled)&&!isCaptureMode(settings.mode);renderer.domElement.style.pointerEvents='';$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=history.length-1;};}
async function applySnapshot(){await studioJob(async()=>{if(!objects.length)throw Error('请先添加物体或文字');await objectUI.flush();if(draftMode){drafts.mark();await drafts.flush();}status('正在拍摄截图…');if(!ANIMA_MODE)await groundEffects.prepare(groundGrid);const restoreRippleUI=rippleEditor?.suspend();const oldPixelRatio=renderer.getPixelRatio(),oldSize=renderer.getSize(new THREE.Vector2()),wasGrid=grid.visible,wasMarkers=markers.visible,wasHelper=helper.visible;let oldSunPivot=false;if(sunPivot){oldSunPivot=sunPivot.visible;sunPivot.visible=false;}grid.visible=!ANIMA_MODE&&groundGrid.visible&&groundGrid.capture;markers.visible=false;helper.visible=false;lightManager?.setHelpersVisible(false);let restoreRoll=()=>{};try{await Promise.all((settings.shotTexts||[]).map(t=>loadTextFont(t.font)));restoreRoll=rotateCaptureCamera(camera,isCaptureMode(settings.mode)?settings.frameRoll:0);renderer.setPixelRatio(1);renderer.setSize(settings.width,settings.height,false);projectCamera(captureAspect(settings),settings.frameProjectionScale||1);updateTextFacing(objects,shots,activeShot,camera);refreshCameraClipping();if(!ANIMA_MODE)groundEffects.update(renderer,scene,camera,grid,floor,groundGrid,objects,{background:sceneEnvironment.background,revision:groundRevision,force:true,exclude:[helper,markers,...(lightManager?.markers||[]),rippleEditor?.helper,...(sunPivot?[sunPivot]:[])]});updateGroundGrid(grid,camera,groundGrid,floor);sceneFisheye.render(renderer,scene,camera,settings.fisheye,{left:0,top:0,width:settings.width,height:settings.height,viewportWidth:settings.width,viewportHeight:settings.height});const output=document.createElement('canvas');output.width=settings.width;output.height=settings.height;const ctx=output.getContext('2d');ctx.filter=filterCSS(settings.filter);ctx.drawImage(renderer.domElement,0,0);ctx.filter='none';drawShotTexts(ctx,settings.shotTexts,output.width,output.height);restoreRoll();const blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('截图编码失败')),'image/png'));let response=await fetch('/references',{method:'POST',headers:{'Content-Type':'image/png',...headers()},body:blob});if(response.status===409){await refreshInstance();response=await fetch('/references',{method:'POST',headers:{'Content-Type':'image/png',...headers()},body:blob});}const asset=await response.json();if(!response.ok)throw Error(asset.error||'截图保存失败');await studio.record(asset);status('截图已加入当前场景记录，可查看、裁剪或用于生成');}finally{restoreRoll();grid.visible=wasGrid;markers.visible=wasMarkers;helper.visible=wasHelper;if(sunPivot)sunPivot.visible=oldSunPivot;lightManager?.setHelpersVisible(settings.mode==='view');renderer.setPixelRatio(oldPixelRatio);renderer.setSize(oldSize.x,oldSize.y,false);resize();restoreRippleUI?.();}});}
async function studioJob(fn){if(loading||pendingJob||removalUnlock)return;pendingJob++;const unlock=captureLock();status('正在处理，请稍候…');let finished=false;try{const result=await fn();finished=true;return result;}finally{pendingJob--;unlock();renderShots();if(finished&&$('status').textContent==='正在处理，请稍候…')status('就绪');}}
function changeGround(values,record=true){
 groundGrid=normalizeGroundGrid({...groundGrid,...values});groundRevision++;
 lightManager?.setGroundRadius(groundGrid.radius);lightManager?.sync(lightSources);refreshCameraClipping();
 // Preview runs during numeric scrubbing. Avoid rebuilding sidebar fields mid-drag:
 // doing so used to reset the text cursor and break the drag-number control.
 grid.visible=groundGrid.visible;
 floor.visible=groundGrid.floorVisible||groundGrid.pattern==='mirror';
 if(floor.material.color)floor.material.color.set(groundGrid.floorColor||'#ffffff');
 rippleEditor?.refresh();
 if(record){studio?.renderShots();pushHistory();}
}
function changeCamera(values,history=true){const before={...settings};Object.assign(settings,values);const outputOnly=Object.keys(values).every(key=>['width','height','captureTier','captureBaseWidth','captureBaseHeight','frameAspect'].includes(key))&&Math.abs(captureAspect(before)-captureAspect(settings))<1e-12;if(outputOnly){saveActiveShot();studio?.renderShots();if(history)pushHistory();return;}if(Object.keys(values).every(key=>key==='filter')){saveActiveShot();studio?.renderShots();if(history)pushHistory();return;}if(!('frameProjectionScale' in values)&&['width','height','frameScale'].some(key=>key in values))settings.frameProjectionScale=preserveFrameProjection(before,settings,$('viewport').getBoundingClientRect());saveActiveShot();syncSettings();updateCamera();updateLighting();studio?.renderShots();if(history)pushHistory();}
function initialize(){renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.setAttribute('aria-label','3D 场景视口');renderer.domElement.tabIndex=0;renderer.domElement.addEventListener('pointerdown',()=>renderer.domElement.focus({preventScroll:true}));$('stage').append(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(settings.fov,settings.width/settings.height,.01,200);camera.position.set(2.4,1.6,4.2);orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.9,0);orbit.addEventListener('end',()=>pushHistory());gizmo=new TransformControls(camera,renderer.domElement);helper=gizmo.getHelper();scene.add(helper,markers,jointProxy);gizmo.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value&&settings.mode!=='firstPerson'&&!(isCaptureMode(settings.mode)&&settings.viewLocked===true);if(!e.value){lastTransform=performance.now();transformFields();boneFields();pushHistory();}});gizmo.addEventListener('objectChange',()=>{if(gizmo.object===jointProxy&&bone&&hasJointFrame(bone))setCharacterBoneQuaternion(selected,bone,jointFrameToLocal(bone,jointProxy.quaternion));if(gizmo.object===sunPivot&&sceneSun){const rayDir=new THREE.Vector3(0,1,0).applyQuaternion(sunPivot.quaternion).normalize();sceneSun.direction=rayDir.negate().toArray();applySun();setDirty();}
  else if(gizmo.object?.userData.sceneLightId){const source=lightSources.find(row=>row.id===gizmo.object.userData.sceneLightId);if(source){source.position=gizmo.object.position.toArray();syncLightUI();setDirty();}}else if(selected)captureDeformation(selected);setDirty();});scene.add(new THREE.HemisphereLight(0xffffff,0x52525c,0.4));scene.add(new THREE.AmbientLight(0xffffff,0));
sceneSun=normalizeSun({direction:[8,12,6],color:'#ffffff',intensity:2.6,castShadow:true});applySun();

{const pmrem=new THREE.PMREMGenerator(renderer),envScene=new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.BoxGeometry(8,5,8),new THREE.MeshBasicMaterial({color:0xf2f4f7,side:THREE.BackSide})));
const envLamp=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshBasicMaterial({color:0xffffff}));
envLamp.position.set(0,2.4,0);envLamp.rotation.x=Math.PI/2;envScene.add(envLamp);
scene.environment=pmrem.fromScene(envScene,0.04).texture;scene.environmentIntensity=0.22;pmrem.dispose();}
lightManager=createSceneLightManager(THREE,scene);lightManager.sync(lightSources);sceneFisheye=createSceneFisheye();floor=createGroundFloor(settings.background);scene.add(floor);grid=createGroundGrid();scene.add(grid);syncSettings();adoptShots({version:1,camera:{position:camera.position.toArray(),target:orbit.target.toArray(),zoom:1},settings:{...settings}});updateLighting();new ResizeObserver(resize).observe($('viewport'));
 frameRollControls=installFrameRollControls({viewport:$('viewport'),get:()=>settings,busy:()=>loading||pendingJob>0||!!removalUnlock||componentEnded,change:angle=>{const before={...settings};settings.frameRoll=angle;settings.frameProjectionScale=preserveFrameProjection(before,settings,$('viewport').getBoundingClientRect());saveActiveShot();resize();},commit:()=>{if(!componentEnded)pushHistory();}});
 firstPersonLook=installFirstPersonLook({element:renderer.domElement,get:()=>settings,busy:()=>loading||pendingJob>0||!!removalUnlock||componentEnded,change:values=>{Object.assign(settings,values);syncActiveFirstPerson();},commit:()=>{if(!componentEnded)pushHistory();}});
 firstPersonNavigation=installFirstPersonNavigation({element:renderer.domElement,get:()=>settings,getCamera:()=>camera,getBody:activeFirstPersonBody,busy:()=>loading||pendingJob>0||!!removalUnlock||componentEnded,change:values=>{Object.assign(settings,values);if('fov' in values){resize();}else updateCamera();syncSettings();studio?.renderShots();},preview:syncActiveFirstPerson,commit:pushHistory});
 renderer.domElement.addEventListener('wheel',e=>{
  if(!axisKeys.length||!axisTransformReady())return;
  e.preventDefault();e.stopImmediatePropagation();
  applyAxisStep(axisKeys[axisKeys.length-1],e.deltaY>0?-1:1);
 },{passive:false,capture:true});let down;
 renderer.domElement.addEventListener('pointerdown',e=>{
  if(e.button!==0||isCaptureMode(settings.mode))return;
  const target=jointAt(e.clientX,e.clientY);
  pendingJoint=target?{bone:target,x:e.clientX,y:e.clientY}:null;
 },true);
 renderer.domElement.addEventListener('pointerup',e=>{
  if(!pendingJoint||e.button!==0)return;
  const target=pendingJoint;pendingJoint=null;
  if(Math.hypot(e.clientX-target.x,e.clientY-target.y)>4)return;
  suppressPickUntil=performance.now()+260;setTimeout(()=>selectBone(target.bone,'viewport'),0);
 },true);
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});renderer.domElement.addEventListener('pointerup',e=>{if(isCaptureMode(settings.mode)||performance.now()<suppressPickUntil)return;if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||gizmo.dragging||rippleEditor?.dragging()||performance.now()-lastTransform<150||e.button!==0)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=markers.visible?raycaster.intersectObjects(markers.children)[0]:null;if(hit){selectBone(hit.object.userData.bone,'viewport');return;}const rippleId=rippleEditor?.pick(raycaster,objects);if(rippleId){rippleEditor.select(rippleId);return;}const lightHit=lightManager?.pick(raycaster);if(lightHit){selectLight(lightHit);return;}const mesh=raycaster.intersectObjects(objects,true)[0];if(mesh){let o=mesh.object;while(o&&!objects.includes(o))o=o.parent;if(o)selectObject(o);return;}selectObject(null);});
 let physicsTime;renderer.setAnimationLoop(time=>{const physicsDt=physicsTime===undefined?0:Math.min((time-physicsTime)/1000,1/15);physicsTime=time;if(!loading&&!pendingJob&&!removalUnlock)objects.forEach(o=>updateCharacter(o,physicsDt));if(selected){selected.updateMatrixWorld(true);for(const m of markers.children)m.position.copy(m.userData.bone.getWorldPosition(new THREE.Vector3()));}syncJointProxy();if(sunPivot&&activeSun){const fwd=camera.getWorldDirection(new THREE.Vector3());sunPivot.position.copy(camera.position).add(fwd.multiplyScalar(4));}updateAxisHud();rippleEditor?.refresh();poseChat?.refresh();if(settings.mode==='firstPerson'){firstPersonNavigation?.tick(physicsDt);syncActiveFirstPerson();}else orbit.update();updateTextFacing(objects,shots,activeShot,camera);refreshCameraClipping();groundEffects.update(renderer,scene,camera,grid,floor,groundGrid,objects,{background:sceneEnvironment.background,revision:groundRevision,exclude:[helper,markers,...(lightManager?.markers||[]),rippleEditor?.helper]});updateGroundGrid(grid,camera,groundGrid,floor);renderWithFallback(renderer,null,()=>sceneFisheye.render(renderer,scene,camera,settings.fisheye,isCaptureMode(settings.mode)?liveLayout:null,isCaptureMode(settings.mode)?settings.frameRoll:0));});rippleEditor=initializeRippleEditing({scene,renderer,get:()=>({ground:groundGrid,camera,orbit,photo:isCaptureMode(settings.mode),busy:loading||pendingJob>0||!!removalUnlock}),change:values=>changeGround(values,false),commit:pushHistory,preview:setDirty,clearSelection:()=>{gizmo.setMode('translate');selectObject(null);},meshes:()=>groundEffects.manualMeshes(),error:e=>status(e.message||String(e),true),dragEnded:()=>{lastTransform=performance.now();}});resize();renderModeHelp();}
const toolsUI=initializeSceneInterface({busy:()=>loading||pendingJob||!!removalUnlock,showModeHelp:(mode,button)=>{const card=$('mode-help');card.hidden=false;renderModeHelp(mode);const r=button.getBoundingClientRect();card.style.setProperty('--mode-help-left',(r.right+10)+'px');card.style.top=Math.max(8,Math.min(r.top,innerHeight-card.offsetHeight-8))+'px';},hideModeHelp:()=>{$('mode-help').hidden=true;}});
setupAnimatedDisclosure($('shape-panel'));
initializeSceneNumberInputs();initializeSceneSelectInputs();setupLightControls();
$('background').addEventListener('change',()=>{sceneEnvironment.background=$('background').value;updateLighting();pushHistory();});
const studioState=()=>({channel,documentId,shots,activeShot,settings,selected,camera,groundGrid});
studio=initializeCameraStudio({get:studioState,change:changeCamera,changeMode:changeCameraMode,changeGlobal:changeGround,api,job:studioJob,error:e=>status(e.message||String(e),true),selectShot:switchShot,layout:resize,commit:pushHistory,capture:applySnapshot,confirm:confirmAction,apply:async asset=>{if(!draftMode)throw Error('请从绘图台重新打开场景');drafts.mark();await drafts.flush();await api('drafts',{action:'apply',channel,asset});status('已设为参考图');},addText:async text=>{if(objects.length>=SCENE_OBJECT_LIMIT)throw Error('场景最多512个物体');const object=await createObject({model:'text',name:text.content.slice(0,20),text:{...text,size:.5,depth:0,color:'#eeeeee',castShadow:true,receiveShadow:true,faceCameraId:shots[activeShot].id,followCamera:false}});object.position.copy(orbit.target);faceTextObject(object,{...shots[activeShot],camera:cameraSnapshot()},false);objects.push(object);scene.add(object);selectObject(object);pushHistory();}});
objectUI=initializeObjectControls({get:studioState,commit:pushHistory,error:e=>status(e.message||String(e),true),job:studioJob,color:applyObjectColor,transforms:transformFields});
poseChat=initializePoseChat({snapshot:sceneSnapshot,peek:scenePeek,apply:applyAIScene,api,error:e=>status(e.message||String(e),true)});

function clampFloatingPanels(){toolsUI.clamp();}
for(const mode of ['translate','rotate','scale'])bind(mode,()=>{
 const lightTarget=gizmo.object?.isPointLight&&gizmo.object.userData.sceneLightId===activeLightId?lightManager.get(activeLightId):null;
 if(lightTarget){gizmo.setMode('translate');gizmo.setSpace('world');gizmo.attach(lightTarget);toolsUI.mode('translate');renderModeHelp();if(mode!=='translate')status('光源只支持 XYZ 位移，请先选中场景物体使用旋转或缩放');return;}
 gizmo.setMode(mode);gizmo.setSpace(mode==='rotate'&&bone?jointControlSpace():mode==='rotate'?'local':'world');
 const target=bone&&mode==='rotate'?(hasJointFrame(bone)?jointProxy:bone):selected;syncJointProxy();if(target)gizmo.attach(target);else gizmo.detach();toolsUI.mode(mode);renderModeHelp();
});
bind('remove',()=>{if(!selected)return;const owner=selected.userData.firstPersonFor;for(const shot of shots)if(shot.id===owner&&shot.settings.mode==='firstPerson')shot.settings.mode='photo';scene.remove(selected);releaseObject(selected);objects=objects.filter(o=>o!==selected);selectObject(objects.at(-1)||null);pushHistory();});
bind('duplicate',async()=>{if(!selected||objects.length>=SCENE_OBJECT_LIMIT)return;const record=serialize().objects.find(o=>o.id===selected.userData.id);delete record.firstPersonFor;record.id=crypto.randomUUID();record.position[0]+=.6;const object=await createObject(record);objects.push(object);scene.add(object);selectObject(object);pushHistory();});
bind('reset-pose',()=>resetAllJoints());
bind('mirror',()=>{if(!selected||!bone)throw Error('请先在视口中选中要镜像的肢体关节');const count=copySelectedLimbPose(allBones(),bone,n=>new THREE.Quaternion().fromArray(characterBoneQuaternion(selected,n)),n=>restBones.get(n),(n,q)=>setCharacterBoneQuaternion(selected,n,q));if(!count)throw Error('当前关节没有对应的另一侧肢体，请选择手臂、腿或手指');boneFields();syncJointProxy();pushHistory();status('已将选中肢体的动作镜像到另一侧');});
bind('orthographic',()=>{settings.orthographic=$('orthographic').checked;updateCamera();syncSettings();studio?.renderShots();pushHistory();},'change');
// Numeric scrub emits input repeatedly; use lightweight previews and commit exactly one history snapshot on change.
for(const key of ['fov','fisheye']){
 const field=$(key),minimum=key==='fov'?10:0,maximum=key==='fov'?90:FISHEYE_MAX;
 const preview=()=>{const value=Number(field.value);if(!field.value.trim()||!Number.isFinite(value)||value<minimum||value>maximum)return;settings[key]=value;
  if(key==='fov'){resize();$('fov-value').value=value+'°';}else $('fisheye-value').textContent=value.toFixed(2);
 };
 field.addEventListener('input',preview);
 field.addEventListener('change',()=>{preview();const value=Number(field.value);if(!Number.isFinite(value)||value<minimum||value>maximum){field.value=settings[key];return;}
  // Screenshot and preview use the same settings; avoid reconstructing OrbitControls.
  saveActiveShot();studio?.renderShots();pushHistory();});
}

function view(direction){const distance=camera.position.distanceTo(orbit.target)||4,target=selected?new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3()):orbit.target.clone();orbit.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(...direction).multiplyScalar(distance));camera.lookAt(target);orbit.update();pushHistory();}
bind('add-shot',addShot);bind('delete-shot',()=>deleteShot());bind('shot-select',()=>switchShot(Number($('shot-select').value)),'change');
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(({front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0],top:[0,1,.001],bottom:[0,-1,.001]})[b.dataset.view])));
bind('new',async()=>{
 if(loading||pendingJob)return;
 if(objects.length&&!await confirmAction('新建空场景将替换当前临时内容。需要保留时请先保存预设。继续？'))return;
 pendingJob++;const unlock=captureLock();
 try{
  if(draftMode)await drafts.flush();
  await loadScene({version:1,sceneLights:normalizeSceneLights(),objects:[],camera:{position:[2.4,1.6,4.2],target:[0,.9,0],zoom:1},settings:{...defaults}},{resetHistory:true});
  documentId='';documentName='临时场景';isPreset=false;dirty=false;updateDocumentTitle();await studio.request('clear-draft');await studio.refreshAlbum();
  if(draftMode){drafts.mark();await drafts.flush();}
 }finally{pendingJob--;unlock();}
});
bind('save',()=>saveDocument(false));bind('preset',()=>saveDocument(true));bind('apply',applySnapshot);
function flushAxisHistory(){if(axisHistoryTimer!==null){clearTimeout(axisHistoryTimer);axisHistoryTimer=null;pushHistory();}}
let historyBusy=false;
async function moveHistory(direction){
 if(historyBusy||loading||pendingJob||removalUnlock)return;
 flushAxisHistory();const next=historyIndex+direction;if(next<0||next>=history.length)return;
 historyBusy=true;axisKeys=[];const previous=historyIndex;pendingJob++;const unlock=captureLock();
 try{await loadScene(JSON.parse(history[next]));historyIndex=next;setDirty();}
 catch(error){historyIndex=previous;throw error;}
 finally{pendingJob--;historyBusy=false;unlock();$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=history.length-1;}
}
bind('undo',()=>moveHistory(-1));bind('redo',()=>moveHistory(1));
document.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase(),modifier=e.ctrlKey||e.metaKey;
 if(pendingJob||loading||removalUnlock){if(modifier&&['s','r','z'].includes(key)&&!e.target.closest('input,textarea,select,[contenteditable="true"]'))e.preventDefault();return;}
 if(modifier&&key==='s'&&!document.querySelector('dialog[open]')){e.preventDefault();if(commitDocumentName())safe(()=>saveDocument(e.shiftKey))();return;}
 if(e.target.closest('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
 if(modifier&&key==='z'&&!e.altKey){e.preventDefault();if(!e.repeat)safe(()=>moveHistory(e.shiftKey?1:-1))();return;}
 if(modifier&&key==='r'){e.preventDefault();if(!isCaptureMode(settings.mode))resetObjectTransforms();return;}
 if(isCaptureMode(settings.mode)&&!['1','2','3','4','c'].includes(key))return;
 if(!modifier&&!e.altKey&&key==='r'&&selected){e.preventDefault();resetCurrentTransform(axisKeys.at(-1));return;}
 if(!modifier&&!e.altKey&&axisTransformReady()&&['x','y','z'].includes(key)){if(!axisKeys.includes(key))axisKeys.push(key);e.preventDefault();return;}
 if(!modifier&&!e.altKey&&axisKeys.length&&axisTransformReady()&&(key==='arrowup'||key==='arrowdown')){e.preventDefault();applyAxisStep(axisKeys.at(-1),key==='arrowup'?1:-1);return;}
 if(key==='escape'){bone=null;selectObject(selected);}
 if(!modifier&&!e.altKey&&key==='c'&&isCaptureMode(settings.mode)){e.preventDefault();studio?.capture?.();return;}
 if(!modifier&&!e.altKey&&/^[1-4]$/.test(key)&&shots.length>1){const index=Number(key)-1;if(index<shots.length){e.preventDefault();switchShot(index);return;}}
});
document.addEventListener('keyup',e=>{const key=e.key.toLowerCase();if(axisKeys.includes(key)){axisKeys=axisKeys.filter(k=>k!==key);}});
window.addEventListener('blur',()=>{axisKeys=[];});
let nativeReady=false,closing=false,componentEnded=false,removedCloseSent=false;
function connectNative(){if(componentEnded){closeRemovedScene().catch(e=>status('窗口关闭失败：'+(e.message||e),true));return;}if(window.dshScene3DBoot?.failure)window.pywebview?.api?.failed?.(window.dshScene3DBoot.failure);else if(nativeReady&&window.pywebview?.api?.ready)window.pywebview.api.ready();}
window.addEventListener('pywebviewready',connectNative);
async function closeRemovedScene(){
 poseChat?.dispose();
 if(removedCloseSent)return;
 componentEnded=true;closing=true;drafts.stop();
 document.activeElement?.blur();removalUnlock?.();removalUnlock=null;removalToken='';
 dirty=false;updateDocumentTitle();status('所属组件已移除，正在关闭编辑窗口…');
 const bridge=window.pywebview?.api;
 if(typeof bridge?.discard_removed!=='function'){closing=false;return;}
 removedCloseSent=true;
 try{await bridge.discard_removed();}catch(error){removedCloseSent=false;closing=false;throw error;}
}
window.dshScene3D={async requestClose(){
 if(closing)return;await poseChat?.cancel();closing=true;
 let unlock;
 try{
  if(draftMode){const state=await api('drafts/state/'+channel);if(state.active===false){await closeRemovedScene();return;}}
  const until=Date.now()+30000;
  while((loading||pendingJob)&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,50));
  if(loading||pendingJob)throw Error('当前操作尚未完成，请稍后再次关闭');
  document.activeElement?.blur();await Promise.resolve();while(pendingJob&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,30));if(pendingJob)throw Error('文字更新尚未完成，请稍后再次关闭');unlock=captureLock();
  await objectUI.flush();
  if(draftMode){drafts.mark();await drafts.flush();}
  else if(dirty)throw Error('这是旧版编辑会话，请先保存预设后再关闭');
  dirty=false;await window.pywebview?.api?.close_result(true);
 }catch(e){
  if(componentEnded){status('窗口关闭失败：'+(e.message||e),true);return;}
  if(draftMode){try{const state=await api('drafts/state/'+channel);if(state.active===false){await closeRemovedScene();return;}}catch{}}
  const message='关闭前保存失败：'+(e.message||e);status(message,true);const discard=window.confirm(message+'\n\n仍要关闭吗？未保存到 Sidecar 的临时修改会丢失。');if(discard)dirty=false;await window.pywebview?.api?.close_result(!!discard);}
 finally{unlock?.();closing=false;}
}};
window.addEventListener('beforeunload',e=>{if(!closing&&!componentEnded&&dirty){e.preventDefault();e.returnValue='';}});
let removalUnlock=null,removalToken='',checkingRemoval=false;
if(draftMode)setInterval(async()=>{
 if(checkingRemoval)return;checkingRemoval=true;
 try{const row=await api('drafts/state/'+channel);if(row.active===false){await closeRemovedScene();return;}if(componentEnded)return;if(!row.captureRequest&&removalUnlock){removalUnlock();removalUnlock=null;removalToken='';status('继续编辑');}if(row.captureRequest&&row.captureRequest!==removalToken&&!loading&&!pendingJob){if(!commitDocumentName())throw Error('请先填写场景名称');removalUnlock?.();removalUnlock=captureLock();removalToken=row.captureRequest;try{await objectUI.flush();drafts.mark();await drafts.flush();await api('drafts',{action:'capture-ack',channel,token:removalToken});status('正在等待移除组件的保存选择…');}catch(error){removalToken='';throw error;}}}
 catch{/* A service reconnect must not close a scene or discard local edits. */}finally{checkingRemoval=false;}
},500);
async function start(){try{initialize();initializeControlBridge();const documents=api('scenes');documents.catch(()=>{});const [models,temporary]=await Promise.all([api('catalog'),draftMode?api('drafts/'+channel):Promise.resolve(null),studio.ready]);catalog=models;$('models').replaceChildren(...catalog.filter(row=>!row.hidden).map(row=>{const b=document.createElement('button');b.textContent=row.label;toolsUI.decorateAsset(b,true);b.onclick=safe(()=>{toolsUI.closeAdd();return addObject(row.id);});return b;}));$('primitives').replaceChildren(...Object.entries(primitiveNames).map(([kind,label])=>{const b=document.createElement('button');b.textContent=label;toolsUI.decorateAsset(b,false);b.onclick=safe(()=>{toolsUI.closeAdd();return addObject(kind);});return b;}));documents.then(listDocuments).catch(e=>status('预设列表加载失败：'+e.message,true));
if(draftMode&&temporary.active===false){await closeRemovedScene();return;}
if(draftMode&&!temporary.active)throw Error('临时场景状态无效，请检查 Sidecar 后重试');
if(temporary?.scene){
 documentId=temporary.presetId||'';documentName=temporary.name||'临时场景';isPreset=!!documentId;
 await loadScene(temporary.scene,{resetHistory:true});
}else if(documentId&&documentId!==channel){
 const record=await api('scenes/'+documentId);documentName=record.name;isPreset=true;
 await loadScene(record.scene,{resetHistory:true});
}else{
 documentId='';documentName='临时场景';await addObject('bodykun');history=[JSON.stringify(serialize())];historyIndex=0;
}
await Promise.all(objects.filter(o=>o.userData.text).map(o=>loadTextFont(o.userData.text.font)));await Promise.all((settings.shotTexts||[]).map(t=>loadTextFont(t.font)));studio.renderShots();studio.refreshAlbum().catch(e=>status('截图记录加载失败：'+e.message,true));if(temporary?.scene)dirty=!!temporary.presetDirty;
if(draftMode){drafts.mark();drafts.flush().catch(e=>status('初始草稿保存失败：'+e.message,true));}
nativeReady=true;connectNative();
dirty=!!temporary?.presetDirty;updateDocumentTitle();$('undo').disabled=true;$('redo').disabled=true;status('就绪 · 点击物体或关节编辑，按住轴键调整数值');window.dshScene3DBoot?.ready();notify('dsh-scene3d-ready');}catch(e){const message='编辑器加载失败：'+(e.message||e);status(message,true);window.dshScene3DBoot?.error(message);$('apply').disabled=true;}}
start();
