// Local SVGs and presentation-only controls for the 3D viewport.
const paths={
 lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3',unlock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 7-2M12 14v3',
 chat:'M4 4h16v12H9l-5 4V4zM8 8h8m-8 4h5',
 plus:'M12 5v14M5 12h14',close:'m6 6 12 12M18 6 6 18',
 undo:'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6v3',redo:'m15 5 5 5-5 5M20 10h-9a6 6 0 0 0-6 6v3',
 move:'M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
 rotate:'M20 10a8 8 0 1 0-2 8M20 4v6h-6',scale:'M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5M4 4l6 6m10 10-6-6',
 duplicate:'M8 8h12v12H8zM4 16V4h12',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
 objects:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
 camera:'M3 7h4l2-3h6l2 3h4v13H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 brush:'M14.5 4.5 19.5 9.5 8 21H3v-5zM13 6l5 5',
 pose:'M14 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0M12 6v7M5 8l7 2 7-2m-7 5-5 8m5-8 5 8',
 proportions:'M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4M8 9h8l-1 6 2 6m-8-6-2 6M4 4v16m-2-2 2 2 2-2M18 11h4m-2-2 2 2-2 2',
 light:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
 fit:'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6M8 8h8v8H8z',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 cube:'m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10',
 mirror:'M12 2v20M9 6 3 12l6 6zm6 0 6 6-6 6z',
 joint:'M8 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 0 8-5m-8 13 8 5M16 3h4m-4 18h4',
 reset:'M4 10a8 8 0 1 1 2 8M4 4v6h6',
 capture:'M3 7h4l2-3h6l2 3h4v13H3zM12 10v7m-3-3 3 3 3-3',
 view:'M12 3v18M3 12h18M12 12l7-7M9 5l3-2 3 2M19 9l2 3-2 3',
 front:'M5 4h14v16H5zM5 16h14',back:'M5 4h14v16H5zM5 8h14',
 left:'M5 4h14v16H5zM9 4v16',right:'M5 4h14v16H5zM15 4v16',top:'M4 5h16v14H4zM4 9h16',bottom:'M4 5h16v14H4zM4 15h16',
};
function svg(name){const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))icon.setAttribute(key,value);const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.cube);icon.append(path);return icon;}

export function initializeSceneInterface({busy=()=>false,showModeHelp=()=>{},hideModeHelp=()=>{}}={}){
 const $=id=>document.getElementById(id);
 const mappings={undo:['undo','撤回 (Ctrl+Z)'],redo:['redo','重做 (Ctrl+Shift+Z)'],'toggle-library':['plus','添加物体'],translate:['move','移动'],rotate:['rotate','旋转'],scale:['scale','缩放'],duplicate:['duplicate','复制物体'],remove:['trash','删除物体'],'toggle-inspector':['objects','场景物体'],'toggle-pose':['pose','物体与姿势'],'toggle-shape':['proportions','体型比例'],'toggle-light':['light','环境与光照'],'close-library':['close','关闭添加菜单'],'close-inspector':['close','关闭属性'],'delete-shot':['trash','删除当前镜头'],'reset-pose':['pose','重置姿势'],'flip-object':['mirror','左右翻转整个物体'],mirror:['joint','镜像选中肢体到对应另一侧'],'text-face-once':['camera','文字面向指定镜头一次'],'text-face-follow':['eye','文字持续面向指定镜头'],'text-upright':['view','文字垂直于地面'],apply:['capture','用于生成']};
 function iconButton(button,name,label){if(!button)return;button.replaceChildren(svg(name));button.classList.add('viewport-icon');button.setAttribute('aria-label',label);button.dataset.tooltip=label;button.removeAttribute('title');}
 for(const [id,[name,label]] of Object.entries(mappings))iconButton($(id),name,label);
 for(const id of ['undo','redo'])$(id).setAttribute('aria-keyshortcuts',id==='undo'?'Control+Z':'Control+Shift+Z');
 for(const button of document.querySelectorAll('[data-view]'))iconButton(button,button.dataset.view,button.textContent.trim());
 $('file-menu').dataset.tooltip='文件';
 const tabs=[...document.querySelectorAll('[data-property]')];let activeProperty='objects-panel',restoreProperty=false;
 function setAdd(open,{focus=false}={}){$('library').hidden=!open;$('toggle-library').setAttribute('aria-expanded',String(open));if(open){closeFile();$('models').querySelector('button')?.focus();}if(!open&&focus)$('toggle-library').focus();}
 function setProperty(id,open=true,{focus=false}={}){
  activeProperty=id||activeProperty;$('inspector').hidden=!open;
  for(const panel of document.querySelectorAll('[data-property-content]'))panel.hidden=panel.id!==activeProperty;
  for(const tab of tabs){const selected=open&&tab.dataset.property===activeProperty;tab.setAttribute('aria-expanded',String(selected));tab.setAttribute('aria-pressed',String(selected));}
  $('inspector-title').textContent=tabs.find(b=>b.dataset.property===activeProperty)?.getAttribute('aria-label')||'属性';
  if(!open&&focus)tabs.find(b=>b.dataset.property===activeProperty)?.focus();
  clamp();
 }
 function closeFile(){$('file-options').hidden=true;$('file-menu').setAttribute('aria-expanded','false');$('load-scene').setAttribute('aria-expanded','false');}
 $('toggle-library').addEventListener('click',()=>{if(!busy())setAdd($('library').hidden);});
 $('close-library').addEventListener('click',()=>setAdd(false,{focus:true}));
 for(const tab of tabs)tab.addEventListener('click',()=>{if(!busy())setProperty(tab.dataset.property,$('inspector').hidden||activeProperty!==tab.dataset.property);});
 $('close-inspector').addEventListener('click',()=>setProperty(activeProperty,false,{focus:true}));
 $('file-menu').addEventListener('click',()=>setAdd(false));
 $('load-scene').addEventListener('click',()=>{if(busy())return;closeFile();window.dispatchEvent(new Event('scene3d-open-library'));});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('#library,#toggle-library'))setAdd(false);});
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!document.querySelector('dialog[open]')){
   if(!$('library').hidden){e.preventDefault();e.stopImmediatePropagation();setAdd(false,{focus:true});}
   else if(!$('inspector').hidden){e.preventDefault();e.stopImmediatePropagation();setProperty(activeProperty,false,{focus:true});}
  }
  if(e.key==='Tab'&&['CANVAS','BODY'].includes(e.target.tagName)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!document.querySelector('dialog[open]')){
   if(document.body.classList.contains('photo-mode'))return;e.preventDefault();const hide=!$('tool-rail').hidden;$('scene-object-rail').hidden=hide;$('tool-rail').hidden=hide;$('panel-rail').hidden=hide;
   if(hide){restoreProperty=!$('inspector').hidden;setProperty(activeProperty,false);setAdd(false);}else if(restoreProperty)setProperty(activeProperty,true);
  }
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&e.target.closest('#library,#file-options,#view-menu')){
   const menu=e.target.closest('#library,#file-options,#view-menu');const buttons=[...menu.querySelectorAll('button,summary')].filter(b=>!b.disabled&&b.getClientRects().length);if(!buttons.length)return;
   e.preventDefault();const index=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length;buttons[next].focus();
  }
 });
 function clamp(){const panel=$('inspector');if(panel.hidden||!panel.dataset.moved)return;const r=panel.getBoundingClientRect();panel.style.left=Math.max(58,Math.min(innerWidth-r.width-58,r.left))+'px';panel.style.top=Math.max(68,Math.min(innerHeight-r.height-12,r.top))+'px';}
 const head=$('inspector').querySelector('[data-drag-handle]');
 head.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button')||busy())return;
  const panel=$('inspector'),r=panel.getBoundingClientRect(),x=event.clientX,y=event.clientY;event.preventDefault();panel.dataset.moved='true';
  const move=e=>{panel.style.right='auto';panel.style.left=r.left+e.clientX-x+'px';panel.style.top=r.top+e.clientY-y+'px';clamp();};
  const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
 });
 window.addEventListener('resize',clamp);
 const tooltip=$('tool-tooltip');let tooltipOwner;
 function hideTooltip(){tooltip.hidden=true;hideModeHelp();tooltipOwner=null;}
 function showTooltip(button){if(button.disabled)return;tooltipOwner=button;hideModeHelp();if(['translate','rotate','scale'].includes(button.id)){tooltip.hidden=true;showModeHelp(button.id,button);return;}tooltip.textContent=button.dataset.tooltip;tooltip.hidden=false;const r=button.getBoundingClientRect(),t=tooltip.getBoundingClientRect();let x=r.right+8,y=r.top+(r.height-t.height)/2;if(r.left>innerWidth/2)x=r.left-t.width-8;if(r.top<62){x=r.left+(r.width-t.width)/2;y=r.bottom+8;}tooltip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,x))+'px';tooltip.style.top=Math.max(8,Math.min(innerHeight-t.height-8,y))+'px';}
 document.addEventListener('pointerover',e=>{const b=e.target.closest('[data-tooltip]');if(b&&b!==tooltipOwner)showTooltip(b);});
 document.addEventListener('pointerout',e=>{if(tooltipOwner&&!tooltipOwner.contains(e.relatedTarget))hideTooltip();});
 document.addEventListener('focusin',e=>{const b=e.target.closest('[data-tooltip]');if(b&&b.matches(':focus-visible'))showTooltip(b);});
 document.addEventListener('focusout',hideTooltip);document.addEventListener('pointerdown',hideTooltip);window.addEventListener('blur',hideTooltip);window.addEventListener('resize',hideTooltip);
 setProperty(activeProperty,false);setAdd(false);
 return {closeAdd:()=>setAdd(false),clamp,mode:name=>{for(const id of ['translate','rotate','scale'])$(id).setAttribute('aria-pressed',String(id===name));},decorateAsset(button,model){button.prepend(svg(model?'pose':'cube'));button.classList.add('asset-row');}};
}

// Hide reviewed UI controls only. Keep deformation bones and their descendants intact.
// A resource replacement must be reviewed again rather than inheriting an old exclusion list.
export function jointControlBones(object,model){
 const rule=model?.hiddenControls;
 const hidden=new Set(rule&&rule.asset===model.file&&rule.rigRevision===(model.rigRevision||0)?rule.bones:[]);
 const bones=[];object?.traverse(node=>{if(node.isBone&&!hidden.has(node.name)&&!(object.userData.firstPersonBody&&/^DEF-spine00[456]$/.test(node.name)))bones.push(node);});return bones;
}

export function sceneIcon(name){return svg(name);}
