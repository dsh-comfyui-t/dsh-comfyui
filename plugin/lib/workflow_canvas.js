/** Menu/search CSS excerpt from ComfyUI_frontend 1.55.18 (GPL-3.0).
 * Declarations retained, selectors scoped; see docs/third-party/ComfyUI-frontend-LICENSE.txt.
 * Source: comfyui_frontend_package/static/assets/main-NWEiSzjK.css
 */
const COMFY_WORKFLOW_CSS=".cc-flow-native .litegraph.litecontextmenu{color:#aaf;z-index:10;background-color:#2e2e2e;min-width:100px;max-height:-webkit-fill-available;padding:0;position:fixed;top:100px;left:100px;overflow-y:auto;box-shadow:0 0 10px #000}\n\n.cc-flow-native .litegraph.litecontextmenu .litemenu-title img{margin-top:2px;margin-left:2px;margin-right:4px}\n.cc-flow-native .litegraph.litecontextmenu .litemenu-entry{margin:2px;padding:2px}\n.cc-flow-native .litegraph .litemenu-entry,.cc-flow-native .litemenu-title{color:#aaa;-webkit-user-select:none;user-select:none;cursor:pointer;margin:2px;padding:0 0 0 2px;font-size:12px}\n.cc-flow-native .litegraph .litemenu-entry .icon{vertical-align:top;width:12px;height:12px;margin:2px;display:inline-block}\n.cc-flow-native .litegraph .litemenu-entry.checked .icon{background-color:#aaf}\n.cc-flow-native .litegraph .litemenu-entry .more{float:right;padding-right:5px}\n.cc-flow-native .litegraph .litemenu-entry.disabled{opacity:.5;cursor:default}\n.cc-flow-native .litegraph .litemenu-entry.separator{border-top:1px solid var(--border-default);cursor:default;background-color:#0000;width:100%;height:0;margin:3px 0 2px;padding:0;display:block}\n.cc-flow-native .litegraph .litemenu-entry.has_submenu{border-right:2px solid #0ff}\n.cc-flow-native .litegraph .litemenu-title{color:#dde;cursor:default;background-color:#111;margin:0;padding:2px}\n.cc-flow-native .litegraph .litemenu-entry:hover:not(.disabled):not(.separator){background-color:var(--palette-interface-panel-hover-surface);color:var(--content-hover-fg);transition:all .2s}\n.cc-flow-native .litegraph .litemenu-entry .property_name{text-align:left;min-width:80px;min-height:1.2em;display:inline-block}\n.cc-flow-native .litegraph .litemenu-entry .property_value{text-align:right;vertical-align:middle;background-color:#00000080;min-width:80px;min-height:1.2em;padding-right:10px;display:inline-block}\n.cc-flow-native .litegraph.litesearchbox{background-color:#00000080;padding-top:4px;position:absolute}\n.cc-flow-native .litegraph.litesearchbox input,.cc-flow-native .litegraph.litesearchbox select{color:#fff;background-color:#000;border:0;min-width:60px;max-width:300px;min-height:1.5em;margin-top:3px;margin-right:5px;padding-left:10px}\n.cc-flow-native .litegraph.litesearchbox .name{min-width:60px;min-height:1.5em;padding-left:10px;display:inline-block}\n.cc-flow-native .litegraph.litesearchbox .helper{max-height:200px;margin-top:2px;overflow:auto}\n.cc-flow-native .litegraph.lite-search-item{color:#fff;background-color:#00000080;padding-top:2px}\n.cc-flow-native .litegraph.lite-search-item.not_in_filter{color:#b99;font-style:italic}\n.cc-flow-native .litegraph.lite-search-item.generic_type{color:#999;font-style:italic}\n.cc-flow-native .litegraph.lite-search-item:hover,.cc-flow-native .litegraph.lite-search-item.selected{cursor:pointer;color:#000;background-color:#fff}\n.cc-flow-native .litegraph.lite-search-item-type{opacity:.8;background:#0003;border-radius:4px;margin-left:5px;padding:2px 5px;font-size:14px;display:inline-block;position:relative;top:-2px}\n.cc-flow-native .graphmenu-entry.event,.cc-flow-native .litemenu-entry.event{border-left:8px solid orange;padding-left:12px}\n.cc-flow-native .graphmenu-entry.danger,.cc-flow-native .litemenu-entry.danger{color:var(--error-text)}\n.cc-flow-native .litegraph .litemenu-entry.danger:hover:not(.disabled){color:var(--error-text);opacity:.8}\n.cc-flow-native .graphmenu-entry .property_value,.cc-flow-native .litemenu-entry .property_value{text-align:right;vertical-align:middle;background-color:#00000080;min-width:80px;min-height:1.2em;padding-right:10px;display:inline-block}\n.cc-flow-native .litegraph .litemenu-entry.has_submenu{padding-right:20px;position:relative}\n.cc-flow-native .litemenu-entry.has_submenu:after{content:\">\";position:absolute;top:0;right:2px}\n.cc-flow-native .litegraph.litecontextmenu,.cc-flow-native .litegraph.litecontextmenu.dark{background-color:var(--comfy-menu-bg);z-index:9999!important}\n.cc-flow-native .litegraph.litecontextmenu .litemenu-entry.submenu,.cc-flow-native .litegraph.litecontextmenu.dark .litemenu-entry.submenu{background-color:var(--comfy-menu-bg);color:var(--fg-color)}\n.cc-flow-native .litegraph.litecontextmenu input{background-color:var(--comfy-input-bg);color:var(--input-text)}\n.cc-flow-native .litegraph.litesearchbox{background-color:var(--comfy-menu-bg);display:block;overflow:hidden;z-index:9999!important}\n.cc-flow-native .litegraph.litesearchbox input,.cc-flow-native .litegraph.litesearchbox select{background-color:var(--comfy-input-bg);color:var(--input-text)}\n.cc-flow-native .litegraph.lite-search-item{color:var(--input-text);background-color:var(--comfy-input-bg);filter:brightness(80%);will-change:transform;padding-left:.2em}\n.cc-flow-native .litegraph.lite-search-item.generic_type{color:var(--input-text);filter:brightness(50%);will-change:transform}";
/** Canvas interactions for the existing DSH workflow format; no execution changes. */
function workflowCanvasZoom(value){return Math.max(.25,Math.min(2,Number(value)||1));}
function workflowCanvasPoint(client,rect,scroll,zoom){
 return {x:(client.x-rect.left+scroll.left)/zoom,y:(client.y-rect.top+scroll.top)/zoom};
}
function workflowCanvasZoomAt(view,next,point){
 const zoom=workflowCanvasZoom(next),ratio=zoom/view.zoom;
 return {zoom,left:(view.left+point.x)*ratio-point.x,top:(view.top+point.y)*ratio-point.y};
}
function workflowCanvasTypes(info,query=''){
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return Object.keys(info).filter(t=>!info[t]?.output_node&&!Object.values(info[t]?.input?.required||{}).some(d=>d[0]==='COMFY_AUTOGROW_V3')&&!/^(Save|Preview)/i.test(t)&&terms.every(term=>[t,info[t].display_name,info[t].category].join(' ').toLowerCase().includes(term)))
 .sort((a,b)=>{const score=t=>[info[t].display_name||t,t].some(s=>s.toLowerCase().startsWith(query.trim().toLowerCase()))?0:1;return score(a)-score(b)||(info[a].display_name||a).localeCompare(info[b].display_name||b,'en');});
}
function workflowCanvasDisconnect(draft,id,info,remove=false){
 const nodes=draft.nodes.filter(n=>!remove||n.id!==id).map(n=>{
  const defaults=postDefaults(info[n.type]||{}),inputs={...n.inputs};
  for(const [key,value] of Object.entries(inputs))if(value&&typeof value==='object'&&(value.node===id||!remove&&n.id===id&&(value.node||value.interface))){
   if(Object.prototype.hasOwnProperty.call(defaults,key))inputs[key]=defaults[key];else delete inputs[key];
  }
  return {...n,inputs};
 });
 return {...draft,nodes,output:remove&&draft.output?.node===id?null:draft.output};
}
function workflowCanvasBounds(nodes,info,heights={}){
 if(!nodes.length)return {x:0,y:0,width:1000,height:650};
 const x=Math.min(...nodes.map(n=>Number(n.x)||0)),y=Math.min(...nodes.map(n=>Number(n.y)||0));
 return {x,y,width:Math.max(...nodes.map(n=>(Number(n.x)||0)+260))-x,height:Math.max(...nodes.map(n=>(Number(n.y)||0)+(heights[n.id]||180+Object.keys(info[n.type]?.input?.required||{}).length*80)))-y};
}
function WorkflowCanvasPopup({popup,info,theme,onClose,onAdd,actions}){
 const [query,setQuery]=React.useState(''),[active,setActive]=React.useState(0),box=React.useRef(null),input=React.useRef(null),composing=React.useRef(false);
 const matches=workflowCanvasTypes(info,query),items=popup.kind==='search'?matches.slice(0,100).map(type=>({id:type,label:info[type].display_name||type,category:info[type].category||'',run:()=>onAdd(type,popup.world)})):actions;
 const width=Math.min(popup.kind==='search'?390:240,Math.max(120,window.innerWidth-16)),maxHeight=Math.max(100,Math.min(popup.kind==='search'?380:items.length*28+32,window.innerHeight-16));
 const left=Math.max(8,Math.min(popup.x,window.innerWidth-width-8)),top=Math.max(8,Math.min(popup.y,window.innerHeight-maxHeight-8));
 const choose=item=>{if(item&&!item.disabled){item.run();onClose(true);}};
 React.useEffect(()=>{
  const outside=e=>{if(!box.current?.contains(e.target))onClose(false);};
  const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose(true);}};
  const resize=()=>onClose(false);
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);window.addEventListener('resize',resize);
  if(popup.kind==='search')input.current?.focus();else box.current?.querySelector('[role=menuitem]')?.focus();
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);window.removeEventListener('resize',resize);};
 },[]);
 React.useEffect(()=>{box.current?.querySelector('[data-active=true]')?.scrollIntoView({block:'nearest'});},[active,query]);
 const keys=e=>{
  if(composing.current||e.isComposing||e.keyCode===229)return;
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
   e.preventDefault();setActive(i=>e.key==='Home'?0:e.key==='End'?Math.max(0,items.length-1):Math.max(0,Math.min(items.length-1,i+(e.key==='ArrowDown'?1:-1))));
  }else if(e.key==='Enter'){e.preventDefault();choose(items[active]);}
  else if(e.key==='Tab')onClose(false);
 };
 return floating(h('div',{className:'cc-flow-native',style:theme},h('div',{ref:box,className:'litegraph '+(popup.kind==='search'?'litesearchbox':'litecontextmenu dark')+' cc-flow-popup',role:popup.kind==='search'?'dialog':'menu','aria-label':popup.kind==='search'?'添加工作流节点':'工作流右键菜单',style:{position:'fixed',left,top,width,maxHeight,zIndex:2147482600},onKeyDown:keys,onContextMenu:e=>e.preventDefault()},
  popup.kind==='search'?h(React.Fragment,null,h('label',{className:'name',htmlFor:'cc-flow-node-search'},'添加节点'),h('input',{id:'cc-flow-node-search',ref:input,type:'search',placeholder:'搜索名称、类名或分类…',role:'combobox','aria-label':'搜索添加工作流节点','aria-expanded':true,'aria-controls':'cc-flow-node-matches','aria-activedescendant':items[active]?'cc-flow-match-'+active:undefined,value:query,onChange:e=>{setQuery(e.target.value);setActive(0);},onCompositionStart:()=>{composing.current=true;},onCompositionEnd:()=>{composing.current=false;}})):null,
  h('div',{id:popup.kind==='search'?'cc-flow-node-matches':undefined,className:popup.kind==='search'?'helper':'',role:popup.kind==='search'?'listbox':'presentation','aria-label':popup.kind==='search'?'节点搜索结果':undefined},
   items.length?items.map((item,i)=>h('button',{key:item.id,id:'cc-flow-match-'+i,type:'button',role:popup.kind==='search'?'option':'menuitem','aria-selected':popup.kind==='search'?i===active:undefined,disabled:item.disabled,'data-active':i===active?'true':'false',className:popup.kind==='search'?'litegraph lite-search-item'+(i===active?' selected':''):'litemenu-entry'+(item.danger?' danger':'')+(item.disabled?' disabled':''),title:item.id,onMouseEnter:()=>setActive(i),onClick:()=>choose(item)},item.label,item.category?h('span',{className:'lite-search-item-type'},item.category):null)):h('div',{className:'name'},'没有匹配的节点')),
  popup.kind==='search'?h('small',{className:'cc-flow-search-count'},matches.length>100?'显示前 100 个结果，请继续输入缩小范围':matches.length+' 个结果 · ↑↓ 选择 · Enter 添加'):null)));
}
const WORKFLOW_CANVAS_CSS=`
.cc-flow-native .litegraph.litecontextmenu.cc-flow-popup,.cc-flow-native .litegraph.litesearchbox.cc-flow-popup{z-index:2147482600!important;overflow:hidden}
.cc-flow-native{--comfy-menu-bg:#353535;--comfy-input-bg:#222;--fg-color:#ddd;--input-text:#ddd;--border-default:#4e4e4e;--palette-interface-panel-hover-surface:#555;--content-hover-fg:#fff;--error-text:#f28b82}
.dsh-comfy-floating .cc-flow-workspace{position:relative;min-width:0;min-height:0;overflow:hidden}
.dsh-comfy-floating .cc-flow-workspace>.cc-flow-scroll{width:100%;height:100%;box-sizing:border-box;touch-action:none;outline-offset:-2px;overflow:clip;background-color:#1e1e1e;background-image:radial-gradient(#383838 1px,transparent 1px)}
.dsh-comfy-floating .cc-flow-space{position:relative;min-width:100%;min-height:100%}
.dsh-comfy-floating .cc-flow-space>.cc-flow-canvas{position:absolute;left:0;top:0;transform-origin:0 0;background-image:none}
.cc-flow-native .cc-flow-view-tools{position:absolute;right:10px;top:10px;z-index:3;display:flex;align-items:center;gap:2px;padding:3px;border-radius:5px;background:var(--comfy-menu-bg);color:var(--fg-color);box-shadow:0 1px 5px #0008}
.cc-flow-native .cc-flow-view-tools button{font:12px system-ui;color:inherit;background:transparent;border:0;min-height:28px;padding:4px 9px;cursor:pointer}.cc-flow-native .cc-flow-view-tools button:hover:not(:disabled){background:var(--palette-interface-panel-hover-surface)}
.cc-flow-native .cc-flow-popup{display:flex;flex-direction:column;overflow:hidden;z-index:2147482600!important;font:12px system-ui;color:var(--fg-color);box-sizing:border-box;max-width:calc(100vw - 16px)}
.cc-flow-native .cc-flow-popup .litemenu-entry{display:block;width:calc(100% - 4px);border:0;background:transparent;text-align:left;min-height:26px;padding:4px 8px;box-sizing:border-box}
.dsh-comfy-floating .cc-flow-links{overflow:visible}
.cc-flow-native .cc-flow-popup>[role=presentation]{min-height:0;overflow:auto}
.cc-flow-native .cc-flow-popup .helper{min-height:0;max-height:none;overflow:auto;overscroll-behavior:contain;flex:1}
.cc-flow-native .cc-flow-popup.litesearchbox>input{display:block;min-height:30px;width:calc(100% - 12px);max-width:none;margin:5px 6px;box-sizing:border-box;flex:none}
.cc-flow-native .cc-flow-popup .lite-search-item{display:block;min-height:30px;width:100%;text-align:left;white-space:normal;border:0;font:inherit;padding:6px 8px}
.cc-flow-native .cc-flow-popup [data-active=true]{outline:1px solid #8ba1ba;outline-offset:-1px}
.cc-flow-native .cc-flow-search-count{display:block;padding:6px 9px;color:#aaa;font-size:11px;flex:none}
`;
