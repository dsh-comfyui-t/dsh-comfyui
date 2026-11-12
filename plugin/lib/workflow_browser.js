/** Standalone ComfyUI-style node browser, backed by the live object_info catalog. */
const COMFY_BROWSER_STYLE=`
.litegraph.litecontextmenu,.litegraph.litecontextmenu.dark{background:#252730!important;color:#e9e9ec!important;min-width:200px;max-width:min(420px,calc(100vw - 24px));max-height:min(340px,calc(100vh - 32px));overflow:auto;scrollbar-width:none;border:0;border-radius:0;padding:0;box-shadow:0 3px 12px #0008!important;font-family:Arial,sans-serif;z-index:2147482600!important}
.litegraph.litecontextmenu .litemenu-entry,.litegraph.litecontextmenu .litemenu-entry.submenu,.litegraph.litecontextmenu.dark .litemenu-entry.submenu{background:#252730!important;color:#e9e9ec;font:13px/22px Arial,sans-serif;min-height:26px;margin:0;padding:2px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.litegraph.litecontextmenu .litemenu-entry:hover:not(.disabled):not(.separator){background:#353740!important;color:#fff;transition:none}
.litegraph.litecontextmenu .litemenu-entry.separator{background:transparent!important;height:1px;min-height:1px;border:0;border-top:1px solid #484a52;margin:4px 0;padding:0!important}
.litegraph.litecontextmenu .litemenu-title{background:#111;color:#ddd;font:14px/25px Arial,sans-serif;padding:2px 6px}
.litegraph.litecontextmenu .litemenu-entry.has_submenu{position:relative;padding-right:30px;border-right:2px solid #00cddd}
.litegraph.litecontextmenu .litemenu-entry.has_submenu:after{content:'›';position:absolute;right:7px;top:0;font-size:18px;line-height:26px}
.litegraph.litecontextmenu .litemenu-entry.disabled{opacity:.45}
.cc-node-browser-mask{position:fixed;inset:0;z-index:2147482700;background:#080a0d66;display:flex;align-items:center;justify-content:center;padding:24px;color:#e6e6e6;font:13px Arial,sans-serif;color-scheme:dark}
.cc-node-browser-mask *{box-sizing:border-box}
.cc-node-browser{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:10px;width:min(900px,100%);height:min(520px,74vh);outline:none}
.cc-node-browser-main{display:flex;flex-direction:column;min-width:0;min-height:0;background:#171717;border:1px solid #53555c;border-radius:8px;padding:10px;overflow:hidden}
.cc-node-browser-searchline{display:flex;gap:6px;background:#282828;border-radius:7px;flex-shrink:0;align-items:center;padding-right:10px}
.cc-node-browser-searchline input{height:40px;min-width:0;flex:1;border:0;outline:0;background:transparent;color:#eee;padding:10px 12px;font:14px Arial,sans-serif}
.cc-node-browser-searchline input:focus-visible{outline:none}.cc-node-browser-searchline:focus-within{box-shadow:inset 0 0 0 1px #50525a}.cc-node-browser-searchline input::placeholder{color:#888}.cc-node-browser-mask button,.cc-node-browser-mask select{font:inherit;color:inherit;cursor:pointer}
.cc-node-browser-close{border:0;background:none;color:#999!important;font-size:20px!important;padding:4px 7px;border-radius:6px}.cc-node-browser-close:hover{background:#393939}
.cc-node-browser-filters{display:flex;align-items:center;gap:6px;padding:10px 0 8px;flex-shrink:0;flex-wrap:wrap}
.cc-node-browser-filters button,.cc-node-browser-filters select{border:1px solid #292929;background:#171717;border-radius:5px;height:28px;padding:4px 9px;color:#999}
.cc-node-browser-filters button[aria-pressed=true]{background:#efefef;color:#171717;border-color:#eee}.cc-node-browser-filters select{max-width:160px}
.cc-node-browser-columns{display:grid;grid-template-columns:145px minmax(0,1fr);gap:10px;min-height:0;flex:1}
.cc-node-browser-categories{overflow:auto;display:flex;flex-direction:column;gap:3px;padding-right:8px;border-right:1px solid #333;min-height:0}
.cc-node-browser-categories button{background:transparent;color:#999;border:0;border-radius:6px;min-height:33px;padding:7px 10px;text-align:left;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-node-browser-categories button:first-child{margin-bottom:6px}.cc-node-browser-categories button[aria-pressed=true]{background:#303133;color:#f5f5f5;font-weight:600}
.cc-node-browser-categories button:hover{background:#252525;color:#eee}
.cc-node-browser-results{overflow:auto;min-width:0;min-height:0;outline:none;padding-right:6px}
.cc-node-browser-row{display:block;width:100%;border:0;border-radius:6px;background:transparent;color:#eee;padding:8px 10px;text-align:left;min-height:52px;cursor:pointer}
.cc-node-browser-row[aria-selected=true],.cc-node-browser-row:hover{background:#282828}
.cc-node-browser-row-title{display:flex;align-items:center;gap:6px;font-size:14px;line-height:20px;font-weight:600}
.cc-node-browser-row-title>span:first-child{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-node-browser-badge{border-radius:10px;padding:1px 6px;background:#303133;color:#ccc;font:10px/16px Arial,sans-serif;white-space:nowrap;font-weight:400}
.cc-node-browser-row-description{color:#929292;margin-top:3px;line-height:18px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-node-browser-preview{align-self:start;border:1px solid #494b54;border-radius:8px;background:#171717;padding:10px;max-height:100%;overflow:auto;min-width:0}
.cc-node-browser-node{background:#252730;border:1px solid #3b3d46;border-radius:7px;overflow:hidden;min-height:62px;margin-bottom:12px;color:#aaa;font-size:13px}
.cc-node-browser-node-title{padding:6px 9px;font-size:11px;color:#999}.cc-node-browser-node-ports{display:flex;justify-content:space-between;gap:12px;padding:0 10px 8px}
.cc-node-browser-node-ports>div{min-width:0}.cc-node-browser-node-ports>div:last-child{text-align:right}.cc-node-browser-node-port{position:relative;line-height:22px;overflow-wrap:anywhere}
.cc-node-browser-node-port:before{content:'';position:absolute;left:-16px;top:8px;width:7px;height:7px;border-radius:50%;background:var(--port-color,#9ab7c9)}
.cc-node-browser-node-ports>div:last-child .cc-node-browser-node-port:before{left:auto;right:-16px}
.cc-node-browser-preview h3{font-size:14px;margin:0 0 6px}.cc-node-browser-preview p{color:#999;font-size:12px;line-height:18px;overflow-wrap:anywhere;margin:0 0 9px;white-space:pre-wrap}
.cc-node-browser-preview hr{border:0;border-top:1px solid #353535;margin:10px 0}.cc-node-browser-preview h4{color:#929292;font-size:12px;font-weight:400;margin:10px 0 7px}
.cc-node-browser-port-detail{display:flex;gap:12px;justify-content:space-between;margin-bottom:8px;font-size:12px;overflow-wrap:anywhere}.cc-node-browser-port-detail span:last-child{color:#929292}
.cc-node-browser-empty{color:#aaa;padding:30px 20px;line-height:26px}.cc-node-browser-hint{color:#888;font:10px/16px Arial,sans-serif;margin-top:8px;flex-shrink:0}
.cc-node-browser-mask :focus-visible{outline:2px solid #777d91;outline-offset:-2px}.cc-node-browser-mask *,.litegraph.litecontextmenu{scrollbar-width:none}.cc-node-browser-mask ::-webkit-scrollbar,.litegraph.litecontextmenu::-webkit-scrollbar{display:none;width:0;height:0}
.litegraph.litecontextmenu.cc-node-browser-type-menu{z-index:2147482800!important}
.cc-node-browser-row.cc-node-browser-row-external{display:inline-block;vertical-align:top;width:50%;min-height:32px;padding:6px 8px}.cc-node-browser-row-external .cc-node-browser-row-description,.cc-node-browser-row-external .cc-node-browser-badge{display:none}.cc-node-browser-row-external .cc-node-browser-row-title{font-size:12px;line-height:20px}
.cc-node-browser-group{padding:7px 10px 4px;color:#999;font-size:11px;line-height:16px}.cc-node-browser-group:not(:first-child){margin-top:5px;border-top:1px solid #333}
@media(max-width:1100px){.cc-node-browser{grid-template-columns:minmax(0,1fr) 210px}.cc-node-browser-columns{grid-template-columns:125px minmax(0,1fr)}.cc-node-browser-row{padding:8px 10px}.cc-node-browser-row-title{font-size:14px}}
@media(max-width:760px){.cc-node-browser-mask{padding:12px}.cc-node-browser{height:min(640px,calc(100vh - 24px));grid-template-columns:minmax(0,1fr)}.cc-node-browser-preview{display:none}.cc-node-browser-columns{grid-template-columns:120px minmax(0,1fr)}.cc-node-browser-main{padding:10px}.cc-node-browser-row-title{font-size:14px}.cc-node-browser-categories button{font-size:12px;padding:7px 8px}.cc-node-browser-filters{gap:6px}.cc-node-browser-filters select{max-width:110px}}
`;
const NATIVE_CATEGORY_LABELS={image:'图像',latent:'Latent',conditioning:'条件',loaders:'加载器',sampling:'采样',model:'模型',advanced:'高级',utils:'实用工具',mask:'遮罩',video:'视频',audio:'音频',text:'文本',experimental:'实验性',DSH:'DSH 接口'};
const NATIVE_NODE_LABELS={KSampler:'K采样器',KSamplerAdvanced:'K采样器（高级）',CLIPTextEncode:'CLIP文本编码',VAEDecode:'VAE解码',VAEEncode:'VAE编码',CheckpointLoaderSimple:'Checkpoint加载器（简易）',LoraLoader:'加载LoRA',EmptyLatentImage:'空Latent图像',LoadImage:'加载图像',ImageScale:'缩放图像',ImageScaleBy:'缩放图像（比例）',ImageInvert:'反转图像'};
function nativeNodeCatalog(info,registered){
 const byName=new Map(Object.entries(info).map(([type,spec])=>[(spec.category||'其他')+'/'+type,{type,spec}]));
 return registered.map(name=>{const {type,spec}=byName.get(name)||{type:name,spec:{}},category=spec.category||'其他',group=category.split('/')[0],module=String(spec.python_module||''),extension=module.startsWith('custom_nodes.');
  const inputs=Object.entries({...spec.input?.required,...spec.input?.optional}).map(([name,d])=>({name,type:nativeWorkflowType(d)})),outputs=(spec.output||[]).map((type,i)=>({name:String(spec.output_name?.[i]||(Array.isArray(type)?'COMBO':type)),type:Array.isArray(type)?'COMBO':String(type||'*')}));
  const title=NATIVE_NODE_LABELS[type]||spec.display_name||type;
  const source=group==='DSH'?'DSH':extension?(module.split('.')[1]||'扩展'):'ComfyUI';
  return {name,type,title,category,group,externalInput:name==='DSH/输入接口'||name.startsWith('DSH/外部输入/'),groupLabel:NATIVE_CATEGORY_LABELS[group]||group,description:String(spec.description||''),source,extension,inputs,outputs,search:[type,title,category,NATIVE_CATEGORY_LABELS[group],spec.description,module,...inputs.map(x=>x.type),...outputs.map(x=>x.type)].join(' ').toLowerCase()};
 });
}
function nativePortMatches(type,filter){const requested=String(filter).split(',').map(s=>s.trim());return String(type).split(',').some(t=>t.trim()==='*'||requested.includes('*')||requested.includes(t.trim()));}
function nativeNodeMatches(items,{query='',category='',source='',input='',output=''}={}){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean),q=query.trim().toLowerCase();
 return items.filter(n=>(!category||n.group===category)&&(!source||(source==='extension'?n.extension:!n.extension))&&(!input||n.inputs.some(p=>nativePortMatches(p.type,input)))&&(!output||n.outputs.some(p=>nativePortMatches(p.type,output)))&&(n.externalInput||terms.every(t=>n.search.includes(t))))
 .sort((a,b)=>{if(a.externalInput||b.externalInput)return a.externalInput&&b.externalInput?items.indexOf(a)-items.indexOf(b):a.externalInput?-1:1;const rank=n=>q?(n.type.toLowerCase()===q||n.title.toLowerCase()===q?0:n.type.toLowerCase().startsWith(q)||n.title.toLowerCase().startsWith(q)?1:2):['KSampler','CLIPTextEncode','VAEDecode','VAEEncode','LoadImage','CheckpointLoaderSimple','LoraLoader','EmptyLatentImage'].indexOf(n.type)>=0?0:1;return rank(a)-rank(b)||a.title.localeCompare(b.title,'zh-CN');});
}
function nativeMenuOptions(items){
 const translate={'Add Node':'添加节点','Add Group':'添加组','Title':'标题','Resize':'调整大小','Collapse':'折叠','Expand':'展开','Pin':'固定','Unpin':'取消固定','Colors':'颜色','Shapes':'形状','Clone':'克隆','Remove':'删除','Align':'对齐','Align Selected To':'对齐选中节点','Distribute Nodes':'分布节点','Disconnect Links':'断开连线'};
 const omitted=new Set(['Inputs','Outputs','Mode','Convert to Subgraph 🆕','Properties','Properties Panel']);
 const result=[];for(const item of items){if(item&&omitted.has(item.content))continue;if(!item){if(result.length&&result.at(-1))result.push(null);}else result.push({...item,content:translate[item.content]||item.content});}if(result.at(-1)===null)result.pop();return result;
}
function showNativeNodeBrowser(canvas,event,items,{add,onError,options={}}={}){
 canvas.search_box?.close();
 const doc=canvas.canvas.ownerDocument,el=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
 const mask=el('div','cc-node-browser-mask'),dialog=el('section','cc-node-browser'),main=el('div','cc-node-browser-main'),preview=el('aside','cc-node-browser-preview');
 mask.append(dialog);dialog.append(main,preview);dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','添加节点');preview.setAttribute('aria-label','节点预览');
 const line=el('div','cc-node-browser-searchline'),search=el('input'),close=el('button','cc-node-browser-close','×');search.placeholder='添加节点…';search.setAttribute('aria-label','搜索节点');close.setAttribute('aria-label','关闭节点浏览器');line.append(search,close);main.append(line);
 const filters=el('div','cc-node-browser-filters'),columns=el('div','cc-node-browser-columns'),categories=el('nav','cc-node-browser-categories'),results=el('div','cc-node-browser-results');categories.setAttribute('aria-label','节点分类');results.setAttribute('role','listbox');results.setAttribute('aria-label','节点搜索结果');results.tabIndex=0;columns.append(categories,results);main.append(filters,columns,el('div','cc-node-browser-hint','↑ ↓ 选择 · Enter 添加 · Esc 关闭'));
 let closed=false,selected=0,limit=100,found=[],state={query:'',category:'',source:'',input:options.type_filter_in||'',output:options.type_filter_out||''};
 const prior=canvas.allow_interaction;canvas.allow_interaction=false;
 const dismiss=()=>{if(closed)return;closed=true;comfyNativeEngine().LiteGraph.closeAllContextMenus();mask.remove();if(canvas.search_box===mask)canvas.search_box=null;canvas.allow_interaction=prior;canvas.canvas.focus();};mask.close=dismiss;close.onclick=dismiss;mask.addEventListener('pointerdown',e=>{if(e.target===mask)dismiss();});
 const showPreview=item=>{preview.replaceChildren();if(!item)return;const node=el('div','cc-node-browser-node'),title=el('div','cc-node-browser-node-title','⌄  '+item.title),ports=el('div','cc-node-browser-node-ports');
  for(const list of [item.inputs,item.outputs]){const side=el('div');for(const p of list.slice(0,4)){const port=el('div','cc-node-browser-node-port',p.name);const colors={IMAGE:'#9ab7c9',LATENT:'#e994e1',MODEL:'#b39ddb',CLIP:'#e2cb72',VAE:'#e98585',CONDITIONING:'#eab16e'};port.style.setProperty('--port-color',colors[p.type]||'#9ab7c9');side.append(port);}ports.append(side);}node.append(title,ports);preview.append(node,el('h3',null,item.title),el('p',null,item.groupLabel),el('p',null,item.description||item.type),el('hr'));
  for(const [label,list] of [['输入',item.inputs],['输出',item.outputs]]){preview.append(el('h4',null,label));if(!list.length)preview.append(el('p',null,'无'));for(const p of list){const row=el('div','cc-node-browser-port-detail');row.append(el('span',null,p.name),el('span',null,p.type));preview.append(row);}}
 };
 const choose=item=>{try{add(item,event,options);dismiss();}catch(error){onError?.(errText(error));}};
 const setSelected=(index,scroll=false)=>{if(!found.length)return;selected=Math.max(0,Math.min(found.length-1,index));if(selected>=limit){limit=selected+50;renderRows();}for(const [i,row] of [...results.querySelectorAll('[role=option]')].entries())row.setAttribute('aria-selected',String(i===selected));showPreview(found[selected]);search.setAttribute('aria-activedescendant','cc-node-result-'+selected);if(scroll)results.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});};
 const renderRows=()=>{results.replaceChildren();search.removeAttribute('aria-activedescendant');if(!found.length){results.append(el('p','cc-node-browser-empty','没有符合条件的节点。试试其他名称、分类或端口类型。'));showPreview(null);return;}
  for(const [index,item] of found.slice(0,limit).entries()){if(index===0||!!found[index-1].externalInput!==!!item.externalInput){const heading=el('div','cc-node-browser-group',item.externalInput?'外部输入':state.query.trim()?'搜索结果':'节点');heading.setAttribute('role','presentation');results.append(heading);}const row=el('div',item.externalInput?'cc-node-browser-row cc-node-browser-row-external':'cc-node-browser-row'),title=el('div','cc-node-browser-row-title');row.setAttribute('role','option');row.id='cc-node-result-'+index;row.setAttribute('aria-selected',String(index===selected));title.append(el('span',null,item.title),el('span','cc-node-browser-badge',item.source));row.append(title,el('div','cc-node-browser-row-description',item.category.split('/').map(part=>NATIVE_CATEGORY_LABELS[part]||part).join(' / ')+(item.description?' | '+item.description:'')));row.onclick=()=>choose(item);row.onpointermove=()=>{if(selected!==index)setSelected(index);};results.append(row);}showPreview(found[selected]);search.setAttribute('aria-activedescendant','cc-node-result-'+selected);
 };
 const refresh=()=>{found=nativeNodeMatches(items,state);selected=state.query.trim()?Math.max(0,found.findIndex(n=>!n.externalInput)):0;limit=100;results.scrollTop=0;renderRows();};
 results.addEventListener('scroll',()=>{if(limit<found.length&&results.scrollTop+results.clientHeight>=results.scrollHeight-160){const top=results.scrollTop;limit+=100;renderRows();results.scrollTop=top;}});
 const sourceButtons=[];for(const [label,value] of [['全部',''],['ComfyUI','core'],['扩展','extension']]){if(value==='extension'&&!items.some(n=>n.extension))continue;const b=el('button',null,label);b.setAttribute('aria-pressed',String(value===state.source));b.onclick=()=>{state.source=value;sourceButtons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));refresh();};sourceButtons.push(b);filters.append(b);}
 for(const [label,key,ports] of [['输入','input','inputs'],['输出','output','outputs']]){const button=el('button');button.type='button';button.setAttribute('aria-label',label+'类型');button.setAttribute('aria-haspopup','menu');const labelButton=()=>{button.textContent=(state[key]||label)+' ▾';button.title=label+'类型：'+(state[key]||'全部');};labelButton();button.onclick=e=>{const {LiteGraph}=comfyNativeEngine();LiteGraph.closeAllContextMenus();const values=['',...[...new Set(items.flatMap(n=>n[ports].flatMap(p=>p.type.split(',').map(t=>t.trim()))))].sort()];new LiteGraph.ContextMenu(values.map(value=>({content:value||'全部'+label+'类型',callback:()=>{state[key]=value;labelButton();refresh();button.focus();}})),{event:e,className:'cc-node-browser-type-menu',scale:1});};filters.append(button);}
 const categoryButtons=[];for(const [key,label] of [['','最相关'],...[...new Map(items.map(n=>[n.group,n.groupLabel])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'))]){const b=el('button',null,label);b.setAttribute('aria-pressed',String(!key));b.onclick=()=>{state.category=key;categoryButtons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));refresh();};categoryButtons.push(b);categories.append(b);}
 search.addEventListener('input',()=>{state.query=search.value;refresh();});search.setAttribute('aria-controls','cc-node-browser-results');search.setAttribute('role','combobox');search.setAttribute('aria-expanded','true');results.id='cc-node-browser-results';
 mask.addEventListener('keydown',e=>{if(e.isComposing||e.keyCode===229)return;if(e.key==='Escape'){e.preventDefault();dismiss();}else if(['ArrowDown','ArrowUp','Enter'].includes(e.key)&&(e.target===search||e.target===results)){e.preventDefault();if(e.key==='Enter'){if(found[selected])choose(found[selected]);}else setSelected(selected+(e.key==='ArrowDown'?1:-1),true);}else if(e.key==='Tab'){const focusable=[...dialog.querySelectorAll('input,button,select,[tabindex="0"]')];if(e.shiftKey&&doc.activeElement===focusable[0]){e.preventDefault();focusable.at(-1).focus();}else if(!e.shiftKey&&doc.activeElement===focusable.at(-1)){e.preventDefault();focusable[0].focus();}}e.stopPropagation();});
 (doc.fullscreenElement||doc.body).append(mask);canvas.search_box=mask;refresh();search.focus();return mask;
}
