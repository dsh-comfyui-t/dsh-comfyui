import {syncSceneSelectInputs} from './select_input.js';
import {captureTier,inferCaptureTier,captureAspect,captureBase,captureAtTier,captureFromPreset,captureFromAspect,swapCaptureRatio,captureRatioParts,ratioText,capturePresetOptions} from './capture_size.js';
import {isCaptureMode} from './camera_modes.js';
import {bindGroundControls} from './ground_controls.js';
import {resizeFrameSettings} from './frame_resize.js';
import {sceneIcon} from './interface.js';
import {loadTextFont,filterCSS} from './text.js';
const $=id=>document.getElementById(id);
const buttonIcon=(id,icon,label)=>{const b=$(id);b.replaceChildren(sceneIcon(icon));b.classList.add('viewport-icon');b.dataset.tooltip=label;b.setAttribute('aria-label',label);};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function initializeCameraStudio(hooks){
 const {get,change,changeGlobal,api,job,error,selectShot,addText,capture,apply,commit}=hooks;
 let album=[],viewed=null,reference=null,albumEpoch=0,presets=[],ratioOptions=[],customRatioOpen=false,customInputAspect=null,lastShotId;
 for(const [id,icon,label] of [['fov-reset','reset','重置透视强度为 35'],['fisheye-reset','reset','重置鱼眼透视为 0'],['filter-brightness-reset','reset','重置亮度为 1'],['filter-contrast-reset','reset','重置对比度为 1'],['filter-saturation-reset','reset','重置饱和度为 1'],['grid-size-reset','reset','重置网格大小为 1'],['toggle-camera','camera','镜头和照片'],['add-shot','plus','添加镜头'],['camera-tab-settings','proportions','镜头设置'],['camera-tab-gallery','objects','查看照片'],['camera-tab-global','light','全局控制']])buttonIcon(id,icon,label);
 const guard=fn=>async(...args)=>{try{return await fn(...args);}catch(e){error(e);}};
 const request=(action,body={})=>{const {channel,documentId}=get();return api('captures',{action,channel,sceneId:documentId,...body});};
 function open(value){$('camera-sidebar').hidden=!value;document.body.classList.toggle('camera-sidebar-open',value);$('toggle-camera').setAttribute('aria-expanded',String(value));$('toggle-camera').setAttribute('aria-pressed',String(value));$('toggle-camera').classList.toggle('selected',value);if(value){$('inspector').hidden=true;$('library').hidden=true;}}
 function tab(name){$('camera-settings').hidden=name!=='settings';$('camera-gallery').hidden=name!=='gallery';$('camera-global').hidden=name!=='global';$('camera-tab-global').setAttribute('aria-pressed',String(name==='global'));$('camera-tab-settings').setAttribute('aria-pressed',String(name==='settings'));$('camera-tab-gallery').setAttribute('aria-pressed',String(name==='gallery'));if(name==='gallery')refreshAlbum().catch(error);}
 $('toggle-camera').onclick=()=>open($('camera-sidebar').hidden);
 $('camera-tab-settings').onclick=()=>tab('settings');$('camera-tab-gallery').onclick=()=>tab('gallery');$('camera-tab-global').onclick=()=>tab('global');
 function syncPreset(){
  const {settings,shots,activeShot}=get(),shotId=shots[activeShot]?.id;if(lastShotId!==shotId){customRatioOpen=false;customInputAspect=null;lastShotId=shotId;}
  if(presets.length)settings.captureTier=inferCaptureTier(settings,presets);
  const base=captureBase(settings),option=ratioOptions.find(row=>Math.abs(row.width-base[0])<.01&&Math.abs(row.height-base[1])<.01&&Math.abs(row.width/row.height-captureAspect(settings))<1e-8);
  $('size-preset').value=!customRatioOpen&&option?option.value:'custom';$('custom-ratio').hidden=$('size-preset').value!=='custom';$('ratio-error').hidden=true;
  if(!customRatioOpen||customInputAspect===null||Math.abs(customInputAspect-captureAspect(settings))>1e-8){const [width,height]=captureRatioParts(settings);$('ratio-width').value=width;$('ratio-height').value=height;customInputAspect=null;}
  $('capture-tier').value=String(captureTier(settings));for(const row of $('capture-tier').options){try{captureAtTier(settings,Number(row.value));row.disabled=false;}catch{row.disabled=true;}}
  $('capture-dimensions').textContent='实际输出 '+settings.width+' × '+settings.height+' px';
  renderFrameLabel();syncSceneSelectInputs();
 }
 function renderFrameLabel(){const {settings,shots,activeShot}=get(),base=captureBase(settings),option=ratioOptions.find(row=>Math.abs(row.width-base[0])<.01&&Math.abs(row.height-base[1])<.01&&Math.abs(row.width/row.height-captureAspect(settings))<1e-8),label=option&&!customRatioOpen?option.label.split(' · ')[0]:ratioText(settings);$('frame-label').textContent=(shots[activeShot]?.name||'当前镜头')+' · '+label;$('camera-frame').setAttribute('aria-label','当前镜头取景比例 '+label);}

 function renderShots(){
  const {shots,activeShot,settings}=get();
  $('camera-buttons').replaceChildren(...shots.map((s,i)=>{const b=document.createElement('button');b.className='camera-number viewport-icon';b.append(sceneIcon('camera'),document.createTextNode(String(i+1)));b.setAttribute('aria-label','镜头 '+(i+1));b.dataset.tooltip=s.name;b.setAttribute('aria-pressed',String(i===activeShot));b.onclick=()=>selectShot(i);const slot=document.createElement('div');slot.className='camera-slot';slot.append(b);if(i===activeShot&&isCaptureMode(settings.mode)){const locked=settings.viewLocked===true,lock=document.createElement('button');lock.id='camera-view-lock';lock.className='viewport-icon camera-view-lock';lock.append(sceneIcon(locked?'lock':'unlock'));lock.setAttribute('aria-label',locked?'解锁视角':'锁定视角');lock.dataset.tooltip=locked?'解锁视角':'锁定视角';lock.setAttribute('aria-pressed',String(locked));lock.onclick=()=>{change({viewLocked:get().settings.viewLocked!==true});$('camera-view-lock')?.focus({preventScroll:true});};slot.append(lock);const ratio=settings.lockRatio!==false,button=document.createElement('button');button.className='viewport-icon camera-ratio-lock';button.id='camera-ratio-lock';button.append(sceneIcon(ratio?'lock':'unlock'));button.setAttribute('aria-label',ratio?'解除比例锁定':'锁定截图比例');button.dataset.tooltip=ratio?'解除比例锁定':'锁定截图比例';button.setAttribute('aria-pressed',String(ratio));button.onclick=()=>change({lockRatio:!ratio});slot.append(button);}return slot;}));
  $('add-shot').disabled=shots.length>=4;$('add-shot').dataset.tooltip=shots.length>=4?'最多 4 个镜头':'添加镜头';
  for(const id of ['fov','fisheye','fov-reset','fisheye-reset'])$(id).disabled=!!settings.orthographic;
  syncPreset();$('lock-ratio').checked=settings.lockRatio!==false;$('camera-mode').value=settings.mode||'view';document.body.classList.toggle('photo-mode',isCaptureMode(settings.mode));
  $('camera-frame').hidden=!isCaptureMode(settings.mode);$('frame-roll-display').hidden=!isCaptureMode(settings.mode);
  $('camera-mode-purpose').textContent=settings.mode==='firstPerson'?'从男性素体头部的固定位置观察与拍摄。素体不显示头颈，可在视角模式调整其姿势和位置。':settings.mode==='photo'?'按取景框构图与拍摄，框外画面变暗；尺寸、滤镜、文字和截图记录使用当前镜头的设置。':'自由观察、摆放物体和编辑姿势，不显示取景框。';
  $('camera-mode-controls').hidden=!isCaptureMode(settings.mode);$('camera-mode-controls').textContent=(settings.mode==='firstPerson'?'左键拖动调整朝向，WASD 水平移动；滚轮调透视强度，空格+滚轮或 ↑/↓ 调高度。':'左键转动视角，右键平移，滚轮缩放。')+' 按住 R + 滚轮或 ↑/↓ 倾斜取景框（每次 1°，Shift 为 5°），Ctrl+R 重置。镜头下方的锁图标可锁定视角。';
  for(const [id,key] of [['filter-style','style'],['filter-brightness','brightness'],['filter-contrast','contrast'],['filter-saturation','saturation']])$(id).value=settings.filter?.[key]??(key==='style'?'none':1);
  const canvas=$('stage').querySelector('canvas');if(canvas)canvas.style.filter=filterCSS(settings.filter);
  const ground=get().groundGrid;if(ground){$('grid-visible').checked=ground.visible;$('grid-color').value=ground.lineColor||'#8b8e93';$('ground-color').value=ground.floorColor||'#ffffff';$('grid-size').value=ground.size;$('grid-pattern').value=ground.pattern;$('grid-capture').checked=ground.capture;$('grid-radius').value=ground.radius;$('ground-transparent').checked=ground.pattern==='mirror'?false:ground.transparent;$('ground-transparent').disabled=ground.pattern==='mirror';$('ground-ripples').checked=ground.ripples;$('ground-ripples-row').hidden=ground.pattern!=='mirror';$('ripple-controls').hidden=ground.pattern!=='mirror';$('ground-ripples-card').hidden=ground.pattern!=='mirror';$('ripple-size').value=ground.rippleSize;$('ripple-height').value=ground.rippleHeight;$('ripple-width').value=ground.rippleWidth;$('ripple-density').value=ground.rippleDensity;$('floor').checked=ground.pattern==='mirror'?true:ground.floorVisible!==false;$('floor').disabled=ground.pattern==='mirror';}
  renderOverlay();syncSceneSelectInputs();
 }
 function renderOverlay(){
  renderFrameLabel();
  const {settings}=get(),frame=$('camera-frame'),overlay=$('shot-text-overlay');
  for(const key of ['left','top','width','height','transform'])overlay.style[key]=frame.style[key];
  overlay.replaceChildren(...(settings.shotTexts||[]).map(t=>{const span=document.createElement('span');span.textContent=t.content;span.style.left=(t.x*100)+'%';span.style.top=(t.y*100)+'%';span.style.fontFamily='SceneNoto-'+t.font;span.style.fontSize=(t.size*parseFloat(frame.style.height)/1024)+'px';span.style.color=t.color;span.style.textShadow=t.shadow?'0 1px 4px #000':'none';return span;}));
 }
 function renderTextEditors(){
  $('shot-text-editors').replaceChildren(...(get().settings.shotTexts||[]).map((text,index)=>{
   const row=document.createElement('section');row.className='shot-text-editor';
   const area=document.createElement('textarea');area.value=text.content;area.maxLength=256;area.setAttribute('aria-label','镜头文字 '+(index+1));area.onchange=()=>{text.content=area.value;change({shotTexts:get().settings.shotTexts});renderOverlay();};row.append(area);
   for(const [key,label,min,max,step] of [['size','字号',8,256,1],['x','水平位置',0,1,.01],['y','垂直位置',0,1,.01]]){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='number';Object.assign(input,{min,max,step,value:text[key]});input.onchange=()=>{text[key]=clamp(Number(input.value),min,max);change({shotTexts:get().settings.shotTexts});renderOverlay();};l.append(input);row.append(l);}
   const color=document.createElement('input');color.type='color';color.value=text.color;color.setAttribute('aria-label','镜头文字颜色');color.onchange=()=>{text.color=color.value;change({shotTexts:get().settings.shotTexts});renderOverlay();};row.append(color);
   const shadow=document.createElement('label');shadow.textContent='文字阴影';const check=document.createElement('input');check.type='checkbox';check.checked=!!text.shadow;check.onchange=()=>{text.shadow=check.checked;change({shotTexts:get().settings.shotTexts});renderOverlay();};shadow.prepend(check);row.append(shadow);
   const remove=document.createElement('button');remove.textContent='删除文字';remove.onclick=()=>{change({shotTexts:get().settings.shotTexts.filter((_,i)=>i!==index)});renderTextEditors();};row.append(remove);return row;
  }));
 }
 bindGroundControls($,changeGlobal);
 $('grid-size-reset').onclick=()=>changeGlobal({size:1});
 $('fov-reset').onclick=()=>change({fov:35});$('fisheye-reset').onclick=()=>change({fisheye:0});
 for(const key of ['brightness','contrast','saturation'])$('filter-'+key+'-reset').onclick=()=>change({filter:{...get().settings.filter,[key]:1}});
 $('lock-ratio').onchange=()=>change({lockRatio:$('lock-ratio').checked});
 $('camera-mode').onchange=guard(async()=>{try{if(hooks.changeMode)await hooks.changeMode($('camera-mode').value);else change({mode:$('camera-mode').value});}finally{renderShots();}});
 for(const [id,key] of [['filter-style','style'],['filter-brightness','brightness'],['filter-contrast','contrast'],['filter-saturation','saturation']]){
  const field=$(id),preview=()=>{const raw=key==='style'?field.value:Number(field.value);if(key!=='style'&&(!field.value.trim()||!Number.isFinite(raw)))return;const state=get().settings;state.filter={...state.filter,[key]:raw};const canvas=$('stage').querySelector('canvas');if(canvas)canvas.style.filter=filterCSS(state.filter);};
  if(key!=='style')field.addEventListener('input',preview);
  field.addEventListener('change',()=>{preview();change({filter:{...get().settings.filter}});renderShots();});
 }
 $('add-text').onclick=guard(()=>job(async()=>{
  const content=$('new-text-content').value.trim();if(!content)throw Error('请填写文字');const font=$('new-text-font').value;
  if($('new-text-scope').value==='object')await addText({content,font});
  else{await loadTextFont(font);const texts=[...(get().settings.shotTexts||[])];if(texts.length>=16)throw Error('每个镜头最多 16 段文字');texts.push({id:crypto.randomUUID(),content,font,size:48,x:.5,y:.85,color:'#ffffff',shadow:true});change({shotTexts:texts});renderShots();renderTextEditors();}
 }));

 async function refreshAlbum(){
  const epoch=++albumEpoch,result=await request('list');if(epoch!==albumEpoch)return;album=result.items;reference=result.reference||null;if(viewed&&!album.some(row=>row.id===viewed.id))viewed=null;renderAlbum();
 }
 function renderAlbum(){
  $('gallery-scope').textContent=get().documentId?'当前场景的照片记录':'临时照片 · 随当前组件保留，保存场景时一并转存';
  $('capture-list').replaceChildren(...album.map(row=>{const b=document.createElement('button');b.className='capture-row'+(viewed&&viewed.id===row.id?' selected':'');b.title=row.name;b.setAttribute('aria-pressed',String(!!(viewed&&viewed.id===row.id)));const img=document.createElement('img');img.src=row.url;img.alt=row.name;img.loading='lazy';b.append(img);if(reference&&reference.id===row.id){const badge=document.createElement('span');badge.className='capture-badge';badge.setAttribute('aria-label','已设为参考图');badge.append(sceneIcon('brush'),sceneIcon('eye'));b.append(badge);}const label=document.createElement('span');label.textContent=row.width+'×'+row.height;b.append(label);b.onclick=()=>selectPhoto(row);return b;}));
  if(!album.length){const p=document.createElement('p');p.textContent='还没有照片，点击拍摄当前镜头。';$('capture-list').append(p);}
  showPreview();
 }
 function selectPhoto(row){viewed=row;renderAlbum();}
 function showPreview(){const el=$('photo-preview');if(!viewed){el.hidden=true;$('capture-use').disabled=true;return;}el.hidden=false;$('photo-preview-image').src=viewed.url;$('capture-use').disabled=false;}
 function clearSelection(){viewed=null;renderAlbum();}
 $('photo-preview').addEventListener('pointerdown',event=>{if(event.target===$('photo-preview'))clearSelection();});
 $('camera-sidebar').addEventListener('pointerdown',event=>{if(!viewed)return;if(event.target.closest('button,#capture-list,#photo-preview'))return;clearSelection();});
 $('capture-use').onclick=guard(()=>job(async()=>{if(!viewed)return;const result=await request('apply',{id:viewed.id});await apply(result.asset);reference=result.reference||null;renderAlbum();}));
 $('photo-preview-download').onclick=()=>{if(!viewed)return;const a=document.createElement('a');a.href=viewed.url;a.download=(viewed.name.replace(/[\\/:*?"<>|]/g,'_')||'照片')+'.png';a.click();};
 $('photo-preview-delete').onclick=guard(()=>job(async()=>{if(!viewed)return;if(!await hooks.confirm('删除“'+viewed.name+'”这张照片？'))return;await request('delete',{id:viewed.id});viewed=null;await refreshAlbum();}));
 $('size-preset').onchange=guard(()=>{const value=$('size-preset').value;customRatioOpen=value==='custom';customInputAspect=null;if(customRatioOpen){syncPreset();return;}const row=ratioOptions.find(row=>row.value===value);try{if(row)change(captureFromPreset(get().settings,row.width,row.height));}finally{syncPreset();}});
 $('capture-tier').onchange=guard(()=>{try{change(captureAtTier(get().settings,Number($('capture-tier').value)));}finally{syncPreset();}});
 $('swap-size').onclick=guard(()=>{customInputAspect=null;try{change(swapCaptureRatio(get().settings));}finally{syncPreset();}});
 for(const id of ['ratio-width','ratio-height'])$(id).onchange=()=>{try{const width=Number($('ratio-width').value),height=Number($('ratio-height').value);if(!(width>0&&height>0))throw Error('请填写有效的宽高比例');const values=captureFromAspect(get().settings,width/height);customRatioOpen=true;customInputAspect=width/height;change(values);syncPreset();}catch(e){customInputAspect=captureAspect(get().settings);$('ratio-error').textContent=e.message+'；画面保留上一个有效比例。';$('ratio-error').hidden=false;}};
 const ready=fetch('/scene3d/size_presets.json').then(r=>{if(!r.ok)throw Error('标准比例预设读取失败');return r.json();}).then(rows=>{presets=rows;ratioOptions=capturePresetOptions(rows);for(const row of ratioOptions){const option=document.createElement('option');option.value=row.value;option.textContent=row.label;$('size-preset').append(option);}syncPreset();}).catch(error);
 for(const edge of ['left','right','top','bottom']){
  const handle=document.createElement('span');handle.className='frame-resize-edge edge-'+edge;handle.dataset.tooltip='拖动调整取景比例；锁定比例时调整取景范围';handle.setAttribute('aria-hidden','true');$('camera-frame').append(handle);
  handle.onpointerdown=event=>{
   if(event.button!==0)return;event.preventDefault();event.stopPropagation();const initial={...get().settings},frame=$('camera-frame'),rect={width:parseFloat(frame.style.width),height:parseFloat(frame.style.height)},x=event.clientX,y=event.clientY;
   const move=e=>{const viewport=$('viewport').getBoundingClientRect();try{change(resizeFrameSettings(initial,rect,viewport,edge,e.clientX-x,e.clientY-y,$('lock-ratio').checked),false);}catch{/* Keep the last valid frame when dragging beyond output limits. */}};
   const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);commit();};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  };
 }
 return {ready,capture,renderShots(){renderShots();renderTextEditors();},renderOverlay,refreshAlbum,async record(asset){const {shots,activeShot}=get();const row=await request('create',{asset,shotId:shots[activeShot].id,name:shots[activeShot].name+' · '+new Date().toLocaleTimeString()});await refreshAlbum();open(true);tab('gallery');return row;},open,request,closeViewer:()=>$('capture-viewer').close()};
}
