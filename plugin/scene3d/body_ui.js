import {sceneIcon} from './interface.js';
import {BODY_FIELDS,bodyShapeSnapshot,applyBodyShape,normalizeBodyShape} from './body.js';
const views=new Map();
export function flushBodyShapeInputs(){for(const view of views.values())view.flush();}

export function renderBodyShape(container,root,{busy=()=>false,preview=()=>{},commit=()=>{},error=()=>{}}={}){
 views.get(container)?.dispose();views.delete(container);
 container.replaceChildren();const shape=bodyShapeSnapshot(root);
 if(!shape){const note=document.createElement('p');note.className='shape-note';note.textContent=root?'体型调节目前支持 BodyKun、BodyChan 男女素体。':'请先选择一个素体。';container.append(note);return;}
 const header=document.createElement('div');header.className='shape-toolbar';
 const sync=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=shape.linked;sync.append(check,'左右同步');
 const reset=document.createElement('button');reset.append(sceneIcon('reset'));reset.className='viewport-icon';reset.dataset.tooltip='重置体型，保留当前姿势';reset.setAttribute('aria-label','重置体型');reset.type='button';header.append(sync,reset);container.append(header);
 const note=document.createElement('p');note.className='shape-note';note.textContent='100% 为原始比例；体型随场景保存，重置体型会保留当前姿势。';container.append(note);
 let pending=null,frame=0;
 views.set(container,{flush:()=>flush(),dispose:()=>{flush();cancelAnimationFrame(frame);}});
 function flush(){if(!pending)return;const next=pending;pending=null;cancelAnimationFrame(frame);frame=0;applyBodyShape(root,next);preview();}
 function update(next,done=false){if(busy())return;pending=next;if(done){flush();commit();}else if(!frame)frame=requestAnimationFrame(()=>{frame=0;try{flush();}catch(e){error(e);}});}
 check.addEventListener('change',()=>{const next=bodyShapeSnapshot(root);next.linked=check.checked;if(next.linked)for(const [key,,,,,paired] of BODY_FIELDS)if(paired)next.values[key+'R']=next.values[key+'L'];update(next,true);renderBodyShape(container,root,{busy,preview,commit,error});});
 reset.addEventListener('click',()=>{update(normalizeBodyShape(undefined,root.userData.model),true);renderBodyShape(container,root,{busy,preview,commit,error});});
 const groups=new Map();
 for(const [key,label,group,min,max,paired,female] of BODY_FIELDS){
  if(female&&root.userData.model!=='bodychan')continue;
  if(!groups.has(group)){const details=document.createElement('details'),summary=document.createElement('summary');details.className='shape-group';details.open=false;summary.textContent=group;details.append(summary);setupAnimatedDisclosure(details,{beforeOpen:()=>{for(const other of groups.values())if(other!==details)setDisclosureOpen(other,false);}});container.append(details);groups.set(group,details);}
  for(const side of paired?(shape.linked?['L']:['L','R']):['']){
   const name=key+side,title=group+' · '+label+(paired&&!shape.linked?(side==='L'?' · 左':' · 右'):''),row=document.createElement('div');row.className='shape-row';
   const text=document.createElement('label');text.textContent=label+(paired&&!shape.linked?(side==='L'?' · 左':' · 右'):'');
   const number=document.createElement('input'),resetOne=document.createElement('button');
   number.type='number';for(const input of [number]){input.min=String(min*100);input.max=String(max*100);input.step='1';input.value=String(Math.round(shape.values[name]*100));input.setAttribute('aria-label',title+' 百分比');}
   number.id='shape-'+name;text.htmlFor=number.id;number.title=`${Math.round(min*100)}–${Math.round(max*100)}%`;
   resetOne.append(sceneIcon('reset'));resetOne.className='shape-reset';resetOne.dataset.tooltip='恢复 100%';resetOne.type='button';resetOne.setAttribute('aria-label','重置 '+title);resetOne.title='恢复 100%';
   const change=(value,done)=>{
    if(!Number.isFinite(value)||value<min*100||value>max*100){number.value=String(Math.round(bodyShapeSnapshot(root).values[name]*100));error(new Error(title+'需在 '+Math.round(min*100)+'–'+Math.round(max*100)+'% 之间'));return;}
    const next=pending||bodyShapeSnapshot(root);next.values[name]=value/100;if(paired&&next.linked)next.values[key+'L']=next.values[key+'R']=value/100;
    number.value=String(value);update(next,done);
   };
   number.addEventListener('input',()=>{const n=number.value.trim()===''?NaN:Number(number.value);if(Number.isFinite(n)&&n>=min*100&&n<=max*100)change(n,false);});
   number.addEventListener('change',()=>change(number.value.trim()===''?NaN:Number(number.value),true));
   number.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();change(number.value.trim()===''?NaN:Number(number.value),true);number.blur();}});
   resetOne.addEventListener('click',()=>change(100,true));
   row.append(text,number,resetOne);groups.get(group).append(row);
  }
 }
}

const disclosures=new WeakMap();
export function setupAnimatedDisclosure(details,{beforeOpen=()=>{}}={}){
 const state={wanted:details.open,animation:null,beforeOpen};disclosures.set(details,state);
 details.querySelector(':scope > summary').addEventListener('click',event=>{event.preventDefault();setDisclosureOpen(details,!state.wanted);});
}
function setDisclosureOpen(details,open){
 const state=disclosures.get(details);if(!state){details.open=open;return;}if(state.wanted===open)return;
 const start=details.getBoundingClientRect().height;state.animation?.cancel();state.wanted=open;if(open)state.beforeOpen();
 details.open=true;details.style.height='';const end=open?details.getBoundingClientRect().height:details.querySelector(':scope > summary').getBoundingClientRect().height;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||typeof details.animate!=='function'){details.open=open;return;}
 details.style.overflow='hidden';const animation=details.animate([{height:start+'px'},{height:end+'px'}],{duration:180,easing:'ease-in-out'});state.animation=animation;
 animation.onfinish=()=>{if(state.animation!==animation)return;details.open=state.wanted;details.style.height='';details.style.overflow='';state.animation=null;};
}
