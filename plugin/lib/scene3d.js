
const REGIONAL_COLORS=['#ffffff','#ff3b30','#34c759','#007aff','#ffcc00','#ff2d95','#00d4c8','#a855f7'];
function editorDocumentDialog({title,message='',name,choices}){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog'),form=document.createElement('form'),heading=document.createElement('h2'),body=document.createElement('p'),buttons=document.createElement('div');
  dialog.style.cssText='max-width:440px;width:calc(100vw - 48px);max-height:80vh;overflow:auto;padding:22px;border:1px solid var(--cc-border,#555);border-radius:10px;background:var(--cc-surface,#292c30);color:var(--cc-text,#eee);font:14px system-ui;box-shadow:0 12px 48px #0006';
  const theme=getComputedStyle(document.querySelector('.dsh-comfy-ui')||document.querySelector('.cc-comfy-native')||document.documentElement);for(const key of ['bg','text','muted','surface','control','hover','border','accent','accent-bg','accent-text','scheme']){const token='--cc-'+key,value=theme.getPropertyValue(token).trim();if(value)dialog.style.setProperty(token,value);}dialog.style.colorScheme=theme.getPropertyValue('--cc-scheme').trim()||'dark';
  dialog.setAttribute('aria-modal','true');heading.id='cc-document-dialog-'+editorChannel();dialog.setAttribute('aria-labelledby',heading.id);heading.textContent=title;heading.style.cssText='font-size:17px;margin:0 0 12px';body.textContent=message;body.style.cssText='line-height:1.6;white-space:pre-wrap;margin:0 0 16px';form.method='dialog';form.append(heading);if(message)form.append(body);
  let input;if(name!==undefined){input=document.createElement('input');input.value=name;input.required=true;input.maxLength=128;input.setAttribute('aria-label','名称');input.style.cssText='box-sizing:border-box;width:100%;padding:8px;margin-bottom:16px;background:var(--cc-control,#333);color:inherit;border:1px solid var(--cc-border,#666);border-radius:5px;font:inherit';form.append(input);}
  buttons.style.cssText='display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap';
  for(const [value,label] of choices){const button=document.createElement('button');button.value=value;button.textContent=label;button.formNoValidate=value==='cancel'||value==='discard';button.style.cssText='font:inherit;color:inherit;border:1px solid var(--cc-border,#666);background:var(--cc-control,#333);border-radius:5px;padding:7px 12px;cursor:pointer';if(value==='save')button.style.background='var(--cc-accent-bg,#3b526e)';buttons.append(button);}
  form.append(buttons);form.onsubmit=e=>{if(input&&e.submitter?.value==='save'&&!input.value.trim()){e.preventDefault();input.setCustomValidity('请输入名称');input.reportValidity();}};input?.addEventListener('input',()=>input.setCustomValidity(''));dialog.append(form);document.body.append(dialog);
  dialog.addEventListener('close',()=>{const result={action:dialog.returnValue||'cancel',name:input?.value.trim()};dialog.remove();resolve(result);},{once:true});dialog.showModal();(input||buttons.firstElementChild)?.focus();input?.select();
 });
}

async function saveScene3DPreset(value,{removeLabel='保存并移除'}={}){
 await requireSidecarFeature('scene3dDraftsVersion',2,'保存场景');
 const status=await jget(EXPANDER+'/scene3d/window/status',5000);let requested=false;
 try{
  let row=await jget(EXPANDER+'/scene3d/drafts/'+value.sessionId,5000);
  if(status.running&&status.channel===value.sessionId){
   row=await jpost(EXPANDER+'/scene3d/drafts',{action:'capture',channel:value.sessionId},5000);requested=true;
   const token=row.captureRequest,until=Date.now()+30000;
   while(row.captureAck!==token){if(Date.now()>until)throw Error('场景同步超时，组件已保留。请在编辑窗口保存后重试。');await new Promise(resolve=>setTimeout(resolve,300));row=await jget(EXPANDER+'/scene3d/drafts/'+value.sessionId,5000);}
  }
  if(!row.scene)throw Error('当前没有可保存的场景，请先打开场景编辑器');
  const naming=await editorDocumentDialog({title:row.presetId?'保存场景预设':'保存为场景预设',name:row.name||'临时场景',choices:[['cancel','取消'],['save',removeLabel]]});
  if(naming.action!=='save')return false;
  await jpost(EXPANDER+'/scene3d/scenes',{id:row.presetId||'',name:naming.name,preset:true,scene:row.scene,captureSource:{channel:value.sessionId,sceneId:row.presetId||''}},20000);return true;
 }finally{if(requested)await jpost(EXPANDER+'/scene3d/drafts',{action:'resume',channel:value.sessionId},5000).catch(()=>{});}
}

async function confirmScene3DRemoval(value){
 const choice=await editorDocumentDialog({title:'移除 3D 参考',message:'是否将当前场景保存为预设？移除后，此组件的临时场景会被清除。',choices:[['cancel','取消'],['discard','直接移除'],['save','保存后移除']]});
 if(choice.action==='cancel')return false;if(choice.action==='discard')return true;
 return await saveScene3DPreset(value,{removeLabel:'保存后移除'});
}

/** Independent local 3D editor and small screenshot metadata. No image bytes in localStorage. */
const REFERENCE_PREPROCESSORS=[
 {id:'none',label:'无（原图）'},
 {id:'canny',label:'Canny 边缘',node:'Canny',params:{low_threshold:0.4,high_threshold:0.8}},
 {id:'lineart',label:'Lineart 线稿',node:'LineArtPreprocessor',params:{}},
 {id:'anime-lineart',label:'Anime Lineart 动漫线稿',node:'AnimeLineArtPreprocessor',params:{}},
 {id:'depth',label:'Depth 深度图',node:'DepthAnythingV2Preprocessor',nodes:[{node:'DepthAnythingV2Preprocessor'},{node:'DepthAnythingPreprocessor'},{node:'Zoe-DepthMapPreprocessor'},{node:'MiDaS-DepthMapPreprocessor'}],params:{}},
 {id:'scribble',label:'Scribble 涂鸦',node:'FakeScribblePreprocessor',params:{}},
 {id:'openpose',label:'OpenPose 姿态',node:'OpenposePreprocessor',params:{}},
 {id:'hed',label:'HED 软边缘',node:'HEDPreprocessor',params:{}},
 {id:'normal',label:'Normal 法线',node:'BAE-NormalMapPreprocessor',params:{}},
 {id:'tile',label:'Tile 平铺',node:'TilePreprocessor',params:{}},
 {id:'color',label:'Color 色彩',node:'ColorPreprocessor',params:{}},
 {id:'binary',label:'Binary 二值',node:'BinaryPreprocessor',params:{}}
];
function referencePreprocessor(id){return REFERENCE_PREPROCESSORS.find(x=>x.id===id)||REFERENCE_PREPROCESSORS[0];}
function normalizeScene3DControlnet(v){
 if(!v||typeof v!=='object')return null;
 const a=v.asset&&/^[0-9a-f]{64}$/.test(String(v.asset.id))&&Number.isInteger(v.asset.width)&&Number.isInteger(v.asset.height)?{id:v.asset.id,width:v.asset.width,height:v.asset.height,url:'/references/'+v.asset.id}:null;
 return {type:String(v.type||'none'),label:String(v.label||''),status:['idle','running','done','error'].includes(v.status)?v.status:(a?'done':'idle'),asset:a,error:String(v.error||'').slice(0,300),pid:String(v.pid||'').slice(0,120),model:String(v.model||'').slice(0,240),strength:Number.isFinite(Number(v.strength))?Math.max(0,Math.min(2,Number(v.strength))):.8,start:Number.isFinite(Number(v.start))?Math.max(0,Math.min(1,Number(v.start))):0,end:Number.isFinite(Number(v.end))?Math.max(0,Math.min(1,Number(v.end))):1};
}
async function runScene3DPreprocess(value,onChange,type){
 const preset=referencePreprocessor(type);
 if(preset.id==='none'){onChange({...value,controlnet:{type:'none',label:'',status:'idle',asset:null,error:'',pid:''}});return;}
 if(!value?.asset)throw Error('请先在 3D 编辑器中截取镜头');
 onChange({...value,controlnet:{type:preset.id,label:preset.label,status:'running',asset:null,error:'',pid:''}});
 try{
  const online=await jget(EXPANDER+'/comfy/online',6000).catch(()=>null);
  if(!online||online.running!==true)throw Error('ComfyUI 未运行，无法执行预处理');
  const prepared=await jpost(EXPANDER+'/references/prepare',{id:value.asset.id},60000);
  const candidates=preset.nodes&&preset.nodes.length?preset.nodes:[{node:preset.node,params:preset.params||{}}];
  const usable=[];
  for(const c of candidates){const info=await jget(COMFY+'/object_info/'+c.node,8000).catch(()=>null);if(info&&info[c.node])usable.push(c);}
  if(!usable.length)throw Error('当前 ComfyUI 未安装「'+preset.label+'」所需的预处理器节点');
  let lastError=null,image=null,usedNode='';
  for(const c of usable){
   try{
    const prompt={'10':{class_type:'LoadImage',inputs:{image:prepared.input}},'11':{class_type:c.node,inputs:{image:['10',0],...(c.params||{})}},'12':{class_type:'SaveImage',inputs:{images:['11',0],filename_prefix:'dsh_cnet/'+preset.id+'_'}}};
    const sub=await jpost(COMFY+'/prompt',{prompt,client_id:'dsh-comfyui-console'},30000);
    const pid=sub.prompt_id;
    onChange({...value,controlnet:{type:preset.id,label:preset.label,status:'running',asset:null,error:'',pid}});
    const until=Date.now()+180000;let found=null;
    while(Date.now()<until){
     const hist=await jget(COMFY+'/history/'+pid,10000).catch(()=>null);
     const entry=hist&&hist[pid];
     if(entry){
      const status=entry.status||{};
      if(status.status_str==='error'){const m=(status.messages||[]).slice(-1)[0];throw Error(((m&&m[1]&&(m[1].exception_message||m[1].message))||'未知错误'));}
      const out=entry.outputs&&entry.outputs['12'];
      if(out&&out.images&&out.images[0]){found=out.images[0];break;}
     }
     await new Promise(r=>setTimeout(r,600));
    }
    if(found){image=found;usedNode=c.node;break;}
    throw Error('预处理超时');
   }catch(e){lastError=e;continue;}
  }
  if(!image)throw Error('预处理失败（已尝试 '+usable.length+' 种预处理器）：'+(lastError&&errText(lastError)||'未知错误'));
  const url=COMFY+'/view?filename='+encodeURIComponent(image.filename)+'&subfolder='+encodeURIComponent(image.subfolder||'')+'&type='+encodeURIComponent(image.type||'output');
  const resp=await fetch(url);if(!resp.ok)throw Error('无法读取预处理结果');
  const bitmap=await createImageBitmap(await resp.blob());
  let asset=null;try{const saved=await referencePersistCanvas(referenceCanvasFromBitmap(bitmap));asset=saved&&saved.asset?saved.asset:null;}finally{bitmap.close();}
  if(!asset)throw Error('预处理结果保存失败');
  onChange({...value,controlnet:{type:preset.id,label:preset.label,status:'done',asset,error:'',pid:'',node:usedNode}});
 }catch(e){
  onChange({...value,controlnet:{type:preset.id,label:preset.label,status:'error',asset:null,error:errText(e),pid:''}});
  notifyError(e,{title:'参考预处理失败'});
 }
}
async function cancelScene3DPreprocess(value,onChange){
 const pid=value?.controlnet?.pid;
 try{if(pid)await fetch(COMFY+'/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delete:[pid]})});await fetch(COMFY+'/interrupt',{method:'POST'});}catch{}
 onChange({...value,controlnet:{type:'none',label:'',status:'idle',asset:null,error:'',pid:''}});
}
function normalizeScene3D(value){
 if(!value||typeof value!=='object')return null;
 const ref=normalizeReferenceImage(value);
 const region=value.regionSize&&Number(value.regionSize.w)>0&&Number(value.regionSize.h)>0?{value:String(value.regionSize.value||''),label:String(value.regionSize.label||''),w:Number(value.regionSize.w),h:Number(value.regionSize.h)}:undefined;
 const regionAsset=value.regionAsset&&typeof value.regionAsset==='object'&&value.regionAsset.id?value.regionAsset:null;
 const regionOriginal=value.regionOriginal&&typeof value.regionOriginal==='object'&&value.regionOriginal.id?value.regionOriginal:null;
 return {...ref,enabled:value.enabled===true,controlnet:normalizeScene3DControlnet(value.controlnet),regionSize:region,regionAsset,regionOriginal,sceneId:/^[a-zA-Z0-9_-]{1,80}$/.test(value.sceneId||'')?value.sceneId:'',sessionId:/^[a-f0-9-]{8,80}$/.test(value.sessionId||'')?value.sessionId:'',applyRevision:/^[0-9]{1,30}$/.test(String(value.applyRevision||''))?String(value.applyRevision):'',name:String(value.name||'3D 场景').slice(0,128)};
}
// Kept for the loaded DSH page only, including panel unmount/remount.
const SCENE3D_RUNTIME={value:null,heartbeat:null};
function scene3DSessionValue(next){
 const value=normalizeScene3D(next);
 if(value&&!value.sessionId)value.sessionId=editorChannel();
 SCENE3D_RUNTIME.value=value;return value;
}
function releaseScene3D(value,keepalive=false){
 if(!value?.sessionId)return Promise.resolve();
 const body={action:'release',channel:value.sessionId};
 if(keepalive)return fetch(EXPANDER+'/scene3d/drafts',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-DSH-Instance-Id':INSTALLED_INSTANCE_ID},body:JSON.stringify(body)});
 return jpost(EXPANDER+'/scene3d/drafts',body,5000);
}
function beginScene3DSession(){
 if(SCENE3D_RUNTIME.heartbeat)return;
 jpost(EXPANDER+'/scene3d/drafts',{action:'cleanup'},5000).catch(()=>{});
 SCENE3D_RUNTIME.heartbeat=setInterval(()=>{
  const value=SCENE3D_RUNTIME.value;
  if(value?.sessionId)jpost(EXPANDER+'/scene3d/drafts',{action:'touch',channel:value.sessionId},5000).catch(()=>{});
 },20000);
 window.addEventListener('pagehide',event=>{if(!event.persisted)releaseScene3D(SCENE3D_RUNTIME.value,true).catch(()=>{});});
}
function collectScene3DThemeTokens(){
 const dark={'--cc-bg':'#151517','--cc-text':'#f9fafb','--cc-muted':'#a5a5a7','--cc-surface':'#272728','--cc-control':'#313133','--cc-hover':'#3f3f41','--cc-border':'#4c4c4e','--cc-scheme':'dark'};
 if(typeof document==='undefined')return dark;
 const el=document.querySelector('.dsh-comfy-ui')||document.documentElement;
 const accent=(el?getComputedStyle(el).getPropertyValue('--cc-accent'):'').trim();
 if(accent){
  dark['--cc-accent']=accent;
  dark['--cc-accent-bg']=accent+'22';
  dark['--cc-accent-text']='#ffffff';
 }
 return dark;
}
function useScene3DWindow({value,onChange,onApply,theme,width,height,onError,onLoading}){

 const latest=React.useRef();latest.current={value,onChange,onApply,theme,width,height,onError,onLoading};
 const session=React.useRef(value?.sessionId?{window:null,channel:value.sessionId,draft:true,applied:value.applyRevision}:null),sidecarOrigin=new URL(EXPANDER).origin;
 React.useEffect(()=>{const s=session.current;if(!s?.window)return;try{s.window.postMessage({type:'dsh-scene3d-theme',channel:s.channel,theme:collectScene3DThemeTokens()},sidecarOrigin);}catch{}},[theme]);
 React.useEffect(()=>{
  beginScene3DSession();
  const receive=async event=>{
   const s=session.current,d=event.data,c=latest.current;
   if(!s||event.source!==s.window||event.origin!==sidecarOrigin||!d||d.channel!==s.channel||!c.value)return;
   if(d.revision&&!/^[0-9]{1,30}$/.test(String(d.revision)))return;
   if(d.revision&&s.revision&&BigInt(d.revision)<=BigInt(s.revision))return;
   const send=(type,data={})=>s.window?.postMessage({type,channel:s.channel,...data},sidecarOrigin);
   if(d.type==='dsh-scene3d-ready'){
    send('dsh-scene3d-theme',{theme:collectScene3DThemeTokens()});
   }else if(d.type==='dsh-scene3d-saved'){
    const id=String(d.sceneId||'');if(id&&!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return;
    c.onChange({...c.value,sceneId:id,name:String(d.name||'3D 场景').slice(0,128),...(id!==c.value.sceneId?{asset:null,enabled:false}:{})});if(d.revision)s.revision=d.revision;
   }else if(d.type==='dsh-scene3d-apply'){
    const next=normalizeScene3D({...c.value,sceneId:d.sceneId,name:d.name,asset:d.asset,original:d.asset,mode:'reference',enabled:true});
    if(!next?.asset||!next.sceneId){c.onError('3D 截图数据无效，请重新截图');return;}
    try{const bitmap=await referenceLoad(next.asset);bitmap.close();if(session.current!==s||!latest.current.value||latest.current.value!==c.value)return;latest.current.onApply(next);if(d.revision)s.revision=d.revision;send('dsh-scene3d-accepted');}catch(e){latest.current.onError('3D 截图读取失败：'+errText(e));}
   }
  };
  let polling=false;const timer=setInterval(async()=>{
   const s=session.current,c=latest.current;if(!s||!c.value||polling)return;polling=true;
   try{
    if(s.draft){
     const row=await jget(EXPANDER+'/scene3d/drafts/state/'+s.channel,5000);
     if(session.current!==s||latest.current.value!==c.value||!row.active)return;
     if(row.applyRevision&&row.applyRevision!==s.applied&&row.asset){
      const next=normalizeScene3D({...c.value,sceneId:row.sceneId,name:row.name,applyRevision:row.applyRevision,asset:row.asset,original:row.asset,mode:'reference',enabled:true});
      try{const bitmap=await referenceLoad(next.asset);bitmap.close();if(session.current!==s||latest.current.value!==c.value)return;latest.current.onApply(next);s.applied=row.applyRevision;}
      catch(e){latest.current.onError('3D 截图读取失败：'+errText(e));}
     }else if(row.revision&&row.revision!==s.revision){
      c.onChange({...c.value,sceneId:row.sceneId,name:row.name});s.revision=row.revision;
     }
    }else{
     const data=await jget(EXPANDER+'/scene3d/transfer/'+s.channel,5000);
     if(session.current===s&&data.type)await receive({source:s.window,origin:sidecarOrigin,data});
    }
   }catch{}finally{polling=false;}
  },2000);
  window.addEventListener('message',receive);return()=>{clearInterval(timer);window.removeEventListener('message',receive);};
 },[sidecarOrigin]);
 React.useEffect(()=>{if(!value)session.current=null;},[!!value]);
 const open=async(opts={})=>{
  const c=latest.current;if(!c.value||session.current?.opening)return;
  const previous=session.current;
  const channel=previous?.channel||c.value.sessionId||editorChannel();session.current=previous||{window:null,channel};session.current.opening=true;const opening=session.current;c.onLoading?.(true);
  try{
   await requireSidecarFeature('nativeEditorsVersion',1,'3D 原生窗口');
   await requireSidecarFeature('scene3dDraftsVersion',1,'3D 临时场景');
   let sceneKey=String(c.value?.sceneId||'');
   if(sceneKey){try{const list=await jget(EXPANDER+'/scene3d/scenes',5000);const items=Array.isArray(list?.items)?list.items:[];if(!items.some(x=>x&&x.id===sceneKey))sceneKey='';}catch{}}
   const result=await jpost(EXPANDER+'/scene3d/window',{channel,origin:location.origin,instance:INSTALLED_INSTANCE_ID,scene:sceneKey,w:String(c.width||896),h:String(c.height||1152),...(opts&&opts.anima?{anima:'1'}:{}),theme:collectScene3DThemeTokens()},30000);
   if(session.current!==opening||!latest.current.value)return;
   if(result?.channel&&/^[a-f0-9-]{8,80}$/.test(result.channel)){opening.channel=result.channel;opening.draft=result.draft===true;}
   if(result?.ready===false){
    const until=Date.now()+45000;
    while(session.current===opening&&latest.current.value){
     const status=await jget(EXPANDER+'/scene3d/window/status',5000);
     if(!status?.running)throw Error('3D 编辑窗口未能启动，请重试；可在连接设置中检查原生窗口环境');
     if(status.channel&&status.channel!==opening.channel)throw Error('3D 编辑窗口的会话已改变，请重新打开');
     if(status.error)throw Error(status.error);
     if(status.ready)break;
     if(Date.now()>until)throw Error('3D 场景加载时间较长，请查看独立窗口中的加载提示后重试');
     await new Promise(resolve=>setTimeout(resolve,400));
    }
   }
  }
  catch(e){if(session.current===opening){session.current=null;latest.current.onError('无法打开独立3D编辑窗口：'+errText(e));}}
  finally{opening.opening=false;if(!session.current||session.current===opening)latest.current.onLoading?.(false);}
 };
 return open;
}
function Scene3DControl({value,onChange,onRemove,onOpen,busy=false,controlnets=[]}){
 const patchCnet=patch=>onChange({...value,controlnet:{...(value.controlnet||{}),...patch}});
 const cnet=value.controlnet||null;
 const hoverPreview=createReferenceHoverPreview();
 const running=!!(cnet&&cnet.status==='running');
 const shown=cnet&&cnet.status==='done'&&cnet.asset?cnet.asset:value.asset;
 const pick=e=>{const id=e.target.value;if(id==='none'){onChange({...value,controlnet:{type:'none',label:'',status:'idle',asset:null,error:'',pid:''}});return;}runScene3DPreprocess(value,onChange,id).catch(()=>{});};
 return h('div',{className:'cc-control-tile cc-image-control','data-component-key':'scene3d','data-kind':'scene3d'},h('style',null,REFERENCE_CSS),
  h('div',{className:'cc-reference-card'},h('button',{type:'button',className:'cc-reference-thumb',style:S.btn2,'aria-label':busy?'正在打开3D参考编辑器':'打开3D参考编辑器','aria-busy':busy,disabled:busy,onClick:regional?openRegion:onOpen,onMouseEnter:hoverPreview.enter,onMouseLeave:hoverPreview.leave},busy?h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner',size:22})):shown?h('img',{src:EXPANDER+shown.url,alt:shown!==value.asset?'预处理后的参考图':'用于生成的3D镜头截图',style:{width:'100%',height:'100%',objectFit:'contain'}}):'编辑场景',
    running?h('span',{className:'cc-reference-thumb-badge',role:'status'},h(PromptIcon,{name:'spinner',size:12}),'处理中'):null),
   h('div',{className:'cc-reference-fields'},h('strong',{title:value.name},'3D 参考 · '+value.name),
    h('label',{className:'cc-reference-preprocess'},h('span',null,'预处理'),h('select',{value:(cnet&&cnet.type)||'none',disabled:running,onChange:pick,'aria-label':'参考图预处理'},REFERENCE_PREPROCESSORS.map(p=>h('option',{value:p.id},p.label)))),
    running?h('div',{className:'cc-reference-preprocess-row'},h('span',{className:'cc-reference-status',role:'status'},'正在生成'+(cnet.label||'预处理')+'…'),h('button',{type:'button',style:S.btn2,onClick:()=>cancelScene3DPreprocess(value,onChange)},'取消')):null,
    (cnet&&cnet.status==='error')?h('span',{className:'cc-reference-status cc-reference-status-error'},cnet.error||'预处理失败'):null,
    h('div',{className:'cc-reference-controlnet'},
     h('label',{className:'cc-reference-preprocess'},h('span',null,'ControlNet 模型'),h('select',{value:(cnet&&cnet.model)||'',disabled:running,onChange:e=>chooseModel(e.target.value),'aria-label':'ControlNet 模型'},controlnets.length?[h('option',{value:''},'请选择 ControlNet 模型'),...controlnets.map(n=>h('option',{value:n},n))]:[h('option',{value:''},'未安装 ControlNet 模型')])),
     h('div',{className:'cc-image-control-row'},
      h('label',null,h('span',null,'强度'),h(DraggableNumberInput,{value:(cnet&&cnet.strength)??.8,min:0,max:2,step:.01,precision:2,label:'ControlNet 强度',dragPerPixel:.005,onChange:strength=>patchCnet({strength})})),
      h('label',null,h('span',{'data-cc-tooltip':'控制 3D 参考图在生成过程的哪一段生效：0% 是开始，100% 是结束。默认 0% → 100%，整个过程都按参考图的姿势来；如果觉得太死板，把结束调小（比如 80%），最后一段交给 AI 自己画。'},'作用范围'),
       h(DraggableNumberInput,{value:Math.round(((cnet&&cnet.start)??0)*100),min:0,max:100,step:5,precision:0,label:'从百分之几开始参考这张 3D 图（0 = 一开始就参考）',dragPerPixel:.5,onChange:start=>patchCnet({start:Math.max(0,Math.min(1,start/100))})}),
       h('span',{style:{color:'var(--cc-muted)'}},'→'),
       h(DraggableNumberInput,{value:Math.round(((cnet&&cnet.end)??1)*100),min:0,max:100,step:5,precision:0,label:'到百分之几停止参考（100 = 一直参考到最后）',dragPerPixel:.5,onChange:end=>patchCnet({end:Math.max(0,Math.min(1,end/100))})})))),
    h('div',{className:'cc-reference-actions'},h('button',{type:'button',style:{...S.btn2,display:'inline-flex',alignItems:'center',gap:6},disabled:busy,'aria-busy':busy,onClick:onOpen},busy?h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner',size:13})):null,busy?'正在打开…':'编辑场景')),
    h('span',{className:'cc-reference-status',role:busy?'status':undefined},busy?'正在准备独立窗口与场景…':(cnet&&cnet.status==='done'?shown.width+' × '+shown.height+' · 已应用 '+cnet.label:value.asset?value.asset.width+' × '+value.asset.height+' · 已截取镜头':'在独立窗口中摆姿并用于生成'))),
  h('button',{type:'button',className:'cc-control-remove','aria-label':'移除3D参考',onClick:onRemove},h(PromptIcon,{name:'x',size:13})),
  hoverPreview.render(shown?EXPANDER+shown.url:null)));
}

const ANIMA_MODELS=[
 {file:'anima_3dpose_6200.safetensors',label:'Anima 3D Pose 6200 · 带阴影网格'},
 {file:'anima_3dpose_outline_7000.safetensors',label:'Anima 3D Pose Outline 7000 · 轮廓增强'},
 {file:'anima_regional_4335.safetensors',label:'Anima Regional 4335 · 区域色块'}
];
const ANIMA_CSS='.cc-anima-fields{display:flex;flex-direction:column;gap:10px;min-width:0}.cc-anima-row{display:grid;grid-template-columns:88px minmax(0,1fr);gap:10px;align-items:center}.cc-anima-label{color:var(--cc-muted);font-size:12px;white-space:nowrap}.cc-anima-control{min-width:0;display:flex;align-items:center;gap:8px}.cc-anima-control>select{flex:1 1 auto;min-width:0;width:100%}.cc-anima-control .cc-drag-number{flex:1 1 0;min-width:0}.cc-anima-range-row{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0}.cc-anima-range-row .cc-drag-number{flex:1 1 0;min-width:0}.cc-anima-note{color:var(--cc-muted);font-size:11px;line-height:1.5;margin-left:98px}.cc-anima-fields>strong{display:block;margin-bottom:2px}';
function AnimaControl({value,onChange,onRemove,onOpen,busy=false,downloads={},onDownload,downloading={},nodeInstalled=true,nodeInstalling=false,onInstallNode,theme}){
 const cnet=value.controlnet||{},model=cnet.model||'',hoverPreview=createReferenceHoverPreview();
 const [regionOpen,setRegionOpen]=React.useState(false);
 const [regionValue,setRegionValue]=React.useState(null);
 const [regionError,setRegionError]=React.useState('');
 const regional=/regional/i.test(String(model));
 const openRegion=async()=>{
  try{
   let v=value;
   {
    const rs=v.regionSize||(IMAGE_SIZE_PRESETS[0]||{w:512,h:512});
    const cur=v.regionAsset||v.asset;
    const asset=cur&&cur.id&&Number(cur.width)===Number(rs.w)&&Number(cur.height)===Number(rs.h)?cur:await (async()=>{const c=document.createElement('canvas');c.width=rs.w;c.height=rs.h;const x=c.getContext('2d');x.fillStyle='#000000';x.fillRect(0,0,rs.w,rs.h);const stored=await referencePersistCanvas(c);const a=(stored&&(stored.asset||stored.original))||stored;if(!a||!a.id)throw Error('创建空白区域图失败');return a;})();
    if(v.regionAsset!==asset){v={...value,regionAsset:asset,regionOriginal:value.regionOriginal||value.original||asset,name:'区域色块图'};onChange(v);}
    setRegionError('');setRegionValue({...v,asset,original:v.regionOriginal||asset});setRegionOpen(true);
   }
  }catch(e){setRegionError('打开区域色块编辑器失败：'+(e?.message||e));}
 };
 const patchCnet=patch=>onChange({...value,controlnet:{...cnet,...patch}});
 const chooseModel=next=>{const nowRegional=/regional/i.test(String(next));if(nowRegional!==regional){if(nowRegional)onChange({...value,controlnet:{...cnet,model:next},regionAsset:value.regionAsset||(Number(value.asset?.width)===Number((value.regionSize||{}).w)&&Number(value.asset?.height)===Number((value.regionSize||{}).h)?value.asset:null)});else onChange({...value,controlnet:{...cnet,model:next}});return;}patchCnet({model:next});};
 const options=[h('option',{key:'none',value:''},'请选择模型')].concat(ANIMA_MODELS.map(m=>h('option',{key:m.file,value:m.file},m.label+(downloads[m.file]===false?'（未下载）':''))));
 const downloadBtn=(()=>{const missingAll=ANIMA_MODELS.filter(m=>downloads[m.file]===false);const busyNow=Object.keys(downloading).some(k=>downloading[k]);const label=busyNow?'下载中…':(model?(downloads[model]===false?'下载模型':'已就绪'):(missingAll.length?'下载模型（'+missingAll.length+'）':'已就绪'));const can=!!(model?downloads[model]===false:missingAll.length);return h('button',{type:'button',style:{...S.btn2,display:'inline-flex',alignItems:'center',gap:6,flex:'none'},disabled:busy||busyNow||!can,onClick:async e=>{e.preventDefault();const targets=model&&downloads[model]===false?[model]:missingAll.map(m=>m.file);for(const f of targets){await onDownload?.(f);}}},busyNow?h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner',size:13})):null,label);})();
 const modelField=h('label',{className:'cc-reference-preprocess cc-anima-model-row'},
  h('span',null,'模型'),
  h('select',{value:model,disabled:busy,onChange:e=>patchCnet({model:e.target.value}),'aria-label':'Anima ControlNet 模型'},options),
  downloadBtn);
 const rangeRow=h(React.Fragment,null,
  h(DraggableNumberInput,{value:Math.round((cnet.start??0)*100),min:0,max:100,step:5,precision:0,label:'从百分之几开始参考',dragPerPixel:.5,onChange:start=>patchCnet({start:Math.max(0,Math.min(1,start/100))})}),
  h('span',{style:{color:'var(--cc-muted)'}},'→'),
  h(DraggableNumberInput,{value:Math.round((cnet.end??1)*100),min:0,max:100,step:5,precision:0,label:'到百分之几停止参考',dragPerPixel:.5,onChange:end=>patchCnet({end:Math.max(0,Math.min(1,end/100))})}));
 const strengthInput=h(DraggableNumberInput,{value:cnet.strength??1,min:0,max:2,step:.01,precision:2,label:'Anima Control 强度',dragPerPixel:.005,onChange:strength=>patchCnet({strength})});
 const displayAsset=regional?(value.regionAsset||value.asset||null):(value.asset||null);
 const thumb= h('button',{type:'button',className:'cc-reference-thumb',style:S.btn2,'aria-label':regional?'编辑区域色块图':'打开 Anima 3D 参考编辑器','aria-busy':busy,disabled:busy,onClick:regional?openRegion:onOpen,onMouseEnter:hoverPreview.enter,onMouseLeave:hoverPreview.leave},
  busy?h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner',size:22})):
  displayAsset?h('img',{src:EXPANDER+displayAsset.url,alt:'Anima 控制图',style:{width:'100%',height:'100%',objectFit:'contain'}}):(regional?'编辑区域图':'编辑 3D 场景'));
 const row=(label,content)=>h('div',{className:'cc-anima-row'},label?h('span',{className:'cc-anima-label'},label):h('span',{className:'cc-anima-label'}),h('div',{className:'cc-anima-control'},content));
 const editBtn=h('button',{type:'button',style:{...S.btn2,display:'inline-flex',alignItems:'center',gap:6},disabled:busy,onClick:regional?openRegion:onOpen},busy?h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner',size:13})):null,busy?'正在打开…':(regional?'编辑区域图':'编辑 3D 场景'));
 const installBtn=nodeInstalled?null:h('button',{type:'button',style:{...S.btn2,display:'inline-flex',alignItems:'center',gap:6},disabled:busy||nodeInstalling,onClick:()=>onInstallNode?.()},nodeInstalling?h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner',size:13})):null,nodeInstalling?'安装中…':'安装节点');
 const sizeSelect=regional?h(SelectMenu,{theme,label:'区域图画布尺寸',value:(value.regionSize&&value.regionSize.value)||(IMAGE_SIZE_PRESETS[0]&&IMAGE_SIZE_PRESETS[0].value),options:IMAGE_SIZE_PRESETS.map(p=>({value:p.value,label:p.label})),onChange:key=>{const p=IMAGE_SIZE_PRESETS.find(x=>x.value===key);if(!p)return;const changed=!value.regionSize||Number(value.regionSize.w)!==Number(p.w)||Number(value.regionSize.h)!==Number(p.h);onChange({...value,regionSize:{value:p.value,label:p.label,w:p.w,h:p.h},...(changed?{asset:null,original:null,name:'区域色块图'}:{})});}}):null;
 const fields=h('div',{className:'cc-reference-fields cc-anima-fields'},
  h('strong',{'data-cc-tooltip':regional?'用固定预设色块区分人物区域，背景保持纯黑。':'用带阴影的 3D 人体网格（黑底）控制姿势，比 OpenPose 线稿更贴近这个模型训练时的输入。'},model?(regional?'区域色块图':'3D 姿态参考'):'选择模型后开始'),
  row('模型',[h('select',{value:model,disabled:busy,onChange:e=>patchCnet({model:e.target.value}),'aria-label':'Anima ControlNet 模型',style:{flex:'1 1 auto',minWidth:0}},options),downloadBtn]),
  regional?row('画布尺寸',sizeSelect):null,
  installBtn?row('',[installBtn]):null,
  row('强度',strengthInput),
  row('作用范围',h('div',{className:'cc-anima-range-row'},rangeRow)),
  h('span',{className:'cc-anima-note'},regional?'用固定预设色块区分区域（背景黑色），颜色之间不要重叠；建议 512 / 768 / 1024、30 步、CFG 4。':'建议 512 / 768 / 1024，30 步、CFG 4；画布比例与 3D 截图保持一致。'));
 return h('div',{className:'cc-control-tile cc-image-control','data-component-key':'anima','data-kind':'anima'},h('style',null,REFERENCE_CSS),h('style',null,ANIMA_CSS),
  h('div',{className:'cc-reference-card'},thumb,fields),
  hoverPreview.render(displayAsset?EXPANDER+displayAsset.url:null),
  regional&&regionOpen&&regionValue?h(ReferenceImageEditor,{value:regionValue,target:{w:regionValue.asset.width,h:regionValue.asset.height},theme,sizeSettings:{w:regionValue.asset.width,h:regionValue.asset.height,multiplier:1,alignment:8},initialTool:'brush',singleSave:true,saveIntent:'regional',saveLabel:'保存',regionalMode:true,onClose:()=>setRegionOpen(false),onExit:(intent,result)=>{if(intent!=='regional')return false;const asset=result?.asset;if(!asset)return false;setRegionOpen(false);onChange({...value,regionAsset:asset,regionOriginal:asset,name:'区域色块图'});return true;}}):null,
  regionError?h('span',{className:'cc-reference-status cc-reference-status-error'},regionError):null);
}
