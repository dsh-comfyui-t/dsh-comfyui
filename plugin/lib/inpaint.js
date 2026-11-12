/** Dedicated mask editing. Reference image editing remains an ordinary raster editor. */
function InpaintFields({value,disabled,onChange,onEdit}){
 const number=(key,label,min,max)=>h('fieldset',{disabled,style:{margin:0,padding:0,border:0,minWidth:0}},h('label',null,h('span',null,label+' (px)'),h(DraggableNumberInput,{value:value[key],min,max,step:1,precision:0,label:'局部重绘'+label,disabled,onChange:v=>onChange({...value,[key]:v})})));
 return h(React.Fragment,null,
  h('div',{className:'cc-reference-actions'},h('button',{type:'button',style:S.btn2,disabled:disabled||!value.asset,onClick:onEdit},value.mask?'编辑遮罩':'绘制遮罩'),value.mask?h('img',{src:EXPANDER+value.mask.url,alt:'重绘遮罩',style:{width:56,height:42,objectFit:'contain',border:'1px solid var(--cc-border)',borderRadius:6}}):null),
  number('grow','遮罩扩展',0,64),number('feather','边缘过渡',0,31),
  h('span',{className:'cc-reference-status'},'白色重绘，黑色保留；扩展和过渡按最终尺寸计算。普通底模可用，专用 Fill / Inpaint 权重暂未适配。'),
  h('span',{className:'cc-reference-status'},value.mask?'已选择 '+(value.coverage*100).toFixed(1)+'% · 更换或编辑底图后需重画遮罩':'先选择底图，再绘制遮罩。开启后会关闭普通图生图。'));
}
function inpaintCoverage(c){const a=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4)n+=a[i]/255;return n/(c.width*c.height);}
function inpaintImportMask(c,bitmap){
 if(c.width!==bitmap.width||c.height!==bitmap.height)throw Error('遮罩尺寸与底图不一致，请重新选择底图并绘制');
 const x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,c.width,c.height);x.drawImage(bitmap,0,0);const im=x.getImageData(0,0,c.width,c.height);
 for(let i=0;i<im.data.length;i+=4){const alpha=Math.round(im.data[i]*im.data[i+3]/255);im.data[i]=im.data[i+1]=im.data[i+2]=255;im.data[i+3]=alpha;}x.putImageData(im,0,0);
}
const INPAINT_CSS=`
.dsh-comfy-floating .cc-inpaint-board>canvas{position:absolute;inset:0;width:100%;height:100%}.dsh-comfy-floating .cc-inpaint-board{background:transparent}
.dsh-comfy-floating .cc-inpaint-editor{gap:8px}.dsh-comfy-floating .cc-inpaint-editor .cc-reference-options{flex-direction:column;align-items:stretch;gap:8px}.dsh-comfy-floating .cc-inpaint-editor .cc-reference-options label{justify-content:space-between;max-width:100%}.dsh-comfy-floating .cc-inpaint-editor .cc-reference-space{width:max-content;height:max-content;min-height:100%;min-width:100%}.dsh-comfy-floating .cc-inpaint-editor .cc-reference-viewport{overflow:auto;background:var(--cc-control)}.dsh-comfy-floating .cc-inpaint-editor .cc-reference-board{position:relative;flex:none;transform:none}.dsh-comfy-floating .cc-inpaint-editor .cc-reference-rail .cc-reference-flyout{width:240px}.dsh-comfy-floating .cc-inpaint-editor .cc-reference-rail .cc-reference-flyout .cc-drag-number{max-width:120px}.dsh-comfy-floating .cc-mask-preview-controls{display:flex;flex-direction:column;gap:10px}.dsh-comfy-floating .cc-mask-preview-controls label{display:flex;gap:8px;align-items:center}.dsh-comfy-floating .cc-mask-preview-controls .cc-drag-number{flex:1;min-width:0;max-width:128px}.dsh-comfy-floating .cc-inpaint-editor .cc-reference-footer>span{margin-right:0}
`;
function InpaintMaskEditor({value,theme,onClose,onApply,onEditBase,sizeSettings}){
 const base=React.useRef(null),canvas=React.useRef(null),viewport=React.useRef(null),maskCursor=React.useRef(null),cursorPoint=React.useRef(null),alive=React.useRef(true),controller=React.useRef(null),lock=React.useRef(true),drag=React.useRef(null),history=React.useRef({items:[],index:-1}),file=React.useRef(null);
 const [busy,setBusy]=React.useState(true),[saving,setSaving]=React.useState(false),[loaded,setLoaded]=React.useState(false),[epoch,setEpoch]=React.useState(0),[error,setError]=useErrorState(''),[dirty,setDirty]=React.useState(false),[discard,setDiscard]=React.useState(false),[tool,setTool]=React.useState('brush'),[stroke,setStroke]=React.useState(40),[opacity,setOpacity]=React.useState(.55),[maskOnly,setMaskOnly]=React.useState(false),[zoom,setZoom]=React.useState(1),[fit,setFit]=React.useState(1),[coverage,setCoverage]=React.useState(0),[drawing,setDrawing]=React.useState(false),[revision,setRevision]=React.useState(0),[box,setBox]=React.useState(null);
 const [generationSize,setGenerationSize]=React.useState(()=>({...imageEditorSize(value,sizeSettings),grow:value.grow??0,feather:value.feather??8})),exitAction=React.useRef(onClose);
 const [reportReadError,clearReadError]=useReadErrorNotice(setError,'遮罩读取失败',()=>{if(alive.current)setEpoch(v=>v+1);});
 const [previewBackground,setPreviewBackground]=React.useState(()=>{try{return normalizePreviewBackground(lsRead().previewBackground);}catch{return 'dark';}});
 const w=value.asset.width,hgt=value.asset.height;
 async function snapshot(){
  const c=canvas.current;
  let item;
  if(c.width*c.height*4<=48*1024*1024){
   const copy=referenceCanvas(c.width,c.height);copy.getContext('2d').drawImage(c,0,0);
   item={canvasSnapshot:copy,bytes:c.width*c.height*4};
  }else{const blob=await referenceBlob(c);item={blob,bytes:blob.size};}
  if(!alive.current)return;const hs=history.current;hs.items=hs.items.slice(0,hs.index+1).concat(item);
  while(hs.items.length>1&&(hs.items.length>20||hs.items.reduce((n,x)=>n+x.bytes,0)>96*1024*1024))hs.items.shift();
  hs.index=hs.items.length-1;setCoverage(inpaintCoverage(c));setRevision(v=>v+1);
 }
 async function run(fn,record=true,quiet=false){if(lock.current||drag.current)return;lock.current=true;if(!quiet)setBusy(true);setError('');try{await fn();if(record){await snapshot();if(alive.current)setDirty(true);}}catch(e){if(alive.current)setError(errText(e));}finally{lock.current=false;if(alive.current&&!quiet)setBusy(false);}}
 React.useEffect(()=>{alive.current=true;lock.current=true;const ctl=new AbortController();clearReadError();controller.current=ctl;setBusy(true);setLoaded(false);setError('');
  (async()=>{let image,mask;try{image=await referenceLoad(value.asset,ctl.signal);if(value.mask)mask=await referenceLoad(value.mask,ctl.signal);if(!alive.current||ctl.signal.aborted)return;
   if(image.width!==w||image.height!==hgt)throw Error('底图尺寸已变化，请重新选择');
   for(const c of [base.current,canvas.current]){c.width=w;c.height=hgt;}base.current.getContext('2d').drawImage(image,0,0);
   if(mask)inpaintImportMask(canvas.current,mask);await snapshot();if(alive.current){clearReadError();setLoaded(true);}
  }catch(e){if(alive.current&&!ctl.signal.aborted)reportReadError(e);}finally{image?.close();mask?.close();if(alive.current){lock.current=false;setBusy(false);}}})();
  return()=>{alive.current=false;clearReadError();ctl.abort();drag.current=null;history.current={items:[],index:-1};};
 },[epoch]);
 React.useEffect(()=>{const el=viewport.current;if(!el)return;const calc=()=>setFit(Math.max(.01,Math.min(1,(el.clientWidth-32)/w,(el.clientHeight-32)/hgt)));calc();const ro=new ResizeObserver(calc);ro.observe(el);return()=>ro.disconnect();},[w,hgt]);
 React.useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=e=>{e.preventDefault();const before=canvas.current?.getBoundingClientRect();if(!before||!before.width)return;const x=(e.clientX-before.left)/before.width,y=(e.clientY-before.top)/before.height;setZoom(current=>Math.max(.1,Math.min(12,current*(e.deltaY>0?.9:1.1))));requestAnimationFrame(()=>{const after=canvas.current?.getBoundingClientRect();if(!after)return;el.scrollLeft+=after.left+x*after.width-e.clientX;el.scrollTop+=after.top+y*after.height-e.clientY;});};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 async function undo(delta){const hs=history.current,next=hs.index+delta;if(next<0||next>=hs.items.length)return;
  await run(async()=>{
   const record=hs.items[next],bitmap=record.blob?await referenceRead(record.blob):null;
   try{if(!alive.current)return;const c=canvas.current,x=c.getContext('2d');x.clearRect(0,0,w,hgt);x.drawImage(bitmap||record.canvasSnapshot,0,0);hs.index=next;setCoverage(inpaintCoverage(c));setDirty(true);setRevision(v=>v+1);}finally{bitmap?.close();}
  },false,true);
 }
 function point(e){const r=canvas.current.getBoundingClientRect();return {x:Math.max(0,Math.min(w,(e.clientX-r.left)*w/r.width)),y:Math.max(0,Math.min(hgt,(e.clientY-r.top)*hgt/r.height))};}
 function previewMaskBrush(e){
  const tip=maskCursor.current,baseCanvas=base.current,board=baseCanvas?.parentElement;
  if(!tip||!board)return;
  cursorPoint.current={clientX:e.clientX,clientY:e.clientY,pointerType:e.pointerType};
  const r=board.getBoundingClientRect(),inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  if(e.pointerType==='touch'||!inside||!loaded||!['brush','eraser'].includes(tool)){
   tip.style.display='none';board.style.cursor=tool==='pan'?'grab':'crosshair';return;
  }
  const diameter=Math.max(3,(Math.max(1,Number(stroke)||1))*fit*zoom);
  tip.style.left=(e.clientX-r.left)+'px';tip.style.top=(e.clientY-r.top)+'px';tip.style.width=diameter+'px';tip.style.height=diameter+'px';
  tip.dataset.tool=tool;tip.style.display='flex';board.style.cursor='none';
 }
 function hideMaskBrush(){if(maskCursor.current)maskCursor.current.style.display='none';const board=base.current?.parentElement;if(board)board.style.cursor=tool==='pan'?'grab':'crosshair';cursorPoint.current=null;}
 React.useEffect(()=>{if(cursorPoint.current)previewMaskBrush(cursorPoint.current);},[tool,stroke,fit,zoom,loaded]);

 function paint(a,b,erase){const x=canvas.current.getContext('2d');x.save();x.globalCompositeOperation=erase?'destination-out':'source-over';x.strokeStyle='#fff';x.fillStyle='#fff';x.lineWidth=Number(stroke)||1;x.lineCap='round';x.lineJoin='round';x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();if(a.x===b.x&&a.y===b.y){x.beginPath();x.arc(a.x,a.y,(Number(stroke)||1)/2,0,Math.PI*2);x.fill();}x.restore();}
 function down(e){if(!loaded||lock.current||drag.current||![0,1].includes(e.button))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);drag.current={id:e.pointerId,tool:e.button===1?'pan':tool,p,last:p,client:{x:e.clientX,y:e.clientY},scroll:{x:viewport.current.scrollLeft,y:viewport.current.scrollTop}};setDrawing(true);if(tool==='rect'&&e.button===0)setBox({x:p.x,y:p.y,w:0,h:0});if(tool==='brush'||tool==='eraser')if(e.button===0)paint(p,p,tool==='eraser');}
 function move(e){const d=drag.current;if(!d||d.id!==e.pointerId)return;if(d.tool==='pan'){viewport.current.scrollLeft=d.scroll.x+d.client.x-e.clientX;viewport.current.scrollTop=d.scroll.y+d.client.y-e.clientY;return;}const p=point(e);if(d.tool==='brush'||d.tool==='eraser')paint(d.last,p,d.tool==='eraser');d.last=p;if(d.tool==='rect')setBox({x:Math.min(d.p.x,p.x),y:Math.min(d.p.y,p.y),w:Math.abs(d.p.x-p.x),h:Math.abs(d.p.y-p.y)});}
 React.useEffect(()=>{const blur=()=>{const d=drag.current;if(d)finish({pointerId:d.id});};window.addEventListener('blur',blur);return()=>window.removeEventListener('blur',blur);},[]);
 async function finish(e){const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;setDrawing(false);setBox(null);if(d.tool==='pan')return;
  await run(()=>{if(d.tool==='rect'){const x=canvas.current.getContext('2d');x.fillStyle='#fff';x.fillRect(Math.min(d.p.x,d.last.x),Math.min(d.p.y,d.last.y),Math.max(1,Math.abs(d.last.x-d.p.x)),Math.max(1,Math.abs(d.last.y-d.p.y)));}});
 }
 function whole(kind){return run(()=>{const c=canvas.current,x=c.getContext('2d');if(kind==='clear')x.clearRect(0,0,w,hgt);else if(kind==='all'){x.fillStyle='#fff';x.fillRect(0,0,w,hgt);}else{const im=x.getImageData(0,0,w,hgt);for(let i=0;i<im.data.length;i+=4){im.data[i]=im.data[i+1]=im.data[i+2]=255;im.data[i+3]=255-im.data[i+3];}x.putImageData(im,0,0);}});}
 const requestExit=action=>{if(saving||drag.current)return;exitAction.current=action;if(dirty)setDiscard(true);else action();};
 const close=()=>requestExit(onClose);
 async function apply(){if(!loaded||lock.current||drag.current)return;const amount=inpaintCoverage(canvas.current);if(amount<=0){setError('遮罩为空，请涂抹需要重绘的区域');return;}lock.current=true;setBusy(true);setSaving(true);setError('');const ctl=new AbortController();controller.current=ctl;
  try{validateImageEditorSize(value,{w,h:hgt},generationSize);if(!Number.isInteger(Number(generationSize.grow))||Number(generationSize.grow)<0||Number(generationSize.grow)>64||!Number.isInteger(Number(generationSize.feather))||Number(generationSize.feather)<0||Number(generationSize.feather)>31)throw Error('遮罩扩展需为 0–64px，边缘过渡需为 0–31px');const blob=await referenceBlob(referenceComposite(canvas.current,[],'#000000')),mask=await referenceStore(blob,ctl.signal);if(alive.current&&!ctl.signal.aborted)onApply(mask,amount,{...generationSize,grow:Number(generationSize.grow),feather:Number(generationSize.feather)});}catch(e){if(alive.current&&!ctl.signal.aborted)setError(errText(e));}finally{if(alive.current&&controller.current===ctl&&!ctl.signal.aborted){lock.current=false;setBusy(false);setSaving(false);}}
 }
 const stop=()=>{controller.current?.abort();lock.current=false;setBusy(false);setSaving(false);};
 const blocked=busy||drawing||!loaded;
 // Keyboard shortcuts must work after drawing on an unfocusable canvas as well.
 // Capture at window level only while this modal is active; never hijack number inputs.
 React.useEffect(()=>{if(!loaded)return;
  const onKey=e=>{if(!(e.ctrlKey||e.metaKey)||discard)return;
   const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
   const k=String(e.key||'').toLowerCase();if(k!=='z'&&k!=='y')return;
   e.preventDefault();e.stopPropagation();
   if(!busy&&!drawing)undo(k==='y'||e.shiftKey?1:-1);
  };
  window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true);
 },[loaded,busy,drawing,discard,revision]);

 const button=(label,fn,disabled=false,icon)=>h('button',{type:'button',style:S.btn2,disabled:blocked||disabled,onClick:fn,'aria-label':label,'data-cc-tooltip':label},icon?h(PromptIcon,{name:icon,size:16}):label);
 return h(OverlayModal,{title:'编辑重绘遮罩',theme,width:2400,maxHeight:'calc(100dvh - 28px)',className:'cc-reference-dialog cc-reference-studio-dialog cc-inpaint-dialog',onClose:close},h('style',null,REFERENCE_CSS+REFERENCE_STUDIO_CSS+INPAINT_CSS),
  h('div',{className:'cc-reference-editor cc-reference-studio cc-inpaint-editor'},
   h('div',{className:'cc-reference-main'},
    h('div',{className:'cc-reference-rail',role:'toolbar','aria-label':'局部重绘编辑工具'},
     ...([['brush','画笔'],['eraser','橡皮擦'],['rect','矩形'],['pan','平移']].map(([name,label])=>h('div',{className:'cc-reference-tool',key:name},
      h('button',{type:'button',style:S.btn2,disabled:blocked,'aria-label':label,'aria-pressed':tool===name,title:label,onClick:()=>setTool(name)},h(ReferenceToolIcon,{name:name==='pan'?'select':name})),
      name==='brush'||name==='eraser'?h('div',{className:'cc-reference-flyout'},h('div',{className:'cc-reference-flyout-body'},h('strong',null,label),h('label',{className:'cc-flyout-row'},h('span',null,'直径 (px)'),h(DraggableNumberInput,{value:stroke,onChange:v=>setStroke(Math.max(1,Math.min(2048,Number(v)||1))),label:'遮罩画笔直径',step:1,precision:0,dragPerPixel:.1,className:'cc-parameter-number',allowEmpty:true,min:1,max:2048,disabled:blocked})))):null))),
     h('div',{className:'cc-rail-sep'}),
     h('div',{className:'cc-reference-tool'},h('button',{type:'button',style:S.btn2,title:'撤销 (Ctrl+Z)','aria-label':'撤销遮罩编辑',disabled:blocked||history.current.index<1,onClick:()=>undo(-1)},h(PromptIcon,{name:'undo',size:16}))),
     h('div',{className:'cc-reference-tool'},h('button',{type:'button',style:S.btn2,title:'重做 (Ctrl+Shift+Z)','aria-label':'重做遮罩编辑',disabled:blocked||history.current.index>=history.current.items.length-1,onClick:()=>undo(1)},h(PromptIcon,{name:'redo',size:16})))),
   h('div',{className:'cc-reference-viewport','data-editor-preview-background':previewBackground,ref:viewport,onDoubleClick:e=>{if(!e.target.closest('.cc-reference-board')){setZoom(1);e.currentTarget.scrollLeft=0;e.currentTarget.scrollTop=0;}}},h('div',{className:'cc-reference-space'},h('div',{className:'cc-reference-board cc-inpaint-board',style:{width:w*fit*zoom,height:hgt*fit*zoom,cursor:tool==='pan'?'grab':'crosshair'},onPointerEnter:previewMaskBrush,onPointerLeave:hideMaskBrush,onPointerDown:e=>{previewMaskBrush(e);down(e);},onPointerMove:e=>{previewMaskBrush(e);move(e);},onPointerUp:finish,onPointerCancel:finish,onLostPointerCapture:finish},h('canvas',{ref:base,'aria-label':'局部重绘底图画布',style:{visibility:maskOnly?'hidden':'visible'}}),h('canvas',{ref:canvas,'aria-label':'重绘遮罩画布',style:{opacity:maskOnly?1:opacity,filter:maskOnly?'none':'sepia(1) saturate(8) hue-rotate(150deg) brightness(.85)'}}),box?h('svg',{viewBox:'0 0 '+w+' '+hgt,'aria-hidden':true},h('rect',{x:box.x,y:box.y,width:box.w,height:box.h,fill:'var(--cc-accent-bg)',stroke:'var(--cc-accent)',strokeWidth:2/(fit*zoom),strokeDasharray:8/(fit*zoom)})):null,h(EditorSizeGuide,{value,size:{w,h:hgt},settings:generationSize}),h('div',{ref:maskCursor,className:'cc-editor-brush-cursor','aria-hidden':true})))),
    h(EditorResizableSidebar,null,
     h(EditorPanelSection,{title:'画布背景'},h(EditorCanvasBackground,{value:previewBackground,onChange:mode=>{setPreviewBackground(mode);try{lsWrite({previewBackground:mode});}catch{}}})),
     h(EditorSizePopover,{disabled:!loaded},h(ImageEditorSizeFields,{value,size:{w,h:hgt},settings:generationSize,onChange:next=>{setGenerationSize(next);setDirty(true);},disabled:blocked,theme})),
     h(EditorPanelSection,{title:'遮罩操作'},
      h('input',{type:'file',ref:file,hidden:true,accept:'.png','aria-label':'导入遮罩文件',onChange:e=>{const selected=e.target.files?.[0];e.target.value='';if(selected)run(async()=>{if(!/\.png$/i.test(selected.name))throw Error('请选择黑白 PNG 遮罩');const bitmap=await referenceRead(selected);try{if(alive.current)inpaintImportMask(canvas.current,bitmap);}finally{bitmap.close();}});}}),
      h('div',{className:'cc-flyout-actions'},button('导入遮罩',()=>file.current.click()),button('全部重绘',()=>whole('all'))),
      h('div',{className:'cc-flyout-actions'},button('清空遮罩',()=>whole('clear')),button('反选遮罩',()=>whole('invert'))),
      h('span',{className:'cc-editor-hint'},'白色遮罩区域将重绘，其余区域保留。遮罩强度不受预览透明度影响。')),
     h(EditorPanelSection,{title:'遮罩预览'},
      h('div',{className:'cc-mask-preview-controls'},h('label',null,'显示透明度 (%)',h(DraggableNumberInput,{value:Math.round(opacity*100),onChange:v=>setOpacity(Math.max(.1,Math.min(1,(Number(v)||10)/100))),min:10,max:100,step:5,precision:0,dragPerPixel:.2,label:'遮罩预览透明度',className:'cc-parameter-number',disabled:busy})),
       h('button',{type:'button',style:S.btn2,disabled:busy,'aria-pressed':maskOnly,onClick:()=>setMaskOnly(v=>!v)},maskOnly?'显示底图':'仅看遮罩')),
      onEditBase?button('编辑底图',()=>requestExit(onEditBase)):null),
     h(EditorPanelSection,{title:'采样边界'},
      ...([['grow','遮罩扩展',64],['feather','边缘过渡',31]].map(([key,label,max])=>h('label',{key,className:'cc-flyout-row'},h('span',null,label+' (px)'),h(DraggableNumberInput,{value:generationSize[key],onChange:v=>{setGenerationSize(cur=>({...cur,[key]:v}));setDirty(true);},label:label,step:1,precision:0,dragPerPixel:.1,className:'cc-parameter-number',allowEmpty:true,min:0,max,disabled:blocked}))))
     )
    )
   ),
   h('footer',{className:'cc-reference-footer'},h('span',null,w+' × '+hgt+' · 已选择 '+(coverage*100).toFixed(1)+'%'),h('span',{className:'cc-zoom'},Math.round(fit*zoom*100)+'%'),h('button',{type:'button',style:S.btn2,disabled:saving||drawing,onClick:close},'取消'),h(TaskAction,{label:'应用遮罩',busy:saving,busyLabel:'正在保存遮罩…',disabled:blocked||coverage<=0,onStart:apply,onStop:stop})),
   discard?h(OverlayModal,{title:'放弃未保存的遮罩修改？',theme,width:440,zIndex:2147482100,onClose:()=>setDiscard(false)},
    h('p',{className:'cc-editor-confirm-description'},'退出后，本次尚未应用的遮罩修改将丢失。'),
    h('div',{className:'cc-editor-confirm-actions'},h('button',{type:'button',style:S.btn2,onClick:()=>setDiscard(false)},'继续编辑'),h('button',{type:'button',style:S.btn2,onClick:()=>{setDiscard(false);exitAction.current();}},'放弃修改'))):null));
}
