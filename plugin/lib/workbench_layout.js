/** Workbench layout data and interactions. Only known module IDs are persisted. */
export const WORKBENCH_MODULES=Object.freeze({prompt:'提示词',model:'模型配置',parameters:'采样设置',preview:'图片预览',post:'生成后控制'});
export function defaultWorkbenchLayout(){return {version:1,rows:[{id:'row-preview-model',modules:['preview','model'],ratio:.6},{id:'row-prompt-parameters',modules:['prompt','parameters'],ratio:.7},{id:'row-post',modules:['post'],ratio:.5}]};}
export function normalizeWorkbenchLayout(value){
 if(!value||value.version!==1||!Array.isArray(value.rows))return defaultWorkbenchLayout();
 const seen=new Set(),ids=new Set(),rows=[];
 for(const row of value.rows.slice(0,8)){
  if(!row||!Array.isArray(row.modules))continue;
  const modules=row.modules.filter(id=>Object.prototype.hasOwnProperty.call(WORKBENCH_MODULES,id)&&!seen.has(id)).filter((id,i,a)=>a.indexOf(id)===i).slice(0,2);
  if(!modules.length)continue;modules.forEach(id=>seen.add(id));
  let id=typeof row.id==='string'&&/^[a-z0-9-]{1,64}$/.test(row.id)?row.id:'row-'+modules[0];
  while(ids.has(id))id+='-next';ids.add(id);
  const ratio=typeof row.ratio==='number'&&Number.isFinite(row.ratio)?Math.max(.3,Math.min(.7,row.ratio)):.5;
  rows.push({id,modules,ratio});
 }
 for(const moduleId of Object.keys(WORKBENCH_MODULES))if(!seen.has(moduleId)){
  let id='row-missing-'+moduleId;while(ids.has(id))id+='-next';ids.add(id);
  rows.push({id,modules:[moduleId],ratio:.5});
 }
 return {version:1,rows};
}
export function readWorkbenchLayout(storage,key){try{return normalizeWorkbenchLayout(JSON.parse(storage.getItem(key)||'null'));}catch{return defaultWorkbenchLayout();}}
export function resizeWorkbenchRow(value,rowId,ratio){
 const layout=normalizeWorkbenchLayout(value);if(!Number.isFinite(ratio))return layout;
 return {...layout,rows:layout.rows.map(row=>row.id===rowId&&row.modules.length===2?{...row,ratio:Math.max(.3,Math.min(.7,ratio))}:row)};
}
export function moveWorkbenchModule(value,moduleId,targetId,placement){
 const layout=normalizeWorkbenchLayout(value);
 if(moduleId===targetId||!Object.prototype.hasOwnProperty.call(WORKBENCH_MODULES,moduleId)||!Object.prototype.hasOwnProperty.call(WORKBENCH_MODULES,targetId)||!['before','after','left','right'].includes(placement))return layout;
 const source=layout.rows.find(row=>row.modules.includes(moduleId)),target=layout.rows.find(row=>row.modules.includes(targetId));
 if(!source||!target)return layout;
 const rows=layout.rows.map(row=>({...row,modules:[...row.modules]})),from=rows.find(row=>row.id===source.id),to=rows.find(row=>row.id===target.id);
 if(placement==='left'||placement==='right'){
  const pair=placement==='left'?[moduleId,targetId]:[targetId,moduleId];
  if(from===to){
   // Reordering inside a pair keeps each module's width with it.
   if(to.modules.length===2){to.modules=pair;to.ratio=1-to.ratio;}
   else to.modules=pair;
   return normalizeWorkbenchLayout({...layout,rows});
  }
  if(to.modules.length===2){
   // Dropping into the left/right half of a full row replaces that slot.
   // The replaced module takes the dragged module's old slot; both row shares stay put.
   const sourceIndex=from.modules.indexOf(moduleId),targetIndex=to.modules.indexOf(targetId);
   if(sourceIndex<0||targetIndex<0)return layout;
   from.modules[sourceIndex]=targetId;to.modules[targetIndex]=moduleId;
  }else{
   // A single target row still becomes a two-module row.
   from.modules=from.modules.filter(id=>id!==moduleId);
   to.modules=pair;
  }
 }else{
  from.modules=from.modules.filter(id=>id!==moduleId);
  const index=rows.indexOf(to)+(placement==='after'?1:0);
  rows.splice(index,0,{id:'row-moved-'+moduleId,modules:[moduleId],ratio:.5});
 }
 return normalizeWorkbenchLayout({...layout,rows:rows.filter(row=>row.modules.length)});
}
export function promptChatReplaces(share,paired,stacked=false){return !!paired&&!stacked&&share<=.500001;}

export function useWorkbenchLayout({value,onChange,active=true,renderHeader,onHeaderClick}){
 const layout=normalizeWorkbenchLayout(value),latest=React.useRef({layout,onChange}),host=React.useRef(null),dragging=React.useRef(null),resizing=React.useRef(null);
 latest.current={layout,onChange};
 const [width,setWidth]=React.useState(1000),[dragId,setDragId]=React.useState(null),[drop,setDrop]=React.useState(null);
 const stacked=width<780;
 const endResize=()=>{
  const state=resizing.current;if(!state)return;resizing.current=null;
  if(state.element.hasPointerCapture?.(state.pointer))state.element.releasePointerCapture(state.pointer);
  document.body.style.userSelect=state.userSelect;
 };
 React.useEffect(()=>{
  const element=host.current;if(!active||!element)return;
  const measure=()=>setWidth(element.getBoundingClientRect().width);measure();
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;observer?.observe(element);
  window.addEventListener('resize',measure);
  window.addEventListener('blur',endResize);
  return()=>{observer?.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('blur',endResize);endResize();};
 },[active]);
 const finishDrag=()=>{dragging.current=null;setDragId(null);setDrop(null);};
 const updateRatio=(row,ratio)=>latest.current.onChange(resizeWorkbenchRow(latest.current.layout,row.id,ratio));
 function startResize(row,event){
  if(event.button!==0||stacked)return;event.preventDefault();endResize();
  const element=event.currentTarget,box=element.parentElement.getBoundingClientRect();
  resizing.current={pointer:event.pointerId,element,left:box.left,width:box.width,userSelect:document.body.style.userSelect};
  document.body.style.userSelect='none';element.setPointerCapture(event.pointerId);
 }
 function moveResize(row,event){
  const state=resizing.current;if(!state||state.pointer!==event.pointerId)return;
  updateRatio(row,(event.clientX-state.left)/state.width);
 }
 function dropInfo(moduleId,event){
  const moduleElement=event.currentTarget,rowElement=moduleElement.closest('.cc-workbench-row');
  if(!rowElement)return {targetId:moduleId,placement:'before',replace:false};
  const box=rowElement.getBoundingClientRect(),x=(event.clientX-box.left)/Math.max(box.width,1),y=(event.clientY-box.top)/Math.max(box.height,1);
  if(y<.22)return {targetId:moduleId,placement:'before',replace:false};
  if(y>.78)return {targetId:moduleId,placement:'after',replace:false};
  const modules=[...rowElement.children].filter(el=>el.classList?.contains('cc-workbench-module')).map(el=>el.dataset.module).filter(Boolean);
  if(modules.length===2){
   // Left/right of a full row means replace the module occupying that half.
   return {targetId:modules[x<.5?0:1],placement:x<.5?'left':'right',replace:true};
  }
  return {targetId:moduleId,placement:x<.5?'left':'right',replace:false};
 }
 function over(moduleId,event){
  if(!dragging.current||dragging.current===moduleId)return;event.preventDefault();event.dataTransfer.dropEffect='move';
  const info=dropInfo(moduleId,event),next={target:info.targetId,placement:info.placement,replace:info.replace};setDrop(old=>old?.target===next.target&&old?.placement===next.placement&&old?.replace===next.replace?old:next);
 }
 function dropped(moduleId,event){
  if(!dragging.current||dragging.current===moduleId)return;event.preventDefault();event.stopPropagation();
  const info=dropInfo(moduleId,event);latest.current.onChange(moveWorkbenchModule(latest.current.layout,dragging.current,info.targetId,info.placement));finishDrag();
 }
 function moveByKey(moduleId,event){
  if(!event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();
  const current=latest.current.layout,rows=current.rows,index=rows.findIndex(row=>row.modules.includes(moduleId)),row=rows[index];
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
   const other=row.modules.find(id=>id!==moduleId)||(rows[index-1]||rows[index+1])?.modules[0];
   if(other)onChange(moveWorkbenchModule(current,moduleId,other,event.key==='ArrowLeft'?'left':'right'));
  }else{
   const adjacent=rows[index+(event.key==='ArrowUp'?-1:1)];
   if(adjacent)onChange(moveWorkbenchModule(current,moduleId,adjacent.modules[0],event.key==='ArrowUp'?'before':'after'));
   else if(row.modules.length===2)onChange(moveWorkbenchModule(current,moduleId,row.modules.find(id=>id!==moduleId),event.key==='ArrowUp'?'before':'after'));
  }
 }
 return renderModule=>h('div',{className:'cc-workbench','data-stacked':stacked,ref:host,'aria-label':'可调整布局的工作台'},layout.rows.map(row=>h('div',{key:row.id,className:'cc-workbench-row','data-row-id':row.id,'data-columns':row.modules.length,
  style:{gridTemplateColumns:row.modules.length===2&&!stacked?`minmax(0,${row.ratio}fr) 10px minmax(0,${1-row.ratio}fr)`:'minmax(0,1fr)'}},
  row.modules.flatMap((id,index)=>{
   const share=row.modules.length===2?(index===0?row.ratio:1-row.ratio):1;
   const module=h('section',{key:id,className:'cc-workbench-module'+(id==='post'?' cc-post-workbench':''),'data-module':id,'data-paired':row.modules.length===2,'data-dragging':dragId===id,
    onDragOver:event=>over(id,event),onDrop:event=>dropped(id,event),onDragLeave:event=>{if(!event.currentTarget.contains(event.relatedTarget))setDrop(old=>old?.target===id?null:old);}},
    h('header',{className:'cc-workbench-module-head'+(id==='post'?' cc-post-workbench-head':''),onClick:event=>{if(event.target.closest('button:not(.cc-workbench-drag),label,input,a,textarea,select'))return;onHeaderClick?.(id,event);}},h('button',{type:'button',className:'cc-workbench-drag',draggable:true,'aria-label':'移动'+WORKBENCH_MODULES[id]+'模块','data-cc-tooltip':'拖动调整位置或并排；Alt + 方向键移动',
     onKeyDown:event=>moveByKey(id,event),onDragStart:event=>{dragging.current=id;setDragId(id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-dsh-workbench-module',id);event.dataTransfer.setData('text/plain',WORKBENCH_MODULES[id]);},onDragEnd:finishDrag},h(PromptIcon,{name:'grip',size:14}),h('span',null,WORKBENCH_MODULES[id])),renderHeader?.(id,{share,paired:row.modules.length===2,stacked,replaceChat:promptChatReplaces(share,row.modules.length===2,stacked)})),
    h('div',{className:'cc-workbench-module-body'},renderModule(id,{share,paired:row.modules.length===2,stacked,replaceChat:promptChatReplaces(share,row.modules.length===2,stacked)})),
    drop?.target===id?h('div',{className:'cc-workbench-drop','data-placement':drop.replace?'replace':drop.placement,'aria-hidden':'true'},h('span',null,drop.replace?'替换「'+WORKBENCH_MODULES[id]+'」':({before:'放到上方',after:'放到下方',left:'并排到左侧',right:'并排到右侧'})[drop.placement])):null);
   if(index===0)return [module];
   return [h('div',{key:'divider',className:'cc-workbench-divider',role:'separator',tabIndex:stacked?-1:0,'aria-label':'调整'+WORKBENCH_MODULES[row.modules[0]]+'与'+WORKBENCH_MODULES[row.modules[1]]+'模块宽度','aria-orientation':'vertical','aria-valuemin':30,'aria-valuemax':70,'aria-valuenow':Math.round(row.ratio*100),'data-cc-tooltip':'拖动调整 3:7 至 7:3；双击均分',
    onPointerDown:event=>startResize(row,event),onPointerMove:event=>moveResize(row,event),onPointerUp:endResize,onPointerCancel:endResize,onLostPointerCapture:endResize,onDoubleClick:()=>updateRatio(row,.5),
    onKeyDown:event=>{let ratio=row.ratio;if(event.key==='ArrowLeft')ratio-=event.shiftKey ? .05 : .01;else if(event.key==='ArrowRight')ratio+=event.shiftKey ? .05 : .01;else if(event.key==='Home')ratio=.3;else if(event.key==='End')ratio=.7;else return;event.preventDefault();updateRatio(row,ratio);}}),module];
  })
 )));
}

export const WORKBENCH_LAYOUT_CSS=`
.dsh-comfy-ui .cc-workbench{display:flex;flex-direction:column;gap:12px;width:100%;min-width:0;container-type:inline-size}
.dsh-comfy-ui .cc-workbench-row{display:grid;gap:0;min-width:0;align-items:stretch}
.dsh-comfy-ui .cc-workbench-row[data-columns="1"]{grid-template-columns:minmax(0,1fr)}
.dsh-comfy-ui .cc-workbench-module{position:relative;min-width:0;display:flex;flex-direction:column;border:var(--cc-ui-border-width) solid var(--cc-border);border-radius:var(--cc-ui-radius-panel);background:var(--cc-surface)}
.dsh-comfy-ui .cc-workbench-module-head{display:flex;align-items:center;flex-wrap:wrap;row-gap:4px;min-height:30px;padding:4px 10px 0;flex:none}
.dsh-comfy-ui .cc-workbench-drag{display:inline-flex;align-items:center;gap:6px;padding:2px 0;min-height:24px;border:0;background:transparent;color:var(--cc-muted);font:inherit;font-size:12px;font-weight:var(--cc-ui-weight-label);cursor:grab;touch-action:none}
.dsh-comfy-ui .cc-prompt-header-tools{display:flex;align-items:center;justify-content:flex-end;gap:5px;margin-left:auto;min-width:0;flex:none}
.dsh-comfy-ui .cc-prompt-header-tools button{height:26px;min-height:26px;padding-top:2px;padding-bottom:2px}
.dsh-comfy-ui .cc-prompt-header-tools .cc-icon-button{width:26px;min-width:26px;padding:0}
.dsh-comfy-ui .cc-workbench-drag:active{cursor:grabbing}.dsh-comfy-ui .cc-workbench-drag:focus-visible{outline:2px solid var(--cc-accent);outline-offset:3px}
.dsh-comfy-ui .cc-workbench-module[data-dragging="true"]{opacity:.55}
.dsh-comfy-ui .cc-workbench-module-body{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}
.dsh-comfy-ui .cc-workbench-divider{position:relative;cursor:col-resize;touch-action:none;min-width:0;outline:none}
.dsh-comfy-ui .cc-workbench-divider::before{content:'';position:absolute;left:4px;width:2px;top:12px;bottom:12px;border-radius:2px;background:var(--cc-border);transition:background .12s}
.dsh-comfy-ui .cc-workbench-divider:hover::before,.dsh-comfy-ui .cc-workbench-divider:focus-visible::before{background:var(--cc-accent)}
.dsh-comfy-ui .cc-workbench[data-stacked="true"] .cc-workbench-row{row-gap:12px}.dsh-comfy-ui .cc-workbench[data-stacked="true"] .cc-workbench-divider{display:none}
.dsh-comfy-ui .cc-workbench-drop{position:absolute;z-index:20;pointer-events:none;display:flex;align-items:center;justify-content:center;border:2px solid var(--cc-accent);border-radius:var(--cc-ui-radius-panel);background:color-mix(in srgb,var(--cc-accent-bg) 82%,transparent);color:var(--cc-text);font-size:12px;font-weight:600}
.dsh-comfy-ui .cc-workbench-drop span{padding:5px 9px;background:var(--cc-surface);border-radius:var(--cc-ui-radius-control)}
.dsh-comfy-ui .cc-workbench-drop[data-placement="replace"]{inset:0;border-radius:var(--cc-ui-radius-panel);box-shadow:inset 0 0 0 9999px color-mix(in srgb,var(--cc-accent-bg) 55%,transparent)}.dsh-comfy-ui .cc-workbench-drop[data-placement="left"]{inset:0 50% 0 0}.dsh-comfy-ui .cc-workbench-drop[data-placement="right"]{inset:0 0 0 50%}.dsh-comfy-ui .cc-workbench-drop[data-placement="before"]{inset:0 0 72%}.dsh-comfy-ui .cc-workbench-drop[data-placement="after"]{inset:72% 0 0}
.dsh-comfy-ui .cc-workbench .cc-model-dock,.dsh-comfy-ui .cc-workbench .cc-prompt-card{border:0!important;border-radius:0!important;background:transparent!important;margin:0;min-width:0}
.dsh-comfy-ui .cc-workbench .cc-prompt-layout{height:auto;flex:1;min-width:0;padding:8px 10px}
.dsh-comfy-ui .cc-workbench .cc-prompt-card{padding:0!important;overflow:hidden}
.dsh-comfy-ui .cc-workbench .cc-prompt-card[hidden]{display:none!important}
/* The shared immediate tooltip portal handles these; hidden legacy bubbles must not widen a narrow module. */
.dsh-comfy-ui .cc-workbench .cc-icon-button[data-cc-tooltip]::after{display:none!important}
.dsh-comfy-ui .cc-workbench .cc-image-settings-host{display:flex;flex-direction:column;flex:1;container-type:inline-size}
.dsh-comfy-ui .cc-workbench .cc-image-settings{display:flex;flex-direction:column;flex:1;height:auto;min-height:0;overflow:visible;border:0;border-radius:0!important;background:transparent}
.dsh-comfy-ui .cc-workbench .cc-image-controls{display:flex;flex-direction:column;flex:1;gap:10px}
.dsh-comfy-ui .cc-workbench .cc-image-advanced{overflow:visible;flex:none;min-height:0;padding:10px 0 0;scrollbar-gutter:auto}
.dsh-comfy-ui .cc-workbench .cc-image-actions{margin-top:auto;flex:none}
.dsh-comfy-ui .cc-workbench .cc-image-preview-host{display:flex;flex:1;min-height:420px;min-width:0;container-type:inline-size}
.dsh-comfy-ui .cc-workbench .cc-image-preview-panel{display:grid;grid-template-rows:minmax(0,1fr);flex:1;min-height:0;min-width:0;padding:8px 11px 11px}
.dsh-comfy-ui .cc-workbench .cc-image-preview-stage{width:100%;height:100%;min-height:0;aspect-ratio:auto;place-self:stretch}
.dsh-comfy-ui .cc-workbench-module[data-module="preview"][data-paired="false"] .cc-image-preview-host{min-height:clamp(420px,65vh,760px)}
@container(max-width:460px){.dsh-comfy-ui .cc-workbench .cc-size-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px}.dsh-comfy-ui .cc-workbench .cc-size-row>div:last-child{grid-column:1/-1}.dsh-comfy-ui .cc-workbench .cc-compact-sampling{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
