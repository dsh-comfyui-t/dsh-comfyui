/** Transactional raster editing with a separate, non-exported inpaint mask. */
const REFERENCE_MASK_LAYER='editor-inpaint-mask';
function referenceEditedFilename(name){return String(name||'ComfyUI').split(/[\\/]/).pop().replace(/\.[^.]+$/,'')+'_edited.png';}
async function referenceExportEdited(intent,result,{folder='',prefix='dsh_comfy'}={}){
 await requireSidecarFeature('imageEditorExportsVersion',2,'图片编辑保存出口');
 const source=result.sourceOutput||{},saved=await jpost(EXPANDER+'/outputs/editor-export',{asset:result.asset.id,original:result.original.id,mode:intent==='output'?'output':'download',folder,prefix,source:{path:source.path||'',image:source.image||null,prompt_id:source.prompt_id||'',filename:source.filename||result.name,params:editorOriginalParams(source.params)}},60000);
 if(intent==='saveas'){const blob=await referenceFetchBlob(saved.asset.id);await outputWriteSavedBlob(blob,referenceEditedFilename(result.name),result.destination);}
 return saved;
}

function referenceCanvasFromBitmap(bitmap){const canvas=referenceCanvas(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,0,0);return canvas;}
const REFERENCE_LIMITS={bytes:32*1024*1024,pixels:16*1024*1024,edge:8192};
function referenceCheckSize(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>8192||h>8192||w*h>REFERENCE_LIMITS.pixels)throw Error('图片最大边 8192px，总像素不超过 16MP');}
function referenceCanvas(w,h){referenceCheckSize(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function referenceBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('图片编码失败')),'image/png'));}
async function referenceRead(blob){if(!blob||blob.size>REFERENCE_LIMITS.bytes)throw Error('图片文件不得超过 32 MiB');const bitmap=await createImageBitmap(blob);try{referenceCheckSize(bitmap.width,bitmap.height);}catch(e){bitmap.close();throw e;}return bitmap;}
async function referenceStore(blob,signal){
 try{await requireSidecarFeature('referenceImagesVersion',1,'图生图 / 局部重绘');}catch(_){/* feature-check 未声明时以 POST 结果为准 */}
 if(blob.size>REFERENCE_LIMITS.bytes)throw Error('PNG 超过 32 MiB，请缩小图片');
 const r=await sidecarFetch(EXPANDER+'/references',{method:'POST',headers:{'Content-Type':'image/png',...instanceHeaders()},body:blob,signal});
 const data=await r.json();if(!r.ok)throw Error(data.error||'图生图保存失败');return data;
}
async function referencePersistCanvas(canvas,signal){
 const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
 let opaque=true;for(let i=3;i<pixels.length;i+=4){if(pixels[i]!==255){opaque=false;break;}}
 const original=await referenceStore(await referenceBlob(canvas),signal);
 const asset=opaque?original:await referenceStore(await referenceBlob(referenceComposite(canvas,[],'#ffffff')),signal);
 return {original,asset};
}
// Keep canvas reads separate from previously cached no-cors thumbnail responses.
function referenceCanvasUrl(id){return EXPANDER+'/references/'+id+'?read=canvas-v1';}
async function referenceFetchBlob(id,signal){
 const r=await sidecarFetch(referenceCanvasUrl(id),{headers:instanceHeaders(),signal,cache:'default'});
 if(!r.ok){let detail='';try{detail=(await r.json()).error||'';}catch{}throw Error('图片读取失败（HTTP '+r.status+'）'+(detail?'：'+detail:''));}
 return await r.blob();
}
async function referenceLoad(record,signal){
 await requireSidecarFeature('referenceImagesVersion',1,'图生图 / 局部重绘');
 return referenceRead(await referenceFetchBlob(record.id,signal));
}
function referenceDrawShape(ctx,s){
 ctx.save();ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.stroke;ctx.lineCap='round';ctx.lineJoin='round';
 if(s.rotation||s.flipX||s.flipY){ctx.translate(s.x+s.w/2,s.y+s.h/2);if(s.rotation)ctx.rotate(s.rotation*Math.PI/180);ctx.scale(s.flipX?-1:1,s.flipY?-1:1);s={...s,x:-s.w/2,y:-s.h/2};}
 ctx.beginPath();
 if(s.kind==='ellipse')ctx.ellipse(s.x+s.w/2,s.y+s.h/2,s.w/2,s.h/2,0,0,Math.PI*2);
 else if(s.kind==='line'){ctx.moveTo(s.x,s.reverse?s.y+s.h:s.y);ctx.lineTo(s.x+s.w,s.reverse?s.y:s.y+s.h);}
 else if(s.kind==='triangle'){ctx.moveTo(s.x+s.w/2,s.y);ctx.lineTo(s.x+s.w,s.y+s.h);ctx.lineTo(s.x,s.y+s.h);ctx.closePath();}
 else ctx.rect(s.x,s.y,s.w,s.h);
 if(s.filled&&s.kind!=='line')ctx.fill();ctx.stroke();ctx.restore();
}
/** Shapes are owned by their creation layer, not a global overlay.
 * Legacy in-memory shapes without layerId are attached to the active layer
 * when restored; persistent editor manifests preserve their layer associations.
 */
function referenceShapesForLayer(shapes,layerId){return shapes.filter(shape=>shape.layerId===layerId);}
function referenceCompositeLayers(ctx,layers,shapes){
 for(const layer of layers){
  if(layer.id===REFERENCE_MASK_LAYER||!layer.visible)continue;
  ctx.save();ctx.globalAlpha=layer.opacity;
  ctx.drawImage(layer.canvas,0,0);
  for(const shape of referenceShapesForLayer(shapes,layer.id))referenceDrawShape(ctx,shape);
  ctx.restore();
 }
}
function referenceAffineShapes(shapes,operation,sourceW,sourceH,targetW, targetH,area=null,angle=0){
 const radians=angle*Math.PI/180;
 return shapes.map(shape=>{
  const centerX=shape.x+shape.w/2,centerY=shape.y+shape.h/2;
  let x=centerX,y=centerY,w=shape.w,h=shape.h,rotation=Number(shape.rotation)||0;
  let flipX=!!shape.flipX,flipY=!!shape.flipY,stroke=shape.stroke;
  if(operation==='crop'){x-=area.x;y-=area.y;}
  else if(operation==='stretch'){
   const sx=targetW/sourceW,sy=targetH/sourceH;
   x*=sx;y*=sy;w*=sx;h*=sy;stroke*=Math.sqrt(sx*sy);
  }else if(operation==='scale-locked'){
   const factor=referenceUniformScale(sourceW,sourceH,targetW,targetH,area?.anchor);
   x*=factor;y*=factor;w*=factor;h*=factor;stroke*=factor;
  }else if(operation==='rotate'){
   x=sourceH-centerY;y=centerX;rotation+=90;
  }else if(operation==='free-rotate'){
   const dx=centerX-sourceW/2,dy=centerY-sourceH/2;
   x=sourceW/2+dx*Math.cos(radians)-dy*Math.sin(radians);
   y=sourceH/2+dx*Math.sin(radians)+dy*Math.cos(radians);rotation+=angle;
  }else if(operation==='flipX'){x=sourceW-centerX;flipX=!flipX;rotation=-rotation;}
  else if(operation==='flipY'){y=sourceH-centerY;flipY=!flipY;rotation=-rotation;}
  return {...shape,x:x-w/2,y:y-h/2,w,h,stroke,rotation:((rotation%360)+360)%360,flipX,flipY};
 });
}
function referenceShapeHitTest(shape,p){
 const cx=shape.x+shape.w/2,cy=shape.y+shape.h/2,rad=(Number(shape.rotation)||0)*Math.PI/180;
 const dx=p.x-cx,dy=p.y-cy;
 const lx=dx*Math.cos(rad)+dy*Math.sin(rad);
 const ly=-dx*Math.sin(rad)+dy*Math.cos(rad);
 return Math.abs(lx)<=shape.w/2+Math.max(1,shape.stroke/2)&&Math.abs(ly)<=shape.h/2+Math.max(1,shape.stroke/2);
}
function referenceShapesEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function referenceComposite(canvas,shapes,background){const out=referenceCanvas(canvas.width,canvas.height),ctx=out.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,out.width,out.height);}ctx.drawImage(canvas,0,0);shapes.forEach(s=>referenceDrawShape(ctx,s));return out;}
/** Color + alpha proximity on the selected layer only.
 * Invisible RGB values are ignored: fully transparent pixels should match
 * even when their hidden color bytes differ.
 */
function referenceFloodDistance(data,index,seed){
 const k=index*4,alpha=data[k+3]/255;
 const r=data[k]*alpha+255*(1-alpha),g=data[k+1]*alpha+255*(1-alpha),b=data[k+2]*alpha+255*(1-alpha);
 return Math.max(Math.abs(r-seed[0]),Math.abs(g-seed[1]),Math.abs(b-seed[2]),Math.abs(data[k+3]-seed[3])*.45);
}
function referenceFloodLuma(data,index){
 const k=index*4,alpha=data[k+3]/255;
 const r=data[k]*alpha+255*(1-alpha),g=data[k+1]*alpha+255*(1-alpha),b=data[k+2]*alpha+255*(1-alpha);
 return .2126*r+.7152*g+.0722*b;
}
/** Morphological closing joins short breaks in contours on the selected layer.
 * Each pass uses a one-dimensional kernel for predictable performance.
 */
function referenceFloodMorph(src,w,h,radius,dilate,horizontal){
 // Sliding sums make each pass O(width * height), independent of gap radius.
 const out=new Uint8Array(w*h),len=horizontal?w:h,lines=horizontal?h:w;
 const prefix=new Uint32Array(len+1),kernel=2*radius+1;
 for(let line=0;line<lines;line++){
  const offset=horizontal?line*w:line,step=horizontal?1:w;
  prefix[0]=0;
  for(let i=0;i<len;i++)prefix[i+1]=prefix[i]+src[offset+i*step];
  for(let i=0;i<len;i++){
   const low=Math.max(0,i-radius),high=Math.min(len-1,i+radius);
   const sum=prefix[high+1]-prefix[low];
   out[offset+i*step]=dilate?(sum>0?1:0):(sum===kernel?1:0);
  }
 }
 return out;
}
function referenceFloodCanGrow(mask,index,depth){
 if(!mask.barrier[index])return false;
 const k=index*4,alpha=mask.source[k+3],luma=referenceFloodLuma(mask.source,index);
 // Grow only into antialiased or soft line-art edge pixels, not through solid cores.
 if(alpha===0)return false;
 if(alpha>=252&&luma<=16)return false;
 if(alpha>=248&&luma<=28&&depth>1)return false;
 return true;
}
function referenceFloodGrow(mask,maxGrow=1){
 const grow=Math.max(0,Math.min(12,Math.floor(Number(maxGrow)||0)));
 if(!grow||!mask?.count)return new Uint8Array(mask?.w&&mask?.h?mask.w*mask.h:0);
 const {region,w,h}=mask,n=w*h;
 const extra=new Uint8Array(n),queue=new Uint32Array(n);
 let head=0,tail=0;
 for(let i=0;i<n;i++)if(region[i])queue[tail++]=i;
 const visit=(from,to)=>{
  if(to<0||to>=n||region[to]||extra[to])return;
  const depth=(extra[from]||0)+1;
  if(depth>grow||!referenceFloodCanGrow(mask,to,depth))return;
  extra[to]=depth;queue[tail++]=to;
 };
 while(head<tail){
  const i=queue[head++],px=i%w;
  if(px>0)visit(i,i-1);
  if(px<w-1)visit(i,i+1);
  if(i>=w)visit(i,i-w);
  if(i+w<n)visit(i,i+w);
 }
 return extra;
}
function referenceFloodMask(source,w,h,x,y,tolerance=32,maxGap=2,grow=1){
 const n=w*h,sx=Math.floor(x),sy=Math.floor(y);
 if(sx<0||sy<0||sx>=w||sy>=h||!n)return null;
 const start=sy*w+sx,k=start*4,a=source[k+3]/255;
 const seed=[source[k]*a+255*(1-a),source[k+1]*a+255*(1-a),source[k+2]*a+255*(1-a),source[k+3]];
 const threshold=Math.max(0,Math.min(255,Number(tolerance)||0));
 const gaps=Math.max(0,Math.min(32,Math.floor(Number(maxGap)||0)));
 const barrier=new Uint8Array(n);
 for(let i=0;i<n;i++)barrier[i]=referenceFloodDistance(source,i,seed)>threshold?1:0;
 let closed=barrier;
 if(gaps){
  closed=barrier.slice();
  const radii=[...new Set([1,2,4,8,16,32,gaps].filter(r=>r<=gaps))].sort((a,b)=>a-b);
  for(const radius of radii){
   let candidate=referenceFloodMorph(barrier,w,h,radius,true,true);
   candidate=referenceFloodMorph(candidate,w,h,radius,true,false);
   candidate=referenceFloodMorph(candidate,w,h,radius,false,true);
   candidate=referenceFloodMorph(candidate,w,h,radius,false,false);
   if(candidate[start])continue;
   for(let i=0;i<n;i++)if(candidate[i])closed[i]=1;
  }
 }
 const region=new Uint8Array(n),queue=new Uint32Array(n);
 let head=0,tail=0;
 const enqueue=i=>{if(!region[i]&&!closed[i]){region[i]=1;queue[tail++]=i;}};
 enqueue(start);
 while(head<tail){
  const i=queue[head++],px=i%w;
  if(px>0)enqueue(i-1);
  if(px<w-1)enqueue(i+1);
  if(i>=w)enqueue(i-w);
  if(i+w<n)enqueue(i+w);
 }
 const grown=referenceFloodGrow({region,source,seed,threshold,w,h,count:tail,barrier},grow);
 return {region,grown,source,seed,threshold,w,h,count:tail,barrier,closed};
}
/** Paint contiguous interior, then optionally grow under antialiased line art.
 * Inspired by GIMP's separation of gap-closing and border growing.
 */
function referenceFloodPaint(target,mask,color){
 if(!mask||!mask.count)return false;
 const {region,grown,source,seed,threshold,w,h}=mask,n=w*h;
 const parsed=/^#([0-9a-f]{6})$/i.exec(color);
 if(!parsed)throw Error('无效填充颜色');
 const rgb=[parseInt(parsed[1].slice(0,2),16),parseInt(parsed[1].slice(2,4),16),parseInt(parsed[1].slice(4,6),16)];
 const soft=new Uint8Array(n);
 const union=new Uint8Array(n);
 for(let i=0;i<n;i++)union[i]=region[i]||grown[i]?1:0;
 const near=i=>{
  if(i<0||i>=n||union[i])return;
  const diff=referenceFloodDistance(source,i,seed);
  const feather=38;
  if(diff>threshold&&diff<threshold+feather){
   const opacity=Math.max(1,Math.round(210*(1-(diff-threshold)/feather)));
   if(opacity>soft[i])soft[i]=opacity;
  }
 };
 for(let i=0;i<n;i++)if(union[i]){
  const px=i%w;if(px)near(i-1);if(px<w-1)near(i+1);
  if(i>=w)near(i-w);if(i+w<n)near(i+w);
 }
 let modified=false;
 for(let i=0;i<n;i++){
  let coverage=0;
  if(region[i])coverage=255;
  else if(grown[i])coverage=Math.max(soft[i],Math.round(255*(1-(grown[i]-1)*.28)));
  else coverage=soft[i];
  if(!coverage)continue;
  const k=i*4,oldAlpha=target[k+3]/255,paintAlpha=coverage/255,outAlpha=paintAlpha+oldAlpha*(1-paintAlpha);
  if(outAlpha<=0)continue;
  const oldR=target[k],oldG=target[k+1],oldB=target[k+2],oldA=target[k+3];
  const nr=Math.round((rgb[0]*paintAlpha+oldR*oldAlpha*(1-paintAlpha))/outAlpha),
    ng=Math.round((rgb[1]*paintAlpha+oldG*oldAlpha*(1-paintAlpha))/outAlpha),
    nb=Math.round((rgb[2]*paintAlpha+oldB*oldAlpha*(1-paintAlpha))/outAlpha),na=Math.round(outAlpha*255);
  if(nr!==oldR||ng!==oldG||nb!==oldB||na!==oldA){target[k]=nr;target[k+1]=ng;target[k+2]=nb;target[k+3]=na;modified=true;}
 }
 return modified;
}
function referenceFlood(canvas,x,y,color,tolerance=32,maxGap=2,grow=1){
 const targetCtx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height;
 const target=targetCtx.getImageData(0,0,w,h);
 const mask=referenceFloodMask(target.data,w,h,x,y,tolerance,maxGap,grow);
 if(!mask||!referenceFloodPaint(target.data,mask,color))return false;
 targetCtx.putImageData(target,0,0);
 return true;
}

const REFERENCE_CSS=`
.dsh-comfy-floating .cc-mask-tool-panel{left:12px;top:12px;width:280px;max-width:calc(100% - 24px);min-width:0;max-height:calc(100% - 24px);overflow:auto;scrollbar-width:none}
.dsh-comfy-floating .cc-editor-help-trigger{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin-left:6px;width:30px!important;min-width:30px!important;height:30px!important;min-height:30px!important;padding:2px!important;border:0!important;background:transparent!important}
.dsh-comfy-floating .cc-editor-help-card{min-width:0;overflow:auto;scrollbar-width:none;font-size:12px;line-height:1.6;font-weight:400}
.dsh-comfy-floating .cc-editor-help-card p{margin:0}
.dsh-comfy-floating .cc-editor-help-section{display:flex;flex-direction:column;gap:4px}
.dsh-comfy-floating .cc-editor-help-section ul{margin:0;padding-left:18px}
.dsh-comfy-floating .cc-editor-help-section li+li{margin-top:4px}

.dsh-comfy-floating .cc-editor-exit-error{position:absolute;bottom:12px;left:76px;z-index:5;max-width:min(700px,75%);padding:8px 12px;background:var(--cc-surface);color:var(--cc-bad);border:1px solid var(--cc-border);border-radius:var(--cc-radius,6px);font-size:12px}
.dsh-comfy-floating .cc-editor-exit-actions{position:relative;display:flex;align-items:center;gap:8px;flex:none;white-space:nowrap}
.dsh-comfy-floating .cc-editor-exit-actions>button{display:inline-flex;align-items:center;gap:7px}
.dsh-comfy-floating .cc-editor-exit-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:168px;display:flex;flex-direction:column;gap:2px;padding:4px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:6px;box-shadow:0 6px 20px #0005;z-index:50}
.dsh-comfy-floating .cc-editor-exit-menu button{padding:8px 12px;text-align:left;background:transparent;color:var(--cc-text);border:0;border-radius:4px;font:inherit;cursor:pointer}
.dsh-comfy-floating .cc-editor-exit-menu button:hover,.dsh-comfy-floating .cc-editor-exit-menu button:focus-visible{background:var(--cc-hover);outline:1px solid var(--cc-accent)}

.dsh-comfy-floating .cc-control-tile.cc-image-control{display:block;flex:0 0 276px;max-width:276px;height:144px;min-height:144px;max-height:144px;padding:11px}
.dsh-comfy-floating .cc-reference-card{display:grid;grid-template-columns:82px minmax(0,1fr);gap:9px;min-width:0;height:100%}
.dsh-comfy-floating .cc-reference-thumb{width:82px;height:120px;object-fit:contain;display:block;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:6px;cursor:pointer;padding:0}
.dsh-comfy-floating .cc-reference-fields{display:flex;flex-direction:column;gap:6px;min-width:0}.dsh-comfy-floating .cc-reference-fields>strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:14px}
.dsh-comfy-floating .cc-image-control-row{display:flex;gap:6px;align-items:center;min-width:0}.dsh-comfy-floating .cc-image-control-row>label{display:flex;align-items:center;gap:4px;min-width:0;font-size:11px;flex:1}
.dsh-comfy-floating .cc-image-control-row label>span{white-space:nowrap;flex:none}.dsh-comfy-floating .cc-image-control-row .cc-drag-number{flex:1;min-width:0}.dsh-comfy-floating .cc-image-control-row .cc-drag-number>button{width:18px;min-width:18px;padding:0}.dsh-comfy-floating .cc-image-control-row .cc-drag-number input{width:40px;min-width:0}.dsh-comfy-floating .cc-image-control-row button{min-height:28px;padding:4px 7px;font-size:11px}
.dsh-comfy-floating .cc-reference-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dsh-comfy-floating .cc-image-control .cc-reference-actions{flex-wrap:nowrap}.dsh-comfy-floating .cc-image-control .cc-reference-actions>button{flex:1;min-height:28px;padding:4px 7px;font-size:11px}
.dsh-comfy-floating .cc-image-control .cc-reference-status{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-comfy-floating .cc-editor-size-settings{display:flex;gap:12px;align-items:center;flex:none;padding:8px 0;border-top:1px solid var(--cc-border);border-bottom:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-editor-size-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1;min-width:0}.dsh-comfy-floating .cc-editor-size-controls label{display:flex;gap:5px;align-items:center;font-size:12px}.dsh-comfy-floating .cc-editor-size-controls input{width:76px;min-width:0;height:32px}
.dsh-comfy-floating .cc-editor-latent-preview{width:96px;height:64px;display:flex;align-items:center;justify-content:center;flex:none}.dsh-comfy-floating .cc-editor-latent-frame{max-width:100%;max-height:100%;border:1px solid var(--cc-accent);background:var(--cc-surface);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--cc-text)}
.dsh-comfy-floating .cc-mask-secondary{display:flex;gap:6px;align-items:center;border-left:1px solid var(--cc-border);padding-left:8px;margin-left:2px}
.dsh-comfy-floating .cc-reference-status{font-size:11px;color:var(--cc-muted);overflow-wrap:anywhere}
.dsh-comfy-floating .cc-reference-hint{font-size:11px;color:var(--cc-muted);margin:2px 0 0;line-height:1.5}
.cc-reference-hover-preview{pointer-events:none;padding:4px;background:var(--cc-surface,#292c30);border:1px solid var(--cc-border,#555);border-radius:8px;box-shadow:0 14px 42px rgba(0,0,0,.45);opacity:0;animation:cc-ref-hover-in .12s ease forwards}
.cc-reference-hover-preview img{display:block;border-radius:4px}
@keyframes cc-ref-hover-in{from{opacity:0}to{opacity:1}}
.cc-reference-controlnet{display:flex;flex-direction:column;gap:6px}
.cc-reference-controlnet .cc-image-control-row{gap:8px}
.cc-reference-controlnet .cc-image-control-row label{display:flex;align-items:center;gap:6px;min-width:0}
.dsh-comfy-floating .cc-reference-thumb{position:relative}
.dsh-comfy-floating .cc-reference-thumb-badge{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;background:rgba(0,0,0,.62);color:var(--cc-text);font-size:10px;pointer-events:none}
.dsh-comfy-floating .cc-reference-preprocess{display:flex;align-items:center;gap:6px;min-width:0}
.dsh-comfy-floating .cc-reference-preprocess>span{font-size:11px;color:var(--cc-muted);flex:none}
.dsh-comfy-floating .cc-reference-preprocess select{flex:1 1 auto;min-width:0;height:26px;padding:0 6px;border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-control);color:var(--cc-text);font:inherit;font-size:11px}
.dsh-comfy-floating .cc-reference-preprocess-row{display:flex;align-items:center;gap:6px}
.dsh-comfy-floating .cc-reference-status-error{color:#f2a5a5}
.dsh-comfy-floating.cc-reference-dialog>div:last-child{overflow:hidden!important;flex:1;min-height:0}
.dsh-comfy-floating .cc-reference-editor{display:flex;flex-direction:column;gap:8px;min-height:0;height:min(700px,calc(100dvh - 140px));flex:1}
.dsh-comfy-floating .cc-reference-tools,.dsh-comfy-floating .cc-reference-options{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:none;font-size:11px}
.dsh-comfy-floating .cc-reference-tools button{min-width:32px;min-height:32px;display:inline-flex;align-items:center;justify-content:center}
.dsh-comfy-floating .cc-reference-tools button[aria-pressed="true"]{background:var(--cc-accent-bg)!important;box-shadow:inset 0 0 0 1px var(--cc-accent)}
.dsh-comfy-floating .cc-reference-options label{display:flex;gap:5px;align-items:center}.dsh-comfy-floating .cc-reference-options input[type="number"]{width:72px;min-width:0;height:32px}.dsh-comfy-floating .cc-reference-options input[type="color"]{width:34px;height:30px;padding:2px;background:var(--cc-control);border:1px solid var(--cc-border);border-radius:6px}
.dsh-comfy-floating .cc-reference-options input[type="range"]{width:90px}.dsh-comfy-floating .cc-reference-viewport{flex:1;min-height:100px;overflow:auto;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);overscroll-behavior:contain;position:relative}
.dsh-comfy-floating .cc-reference-space{min-width:100%;min-height:100%;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.dsh-comfy-floating .cc-reference-board{position:relative;flex:none;touch-action:none;box-shadow:0 0 0 1px var(--cc-border);cursor:inherit}
.dsh-comfy-floating .cc-reference-board canvas{width:100%;height:100%;display:block}.dsh-comfy-floating .cc-reference-board>svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
.dsh-comfy-floating .cc-reference-footer{display:flex;justify-content:flex-end;gap:8px;align-items:center;flex-wrap:wrap;flex:none}.dsh-comfy-floating .cc-reference-footer>span{margin-right:auto;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-reference-size-locked{opacity:.55}.dsh-comfy-ui .cc-reference-size-locked button{cursor:not-allowed!important}
@media(max-width:600px){.dsh-comfy-floating .cc-reference-options input[type="number"]{width:62px}.dsh-comfy-floating .cc-reference-editor{height:calc(100dvh - 130px)}}
.dsh-comfy-floating .cc-control-tile.cc-image-control{height:166px;min-height:166px;max-height:166px}
.dsh-comfy-floating .cc-control-tile.cc-image-control .cc-reference-thumb{height:142px}
.dsh-comfy-floating .cc-image-control .cc-reference-fields{gap:4px}
.dsh-comfy-floating .cc-image-control .cc-reference-cell-scale{display:flex;gap:5px;align-items:center;min-width:0;font-size:11px}
.dsh-comfy-floating .cc-image-control .cc-reference-cell-scale>span{flex:none;color:var(--cc-muted)}
.dsh-comfy-floating .cc-image-control .cc-reference-cell-scale .cc-drag-number{flex:1;min-width:0;height:27px}
`;
// PhotoCraft Proximity Match + Poisson healing port (MIT).
// Sources, pinned revision and changes: docs/third-party/photocraft-heal/README.md.
// This is not Adobe code or a reconstruction of its Content-Aware kernel.
function referenceSpotHealCore({width:w,height:h,image,mask},progress=()=>{}){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>16*1024*1024||image.length!==w*h*4||mask.length!==w*h)throw Error('污点修复支持最多 1600 万像素，请缩小图片后重试');
 const n=w*h,out=new Uint8ClampedArray(image),seen=new Uint8Array(n),groups=[];
 // Keep every covered pixel; connected regions are solved independently, but all
 // selected regions and transparent pixels are excluded from source sampling.
 for(let p=0;p<n;p++)if(mask[p]&&image[p*4+3]&&!seen[p]){
  const cells=[p];seen[p]=1;let x0=p%w,y0=Math.floor(p/w),x1=x0+1,y1=y0+1;
  for(let q=0;q<cells.length;q++){
   if(cells.length>250000)throw Error('污点修复范围过大，请分次涂抹；大物体请使用智能去除');
   const i=cells[q],x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&yy>=0&&xx<w&&yy<h&&mask[j]&&image[j*4+3]&&!seen[j]){seen[j]=1;cells.push(j);}
   }
  }
  groups.push({cells,x0,y0,x1,y1});if(groups.length>128)throw Error('污点过多，请分次应用修改');
 }
 if(!groups.length)throw Error('请先在有图像的区域涂抹污点');
 function dilate(m,gw,gh,r){
  const tmp=new Uint8Array(m.length),d=new Uint8Array(m.length);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++)if(m[y*gw+x])for(let xx=Math.max(0,x-r);xx<Math.min(gw,x+r+1);xx++)tmp[y*gw+xx]=1;
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++)if(tmp[y*gw+x])for(let yy=Math.max(0,y-r);yy<Math.min(gh,y+r+1);yy++)d[yy*gw+x]=1;
  return d;
 }
 function integral(m,gw,gh){const t=new Uint32Array((gw+1)*(gh+1));for(let y=0;y<gh;y++){let row=0;for(let x=0;x<gw;x++){row+=m[y*gw+x];t[(y+1)*(gw+1)+x+1]=t[y*(gw+1)+x+1]+row;}}return t;}
 function count(t,gw,gh,x0,y0,x1,y1){x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(gw,x1);y1=Math.min(gh,y1);if(x1<=x0||y1<=y0)return 0;const s=gw+1;return t[y1*s+x1]+t[y0*s+x0]-t[y0*s+x1]-t[y1*s+x0];}
 // Rust poisson::solve_rec / sor, with the same restriction, prolongation,
 // tolerances and relaxation factors; RGB is normalised, alpha is not solved.
 function membrane(gw,gh,unknown,v,depth=0){
  let total=0,sum=0,known=0;const cells=[];
  for(let i=0;i<v.length;i++)if(unknown[i]){total++;cells.push(i);}else{sum+=v[i];known++;}
  if(!total||!known)return;
  const coarse=gw>=8&&gh>=8&&total>64&&depth<16;
  if(coarse){
   const cw=Math.ceil(gw/2),ch=Math.ceil(gh/2),cu=new Uint8Array(cw*ch).fill(1),cv=new Float32Array(cw*ch);
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){let s=0,k=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const xx=x*2+dx,yy=y*2+dy,i=yy*gw+xx;if(xx<gw&&yy<gh&&!unknown[i]){s+=v[i];k++;}}if(k){cu[y*cw+x]=0;cv[y*cw+x]=s/k;}}
   membrane(cw,ch,cu,cv,depth+1);
   for(const i of cells){const fy=Math.max(0,Math.min(ch-1,(Math.floor(i/gw)+.5)/2-.5)),fx=Math.max(0,Math.min(cw-1,(i%gw+.5)/2-.5)),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(cw-1,x0+1),y1=Math.min(ch-1,y0+1),tx=fx-x0,ty=fy-y0,a=cv[y0*cw+x0]*(1-tx)+cv[y0*cw+x1]*tx,b=cv[y1*cw+x0]*(1-tx)+cv[y1*cw+x1]*tx;v[i]=a+(b-a)*ty;}
  }else for(const i of cells)v[i]=sum/known;
  const omega=coarse?1.7:1.85,iterations=coarse?30:2000;
  for(let iter=0;iter<iterations;iter++){let max=0;for(const i of cells){const x=i%gw,y=Math.floor(i/gw);let s=0,k=0;if(x){s+=v[i-1];k++;}if(x+1<gw){s+=v[i+1];k++;}if(y){s+=v[i-gw];k++;}if(y+1<gh){s+=v[i+gw];k++;}if(k){const d=omega*(s/k-v[i]);v[i]+=d;max=Math.max(max,Math.abs(d));}}if(max<2e-5)break;}
 }
 let done=0;
 for(const g of groups){
  const pad=Math.min(256,Math.max(48,2*Math.min(g.x1-g.x0,g.y1-g.y0))),ax=Math.max(0,g.x0-pad),ay=Math.max(0,g.y0-pad),bx=Math.min(w,g.x1+pad),by=Math.min(h,g.y1+pad),gw=bx-ax,gh=by-ay;
  if(gw*gh>3*1024*1024)throw Error('该选区跨度过大，请分次修复');
  const original=new Uint8Array(gw*gh),forbidden=new Uint8Array(gw*gh),rgb=new Float32Array(gw*gh*3);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const i=y*gw+x,j=(y+ay)*w+x+ax;forbidden[i]=mask[j]||image[j*4+3]<255?1:0;for(let c=0;c<3;c++)rgb[i*3+c]=image[j*4+c]/255;}
  for(const p of g.cells)original[(Math.floor(p/w)-ay)*gw+p%w-ax]=1;
  const domain=dilate(original,gw,gh,2),heal=dilate(original,gw,gh,1),blocked=dilate(forbidden,gw,gh,2),hs=integral(blocked,gw,gh),ds=integral(domain,gw,gh);
  let hx0=gw,hy0=gh,hx1=0,hy1=0;
  for(let i=0;i<domain.length;i++)if(domain[i]){const x=i%gw,y=Math.floor(i/gw);hx0=Math.min(hx0,x);hy0=Math.min(hy0,y);hx1=Math.max(hx1,x+1);hy1=Math.max(hy1,y+1);}
  const ring=3,x0=hx0-ring,y0=hy0-ring,x1=hx1+ring,y1=hy1+ring,points=[];
  for(let y=Math.max(0,y0);y<Math.min(gh,y1);y++)for(let x=Math.max(0,x0);x<Math.min(gw,x1);x++)if(!domain[y*gw+x]&&!forbidden[y*gw+x]&&count(ds,gw,gh,x-ring,y-ring,x+ring+1,y+ring+1))points.push([x,y]);
  if(!points.length)throw Error('周围没有可用纹理，请缩小污点范围');
  const stride=Math.max(1,Math.floor(points.length/2000)),pts=points.filter((_,i)=>i%stride===0),radius=pad,step=Math.max(1,Math.floor(radius/24));let best=null,error=Infinity;
  function consider(dx,dy){
   // Adaptation: allow edge-touching destinations, but require the translated
   // sampling domain and every scored neighbour to be in-bounds and unmasked.
   if((!dx&&!dy)||hx0+dx<0||hy0+dy<0||hx1+dx>gw||hy1+dy>gh||count(hs,gw,gh,hx0+dx,hy0+dy,hx1+dx,hy1+dy))return;
   let e=0;const penalty=1+1e-3*Math.hypot(dx,dy)/radius;
   for(let k=0;k<pts.length;k++){const [x,y]=pts[k],xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=gw||yy>=gh||blocked[yy*gw+xx])return;const a=(y*gw+x)*3,b=(yy*gw+xx)*3;for(let c=0;c<3;c++){const d=rgb[a+c]-rgb[b+c];e+=d*d;}if(k%32===31&&e/pts.length*penalty>=error)return;}
   e=e/pts.length*penalty;if(e<error){error=e;best=[dx,dy];}
  }
  for(let dy=-radius;dy<=radius;dy+=step)for(let dx=-radius;dx<=radius;dx+=step)consider(dx,dy);
  if(step>1&&best){const [xx,yy]=best;for(let dy=yy-step;dy<=yy+step;dy++)for(let dx=xx-step;dx<=xx+step;dx++)if(Math.abs(dx)<=radius&&Math.abs(dy)<=radius)consider(dx,dy);}
  if(!best)throw Error('附近找不到完整的干净纹理，请缩小选区或分次涂抹');
  const [dx,dy]=best,src=new Float32Array(rgb);
  for(let i=0;i<domain.length;i++)if(domain[i])for(let c=0;c<3;c++)src[i*3+c]=rgb[(i+dy*gw+dx)*3+c];
  for(let c=0;c<3;c++){
   const v=new Float32Array(gw*gh);for(let i=0;i<v.length;i++)if(!heal[i])v[i]=rgb[i*3+c]-src[i*3+c];
   membrane(gw,gh,heal,v);
   for(const p of g.cells){const i=(Math.floor(p/w)-ay)*gw+p%w-ax,coverage=mask[p]/255;out[p*4+c]=image[p*4+c]*(1-coverage)+Math.max(0,Math.min(1,src[i*3+c]+v[i]))*255*coverage;}
  }
  progress(++done/groups.length);
 }
 return out;
}
function referenceSpotHealTask(payload,onProgress){
 let worker,url,finish,rejectTask,settled=false;
 const cleanup=()=>{worker?.terminate();if(url)URL.revokeObjectURL(url);};
 const promise=new Promise((resolve,reject)=>{finish=resolve;rejectTask=reject;});
 try{
  url=URL.createObjectURL(new Blob(['const heal='+referenceSpotHealCore.toString()+';onmessage=e=>{try{const pixels=heal(e.data,value=>postMessage({progress:value}));postMessage({pixels},[pixels.buffer]);}catch(e){postMessage({error:e.message||String(e)});}};'],{type:'text/javascript'}));
  worker=new Worker(url);
  worker.onmessage=e=>{if(settled)return;if(e.data.progress!==undefined){onProgress?.(e.data.progress);return;}settled=true;cleanup();if(e.data.error)rejectTask(Error(e.data.error));else finish(e.data.pixels);};
  worker.onerror=e=>{if(settled)return;settled=true;e.preventDefault();cleanup();rejectTask(Error('污点修复后台线程失败：'+(e.message||'请重新打开编辑器')));};
  worker.postMessage(payload,[payload.image.buffer,payload.mask.buffer]);
 }catch(e){settled=true;cleanup();rejectTask(e);}
 return {promise,cancel(){if(settled)return;settled=true;cleanup();rejectTask(new DOMException('已取消','AbortError'));}};
}

function ReferenceToolIcon({name}){
 const paths={mask:['M3 3h18v18H3z','M3 15 15 3M9 21 21 9'],eye:['M2.1 12S5.7 5.5 12 5.5s9.9 6.5 9.9 6.5-3.6 6.5-9.9 6.5S2.1 12 2.1 12Z','M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],eyeOff:['M3 3l18 18','M10.6 6A10.8 10.8 0 0 1 12 5.5c6.3 0 9.9 6.5 9.9 6.5a17 17 0 0 1-3 3.6M6.2 6.2C3.5 8 2.1 12 2.1 12s3.6 6.5 9.9 6.5a10 10 0 0 0 3-.5'],copy:['M9 9h12v12H9z','M5 15H3V3h12v2'],heal:['M4 10 10 4a4 4 0 0 1 6 0l4 4a4 4 0 0 1 0 6l-6 6a4 4 0 0 1-6 0l-4-4a4 4 0 0 1 0-6Z','m7 7 10 10M9 12h.01M12 9h.01M12 15h.01M15 12h.01'],quickselect:['M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5','m8 16 2-6 7-4 2 3-5 6z'],remove:['M4 20 20 4','M4 4h6M4 4v6M20 14v6h-6','M11 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z'],blur:['M12 3c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12z'],recolor:['M4 20 18 6','M15 3v4M20 8h-4','M4 5v4M2 7h4'],liquify:['M3 8c4-7 8 7 13 0 2-3 4-3 5 0','M3 16c4-7 8 7 13 0 2-3 4-3 5 0'],brush:['m4 20 2-7L17 2l5 5L11 18z','m6 13 5 5'],eraser:['m3 13 9-10 9 8-9 10H8z','m7 9 9 8'],fill:['m4 11 8-8 9 9-8 8z','m3 21 18 0','m4 4 7 7'],text:['M5 5h14','M12 5v15','M8.5 20h7'],select:['m4 3 16 9-8 2-3 7z'],crop:['M7 2v15h15','M2 7h15v15'],rect:['M3 4h18v16H3z'],ellipse:['M21 12a9 8 0 1 1-18 0 9 8 0 1 1 18 0'],line:['m3 21 18-18'],triangle:['m12 3 10 18H2z']};
 return h('svg',{width:17,height:17,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,'aria-hidden':true},...(paths[name]||paths.select).map((d,i)=>h('path',{d,key:i,strokeLinecap:'round',strokeLinejoin:'round'})));
}
const IMAGE_DENOISE_HELP='降噪越低，越接近输入图片；降噪越高，越容易按照提示词重新生成内容。局部重绘只对遮罩覆盖区域生效。';
function imageEditorSize(value,settings={}){return {mode:value.mode==='parameters'?'parameters':'reference',w:Number(settings.w)||1024,h:Number(settings.h)||1024,multiplier:Number(settings.multiplier)||1,alignment:Number(settings.alignment)||8};}
function validateImageEditorSize(value,size,settings){
 const m=Number(settings.multiplier);if(!Number.isFinite(m)||m<.25||m>4)throw Error('尺寸倍率需为 0.25–4');
 if(settings.mode==='parameters'&&![settings.w,settings.h].every(n=>Number.isFinite(Number(n))&&Number(n)>=64&&Number(n)<=8192))throw Error('生成宽高需为 64–8192');
 return generationImageSize({...value,asset:{...value.asset,width:size.w,height:size.h},mode:settings.mode},settings.w,settings.h,m,settings.alignment);
}
function ImageEditorSizeFields({value,size,settings,onChange,disabled,theme}){
 let output;try{output=validateImageEditorSize(value,size,settings);}catch{}const change=(k,v)=>onChange({...settings,[k]:v});
 const number=(label,key,min,max,step)=>h('label',null,label,h(DraggableNumberInput,{value:settings[key],onChange:v=>change(key,v),label:label,step:step,precision:numberInputPrecision(step),dragPerPixel:(step)/10,className:'cc-parameter-number',allowEmpty:true,min:min,max:max,disabled:disabled}));
 return h('section',{className:'cc-editor-size-settings','aria-label':'生成尺寸'},h('div',{className:'cc-editor-size-controls'},h('div',{className:'cc-editor-size-mode-options',role:'group','aria-label':'生成尺寸模式'},...([{value:'reference',label:'输入图片尺寸'},{value:'parameters',label:'自定义生成尺寸'}].map(o=>h('button',{type:'button',key:o.value,disabled,'aria-pressed':settings.mode===o.value,onClick:()=>change('mode',o.value)},o.label)))),settings.mode==='parameters'?h(React.Fragment,null,number('生成宽','w',64,8192,settings.alignment),number('生成高','h',64,8192,settings.alignment)):h('span',{style:S.dim},size.w+' × '+size.h),number('尺寸倍率','multiplier',.25,4,.01),h('span',{role:'status',className:'cc-editor-size-status',style:S.dim},output?'最终 '+output.w+' × '+output.h:'请检查生成尺寸')));
}
/** Hover preview anchored to the left of a reference thumbnail, keeping original aspect ratio. */
function createReferenceHoverPreview(){
 const [state,setState]=React.useState(null);
 const enter=e=>{
  try{const r=e.currentTarget.getBoundingClientRect();const w=Math.min(240,Math.max(120,r.left-16));setState({left:Math.max(8,r.left-w-10),top:Math.max(8,r.top),w});}catch{}
 };
 const leave=()=>setState(null);
 const render=url=>{
  if(!state||!url)return null;
  return floating(h('div',{className:'cc-reference-hover-preview',style:{position:'fixed',left:state.left+'px',top:state.top+'px',zIndex:2147483000}},h('img',{src:url,alt:'参考图预览',style:{display:'block',maxWidth:state.w+'px',maxHeight:'300px',width:'auto',height:'auto'}})));
 };
 return {enter,leave,render};
}

function ReferenceImageControl({value,onChange,onRemove,theme,target,inpaint=false,sourceReference,sizeSettings,onSizeApply,onEditorExit}){
 const [busy,setBusy]=React.useState(false),[error,setError]=useErrorState(''),[editing,setEditing]=React.useState(''),[pending,setPending]=React.useState(null),file=React.useRef(null),task=React.useRef({seq:0,ctl:null});
 const hoverPreview=createReferenceHoverPreview();
 const label=inpaint?'局部重绘':'图生图';
 React.useEffect(()=>()=>{task.current.seq++;task.current.ctl?.abort();},[]);
 React.useEffect(()=>{task.current.seq++;task.current.ctl?.abort();task.current.ctl=null;setBusy(false);},[value.enabled]);
 async function choose(selected){if(!selected)return;const seq=++task.current.seq,ctl=new AbortController();task.current.ctl?.abort();task.current.ctl=ctl;setBusy(true);setError('');
  try{if(!/\.(png|jpe?g|webp|bmp)$/i.test(selected.name))throw Error('请选择 PNG、JPEG、WebP 或 BMP 图片');
   const bitmap=await referenceRead(selected);let original,asset;try{const canvas=referenceCanvas(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,0,0);({original,asset}=await referencePersistCanvas(canvas,ctl.signal));}finally{bitmap.close();}
   if(/\.png$/i.test(selected.name))try{original=await referenceStore(selected,ctl.signal);}catch(e){if(ctl.signal.aborted)throw e;}
   if(task.current.seq===seq&&!ctl.signal.aborted){onChange({...value,original,asset,editorDocument:null,name:selected.name,enabled:true,mode:'reference',...(inpaint?{mask:null,coverage:0}:{})});onSizeApply?.({...sizeSettings,multiplier:1});setEditing('image');}
  }catch(e){if(task.current.seq===seq&&!ctl.signal.aborted)setError(errText(e));}finally{if(task.current.seq===seq){setBusy(false);task.current.ctl=null;}}}
 function requestFile(selected){if(!selected)return;if(inpaint&&value.mask)setPending({file:selected});else choose(selected);}
 function saveImage(asset,settings,editorDocument){
  const changed=asset.id!==value.asset.id,next={...value,asset,original:value.original||value.asset,editorDocument,mode:settings?.mode||value.mode,...(inpaint&&changed?{mask:null,coverage:0}:{})};
  referenceEditorSaveCell(inpaint?'inpaint':'referenceImage',next);onChange(next);if(settings)onSizeApply?.(settings);
  if(inpaint&&changed&&value.mask)notifyError('底图已更新，原遮罩已清除，请重新绘制。',{title:'局部重绘底图已更新',severity:'warning'});
 }
 function commitImage(asset,settings){onChange({...value,asset,editorDocument:null,mode:settings?.mode||value.mode,...(inpaint&&asset.id!==value.asset.id?{mask:null,coverage:0}:{})});if(settings)onSizeApply?.(settings);setEditing('image');}
 const btn=(text,fn,disabled=false)=>h('button',{type:'button',style:S.btn2,disabled:busy||disabled,onClick:fn},text);
 return h('div',{className:'cc-control-tile cc-image-control','data-kind':inpaint?'inpaint':'reference','data-component-key':inpaint?'inpaint':'reference'},h('style',null,REFERENCE_CSS),
  h('div',{className:'cc-reference-card'},value.asset?h('button',{type:'button',className:'cc-reference-thumb','aria-label':'编辑'+label+'图片',onClick:()=>setEditing('image'),disabled:busy,onMouseEnter:hoverPreview.enter,onMouseLeave:hoverPreview.leave},h('img',{src:referenceCanvasUrl(value.asset.id),crossOrigin:'anonymous',alt:label,style:{width:'100%',height:'100%',objectFit:'contain'},onError:()=>setError('图片无法读取，请替换图片或重新打开编辑器')})):h('button',{type:'button',style:S.btn2,className:'cc-reference-thumb',disabled:busy,onClick:()=>file.current.click()},'选择图片'),
   h('div',{className:'cc-reference-fields'},h('strong',{title:value.name||label},label+(value.name?' · '+value.name:'')),
    h('div',{className:'cc-image-control-row'},null,h('label',{title:IMAGE_DENOISE_HELP,'data-cc-tooltip':IMAGE_DENOISE_HELP},h('span',null,'降噪'),h(DraggableNumberInput,{value:value.denoise,onChange:denoise=>onChange({...value,denoise}),min:0,max:1,step:.01,precision:2,label:label+'降噪',dragPerPixel:.005}))),
    h('div',{className:'cc-reference-cell-scale'},h('span',null,'尺寸倍率'),h(DraggableNumberInput,{value:Number(sizeSettings?.multiplier)||1,onChange:v=>onSizeApply?.({...sizeSettings,multiplier:ccClamp(Number(v)||1,.25,4)}),min:.25,max:4,step:.01,precision:2,label:label+' 尺寸倍率',dragPerPixel:.002,disabled:busy})),
    h('div',{className:'cc-reference-actions'},h('input',{ref:file,type:'file',accept:'.png,.jpg,.jpeg,.webp,.bmp',hidden:true,'aria-label':'选择'+label+'文件',onChange:e=>{requestFile(e.target.files?.[0]);e.target.value='';}}),btn(value.asset?'换图':'导入',()=>file.current.click()),btn(inpaint?'遮罩':'编辑',()=>{if(!value.asset){setError('请先导入'+label+'图片');return;}setEditing('image');})),
    h('span',{className:'cc-reference-status',role:error?'alert':undefined,title:error||''},busy?'正在读取图片…':error||(!value.asset?'请先导入图片':inpaint?(value.mask?'已涂抹 '+(value.coverage*100).toFixed(1)+'%':'尚未绘制遮罩'):'已载入图片')),
    null)),
  h('button',{type:'button',className:'cc-control-remove','aria-label':'移除'+label,onClick:onRemove},h(PromptIcon,{name:'x',size:13})),
  hoverPreview.render(value.asset?referenceCanvasUrl(value.asset.id):null),
  editing==='image'&&value.asset?h(ReferenceImageEditor,{key:(value.original||value.asset).id,value,target,theme,sizeSettings,initialTool:inpaint?'mask':'brush',onClose:()=>setEditing(''),onSave:saveImage,onExit:onEditorExit}):null,
  pending?h(OverlayModal,{title:'更换局部重绘底图',theme,width:420,zIndex:2147482000,onClose:()=>setPending(null)},h('p',null,'更换或修改底图后，原遮罩将清除，需要重新绘制。'),h('div',{className:'cc-reference-actions'},btn('保留当前底图',()=>setPending(null)),btn('更换并清除遮罩',()=>{const next=pending;setPending(null);if(next.file)choose(next.file);else commitImage(next.asset,next.settings);} ))):null);
}
const REFERENCE_STUDIO_CSS=`
/* OverlayModal mounts a .cc-reference-studio-dialog SECTION inside .dsh-comfy-floating.cc-backdrop.
   Size that section, NOT the backdrop. The content pane and editor must shrink in flex layout:
   accordion changes remain inside .cc-editor-sidebar's scroll container. */
.dsh-comfy-floating.cc-backdrop > section.cc-reference-studio-dialog{width:calc(100vw - 28px)!important;max-width:calc(100vw - 28px)!important;height:calc(100dvh - 28px)!important;max-height:calc(100dvh - 28px)!important;min-height:0!important}
.dsh-comfy-floating.cc-backdrop > section.cc-reference-studio-dialog > div:last-child{display:flex!important;flex:1 1 0!important;flex-direction:column!important;min-height:0!important;min-width:0!important;overflow:hidden!important;max-height:none!important}
.dsh-comfy-floating.cc-backdrop > section.cc-reference-studio-dialog > div:last-child > .cc-reference-studio{flex:1 1 0!important;height:auto!important;min-height:0!important;max-height:none!important;min-width:0!important;overflow:hidden}
.dsh-comfy-floating .cc-reference-studio{height:100%!important;max-height:100%!important;min-height:0!important}
.dsh-comfy-floating .cc-reference-studio .cc-reference-main{min-height:0!important;overflow:hidden}
.dsh-comfy-floating .cc-reference-studio .cc-reference-viewport{min-height:0!important}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar{min-height:0!important;max-height:100%;overscroll-behavior:contain}
.dsh-comfy-floating .cc-reference-studio .cc-reference-footer{flex-wrap:nowrap;min-height:36px;max-height:48px}

.dsh-comfy-floating .cc-reference-studio{display:flex;flex-direction:column;gap:8px;min-height:0;height:100%;max-height:100%;flex:1;font-size:12px}
.dsh-comfy-floating .cc-reference-main{display:flex;gap:8px;min-height:0;flex:1;position:relative}
.dsh-comfy-floating .cc-reference-rail{flex:none;display:flex;flex-direction:column;gap:3px;padding:5px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px;position:relative;z-index:70;width:46px;overflow:visible}
.dsh-comfy-floating .cc-reference-rail .cc-reference-tool{position:relative;flex:none}
.dsh-comfy-floating .cc-reference-rail button{width:34px;height:34px;min-width:34px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:7px}
.dsh-comfy-floating .cc-reference-rail button[aria-pressed="true"]{background:var(--cc-accent-bg)!important;box-shadow:inset 0 0 0 1px var(--cc-accent);color:var(--cc-accent)}
.dsh-comfy-floating .cc-rail-sep{height:1px;background:var(--cc-border);margin:2px;flex:none}
.dsh-comfy-floating .cc-reference-flyout{display:none;position:absolute;left:calc(100% + 8px);top:0;width:240px;max-height:min(470px,calc(100dvh - 170px));overflow:auto;flex-direction:column;gap:8px;padding:10px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px;box-shadow:0 14px 34px rgba(0,0,0,.28);z-index:40;color:var(--cc-text);text-align:left}
.dsh-comfy-floating .cc-reference-tool:hover>.cc-reference-flyout{display:flex}
.dsh-comfy-floating .cc-reference-tool>.cc-reference-flyout.is-open{display:flex}
.dsh-comfy-floating .cc-reference-flyout{left:100%;top:-4px;width:260px;max-height:none;padding:0 0 0 8px;border:0;background:transparent;border-radius:0;box-shadow:none;overflow:visible}
.dsh-comfy-floating .cc-reference-flyout-body{display:flex;flex-direction:column;gap:8px;max-height:min(490px,calc(100dvh - 175px));overflow:auto;padding:10px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px;box-shadow:0 14px 34px rgba(0,0,0,.28)}
.dsh-comfy-floating .cc-reference-flyout>strong{font-size:12px;font-weight:600}
.dsh-comfy-floating .cc-flyout-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--cc-muted);min-height:30px}
.dsh-comfy-floating .cc-flyout-row>span{flex:none}
.dsh-comfy-floating .cc-flyout-row input[type="color"]{width:34px;height:28px;padding:2px;background:var(--cc-control);border:1px solid var(--cc-border);border-radius:6px}
.dsh-comfy-floating .cc-flyout-row input[type="range"]{flex:1;min-width:70px}
.dsh-comfy-floating .cc-flyout-hint{font-size:10.5px;line-height:1.5;color:var(--cc-muted)}
.dsh-comfy-floating .cc-flyout-actions{display:flex;gap:6px;flex-wrap:wrap}
.dsh-comfy-floating .cc-flyout-actions>button{flex:1;min-height:28px;font-size:11px;padding:4px 6px}
.dsh-comfy-floating .cc-reference-viewport{flex:1;min-width:0;min-height:100px;position:relative;overflow:hidden;border:1px solid var(--cc-border);border-radius:9px;background:var(--cc-control);touch-action:none;cursor:crosshair}
.dsh-comfy-floating .cc-reference-board{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;box-shadow:0 0 0 1px var(--cc-border)}
.dsh-comfy-floating .cc-reference-board>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.dsh-comfy-floating .cc-reference-board>svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.dsh-comfy-floating .cc-reference-transform{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:none;padding:7px 8px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:8px}
.dsh-comfy-floating .cc-reference-transform>label{display:flex;gap:4px;align-items:center;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-reference-transform>button{min-height:28px;font-size:11px;padding:4px 7px}
.dsh-comfy-floating .cc-reference-transform>label>input[type="color"]{width:30px;height:26px;padding:2px;background:var(--cc-control);border:1px solid var(--cc-border);border-radius:6px}
.dsh-comfy-floating .cc-reference-footer{display:flex;justify-content:flex-end;gap:7px;align-items:center;flex-wrap:wrap;flex:none}
.dsh-comfy-floating .cc-reference-footer>span{margin-right:auto;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-reference-footer>span.cc-zoom{font-variant-numeric:tabular-nums;margin-right:0}
.dsh-comfy-floating .cc-reference-footer>button{min-height:30px;font-size:12px;padding:4px 9px}
.dsh-comfy-floating .cc-layer-list{display:flex;flex-direction:column;gap:5px;max-height:220px;overflow:auto}
.dsh-comfy-floating .cc-layer-item{display:flex;align-items:center;gap:5px;padding:4px 5px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);cursor:pointer}
.dsh-comfy-floating .cc-layer-item.active{border-color:var(--cc-accent);box-shadow:inset 0 0 0 1px var(--cc-accent)}
.dsh-comfy-floating .cc-layer-item>button{width:24px;min-width:24px;height:24px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.dsh-comfy-floating .cc-layer-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.dsh-comfy-floating .cc-layer-role{font-size:10px;color:var(--cc-muted);flex:none}

.dsh-comfy-floating .cc-editor-sidebar{flex:none;box-sizing:border-box;min-width:0;max-width:30%;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:8px;scrollbar-gutter:stable}
.dsh-comfy-floating .cc-editor-sidebar-resizer{align-self:stretch;flex:none;width:8px;cursor:col-resize;touch-action:none;display:flex;align-items:center;justify-content:center;border-radius:5px;outline-offset:1px}
.dsh-comfy-floating .cc-editor-sidebar-resizer::before{content:'';height:38px;width:2px;border-radius:2px;background:var(--cc-border)}
.dsh-comfy-floating .cc-editor-sidebar-resizer:hover::before,.dsh-comfy-floating .cc-editor-sidebar-resizer:focus-visible::before{background:var(--cc-accent)}
.dsh-comfy-floating .cc-editor-section{flex:none;border-bottom:1px solid var(--cc-border);min-width:0}
.dsh-comfy-floating .cc-editor-section-head{display:flex;align-items:center;gap:6px;width:100%;padding:9px 12px!important;min-height:34px;box-sizing:border-box;font:inherit;font-size:12px;font-weight:600;color:var(--cc-text);border:0!important;background:transparent!important;text-align:left;cursor:pointer}
.dsh-comfy-floating .cc-editor-section-head:hover{background:var(--cc-hover)!important}
.dsh-comfy-floating .cc-editor-section-head .cc-section-arrow{margin-left:auto;color:var(--cc-muted);font-size:10px}
.dsh-comfy-floating .cc-editor-section-body{padding:4px 10px 12px;display:flex;flex-direction:column;gap:9px;min-width:0}
.dsh-comfy-floating .cc-editor-section-body .cc-editor-size-settings{flex-wrap:wrap;border:0;padding:0;min-width:0}
.dsh-comfy-floating .cc-editor-section-body .cc-editor-size-controls{align-items:stretch;flex-direction:column;gap:8px}
.dsh-comfy-floating .cc-editor-section-body .cc-editor-size-controls>label{width:100%;justify-content:space-between}
.dsh-comfy-floating .cc-editor-section-body .cc-editor-size-controls .cc-drag-number{max-width:138px}
.dsh-comfy-floating .cc-editor-section-body .cc-editor-latent-preview{width:100%;justify-content:flex-start}
.dsh-comfy-floating .cc-editor-section-body .cc-reference-transform{display:flex;flex-direction:column;align-items:stretch;gap:7px;padding:0;border:0;background:none}
.dsh-comfy-floating .cc-editor-section-body .cc-reference-transform>label{justify-content:space-between;min-width:0}
.dsh-comfy-floating .cc-editor-section-body .cc-reference-transform .cc-drag-number{max-width:140px}
.dsh-comfy-floating .cc-editor-section-body .cc-reference-transform>button{width:100%}
.dsh-comfy-floating .cc-editor-section-body .cc-flyout-row{width:100%}
.dsh-comfy-floating .cc-editor-hint{font-size:11px;color:var(--cc-muted);line-height:1.5}
.dsh-comfy-floating .cc-reference-main{gap:0}
.dsh-comfy-floating .cc-reference-main>.cc-reference-rail{margin-right:8px}
.dsh-comfy-floating .cc-reference-main>.cc-reference-viewport{min-width:0;min-height:0;flex:1;border-radius:8px}
.dsh-comfy-floating .cc-reference-footer{min-height:32px;gap:8px;border-top:1px solid var(--cc-border);padding:5px 2px 0}
.dsh-comfy-floating .cc-reference-footer .cc-zoom{margin-right:8px;font-variant-numeric:tabular-nums}
@media(max-width:620px){.dsh-comfy-floating .cc-editor-sidebar{min-width:0}.dsh-comfy-floating .cc-reference-main>.cc-reference-rail{margin-right:5px}.dsh-comfy-floating .cc-editor-sidebar-resizer{width:6px}}

/* Keep the single workspace numeric component: small 16px arrows, no oversized rail buttons. */
.dsh-comfy-floating .cc-reference-studio :is(.cc-reference-flyout,.cc-editor-sidebar) .cc-drag-number{width:100%;min-width:0;max-width:150px;height:var(--cc-number-height,36px)!important}
.dsh-comfy-floating .cc-reference-studio .cc-reference-rail .cc-reference-flyout .cc-drag-number>button,
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar .cc-drag-number>button{width:var(--cc-number-arrow-width,16px)!important;min-width:0!important;max-width:var(--cc-number-arrow-width,16px)!important;height:auto!important;min-height:0!important;padding:0!important;flex:0 0 var(--cc-number-arrow-width,16px)!important;border-radius:0!important}
.dsh-comfy-floating .cc-reference-studio .cc-reference-rail .cc-reference-flyout .cc-drag-number>input{min-width:0!important;width:0!important;height:100%!important;padding:5px 1px!important}
.dsh-comfy-floating .cc-editor-confirm-description{margin:0 0 12px;color:var(--cc-muted);font-size:12px;line-height:1.5}
.dsh-comfy-floating .cc-editor-confirm-actions{display:flex;justify-content:flex-end;gap:8px}
.dsh-comfy-floating .cc-layer-actions{display:flex;gap:3px;flex-wrap:nowrap;justify-content:flex-start}
.dsh-comfy-floating .cc-layer-actions>button{width:30px;height:28px;min-width:30px;padding:0!important;display:flex;align-items:center;justify-content:center}
.dsh-comfy-floating .cc-layer-actions>button:disabled{opacity:.35;cursor:default}
.dsh-comfy-floating .cc-layer-item>button{width:27px;min-width:27px;height:27px}
@media(max-width:760px){.dsh-comfy-floating .cc-reference-rail{width:42px}.dsh-comfy-floating .cc-reference-rail button{width:30px;min-width:30px;height:30px}.dsh-comfy-floating .cc-reference-flyout{width:210px}}


/* Separate sidebar cards. No clipping of portal popovers. */
.dsh-comfy-floating .cc-editor-sidebar{gap:10px;padding:0;background:transparent;border:0;scrollbar-gutter:auto}
.dsh-comfy-floating .cc-editor-card{flex:none;min-width:0;display:flex;flex-direction:column;gap:9px;padding:10px;border:1px solid var(--cc-border);border-radius:9px;background:var(--cc-surface)}
.dsh-comfy-floating .cc-editor-card-title{font-size:12px;font-weight:650;color:var(--cc-text)}
.dsh-comfy-floating .cc-editor-fill-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px}
.dsh-comfy-floating .cc-editor-fill-toggle>button{padding:5px 9px;background:var(--cc-control);border:1px solid var(--cc-border);color:var(--cc-text);border-radius:6px}
.dsh-comfy-floating .cc-editor-color-sv{position:relative;height:118px;border-radius:7px;cursor:crosshair;touch-action:none;background-image:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent);border:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-editor-color-dot{position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px #000;transform:translate(-50%,-50%);pointer-events:none}
.dsh-comfy-floating .cc-editor-color-hue{height:15px;position:relative;border-radius:5px;cursor:crosshair;touch-action:none;background:linear-gradient(to right,red,#ff0,lime,cyan,blue,magenta,red)}
.dsh-comfy-floating .cc-editor-hue-marker{position:absolute;top:-3px;bottom:-3px;width:5px;border:2px solid #fff;box-shadow:0 0 3px #000;transform:translateX(-50%);pointer-events:none}
.dsh-comfy-floating .cc-editor-color-row{display:flex;gap:6px;align-items:center;min-width:0}.dsh-comfy-floating .cc-editor-color-row input[type=color]{width:33px;height:31px;padding:1px;min-width:33px}.dsh-comfy-floating .cc-editor-color-row input[type=text]{min-width:0;flex:1;max-width:100%;height:31px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-text);padding:0 6px}
.dsh-comfy-floating .cc-editor-color-row button{width:30px;min-width:30px;height:30px;border-radius:6px;border:1px solid var(--cc-border);display:grid;place-items:center;background:var(--cc-control);color:var(--cc-text);cursor:pointer}
.dsh-comfy-floating .cc-editor-recent-colors{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}.dsh-comfy-floating .cc-editor-recent-colors button{height:21px;border-radius:5px;border:1px solid var(--cc-border);cursor:pointer}
.dsh-comfy-floating .cc-editor-card .cc-editor-background-grid{padding:0}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar{overflow:hidden;min-height:0}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar-top{flex:0 1 auto;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar-top>.cc-editor-card{flex:none}
/* The layer panel occupies *all* remaining sidebar height, independent of its rows. */
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar{display:flex;flex-direction:column;min-height:0;height:100%}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar-top{flex:0 1 auto;max-height:calc(100% - 172px);overflow-y:auto}
.dsh-comfy-floating .cc-reference-studio .cc-layer-card{margin-top:0;flex:1 1 0;min-height:172px;max-height:none;height:0;overflow:hidden;display:flex;flex-direction:column}
.dsh-comfy-floating .cc-reference-studio .cc-layer-card>.cc-editor-card-title{flex:none}
.dsh-comfy-floating .cc-reference-studio .cc-layer-card .cc-layer-actions,.dsh-comfy-floating .cc-reference-studio .cc-layer-card .cc-flyout-row{flex:none}

.dsh-comfy-floating .cc-reference-studio .cc-layer-card .cc-layer-list{flex:1 1 0;min-height:0;max-height:none;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin}
.dsh-comfy-floating .cc-layer-card .cc-layer-item{min-height:35px}.dsh-comfy-floating .cc-layer-card .cc-layer-list{display:flex;flex-direction:column;gap:5px}.dsh-comfy-floating .cc-layer-card .cc-layer-role{display:none}
.dsh-comfy-floating .cc-editor-size-popover{z-index:2147482100}
/* Background choice belongs to the viewport only; the actual image board stays transparent. */
.dsh-comfy-floating .cc-reference-studio .cc-reference-board{background:transparent!important;background-image:none!important}

/* Fixed-size editor: static headers, shared image-preview checker palettes. */
.dsh-comfy-floating .cc-reference-studio .cc-editor-section-head{cursor:default!important;pointer-events:none}
.dsh-comfy-floating .cc-reference-studio .cc-editor-section-head:hover{background:transparent!important}
.dsh-comfy-floating .cc-editor-preview-settings{display:flex;align-items:center;min-width:0}
.dsh-comfy-floating .cc-editor-preview-settings .cc-select-trigger{width:100%;min-width:0}
.dsh-comfy-floating .cc-editor-preview-settings>div{width:100%;min-width:0}
.dsh-comfy-floating .cc-reference-studio :is(.cc-reference-viewport,.cc-reference-board)[data-editor-preview-background="dark"]{background-color:#242424!important;background-image:repeating-conic-gradient(#363636 0 25%,#242424 0 50%)!important;background-size:24px 24px!important}
.dsh-comfy-floating .cc-reference-studio :is(.cc-reference-viewport,.cc-reference-board)[data-editor-preview-background="light"]{background-color:#fff!important;background-image:repeating-conic-gradient(#dedede 0 25%,#fff 0 50%)!important;background-size:24px 24px!important}
.dsh-comfy-floating .cc-reference-studio :is(.cc-reference-viewport,.cc-reference-board)[data-editor-preview-background="system"]{background:var(--cc-control)!important;background-image:none!important}

/* v5 - one continuous preview background; no second checker on the image bounds */
.dsh-comfy-floating .cc-reference-studio .cc-reference-board{background:transparent!important;background-image:none!important;box-shadow:none!important}
.dsh-comfy-floating .cc-reference-studio .cc-reference-board[data-editor-preview-background]{background:transparent!important;background-image:none!important}
.dsh-comfy-floating .cc-reference-studio .cc-reference-viewport[data-editor-preview-background="dark"]{--cc-editor-outline:#efefef}
.dsh-comfy-floating .cc-reference-studio .cc-reference-viewport[data-editor-preview-background="light"]{--cc-editor-outline:#262626}
.dsh-comfy-floating .cc-reference-studio .cc-reference-viewport[data-editor-preview-background="system"]{--cc-editor-outline:var(--cc-text)}
.dsh-comfy-floating .cc-editor-background-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.dsh-comfy-floating .cc-editor-background-tile{min-width:0;width:100%;height:44px;padding:4px;border:1px solid var(--cc-border);background:var(--cc-control);border-radius:6px;cursor:pointer}
.dsh-comfy-floating .cc-editor-background-tile[aria-pressed="true"]{border-color:var(--cc-accent);box-shadow:inset 0 0 0 1px var(--cc-accent)}
.dsh-comfy-floating .cc-editor-background-tile:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-floating .cc-editor-background-swatch{display:block;width:100%;height:100%;border-radius:3px;border:1px solid rgba(128,128,128,.24)}
.dsh-comfy-floating .cc-editor-background-tile[data-mode="dark"] .cc-editor-background-swatch{background-color:#242424;background-image:repeating-conic-gradient(#363636 0 25%,#242424 0 50%);background-size:14px 14px}
.dsh-comfy-floating .cc-editor-background-tile[data-mode="light"] .cc-editor-background-swatch{background-color:#fff;background-image:repeating-conic-gradient(#dedede 0 25%,#fff 0 50%);background-size:14px 14px}
.dsh-comfy-floating .cc-editor-background-tile[data-mode="system"] .cc-editor-background-swatch{background:linear-gradient(125deg,var(--cc-control) 0% 50%,var(--cc-surface) 50% 100%)}
.dsh-comfy-floating .cc-editor-size-entry{width:100%;display:flex;align-items:center;gap:9px;min-height:36px;padding:7px 11px;border:0;background:transparent;color:var(--cc-text);font-size:12px;text-align:left;cursor:pointer}
.dsh-comfy-floating .cc-editor-size-entry:hover,.dsh-comfy-floating .cc-editor-size-entry:focus-visible{background:var(--cc-hover)}
.dsh-comfy-floating .cc-editor-size-entry>span{flex:1;font-weight:600}
.dsh-comfy-floating .cc-editor-size-popover{position:fixed;z-index:2147481900;box-sizing:border-box;padding-right:8px;max-height:calc(100dvh - 20px);pointer-events:auto}
.dsh-comfy-floating .cc-editor-size-popover-body{max-height:min(470px,calc(100dvh - 28px));overflow-y:auto;overflow-x:hidden;padding:12px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px;box-shadow:0 12px 34px rgba(0,0,0,.48);display:flex;flex-direction:column;gap:10px}
.dsh-comfy-floating .cc-editor-size-popover .cc-editor-size-settings{width:100%;padding:0;border:0}
.dsh-comfy-floating .cc-editor-size-popover .cc-editor-size-controls{flex-direction:column;align-items:stretch}
.dsh-comfy-floating .cc-editor-size-popover .cc-editor-size-controls>label{display:flex;justify-content:space-between}
.dsh-comfy-floating .cc-editor-size-popover .cc-editor-size-controls .cc-drag-number{max-width:155px}
.dsh-comfy-floating .cc-editor-size-popover .cc-reference-transform{display:flex;flex-direction:column;align-items:stretch;gap:7px;padding:0;border:0;background:none}
.dsh-comfy-floating .cc-editor-size-popover .cc-reference-transform>label{display:flex;align-items:center;justify-content:space-between}
.dsh-comfy-floating .cc-editor-size-popover .cc-reference-transform>button{width:100%}
.dsh-comfy-floating .cc-layer-item>button{width:32px;min-width:32px;height:31px;padding:0}
.dsh-comfy-floating .cc-layer-item>button svg{width:21px;height:21px;stroke-width:2}
.dsh-comfy-floating .cc-editor-size-mode-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;width:100%}
.dsh-comfy-floating .cc-editor-size-mode-options>button{min-width:0;font-size:10.5px;padding:5px 2px;border-radius:5px;border:1px solid var(--cc-border);background:var(--cc-control);color:var(--cc-text);cursor:pointer}
.dsh-comfy-floating .cc-editor-size-mode-options>button[aria-pressed="true"]{border-color:var(--cc-accent);box-shadow:inset 0 0 0 1px var(--cc-accent);color:var(--cc-accent)}
.dsh-comfy-floating .cc-editor-source-guide{position:absolute;inset:0;border:1px dashed color-mix(in srgb,var(--cc-editor-outline,#eee) 65%,transparent);box-sizing:border-box;pointer-events:none;z-index:3}
/* Guide is anchored to the source image, not painted into any canvas. */
.dsh-comfy-floating .cc-editor-size-guide{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-right:2px dashed var(--cc-editor-outline,#eee);border-bottom:2px dashed var(--cc-editor-outline,#eee);pointer-events:none;z-index:4;box-sizing:border-box}
.dsh-comfy-floating .cc-editor-guide-edge{position:absolute;display:flex;align-items:center;color:var(--cc-editor-outline,#eee);font-size:12px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.55)}
.dsh-comfy-floating .cc-editor-guide-edge::before,.dsh-comfy-floating .cc-editor-guide-edge::after{content:'';flex:1 1 0;min-width:0;min-height:0}
.dsh-comfy-floating .cc-editor-guide-edge-top{left:0;right:0;top:0;transform:translateY(-50%)}
.dsh-comfy-floating .cc-editor-guide-edge-top::before,.dsh-comfy-floating .cc-editor-guide-edge-top::after{border-top:2px dashed currentColor}
.dsh-comfy-floating .cc-editor-guide-edge-left{top:0;bottom:0;left:0;flex-direction:column;transform:translateX(-50%)}
.dsh-comfy-floating .cc-editor-guide-edge-left::before,.dsh-comfy-floating .cc-editor-guide-edge-left::after{border-left:2px dashed currentColor}
.dsh-comfy-floating .cc-editor-guide-edge>span{flex:none;background:var(--cc-surface);color:var(--cc-text);border-radius:3px;padding:0 3px;line-height:18px}
.dsh-comfy-floating .cc-editor-guide-edge-left>span{writing-mode:vertical-rl;transform:rotate(180deg);padding:3px 0}

/* v11: hide scrollbar chrome, keep wheel/drag/keyboard scrolling working. */
.dsh-comfy-floating.cc-backdrop > .cc-reference-studio-dialog,
.dsh-comfy-floating.cc-backdrop > .cc-reference-studio-dialog *,
.dsh-comfy-floating .cc-editor-size-popover,
.dsh-comfy-floating .cc-editor-size-popover *{scrollbar-width:none!important;scrollbar-gutter:auto!important;-ms-overflow-style:none!important}
.dsh-comfy-floating.cc-backdrop > .cc-reference-studio-dialog *::-webkit-scrollbar,
.dsh-comfy-floating .cc-editor-size-popover *::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
/* The cursor follows image coordinates, but is drawn in viewport coordinates. */
.dsh-comfy-floating .cc-editor-brush-cursor{display:none;position:absolute;left:0;top:0;pointer-events:none;z-index:18;transform:translate(-50%,-50%);box-sizing:border-box;width:28px;height:28px;align-items:center;justify-content:center}
.dsh-comfy-floating .cc-editor-brush-cursor[data-tool="fill"],.dsh-comfy-floating .cc-editor-brush-cursor[data-tool="eyedrop"]{border-radius:7px;background:rgba(27,27,31,.8);width:28px!important;height:28px!important}
.dsh-comfy-floating .cc-editor-brush-cursor>svg.cc-editor-brush-shapes{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.dsh-comfy-floating .cc-editor-brush-cursor>svg:not(.cc-editor-brush-shapes){width:16px;height:16px;stroke:#fff;filter:drop-shadow(0 1px 1px #000)}
.dsh-comfy-floating .cc-editor-brush-cursor [data-cursor-shape]{display:none;fill:none;vector-effect:non-scaling-stroke}
.dsh-comfy-floating .cc-editor-brush-cursor[data-shape="circle"] [data-cursor-shape="circle"],.dsh-comfy-floating .cc-editor-brush-cursor[data-shape="square"] [data-cursor-shape="square"],.dsh-comfy-floating .cc-editor-brush-cursor[data-shape="soft"] [data-cursor-shape="soft"]{display:block}
.dsh-comfy-floating .cc-editor-brush-cursor [data-cursor-outline]{stroke:#141414;stroke-width:3;stroke-opacity:.9}
.dsh-comfy-floating .cc-editor-brush-cursor [data-cursor-line]{stroke:#fff;stroke-width:1.2}
.dsh-comfy-floating .cc-editor-brush-cursor [data-cursor-shape="soft"]{stroke-dasharray:1 1}
.dsh-comfy-floating .cc-editor-eyedrop-loupe{display:none;position:absolute;z-index:25;width:132px;height:132px;padding:1px;box-sizing:border-box;border:2px solid #fff;border-radius:50%;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.55);pointer-events:none}
.dsh-comfy-floating .cc-editor-eyedrop-loupe canvas{display:block;width:126px;height:126px;border-radius:50%;image-rendering:pixelated;background:var(--cc-control)}
.dsh-comfy-floating .cc-editor-eyedrop-swatch{display:none;position:absolute;z-index:26;left:0;top:0;width:34px;height:26px;box-sizing:border-box;border:1px solid rgba(255,255,255,.95);border-radius:0 5px 5px 5px;box-shadow:0 1px 5px rgba(0,0,0,.65);pointer-events:none}
.dsh-comfy-floating .cc-editor-eyedrop-swatch::before{content:"";position:absolute;left:0;top:0;width:9px;height:9px;background:#fff;clip-path:polygon(0 0,100% 0,0 100%)}
/* Per-layer flyout portals through the scroll-clipped sidebar. */
.dsh-comfy-floating .cc-editor-layer-hover-bridge{position:fixed;z-index:2147482049;pointer-events:auto;background:transparent}
.dsh-comfy-floating .cc-editor-layer-popover{position:fixed;z-index:2147482050;pointer-events:auto;max-height:calc(100dvh - 24px);overflow-y:auto;overflow-x:hidden;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px;box-shadow:0 14px 34px rgba(0,0,0,.48);padding:11px;display:flex;flex-direction:column;gap:10px;color:var(--cc-text);scrollbar-width:none!important}
.dsh-comfy-floating .cc-editor-layer-popover::-webkit-scrollbar{display:none;width:0;height:0}
.dsh-comfy-floating .cc-editor-layer-popover .cc-drag-number{max-width:145px}
.dsh-comfy-floating .cc-layer-popover-title{font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-comfy-floating .cc-layer-popover-action-row{display:flex;gap:6px}
.dsh-comfy-floating .cc-layer-popover-action-row button{flex:1;min-width:0;height:32px;border:1px solid var(--cc-border);background:var(--cc-control);border-radius:6px;color:var(--cc-text);display:grid;place-items:center;cursor:pointer}
.dsh-comfy-floating .cc-layer-popover-action-row button:disabled{opacity:.4;cursor:default}
.dsh-comfy-floating .cc-layer-popover-action-row button:not(:disabled):hover{background:var(--cc-hover);border-color:var(--cc-accent)}
.dsh-comfy-floating .cc-layer-popover-action-row svg{width:17px;height:17px}
.dsh-comfy-floating .cc-layer-delete{flex:0 0 30px!important;width:30px!important;min-width:30px!important;height:29px!important;display:grid!important;place-items:center!important}
.dsh-comfy-floating .cc-layer-delete svg{width:16px!important;height:16px!important}
.dsh-comfy-floating .cc-reference-studio .cc-layer-actions{justify-content:space-between}
.dsh-comfy-floating .cc-reference-studio .cc-layer-actions>button{flex:1;min-width:0}
`;

// Shared between reference-image and inpaint editors; the resize handle never changes the image.
function EditorResizableSidebar({children}){
 const MIN_WIDTH=200;
 const [width,setWidth]=React.useState(MIN_WIDTH),tracking=React.useRef(null),container=React.useRef(null);
 const bounds=()=>{const host=container.current?.parentElement;const parentWidth=host?.clientWidth||window.innerWidth-80;const max=Math.max(1,Math.floor(parentWidth*.30));return {min:Math.min(MIN_WIDTH,max),max};};
 const cap=value=>{const {min,max}=bounds();return Math.max(min,Math.min(max,Math.round(value)));};
 React.useEffect(()=>{const host=container.current?.parentElement;if(!host)return;const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>setWidth(w=>cap(w))):null;observer?.observe(host);const onResize=()=>setWidth(w=>cap(w));window.addEventListener('resize',onResize);onResize();return()=>{observer?.disconnect();window.removeEventListener('resize',onResize);};},[]);
 const move=e=>{const old=tracking.current;if(!old||old.pointerId!==e.pointerId)return;setWidth(cap(old.width+old.x-e.clientX));};
 const done=e=>{if(!tracking.current||tracking.current.pointerId!==e.pointerId)return;tracking.current=null;try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}};
 const {min,max}=bounds();
 return h(React.Fragment,null,h('div',{className:'cc-editor-sidebar-resizer',role:'separator',tabIndex:0,'aria-label':'调整右侧面板宽度','aria-orientation':'vertical','aria-valuenow':Math.min(width,max),'aria-valuemin':min,'aria-valuemax':max,title:'左右拖动调整右侧栏宽度',onPointerDown:e=>{if(e.button!==0)return;e.preventDefault();tracking.current={pointerId:e.pointerId,x:e.clientX,width};e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:move,onPointerUp:done,onPointerCancel:done,onLostPointerCapture:()=>{tracking.current=null;},onKeyDown:e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();setWidth(w=>cap(w+(e.key==='ArrowLeft'?16:-16)));}}),h('aside',{ref:container,className:'cc-editor-sidebar',style:{width:Math.min(width,max)+'px'},'aria-label':'编辑器属性面板'},children));
}
// Editor sections are always visible; scrolling occurs inside the fixed-size sidebar.
function EditorPanelSection({title,children}){
 return h('section',{className:'cc-editor-section'},h('div',{className:'cc-editor-section-head'},title),h('div',{className:'cc-editor-section-body'},children));
}
const EDITOR_CANVAS_BACKGROUNDS=[{value:'dark',label:'深色棋盘格'},{value:'light',label:'亮色棋盘格'},{value:'system',label:'跟随系统'}];
function EditorCanvasBackground({value,onChange}){
 return h('div',{className:'cc-editor-background-grid',role:'group','aria-label':'画布背景'},...EDITOR_CANVAS_BACKGROUNDS.map(item=>h('button',{key:item.value,type:'button',className:'cc-editor-background-tile', 'data-mode':item.value,'aria-pressed':value===item.value,'aria-label':item.label,'data-cc-tooltip':item.label,title:item.label,onClick:()=>onChange(item.value)},h('span',{className:'cc-editor-background-swatch','aria-hidden':true}))));
}
// The frame uses the workbench's top/left dashed-edge dimensions, over the image viewport.
// It is an editing guide, never part of either source image or exported pixels.
function EditorSizeGuide({value,size,settings}){
 let output;try{output=validateImageEditorSize(value,size,settings);}catch{return null;}
 if(!output||!size.w||!size.h)return null;
 return h(React.Fragment,null,(output.w!==size.w||output.h!==size.h)?h('div',{className:'cc-editor-source-guide','aria-label':'当前画布范围 '+size.w+' × '+size.h}):null,h('div',{className:'cc-editor-size-guide','aria-label':'生成范围 '+output.w+' × '+output.h,style:{width:(output.w/size.w*100)+'%',height:(output.h/size.h*100)+'%'}},
  h('div',{className:'cc-editor-guide-edge cc-editor-guide-edge-top'},h('span',null,output.w+' px')),
  h('div',{className:'cc-editor-guide-edge cc-editor-guide-edge-left'},h('span',null,output.h+' px'))));
}
// Editor coordinates are always image pixels. Only one absolutely positioned board is transformed.
function editorImageRect(clientX,clientY,rect,w,h){return {x:(clientX-rect.left)*w/rect.width,y:(clientY-rect.top)*h/rect.height};}
function editorFrameRect(w,h,outW,outH){return {x:(w-outW)/2,y:(h-outH)/2,w:outW,h:outH};}
function editorHistoryBytes(items){
 // Metadata-only changes reuse pixel snapshots; count each backing blob/canvas just once.
 const seen=new Set();let total=0;
 for(const entry of items)for(const layer of entry.layers){
  const data=layer.canvasSnapshot||layer.blob;if(!data||seen.has(data))continue;
  seen.add(data);total+=layer.blob?layer.blob.size:data.width*data.height*4;
 }
 return total;
}

function editorHexFromHsv(h,s,v){
 const f=n=>{const k=(n+h/60)%6;return Math.round((v-v*s*Math.max(Math.min(k,4-k,1),0))*255);};
 return '#'+[f(5),f(3),f(1)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function editorHsvFromHex(hex){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;let h=0;if(d){if(hi===r)h=((g-b)/d)%6;else if(hi===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360;}return {h,s:hi?d/hi:0,v:hi};}
function EditorColorPalette({color,onChange,onCommit,recent,onSample,sampleActive=false,disabled}){
 const hsv=editorHsvFromHex(color),sv=React.useRef(null),hue=React.useRef(null);const [hexDraft,setHexDraft]=React.useState(color);const [rememberHue,setRememberHue]=React.useState(hsv.h);React.useEffect(()=>setHexDraft(color),[color]);React.useEffect(()=>{if(hsv.s>.001)setRememberHue(hsv.h);},[hsv.h,hsv.s]);const activeHue=hsv.s>.001?hsv.h:rememberHue;
 const pickSV=e=>{const r=sv.current?.getBoundingClientRect();if(!r||!r.width||!r.height)return;onChange(editorHexFromHsv(activeHue,ccClamp((e.clientX-r.left)/r.width,0,1),1-ccClamp((e.clientY-r.top)/r.height,0,1)));};
 const pickHue=e=>{const r=hue.current?.getBoundingClientRect();if(!r||!r.width)return;const nextHue=ccClamp((e.clientX-r.left)/r.width,0,1)*360;setRememberHue(nextHue);onChange(editorHexFromHsv(nextHue,hsv.s,hsv.v));};
 const keyboardColor=(e,axis)=>{if(disabled)return;const key=e.key,step=e.shiftKey?10:1;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return;e.preventDefault();if(axis==='hue'){const h=(activeHue+(key==='ArrowRight'||key==='ArrowUp'?step:-step)+360)%360;setRememberHue(h);onChange(editorHexFromHsv(h,hsv.s,hsv.v));}else{const s=ccClamp(hsv.s+(key==='ArrowRight'?step/100:key==='ArrowLeft'?-step/100:0),0,1),v=ccClamp(hsv.v+(key==='ArrowUp'?step/100:key==='ArrowDown'?-step/100:0),0,1);onChange(editorHexFromHsv(activeHue,s,v));}onCommit();};
 const pointer=(fn,ref)=>({onPointerDown:e=>{if(disabled)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);fn(e);},onPointerMove:e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))fn(e);},onPointerUp:e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){fn(e);onCommit();e.currentTarget.releasePointerCapture(e.pointerId);}},onPointerCancel:onCommit});
 return h('section',{className:'cc-editor-card', 'aria-label':'颜色'},
  h('strong',{className:'cc-editor-card-title'},'颜色'),
  h('div',{ref:sv,className:'cc-editor-color-sv',role:'slider','aria-label':'饱和度与亮度','aria-valuetext':Math.round(hsv.s*100)+'% / '+Math.round(hsv.v*100)+'%',tabIndex:0,style:{backgroundColor:editorHexFromHsv(activeHue,1,1)},onKeyDown:e=>keyboardColor(e,'sv'),...pointer(pickSV,sv)},h('span',{className:'cc-editor-color-dot',style:{left:(hsv.s*100)+'%',top:((1-hsv.v)*100)+'%'}})),
  h('div',{ref:hue,className:'cc-editor-color-hue',role:'slider','aria-label':'色相','aria-valuemin':0,'aria-valuemax':360,'aria-valuenow':Math.round(hsv.h),tabIndex:0,onKeyDown:e=>keyboardColor(e,'hue'),...pointer(pickHue,hue)},h('span',{className:'cc-editor-hue-marker',style:{left:(activeHue/360*100)+'%'}})),
  h('div',{className:'cc-editor-color-row'},h('input',{type:'color',value:color,disabled,'aria-label':'系统颜色选择器',onChange:e=>onChange(e.target.value),onBlur:onCommit}),h('input',{type:'text',value:hexDraft,className:'cc-editor-hex',disabled,'aria-label':'HEX 颜色',onChange:e=>{const v=e.target.value;if(/^#?[0-9a-fA-F]{0,6}$/.test(v)){setHexDraft(v);if(/^#[0-9a-fA-F]{6}$/.test(v))onChange(v);}},onBlur:()=>{setHexDraft(color);onCommit();}}),onSample?h('button',{type:'button',disabled,'data-cc-tooltip':'鼠标右键快捷吸色','aria-label':'从画布吸色','aria-pressed':sampleActive,className:sampleActive?'active':'',onClick:onSample},h('svg',{viewBox:'0 0 24 24',width:17,height:17,fill:'none',stroke:'currentColor',strokeWidth:1.8},h('path',{d:'m14 5 5 5M5 20l5-1 10-10-5-5L5 14v6Z'}))):null),
  h('div',{className:'cc-editor-recent-colors','aria-label':'最近使用颜色'},...recent.map(c=>h('button',{type:'button',key:c,style:{background:c},title:c,'aria-label':'选择颜色 '+c,disabled,onClick:()=>{onChange(c);onCommit(c);}}))));
}
// Popup is fixed-positioned and stays inside the editor DOM, so numeric input and focus
// remain part of the modal. A short leave grace covers the tiny hover transition seam.
function EditorSizePopover({children,disabled=false}){
 const trigger=React.useRef(null),popup=React.useRef(null),timer=React.useRef(null),dragging=React.useRef(false);const portal=React.useMemo(()=>{try{return require('react-dom').createPortal;}catch{return null;}},[]);
 const [open,setOpen]=React.useState(false),[position,setPosition]=React.useState({left:0,top:0});
 const show=()=>{if(timer.current)clearTimeout(timer.current);const rect=trigger.current?.getBoundingClientRect();if(rect){const sidebar=trigger.current.closest('.cc-editor-sidebar')?.getBoundingClientRect();const width=Math.min(310,Math.max(235,window.innerWidth*.28));const rightEdge=sidebar?sidebar.left-6:rect.left+6;setPosition({left:Math.max(8,rightEdge-width),top:Math.max(8,Math.min(rect.top-6,window.innerHeight-495)),width});}setOpen(true);};
 const hide=()=>{if(timer.current)clearTimeout(timer.current);if(dragging.current)return;timer.current=setTimeout(()=>setOpen(false),100);};
 React.useEffect(()=>{const release=()=>{if(!dragging.current)return;dragging.current=false;if(!trigger.current?.matches(':hover')&&!popup.current?.matches(':hover'))setOpen(false);};window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);return()=>{if(timer.current)clearTimeout(timer.current);window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);};},[]);
 return h('section',{className:'cc-editor-section cc-editor-size-section'},
  h('button',{ref:trigger,type:'button',className:'cc-editor-size-entry','aria-label':'图片尺寸','aria-expanded':open,'aria-haspopup':'true',title:'图片尺寸','data-cc-tooltip':'图片尺寸',disabled,onMouseEnter:show,onMouseLeave:hide,onFocus:show,onClick:()=>{if(!open)show();}},
   h(ReferenceToolIcon,{name:'crop'}),h('span',null,'图片尺寸'),h('svg',{viewBox:'0 0 16 16',width:13,height:13,fill:'none','aria-hidden':true},h('path',{d:'m10 3-5 5 5 5',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round'}))),
  open?(portal?portal(h('div',{ref:popup,className:'cc-editor-size-popover',role:'group','aria-label':'图片尺寸参数',style:{left:position.left,top:position.top,width:position.width},onMouseEnter:show,onMouseLeave:hide,onFocus:show,onPointerDown:()=>{dragging.current=true;},onPointerUp:()=>{dragging.current=false;},onPointerCancel:()=>{dragging.current=false;}},h('div',{className:'cc-editor-size-popover-body'},children)),trigger.current?.closest('.dsh-comfy-floating.cc-backdrop')||document.body):h('div',{ref:popup,className:'cc-editor-size-popover',role:'group','aria-label':'图片尺寸参数',style:{left:position.left,top:position.top,width:position.width},onMouseEnter:show,onMouseLeave:hide},h('div',{className:'cc-editor-size-popover-body'},children))):null);
}

function EditorTransformGlyph({kind}){
 return h('svg',{viewBox:'0 0 24 24',width:17,height:17,fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},
  kind==='rotate'?h(React.Fragment,null,h('path',{d:'M4 11a8 8 0 1 1 3 6.2M4 5v6h6'}),h('path',{d:'M10 9h5v6h-5z'})):
  kind==='flipX'?h(React.Fragment,null,h('path',{d:'M12 3v18',strokeDasharray:'2 3'}),h('path',{d:'M9 5 3 12l6 7V5Zm6 0 6 7-6 7V5Z'})):
  h(React.Fragment,null,h('path',{d:'M3 12h18',strokeDasharray:'2 3'}),h('path',{d:'m5 9 7-6 7 6H5Zm0 6 7 6 7-6H5Z'})));
}
// Opens only while the pointer/focus is on the row or flyout, never pinned by clicking.
function EditorLayerProperties({layer,disabled,onOpacity,onTransform,onRasterize,onDuplicate,children}){
 const row=React.useRef(null),popup=React.useRef(null),bridgeRef=React.useRef(null),timer=React.useRef(null),dragging=React.useRef(false);
 const portal=React.useMemo(()=>{try{return require('react-dom').createPortal;}catch{return null;}},[]);
 const [open,setOpen]=React.useState(false),[position,setPosition]=React.useState({left:8,top:8,width:235});
 const show=()=>{if(timer.current)clearTimeout(timer.current);const r=row.current?.getBoundingClientRect();const aside=row.current?.closest('.cc-editor-sidebar')?.getBoundingClientRect();if(r){const width=Math.min(270,Math.max(220,window.innerWidth*.22));const x=(aside?.left??r.left)-width-8;const popupHeight=popup.current?.getBoundingClientRect().height||200;setPosition({left:Math.max(8,x),top:Math.max(8,Math.min(r.top,window.innerHeight-popupHeight-8)),width});}setOpen(true);};
 const keep=()=>{if(timer.current)clearTimeout(timer.current);};
 const hide=()=>{if(timer.current)clearTimeout(timer.current);if(dragging.current)return;timer.current=setTimeout(()=>{if(!row.current?.matches(':hover')&&!popup.current?.matches(':hover')&&!bridgeRef.current?.matches(':hover')&&!popup.current?.contains(document.activeElement))setOpen(false);},120);};
 React.useLayoutEffect(()=>{if(!open)return;const el=popup.current;if(!el)return;const h=el.getBoundingClientRect().height,maxTop=window.innerHeight-h-8;setPosition(p=>p.top<=maxTop?p:{...p,top:Math.max(8,maxTop)});},[open]);
 React.useEffect(()=>{const end=()=>{if(!dragging.current)return;dragging.current=false;if(!row.current?.matches(':hover')&&!popup.current?.matches(':hover'))setOpen(false);};window.addEventListener('pointerup',end,true);window.addEventListener('pointercancel',end,true);return()=>{clearTimeout(timer.current);window.removeEventListener('pointerup',end,true);window.removeEventListener('pointercancel',end,true);};},[]);
 const actions=[['旋转该图层 90°','rotate'],['水平翻转该图层','flipX'],['上下翻转该图层','flipY']];
 const content=h('div',{ref:popup,className:'cc-editor-layer-popover',role:'group','aria-label':layer.name+' 属性',style:position,onMouseEnter:keep,onMouseLeave:hide,onPointerDown:()=>{dragging.current=true;},onFocus:keep},
  h('div',{className:'cc-layer-popover-title'},layer.name),
  h('label',{className:'cc-flyout-row'},h('span',null,'不透明度 (%)'),h(DraggableNumberInput,{value:Math.round(layer.opacity*100),onChange:v=>onOpacity(layer.id,ccClamp(Number(v)||0,0,100)/100),label:layer.name+' 不透明度',step:1,precision:0,min:0,max:100,className:'cc-parameter-number',disabled})),
  h('div',{className:'cc-layer-popover-action-row',role:'toolbar','aria-label':layer.name+' 图层操作'},
   h('button',{type:'button',disabled,'aria-label':'复制该图层','data-cc-tooltip':'复制该图层',onPointerDown:e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();onDuplicate(layer.id);},onClick:e=>{e.stopPropagation();if(e.detail===0)onDuplicate(layer.id);}},h(ReferenceToolIcon,{name:'copy'})),
   ...actions.map(([label,kind])=>h('button',{key:kind,type:'button',disabled,title:label,'aria-label':label,'data-cc-tooltip':label,onPointerDown:e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();onTransform(layer.id,kind);},onClick:e=>{e.stopPropagation();if(e.detail===0)onTransform(layer.id,kind);}},h(EditorTransformGlyph,{kind})))),
  layer.kind==='vector'&&onRasterize?h('button',{type:'button',style:S.btn2,className:'cc-layer-rasterize-button',disabled,'aria-label':'转为像素','data-cc-tooltip':'将该矢量图层转为像素图层',onClick:e=>{e.stopPropagation();onRasterize(layer.id);}},'转为像素'):null,
  h('span',{className:'cc-flyout-hint'},layer.kind==='vector'?'矢量图形只能在该矢量图层中编辑。旋转、翻转或转为像素后会按此层内容处理。':'只变换该层内容；其他图层和画布尺寸不变。'));
 const r=row.current?.getBoundingClientRect(),right=position.left+position.width;
 const bridgeTop=Math.min(position.top,r?.top??position.top);
 const bridge=h('div',{ref:bridgeRef,className:'cc-editor-layer-hover-bridge',style:{left:right-1,top:bridgeTop,width:Math.max(18,(r?.left??right+18)-right+2),height:Math.max(220,Math.max(position.top+220,r?.bottom??0)-bridgeTop)},onMouseEnter:keep,onMouseLeave:hide});
 const flyout=h(React.Fragment,null,bridge,content);
 return h('div',{ref:row,className:'cc-layer-hover-wrap',onMouseEnter:show,onMouseLeave:hide,onFocus:()=>{if(!open)show();else keep();}},children,
  open?(portal?portal(flyout,row.current?.closest('.dsh-comfy-floating.cc-backdrop')||document.body):flyout):null);
}
const REFERENCE_STUDIO_V13_CSS=`
.dsh-comfy-floating.cc-backdrop .cc-reference-studio-dialog > div:first-child{position:relative;overflow:visible;z-index:35}
.dsh-comfy-floating.cc-backdrop .cc-reference-studio-dialog > div:first-child > strong{display:block;flex:1;min-width:0}
.dsh-comfy-floating .cc-editor-titlebar{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;width:100%}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar-top{flex:0 0 auto;height:auto;max-height:min(420px,53%);min-height:0;overflow-y:auto}
.dsh-comfy-floating .cc-reference-studio .cc-layer-card{flex:1 1 0;min-height:172px;height:0;max-height:none}
.dsh-comfy-floating .cc-editor-visual-clip{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.dsh-comfy-floating .cc-editor-visual-rotate{position:relative;width:100%;height:100%;transform-origin:50% 50%;pointer-events:none}
.dsh-comfy-floating .cc-editor-visual-rotate > canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.dsh-comfy-floating .cc-editor-visual-rotate > svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.dsh-comfy-floating .cc-editor-crop-handle{position:absolute;width:calc(10px * var(--cc-editor-inv-scale,1));height:calc(10px * var(--cc-editor-inv-scale,1));border-radius:2px;background:var(--cc-accent);border:1px solid white;box-sizing:border-box;transform:translate(-50%,-50%);pointer-events:none}
.dsh-comfy-floating .cc-editor-crop-handle[data-handle='nw']{left:0;top:0}
.dsh-comfy-floating .cc-editor-crop-handle[data-handle='n']{left:50%;top:0}
.dsh-comfy-floating .cc-editor-crop-handle[data-handle='ne']{left:100%;top:0}
.dsh-comfy-floating .cc-editor-crop-handle[data-handle='e']{left:100%;top:50%}
.dsh-comfy-floating .cc-editor-crop-handle[data-handle='se']{left:100%;top:100%}
.dsh-comfy-floating .cc-editor-crop-handle[data-handle='s']{left:50%;top:100%}
.dsh-comfy-floating .cc-editor-crop-handle[data-handle='sw']{left:0;top:100%}
.dsh-comfy-floating .cc-editor-crop-handle[data-handle='w']{left:0;top:50%}
.dsh-comfy-floating .cc-reference-crop-box{z-index:4}

.dsh-comfy-floating .cc-editor-title-main{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-comfy-floating .cc-editor-title-actions{display:flex;align-items:center;gap:8px;position:relative}
.dsh-comfy-floating .cc-editor-menu-trigger{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:var(--cc-text);padding:2px 0;cursor:pointer;font:inherit}
.dsh-comfy-floating .cc-editor-menu-trigger svg{opacity:.7}
.dsh-comfy-floating .cc-editor-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:188px;padding:6px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px;box-shadow:0 16px 40px rgba(0,0,0,.35);z-index:80;display:flex;flex-direction:column;gap:2px}
.dsh-comfy-floating .cc-editor-menu button{justify-content:flex-start;padding:8px 10px;min-height:0;border-radius:7px}
.dsh-comfy-floating .cc-reference-overlay-panel{position:absolute;z-index:55;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:10px;box-shadow:0 16px 40px rgba(0,0,0,.28);padding:10px;display:flex;flex-direction:column;gap:8px;min-width:236px}
.dsh-comfy-floating .cc-reference-overlay-panel.left{left:12px;top:12px}
.dsh-comfy-floating .cc-reference-overlay-panel.right{right:12px;top:12px;min-width:unset;padding:8px}
.dsh-comfy-floating .cc-reference-overlay-panel-title{font-size:12px;font-weight:650;color:var(--cc-text)}
.dsh-comfy-floating .cc-reference-panel-actions{display:flex;gap:6px;flex-wrap:wrap}
.dsh-comfy-floating .cc-reference-panel-actions>button{flex:1;min-height:28px;font-size:11px;padding:4px 7px}
.dsh-comfy-floating .cc-reference-lock-button{min-width:34px;height:32px;padding:0 8px;border-radius:7px;border:1px solid var(--cc-border);background:var(--cc-control);color:var(--cc-text);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
.dsh-comfy-floating .cc-reference-lock-button[aria-pressed='true']{background:var(--cc-accent-bg);box-shadow:inset 0 0 0 1px var(--cc-accent);color:var(--cc-accent)}
.dsh-comfy-floating .cc-reference-crop-box{position:absolute;border:1.5px dashed var(--cc-editor-outline,#efefef);background:color-mix(in srgb,var(--cc-accent-bg) 55%,transparent);pointer-events:none;box-shadow:0 0 0 1px color-mix(in srgb,var(--cc-accent) 48%,transparent) inset}
.dsh-comfy-floating .cc-reference-crop-label{position:absolute;left:0;top:-18px;font-size:10px;line-height:1;padding:2px 5px;border-radius:999px;background:var(--cc-surface);border:1px solid var(--cc-border);color:var(--cc-text);white-space:nowrap}
.dsh-comfy-floating .cc-layer-rasterize-button{width:100%;min-height:28px;padding:5px 8px;font-size:11px}
.dsh-comfy-floating .cc-layer-item[data-kind='vector']{border-style:dashed}
.dsh-comfy-floating .cc-layer-badge{font-size:10px;color:var(--cc-muted);padding:1px 5px;border:1px solid var(--cc-border);border-radius:999px}
.dsh-comfy-floating .cc-reference-studio .cc-reference-viewport,
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar,
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar-top,
.dsh-comfy-floating .cc-reference-studio .cc-layer-list,
.dsh-comfy-floating .cc-reference-studio .cc-reference-flyout-body{scrollbar-width:none}
.dsh-comfy-floating .cc-reference-studio .cc-reference-viewport::-webkit-scrollbar,
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar::-webkit-scrollbar,
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar-top::-webkit-scrollbar,
.dsh-comfy-floating .cc-reference-studio .cc-layer-list::-webkit-scrollbar,
.dsh-comfy-floating .cc-reference-studio .cc-reference-flyout-body::-webkit-scrollbar{display:none;width:0;height:0}
.dsh-comfy-floating .cc-image-control{height:166px;min-height:166px;max-height:166px}
.dsh-comfy-floating .cc-image-control .cc-reference-thumb{height:142px}
.dsh-comfy-floating .cc-reference-cell-scale{display:flex;gap:5px;align-items:center;min-width:0;font-size:11px}
.dsh-comfy-floating .cc-reference-cell-scale>span{flex:none;color:var(--cc-muted)}
.dsh-comfy-floating .cc-reference-cell-scale .cc-drag-number{min-width:0;flex:1;height:27px}
`;
function EditorAspectLockGlyph({locked}){
 if(locked)return h(PromptIcon,{name:'link',size:14});
 return h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},
  h('path',{d:'M9 15a5 5 0 0 1-7-7l3-3a5 5 0 0 1 7 0'}),
  h('path',{d:'M15 9a5 5 0 0 1 7 7l-3 3a5 5 0 0 1-7 0'}),
  h('path',{d:'m8 8 8 8'}));
}
const REFERENCE_STUDIO_V15_CSS=`
/* Header title and menu share the left edge; close button stays on right. */
.dsh-comfy-floating.cc-backdrop > section.cc-reference-studio-dialog > div:first-child{justify-content:flex-start!important}
.dsh-comfy-floating.cc-backdrop > section.cc-reference-studio-dialog > div:first-child > strong{flex:0 0 auto!important;min-width:0}
.dsh-comfy-floating.cc-backdrop > section.cc-reference-studio-dialog > div:first-child > .cc-editor-title-actions{margin:0 auto 0 2px!important;flex:none!important}
.dsh-comfy-floating .cc-editor-title-actions .cc-editor-menu{left:0!important;right:auto!important}
/* Each card size is independent of its contents. Only the layer list scrolls. */
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar{display:flex!important;flex-direction:column!important;gap:8px!important;height:100%!important;min-height:0!important;overflow:hidden!important}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar > .cc-editor-card:first-child{box-sizing:border-box;flex:0 0 clamp(202px,30vh,246px)!important;height:clamp(202px,30vh,246px)!important;min-height:0!important;max-height:clamp(202px,30vh,246px)!important;overflow-y:auto!important;overflow-x:hidden!important;gap:6px!important}
.dsh-comfy-floating .cc-reference-studio .cc-editor-color-sv{height:clamp(76px,11vh,98px)!important;flex:none!important}
.dsh-comfy-floating .cc-reference-studio .cc-editor-color-hue{height:12px!important;flex:none!important}
.dsh-comfy-floating .cc-reference-studio .cc-editor-recent-colors{grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(2,20px);min-height:45px;max-height:45px;align-content:start;overflow:hidden!important}
.dsh-comfy-floating .cc-reference-studio .cc-editor-background-card{box-sizing:border-box;flex:0 0 auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:hidden!important;gap:6px!important}
.dsh-comfy-floating .cc-reference-studio .cc-editor-background-grid{gap:5px}
.dsh-comfy-floating .cc-reference-studio .cc-editor-background-tile{height:36px}
.dsh-comfy-floating .cc-reference-studio .cc-layer-card{box-sizing:border-box;flex:1 1 0!important;height:0!important;min-height:90px!important;max-height:none!important;margin-top:0!important;overflow:hidden!important}
.dsh-comfy-floating .cc-reference-studio .cc-layer-card .cc-layer-list{flex:1 1 0!important;min-height:0!important;max-height:none!important;overflow-y:auto!important}
/* Use the existing cc-save-toggle switch-track pattern from app.js. */
.dsh-comfy-floating .cc-editor-image-fill-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:23px;flex:none;font-size:11px;min-width:0}
.dsh-comfy-floating .cc-editor-image-fill-row>span{white-space:nowrap;color:var(--cc-text)}
.dsh-comfy-floating .cc-editor-image-fill-switch{display:flex;align-items:center;justify-content:center;flex:none;width:43px;height:25px;min-height:25px;padding:2px;border:0;border-radius:7px;background:transparent;color:var(--cc-text);cursor:pointer}
.dsh-comfy-floating .cc-editor-image-fill-switch .cc-switch-track{position:relative;display:block;width:33px;height:19px;border-radius:99px;background:var(--cc-border);transition:background .15s}
.dsh-comfy-floating .cc-editor-image-fill-switch .cc-switch-track:after{content:"";position:absolute;left:3px;top:3px;width:13px;height:13px;border-radius:50%;background:var(--cc-text);transition:transform .15s}
.dsh-comfy-floating .cc-editor-image-fill-switch[aria-checked="true"] .cc-switch-track{background:var(--cc-accent)}
.dsh-comfy-floating .cc-editor-image-fill-switch[aria-checked="true"] .cc-switch-track:after{transform:translateX(14px);background:var(--cc-surface)}
.dsh-comfy-floating .cc-editor-image-fill-switch:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-floating .cc-editor-image-fill-switch:disabled{opacity:.45;cursor:not-allowed}
.dsh-comfy-floating .cc-editor-image-fill-swatch{display:block;box-sizing:border-box;flex:none;width:100%;min-width:0;height:30px;min-height:30px;cursor:pointer;padding:3px;background:var(--cc-control);border:1px solid var(--cc-border);border-radius:6px}
.dsh-comfy-floating .cc-editor-image-fill-swatch::-webkit-color-swatch-wrapper{padding:0}
.dsh-comfy-floating .cc-editor-image-fill-swatch::-webkit-color-swatch{border:0;border-radius:3px}
.dsh-comfy-floating .cc-editor-image-fill-swatch::-moz-color-swatch{border:0;border-radius:3px}
.dsh-comfy-floating .cc-editor-image-fill-swatch:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-floating .cc-editor-image-fill-swatch:disabled{opacity:.45;cursor:not-allowed}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar > .cc-editor-card::-webkit-scrollbar{display:none;width:0;height:0}
.dsh-comfy-floating .cc-reference-studio .cc-editor-sidebar > .cc-editor-card{scrollbar-width:none}
`;
const REFERENCE_SCALE_V175_CSS=`
.dsh-comfy-floating .cc-reference-studio .cc-editor-resize-panel{box-sizing:border-box;width:290px;min-width:0;max-width:calc(100% - 24px);max-height:calc(100% - 24px);overflow-y:auto;overscroll-behavior:contain;gap:9px;scrollbar-width:none}
.dsh-comfy-floating .cc-reference-studio .cc-editor-resize-panel::-webkit-scrollbar{display:none;width:0;height:0}
.dsh-comfy-floating .cc-editor-resize-caption,.dsh-comfy-floating .cc-editor-resize-hint{display:block;min-width:0;color:var(--cc-muted);font-size:11px;line-height:1.45}
.dsh-comfy-floating .cc-editor-resize-group{display:flex;flex-direction:column;gap:6px;min-width:0}
.dsh-comfy-floating .cc-editor-resize-label{font-size:11px;font-weight:600;color:var(--cc-text)}
.dsh-comfy-floating .cc-editor-resize-quick{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
.dsh-comfy-floating .cc-editor-resize-quick>button,.dsh-comfy-floating .cc-editor-resize-match{min-height:29px;font-size:11px;min-width:0}
.dsh-comfy-floating .cc-editor-resize-match{width:100%;white-space:normal;text-align:center}
`;
const REFERENCE_FILL_V17_CSS=`
.dsh-comfy-floating .cc-reference-studio .cc-reference-tool:has(.cc-fill-panel) .cc-reference-flyout{width:278px}
.dsh-comfy-floating .cc-reference-studio .cc-fill-panel{display:flex;flex-direction:column;gap:10px;min-width:0;color:var(--cc-text)}
.dsh-comfy-floating .cc-fill-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.dsh-comfy-floating .cc-fill-head strong{font-size:12px;font-weight:650}
.dsh-comfy-floating .cc-fill-head-note{color:var(--cc-muted);font-size:10px;white-space:nowrap}
.dsh-comfy-floating .cc-fill-preset-title{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:550}
.dsh-comfy-floating .cc-fill-custom{margin-left:auto;color:var(--cc-muted);font-size:10px;font-weight:400}
.dsh-comfy-floating .cc-fill-presets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.dsh-comfy-floating .cc-reference-studio .cc-fill-presets .cc-fill-preset{display:flex;align-items:center;justify-content:center;min-width:0;width:auto;height:31px;min-height:31px;padding:4px 5px!important;border-radius:6px;border:1px solid var(--cc-border);background:var(--cc-control);color:var(--cc-text);font-size:11px;cursor:pointer}
.dsh-comfy-floating .cc-fill-presets .cc-fill-preset[aria-pressed="true"]{border-color:var(--cc-accent);background:var(--cc-accent-bg);box-shadow:inset 0 0 0 1px var(--cc-accent)}
.dsh-comfy-floating .cc-fill-presets .cc-fill-preset:focus-visible,.dsh-comfy-floating .cc-fill-advanced-toggle:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-floating .cc-fill-guidance{font-size:10px;color:var(--cc-muted);line-height:1.4}
.dsh-comfy-floating .cc-reference-studio .cc-fill-advanced-toggle{display:flex;align-items:center;gap:6px;justify-content:flex-start;width:100%;height:28px;min-height:28px;flex:none;padding:4px 0!important;border:0;background:transparent;color:var(--cc-text);font-size:11px;text-align:left;cursor:pointer;border-top:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-fill-advanced-note{margin-left:auto;color:var(--cc-muted);font-size:10px}
.dsh-comfy-floating .cc-fill-details{display:flex;flex-direction:column;gap:8px;min-width:0;padding:2px 0}
.dsh-comfy-floating .cc-fill-detail-row{display:flex;align-items:center;gap:7px;justify-content:space-between;min-width:0;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-fill-detail-label{display:inline-flex;align-items:center;gap:4px;flex:none}
.dsh-comfy-floating .cc-fill-info{font-size:11px;opacity:.75}
.dsh-comfy-floating .cc-reference-studio .cc-fill-detail-row .cc-drag-number{width:112px!important;max-width:112px!important;height:30px!important;min-width:0}
.dsh-comfy-floating .cc-fill-units{font-size:10px;line-height:1.4;color:var(--cc-muted)}
.dsh-comfy-floating .cc-fill-foot{padding-top:8px;border-top:1px solid var(--cc-border);font-size:10px;color:var(--cc-muted)}
/* Each layer ROW starts near the toolbar: group rises upward, card never moves. */
.dsh-comfy-floating .cc-reference-studio .cc-layer-card .cc-layer-list{display:flex!important;flex-direction:column!important;justify-content:flex-start!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important}
.dsh-comfy-floating .cc-reference-studio .cc-layer-card .cc-layer-list > *{flex:0 0 auto!important;min-height:35px}
.dsh-comfy-floating .cc-reference-studio .cc-layer-card .cc-layer-list > :first-child{margin-top:auto!important}
`;

const ccClamp=(v,min,max)=>Math.max(min,Math.min(max,v));
// Angles are cyclic, unlike ordinary bounded size/opacity inputs.
const referenceWrapAngle=value=>((Math.round(Number(value)||0)%360)+360)%360;
function referenceCanvasCropFrame(frame,w,h,allowOverflow=false){
 const num=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback,limit=REFERENCE_LIMITS.edge;
 const left=Math.round(num(frame?.x,0)),top=Math.round(num(frame?.y,0));
 const x=ccClamp(left,allowOverflow?-limit:0,allowOverflow?w+limit-1:w-1),y=ccClamp(top,allowOverflow?-limit:0,allowOverflow?h+limit-1:h-1);
 const right=left+Math.max(1,Math.round(num(frame?.w,w))),bottom=top+Math.max(1,Math.round(num(frame?.h,h)));
 return {x,y,w:ccClamp(right-x,1,allowOverflow?Math.min(limit,w+limit-x):w-x),h:ccClamp(bottom-y,1,allowOverflow?Math.min(limit,h+limit-y):h-y)};
}
function referenceCanvasCropHandle(frame,p,scale=1){
 const radius=8/Math.max(.05,scale),l=frame.x,t=frame.y,r=l+frame.w,b=t+frame.h;
 const corners=[['nw',l,t],['ne',r,t],['se',r,b],['sw',l,b]];
 const near=corners.map(([name,x,y])=>({name,d:Math.hypot(p.x-x,p.y-y)})).sort((a,b)=>a.d-b.d)[0];
 if(near.d<=radius)return near.name;
 if(p.x>=l-radius&&p.x<=r+radius){if(Math.abs(p.y-t)<=radius)return 'n';if(Math.abs(p.y-b)<=radius)return 's';}
 if(p.y>=t-radius&&p.y<=b+radius){if(Math.abs(p.x-l)<=radius)return 'w';if(Math.abs(p.x-r)<=radius)return 'e';}
 return '';
}
function referenceCanvasCropResize(frame,handle,p,bounds,locked=false,snap=true,scale=1,allowOverflow=false){
 const {w:W,h:H}=bounds,limit=REFERENCE_LIMITS.edge,f=referenceCanvasCropFrame(frame,W,H,allowOverflow),ratio=f.w/f.h;
 const minX=allowOverflow?-limit:0,minY=allowOverflow?-limit:0,maxX=allowOverflow?W+limit:W,maxY=allowOverflow?H+limit:H;
 const threshold=4/Math.max(.05,scale),edge=(value,max)=>{const v=allowOverflow?value:ccClamp(value,0,max);return snap&&Math.abs(v)<=threshold?0:snap&&Math.abs(max-v)<=threshold?max:v;};
 let l=f.x,t=f.y,r=l+f.w,b=t+f.h;
 const hasX=/[we]/.test(handle),hasY=/[ns]/.test(handle);
 if(handle.includes('w'))l=ccClamp(edge(p.x,W),Math.max(minX,r-limit),r-1);if(handle.includes('e'))r=ccClamp(edge(p.x,W),l+1,Math.min(maxX,l+limit));
 if(handle.includes('n'))t=ccClamp(edge(p.y,H),Math.max(minY,b-limit),b-1);if(handle.includes('s'))b=ccClamp(edge(p.y,H),t+1,Math.min(maxY,t+limit));
 if(locked){
  const ax=handle.includes('w')?f.x+f.w:f.x,ay=handle.includes('n')?f.y+f.h:f.y;
  if(hasX&&hasY){
   const maxW=Math.min(limit,handle.includes('w')?ax-minX:maxX-ax),maxH=Math.min(limit,handle.includes('n')?ay-minY:maxY-ay);
   let width=Math.abs((r-l)/f.w-1)>=Math.abs((b-t)/f.h-1)?r-l:(b-t)*ratio;
   width=Math.max(Math.min(Math.max(1,ratio),maxW,maxH*ratio),Math.min(width,maxW,maxH*ratio));
   const height=width/ratio;l=handle.includes('w')?ax-width:ax;r=l+width;t=handle.includes('n')?ay-height:ay;b=t+height;
  }else if(hasX){
   const cy=f.y+f.h/2,maxW=Math.min(limit,handle.includes('w')?ax-minX:maxX-ax),maxH=Math.min(limit,2*Math.min(cy-minY,maxY-cy));
   const width=Math.min(Math.max(1,ratio,r-l),maxW,maxH*ratio),height=width/ratio;l=handle.includes('w')?ax-width:ax;r=l+width;t=cy-height/2;b=t+height;
  }else if(hasY){
   const cx=f.x+f.w/2,maxH=Math.min(limit,handle.includes('n')?ay-minY:maxY-ay),maxW=Math.min(limit,2*Math.min(cx-minX,maxX-cx));
   const height=Math.min(Math.max(1,1/ratio,b-t),maxH,maxW/ratio),width=height*ratio;t=handle.includes('n')?ay-height:ay;b=t+height;l=cx-width/2;r=l+width;
  }
 }
 const x=Math.round(l),y=Math.round(t);
 return referenceCanvasCropFrame({x,y,w:Math.round(r)-x,h:Math.round(b)-y},W,H,allowOverflow);
}

// Editor pixels stay in the existing PNG store; only a small manifest ID enters cell settings.
async function referenceEditorReadDocument(value,signal,cache){
 await requireSidecarFeature('referenceDocumentsVersion',1,'图片编辑自动保存与历史');
 const record=await jget(EXPANDER+'/reference-documents/'+value.editorDocument,20000,signal);
 if(record.asset!==value.asset.id||record.original!==(value.original||value.asset).id)throw Error('编辑历史与当前图片不一致，请重新读取，避免覆盖原记录');
 const blobs=new Map(),items=[];
 for(const entry of record.history.items){
  const layers=[];
  for(const layer of entry.layers){
   if(!blobs.has(layer.image)){
    const blob=await referenceFetchBlob(layer.image,signal);blobs.set(layer.image,blob);cache?.set(blob,Promise.resolve({id:layer.image}));
   }
   const {image,...meta}=layer;layers.push({...meta,blob:blobs.get(image)});
  }
  items.push({...entry,layers});
 }
 return {...record,history:{items,index:record.history.index}};
}
async function referenceEditorLayerCanvases(entry,signal){
 const layers=[];
 for(const rec of entry.layers){
  if(signal?.aborted)throw Error('图片读取已取消');
  const canvas=referenceCanvas(entry.size.w,entry.size.h);
  if(rec.canvasSnapshot)canvas.getContext('2d').drawImage(rec.canvasSnapshot,0,0);
  else{const bitmap=await referenceRead(rec.blob);try{canvas.getContext('2d').drawImage(bitmap,0,0);}finally{bitmap.close();}}
  const {blob,canvasSnapshot,...meta}=rec;layers.push({...meta,canvas});
 }
 return layers;
}
async function referenceEditorWriteDocument(capture,cache,signal){
 await requireSidecarFeature('referenceDocumentsVersion',1,'图片编辑自动保存与历史');
 const items=[];
 for(const entry of capture.history.items){
  const layers=[];
  for(const layer of entry.layers){
   const backing=layer.blob||layer.canvasSnapshot;if(!backing)throw Error('历史图层像素缺失，未覆盖已保存内容');
   if(!cache.has(backing))cache.set(backing,(async()=>referenceStore(layer.blob||await referenceBlob(layer.canvasSnapshot),signal))().catch(e=>{cache.delete(backing);throw e;}));
   const image=await cache.get(backing),{blob,canvasSnapshot,...meta}=layer;layers.push({...meta,image:image.id});
  }
  const {layers:unused,...meta}=entry;items.push({...meta,layers});
 }
 const current=capture.history.items[capture.history.index];let asset=capture.unchangedAsset;
 if(!asset){
  const canvas=referenceCanvas(current.size.w,current.size.h),ctx=canvas.getContext('2d');
  if(current.fillEnabled){ctx.fillStyle=current.imageBackgroundColor;ctx.fillRect(0,0,canvas.width,canvas.height);}
  for(const layer of current.layers){
   if(layer.id===REFERENCE_MASK_LAYER||!layer.visible)continue;ctx.save();ctx.globalAlpha=layer.opacity;
   if(layer.canvasSnapshot)ctx.drawImage(layer.canvasSnapshot,0,0);
   else{const bitmap=await referenceRead(layer.blob);try{ctx.drawImage(bitmap,0,0);}finally{bitmap.close();}}
   for(const shape of referenceShapesForLayer(current.shapes,layer.id))referenceDrawShape(ctx,shape);ctx.restore();
  }
  asset=await referenceStore(await referenceBlob(canvas),signal);
 }
 const manifest={version:1,asset:asset.id,original:capture.original.id,history:{items,index:capture.history.index},tool:capture.tool};
 const saved=await jpost(EXPANDER+'/reference-documents',manifest,30000,signal);
 if(!saved?.id||!/^[0-9a-f]{64}$/.test(saved.id))throw Error('自动保存没有返回有效历史记录');
 return {asset,document:saved.id,settings:current.generationSize};
}
function referenceEditorSaveCell(kind,next){
 const previous=USER.last;USER.last={...(previous||{}),[kind]:next};
 if(!saveUser()){USER.last=previous;throw Error('单元格保存失败，请检查浏览器存储空间；编辑内容仍在窗口中');}
}

const REFERENCE_CANVAS_CROP_CSS=`
.dsh-comfy-floating .cc-canvas-crop-panel{width:236px;min-width:0}
.dsh-comfy-floating .cc-canvas-crop-title{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsh-comfy-floating .cc-canvas-crop-title .cc-reset-button{--cc-reset-size:28px}
.dsh-comfy-floating .cc-canvas-crop-overflow{display:flex;align-items:center;gap:8px;min-height:28px;font-size:12px;color:var(--cc-text);cursor:pointer}
.dsh-comfy-floating .cc-canvas-crop-overflow input{margin:0;accent-color:var(--cc-accent)}
.dsh-comfy-floating .cc-reference-crop-box{background:transparent;box-shadow:0 0 0 calc(200vmax * var(--cc-editor-inv-scale,1)) rgba(0,0,0,.5);pointer-events:none}
.dsh-comfy-floating .cc-editor-crop-handle{background:var(--cc-surface);border:2px solid var(--cc-accent);width:calc(10px * var(--cc-editor-inv-scale,1));height:calc(10px * var(--cc-editor-inv-scale,1));pointer-events:none}
`;

const REFERENCE_SAVE_STATUS_CSS=`
.dsh-comfy-floating .cc-editor-saving-layer{position:fixed;inset:0;z-index:90;display:grid;place-items:center;pointer-events:none;color:var(--cc-text)}
.dsh-comfy-floating .cc-editor-saving-card{display:flex;align-items:center;gap:12px;box-sizing:border-box;max-width:calc(100vw - 48px);padding:16px 20px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:var(--cc-radius,10px);box-shadow:0 12px 36px rgba(0,0,0,.3)}
.dsh-comfy-floating .cc-editor-saving-card>.cc-icon-spinner{display:inline-flex;flex:none;color:var(--cc-accent)}
.dsh-comfy-floating .cc-editor-saving-copy{display:flex;flex-direction:column;gap:4px;font-size:13px}
.dsh-comfy-floating .cc-editor-saving-copy small{font-size:11px;color:var(--cc-muted)}
`;

/** Use the SAME multiplier for horizontal and vertical canvas/vector scaling.
 * The other integer edge may differ by < 0.5px because dimensions are rounded.
 */
function referenceUniformScale(sourceW,sourceH,targetW,targetH,anchor='w'){
 if(!(sourceW>0&&sourceH>0&&targetW>0&&targetH>0))throw Error('无效图片尺寸');
 return anchor==='h'?targetH/sourceH:targetW/sourceW;
}
/** Scale the entire image proportionally using one source dimension as the anchor.
 * This never changes canvas content directly; the existing transform pipeline
 * performs pixel resampling and scales editable vector geometry when applied.
 */
function referenceScaleLockedSide(sourceW,sourceH,side,length){
 const w=Number(sourceW),h=Number(sourceH),n=Number(length);
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||!Number.isFinite(n)||n<1||!['w','h'].includes(side))return null;
 const edge=Math.round(n);
 return side==='w'?{w:edge,h:Math.max(1,Math.round(h*edge/w))}:{w:Math.max(1,Math.round(w*edge/h)),h:edge};
}
function referenceScaleSizeAllowed(d){
 if(!d)return false;
 try{referenceCheckSize(d.w,d.h);return true;}catch{return false;}
}
/** Match existing physical 1K presets by measuring the source's aspect error.
 * Normalize the source to the preset's long side without rounding, then accept
 * only <=5 px error on the other edge. Matching alone does not modify pixels.
 * Selecting an accepted suggestion explicitly allows a tiny non-uniform resize
 * to the exact preset dimensions; manual and 1024-edge scaling stay uniform.
 */
function referenceMatch1kPreset(sourceW,sourceH,presets){
 const w=Number(sourceW),h=Number(sourceH);
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||!Array.isArray(presets))return null;
 const sourceLong=Math.max(w,h),sourceShort=Math.min(w,h);
 let best=null;
 for(const preset of presets){
  const pw=Number(preset.w),ph=Number(preset.h);
  if(!Number.isFinite(pw)||!Number.isFinite(ph)||pw<1||ph<1)continue;
  const presetLong=Math.max(pw,ph),presetShort=Math.min(pw,ph);
  const scaledShort=sourceShort*presetLong/sourceLong;
  const pixelError=Math.abs(scaledShort-presetShort);
  if(pixelError>5+1e-9||best&&pixelError>=best.pixelError)continue;
  // Orient the EXISTING preset to the source image, never use ratio labels.
  const portrait=w<h,presetPortrait=pw<ph;
  const targetW=(portrait===presetPortrait)?pw:ph;
  const targetH=(portrait===presetPortrait)?ph:pw;
  const proposed={w:targetW,h:targetH};
  if(!referenceScaleSizeAllowed(proposed))continue;
  best={value:preset.value,label:String(preset.label||preset.value||'').split('·')[0].trim(),
   w:targetW,h:targetH,pixelError,canUpscale:sourceLong<presetLong,
   canApply:sourceLong<=presetLong&&(w!==targetW||h!==targetH),
   presetW:pw,presetH:ph};
 }
 return best;
}

function referencePoint(x=0,y=0){return {x:Number(x)||0,y:Number(y)||0};}
function referenceCloneQuad(quad){return (Array.isArray(quad)?quad:[]).map(p=>referencePoint(p?.x,p?.y));}
function referenceDefaultQuad(w,h){return [referencePoint(0,0),referencePoint(w,0),referencePoint(w,h),referencePoint(0,h)];}
function referenceQuadCenter(quad){const q=referenceCloneQuad(quad);return {x:(q[0].x+q[2].x)/2,y:(q[0].y+q[2].y)/2};}
function referenceQuadHandlePositions(quad){const q=referenceCloneQuad(quad);return {nw:q[0],n:{x:(q[0].x+q[1].x)/2,y:(q[0].y+q[1].y)/2},ne:q[1],e:{x:(q[1].x+q[2].x)/2,y:(q[1].y+q[2].y)/2},se:q[2],s:{x:(q[2].x+q[3].x)/2,y:(q[2].y+q[3].y)/2},sw:q[3],w:{x:(q[3].x+q[0].x)/2,y:(q[3].y+q[0].y)/2}};}
function referencePointDistance(a,b){return Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));}
function referenceQuadTranslate(quad,dx,dy){return referenceCloneQuad(quad).map(p=>({x:p.x+dx,y:p.y+dy}));}
function referenceQuadScaleFromCenter(quad,ratio,center=referenceQuadCenter(quad)){
 const r=Math.max(.02,Number(ratio)||1),c=referencePoint(center?.x,center?.y);return referenceCloneQuad(quad).map(p=>({x:c.x+(p.x-c.x)*r,y:c.y+(p.y-c.y)*r}));
}
function referenceQuadRotate(quad,angle,center=referenceQuadCenter(quad)){
 const q=referenceCloneQuad(quad),c=referencePoint(center?.x,center?.y),rad=(Number(angle)||0)*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
 return q.map(p=>{const dx=p.x-c.x,dy=p.y-c.y;return {x:c.x+dx*cos-dy*sin,y:c.y+dx*sin+dy*cos};});
}
function referenceLineNormal(a,b){const dx=(b?.x||0)-(a?.x||0),dy=(b?.y||0)-(a?.y||0),len=Math.hypot(dx,dy)||1;return {x:-dy/len,y:dx/len};}
function referenceRotateHandle(quad,offset=44){
 const q=referenceCloneQuad(quad),bottom={x:(q[2].x+q[3].x)/2,y:(q[2].y+q[3].y)/2},center=referenceQuadCenter(q);
 let n=referenceLineNormal(q[3],q[2]);
 const probe={x:bottom.x+n.x*10,y:bottom.y+n.y*10};
 if(referencePointDistance(probe,center)<referencePointDistance(bottom,center))n={x:-n.x,y:-n.y};
 return {base:center,point:{x:bottom.x+n.x*offset,y:bottom.y+n.y*offset}};
}
function referencePointInQuad(p,quad){
 const q=referenceCloneQuad(quad),x=p?.x||0,y=p?.y||0;let inside=false;
 for(let i=0,j=3;i<4;j=i++){
  const a=q[j],b=q[i],cross=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
  if(Math.abs(cross)<1e-6&&x>=Math.min(a.x,b.x)-1e-6&&x<=Math.max(a.x,b.x)+1e-6&&y>=Math.min(a.y,b.y)-1e-6&&y<=Math.max(a.y,b.y)+1e-6)return true;
  if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
function referenceTransformHandleHit(quad,p,scale=1,mode='parallel'){
 const pos=referenceQuadHandlePositions(quad),radius=11/Math.max(.05,scale);
 const allowed=mode==='parallel'?['nw','n','ne','e','se','s','sw','w']:['nw','n','ne','e','se','s','sw','w'];
 for(const key of allowed){if(referencePointDistance(pos[key],p)<=radius)return {type:'handle',handle:key};}
 const rot=referenceRotateHandle(quad,34/Math.max(.2,scale));
 if(referencePointDistance(rot.point,p)<=radius+2)return {type:'rotate',handle:'rotate'};
 if(referencePointInQuad(p,quad))return {type:'move',handle:'move'};
 return null;
}
function referenceSolveBasis(vec,u,v){const det=u.x*v.y-u.y*v.x;if(Math.abs(det)<1e-6)return null;return {a:(vec.x*v.y-vec.y*v.x)/det,b:(u.x*vec.y-u.y*vec.x)/det};}
function referenceUnitFrom(a,b){const dx=(b?.x||0)-(a?.x||0),dy=(b?.y||0)-(a?.y||0),len=Math.hypot(dx,dy)||1;return {x:dx/len,y:dy/len};}
function referenceParallelCornerDrag(quad,handle,p){
 const q=referenceCloneQuad(quad),pt=referencePoint(p?.x,p?.y);
 if(handle==='nw'){
  const fixed=q[2],u=referenceUnitFrom(q[0],q[1]),v=referenceUnitFrom(q[0],q[3]),sol=referenceSolveBasis({x:fixed.x-pt.x,y:fixed.y-pt.y},u,v);if(!sol)return q;return [pt,{x:pt.x+u.x*sol.a,y:pt.y+u.y*sol.a},fixed,{x:pt.x+v.x*sol.b,y:pt.y+v.y*sol.b}];
 }
 if(handle==='ne'){
  const fixed=q[3],u=referenceUnitFrom(q[3],q[2]),v=referenceUnitFrom(q[3],q[0]),sol=referenceSolveBasis({x:pt.x-fixed.x,y:pt.y-fixed.y},u,v);if(!sol)return q;return [{x:fixed.x+v.x*sol.b,y:fixed.y+v.y*sol.b},pt,{x:fixed.x+u.x*sol.a,y:fixed.y+u.y*sol.a},fixed];
 }
 if(handle==='se'){
  const fixed=q[0],u=referenceUnitFrom(q[0],q[1]),v=referenceUnitFrom(q[0],q[3]),sol=referenceSolveBasis({x:pt.x-fixed.x,y:pt.y-fixed.y},u,v);if(!sol)return q;return [fixed,{x:fixed.x+u.x*sol.a,y:fixed.y+u.y*sol.a},pt,{x:fixed.x+v.x*sol.b,y:fixed.y+v.y*sol.b}];
 }
 if(handle==='sw'){
  const fixed=q[1],u=referenceUnitFrom(q[1],q[0]),v=referenceUnitFrom(q[1],q[2]),sol=referenceSolveBasis({x:pt.x-fixed.x,y:pt.y-fixed.y},u,v);if(!sol)return q;return [{x:fixed.x+u.x*sol.a,y:fixed.y+u.y*sol.a},fixed,{x:fixed.x+v.x*sol.b,y:fixed.y+v.y*sol.b},pt];
 }
 return q;
}
function referenceParallelHandleDrag(quad,handle,delta,p){
 const q=referenceCloneQuad(quad),dx=(delta?.x||0),dy=(delta?.y||0),pt=referencePoint(p?.x,p?.y);
 if(handle==='n'){q[0].x+=dx;q[0].y+=dy;q[1].x+=dx;q[1].y+=dy;return q;}
 if(handle==='e'){q[1].x+=dx;q[1].y+=dy;q[2].x+=dx;q[2].y+=dy;return q;}
 if(handle==='s'){q[2].x+=dx;q[2].y+=dy;q[3].x+=dx;q[3].y+=dy;return q;}
 if(handle==='w'){q[0].x+=dx;q[0].y+=dy;q[3].x+=dx;q[3].y+=dy;return q;}
 return referenceParallelCornerDrag(quad,handle,pt);
}
function referenceFreeHandleDrag(quad,handle,delta,p){
 const q=referenceCloneQuad(quad),dx=(delta?.x||0),dy=(delta?.y||0),pt=referencePoint(p?.x,p?.y);
 if(handle==='nw'){q[0]=pt;return q;}if(handle==='ne'){q[1]=pt;return q;}if(handle==='se'){q[2]=pt;return q;}if(handle==='sw'){q[3]=pt;return q;}
 if(handle==='n'){q[0].x+=dx;q[0].y+=dy;q[1].x+=dx;q[1].y+=dy;return q;}
 if(handle==='e'){q[1].x+=dx;q[1].y+=dy;q[2].x+=dx;q[2].y+=dy;return q;}
 if(handle==='s'){q[2].x+=dx;q[2].y+=dy;q[3].x+=dx;q[3].y+=dy;return q;}
 if(handle==='w'){q[0].x+=dx;q[0].y+=dy;q[3].x+=dx;q[3].y+=dy;return q;}
 return q;
}
// Four screen pixels, matching canvas-crop snapping; Alt temporarily bypasses it.
function referenceSnapTransformQuad(quad,w,h,{scale=1,type='move',handle='',baseMode='parallel',keepRatio=false,bypass=false}={}){
 const q=referenceCloneQuad(quad);if(bypass)return q;
 const threshold=4/Math.max(.05,scale),positions=referenceQuadHandlePositions(q);
 const nearest=(values,end)=>{let best=0,distance=Infinity;for(const value of values)for(const edge of [0,end]){const delta=edge-value;if(Math.abs(delta)<=threshold&&Math.abs(delta)<distance){best=delta;distance=Math.abs(delta);}}return best;};
 if(type==='move'){const points=Object.values(positions);return referenceQuadTranslate(q,nearest(points.map(p=>p.x),w),nearest(points.map(p=>p.y),h));}
 const p=positions[handle];if(!p)return q;
 if(keepRatio){
  const center=referenceQuadCenter(q);let factor=1,distance=Infinity;
  for(const [axis,end] of [['x',w],['y',h]])for(const edge of [0,end]){
   const error=Math.abs(edge-p[axis]),offset=p[axis]-center[axis];
   if(error<=threshold&&error<distance&&Math.abs(offset)>1e-6){const candidate=(edge-center[axis])/offset;if(candidate>=.02){factor=candidate;distance=error;}}
  }
  return referenceQuadScaleFromCenter(q,factor,center);
 }
 const dx=nearest([p.x],w),dy=nearest([p.y],h),point={x:p.x+dx,y:p.y+dy};
 if(!dx&&!dy)return q;
 return baseMode==='free'?referenceFreeHandleDrag(q,handle,{x:dx,y:dy},point):referenceParallelHandleDrag(q,handle,{x:dx,y:dy},point);
}
function referenceBilinearPoint(quad,u,v){const q=referenceCloneQuad(quad),a=(1-u)*(1-v),b=u*(1-v),c=u*v,d=(1-u)*v;return {x:q[0].x*a+q[1].x*b+q[2].x*c+q[3].x*d,y:q[0].y*a+q[1].y*b+q[2].y*c+q[3].y*d};}
function referenceTriangleTransform(src,dst){
 const [s0,s1,s2]=src,[d0,d1,d2]=dst,den=s0.x*(s1.y-s2.y)+s1.x*(s2.y-s0.y)+s2.x*(s0.y-s1.y);if(Math.abs(den)<1e-9)return null;
 return {
  a:(d0.x*(s1.y-s2.y)+d1.x*(s2.y-s0.y)+d2.x*(s0.y-s1.y))/den,
  b:(d0.y*(s1.y-s2.y)+d1.y*(s2.y-s0.y)+d2.y*(s0.y-s1.y))/den,
  c:(d0.x*(s2.x-s1.x)+d1.x*(s0.x-s2.x)+d2.x*(s1.x-s0.x))/den,
  d:(d0.y*(s2.x-s1.x)+d1.y*(s0.x-s2.x)+d2.y*(s1.x-s0.x))/den,
  e:(d0.x*(s1.x*s2.y-s2.x*s1.y)+d1.x*(s2.x*s0.y-s0.x*s2.y)+d2.x*(s0.x*s1.y-s1.x*s0.y))/den,
  f:(d0.y*(s1.x*s2.y-s2.x*s1.y)+d1.y*(s2.x*s0.y-s0.x*s2.y)+d2.y*(s0.x*s1.y-s1.x*s0.y))/den
 };
}
function referenceDrawWarpTriangle(ctx,source,srcTri,dstTri){
 const m=referenceTriangleTransform(srcTri,dstTri);if(!m)return;ctx.save();ctx.beginPath();ctx.moveTo(dstTri[0].x,dstTri[0].y);ctx.lineTo(dstTri[1].x,dstTri[1].y);ctx.lineTo(dstTri[2].x,dstTri[2].y);ctx.closePath();ctx.clip();ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.drawImage(source,0,0);ctx.restore();
}
function referenceWarpCanvas(source,targetW,targetH,quad,segments=14,output=null){
 const out=output||referenceCanvas(targetW,targetH);
 if(output){referenceCheckSize(targetW,targetH);if(out.width!==targetW)out.width=targetW;if(out.height!==targetH)out.height=targetH;}
 const ctx=out.getContext('2d'),sx=source.width,sy=source.height;
 if(output){ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';}
 ctx.clearRect(0,0,targetW,targetH);
 if(referenceTransformUnchanged(quad,targetW,targetH)){ctx.drawImage(source,0,0,targetW,targetH);return out;}
 // A parallelogram is one affine draw: retain exact alpha without triangle seams.
 const q=referenceCloneQuad(quad);
 if(Math.abs(q[0].x+q[2].x-q[1].x-q[3].x)<1e-6&&Math.abs(q[0].y+q[2].y-q[1].y-q[3].y)<1e-6){ctx.setTransform((q[1].x-q[0].x)/sx,(q[1].y-q[0].y)/sx,(q[3].x-q[0].x)/sy,(q[3].y-q[0].y)/sy,q[0].x,q[0].y);ctx.drawImage(source,0,0);return out;}
 // Adjacent antialiased triangles contribute complementary coverage. Add their
 // premultiplied colors/alpha, rather than multiplying coverage at shared edges.
 ctx.globalCompositeOperation='lighter';
 const seg=Math.max(4,Math.min(28,Math.floor(Number(segments)||14)));
 for(let yi=0;yi<seg;yi++)for(let xi=0;xi<seg;xi++){
  const u0=xi/seg,v0=yi/seg,u1=(xi+1)/seg,v1=(yi+1)/seg;
  const s00={x:sx*u0,y:sy*v0},s10={x:sx*u1,y:sy*v0},s11={x:sx*u1,y:sy*v1},s01={x:sx*u0,y:sy*v1};
  const d00=referenceBilinearPoint(quad,u0,v0),d10=referenceBilinearPoint(quad,u1,v0),d11=referenceBilinearPoint(quad,u1,v1),d01=referenceBilinearPoint(quad,u0,v1);
  referenceDrawWarpTriangle(ctx,source,[s00,s10,s11],[d00,d10,d11]);
  referenceDrawWarpTriangle(ctx,source,[s00,s11,s01],[d00,d11,d01]);
 }
 return out;
}
function referenceTransformUnchanged(quad,w,h){const full=referenceDefaultQuad(w,h);return quad?.length===4&&quad.every((p,i)=>Math.abs(p.x-full[i].x)<1e-6&&Math.abs(p.y-full[i].y)<1e-6);}
function referenceRenderLayerCanvas(layer,shapes,w,h){
 const out=referenceCanvas(w,h),ctx=out.getContext('2d');ctx.drawImage(layer.canvas,0,0);for(const shape of referenceShapesForLayer(shapes,layer.id))referenceDrawShape(ctx,shape);return out;
}

function ImageEditorHelp({open,onOpenChange,theme}){
 const anchor=React.useRef(null),popup=React.useRef(null),timer=React.useRef(null);
 const [position,setPosition]=React.useState({left:16,top:70,width:500,maxHeight:600});
 const keep=()=>{clearTimeout(timer.current);onOpenChange(true);};
 const hide=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{if(!anchor.current?.matches(':hover')&&!popup.current?.matches(':hover')&&!popup.current?.contains(document.activeElement)&&document.activeElement!==anchor.current)onOpenChange(false);},120);};
 React.useEffect(()=>()=>clearTimeout(timer.current),[]);
 React.useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{const r=anchor.current?.getBoundingClientRect();if(!r)return;const width=Math.min(520,window.innerWidth-32),top=r.bottom+8;setPosition({left:Math.max(16,Math.min(r.left,window.innerWidth-width-16)),top,width,maxHeight:Math.max(100,window.innerHeight-top-16)});};
  place();window.addEventListener('resize',place);return()=>window.removeEventListener('resize',place);
 },[open]);
 const section=(title,items)=>h('section',{className:'cc-editor-help-section'},h('strong',null,title),h('ul',null,...items.map(([name,description])=>h('li',{key:name},h('b',null,name+'：'),description))));
 return h(React.Fragment,null,
  h('button',{ref:anchor,type:'button',className:'cc-editor-help-trigger',style:S.btn2,'aria-label':'图片编辑器使用说明','aria-expanded':open,onMouseEnter:keep,onMouseLeave:hide,onFocus:keep,onBlur:hide,onClick:()=>onOpenChange(!open)},
   h('svg',{viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('circle',{cx:12,cy:12,r:10.5}),h('path',{d:'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01'}))),
  open?floating(h('div',{className:'dsh-comfy-floating',style:theme},h('div',{ref:popup,className:'cc-reference-overlay-panel cc-editor-help-card',role:'region','aria-label':'图片编辑器使用说明',tabIndex:0,style:{...position,position:'fixed',zIndex:2147482500},onMouseEnter:keep,onMouseLeave:hide,onFocus:keep,onBlur:hide},
   h('p',{className:'cc-editor-help-pixels'},'图片编辑器采用完美像素显示。部分尺寸的图片在缩放时可能出现视觉上的锯齿边缘，这是显示比例造成的，不会改变原图或导出结果。'),
   section('工具与编辑',[
    ['画笔、橡皮擦、油漆桶','在选中的图像图层绘制、擦除或填充颜色。各工具的笔刷参数独立；在画布上按 Ctrl + 滚轮可调整当前画笔大小，普通滚轮缩放画布。'],
    ['智能去除','涂抹或套索选择范围后，点击“应用修改”，使用 LaMa 补出背景。'],
    ['污点修复','适合小污点和多余线条，松开鼠标即应用，一笔一次撤回。'],
    ['模糊、液化','局部柔化或推移像素；可撤回调整。'],
    ['选区换色','先选择范围，再选色域调整色相、饱和度和亮度；保护色域可排除不想改变的颜色。'],
    ['局部重绘遮罩','首次落笔创建“遮罩图层”；主题色标记用于重绘，不进入导出图片。遮罩扩展向外增加范围，边缘过渡柔化交界。'],
    ['颜色与吸色','右侧颜色面板支持调色、HEX 输入和吸色；笔刷大小、形状与透明度在对应工具浮窗中调整。'],
    ['图层与背景','选择图层后编辑，可隐藏、复制、排序或删除图像图层。棋盘格只改变查看背景；开启“图片底色”才会写入导出图像。'],
    ['编辑菜单与历史','缩放、裁剪、旋转或自由变形画布；未确认的预览需先“应用修改”。Ctrl+Z 撤回，Ctrl+Shift+Z 重做。Esc 优先退出当前操作。']]),
   section('保存并退出',[
    ['保存到输出','在默认出图保存目录中新建图片。导出图不保留可恢复的编辑历史。'],
    ['另存为','选择保存位置；浏览器不支持系统选择器时交给浏览器下载。导出图不保留编辑历史。取消选择位置会留在编辑器。'],
    ['设为图生图参考','保存到图生图单元格，保留原图和编辑历史，可继续编辑，直到对应单元格被移除。'],
    ['局部重绘','必须先绘制非空遮罩。保存到底图/遮罩对应的局部重绘单元格，并保留编辑历史供继续编辑。'],
    ['取消','丢弃本次修改，保留进入编辑器前的图片和历史。普通状态下 Esc 同样取消退出。']]),
   h('p',{className:'cc-editor-help-note'},'导出保留原始生成信息，并标记图片经过编辑；这些参数只能生成编辑前的原图，不能还原当前编辑结果。未应用的裁剪、变形和选区预览不参与保存。')
  ))):null);
}

function ReferenceImageEditor({value,target,theme,onClose,onSave,onExit,sizeSettings,initialTool='brush',singleSave=false,saveIntent='inpaint',saveLabel='保存',regionalMode=false}){
 const viewport=React.useRef(null),board=React.useRef(null),display=React.useRef(null),transformPreview=React.useRef(null),transformSource=React.useRef(null),brushCursor=React.useRef(null),brushPointer=React.useRef(null),eyedropLoupe=React.useRef(null),eyedropSwatch=React.useRef(null),alive=React.useRef(true),ctl=React.useRef(new AbortController()),busyRef=React.useRef(true),drag=React.useRef(null),finishRef=React.useRef(null),history=React.useRef({items:[],index:-1}),doc=React.useRef({layers:[],shapes:[],background:'#ffffff',fillEnabled:false,fillColor:'#111111',imageBackgroundColor:'#ffffff',activeId:''}),raf=React.useRef(0),scaleRef=React.useRef(1),transformQuadRef=React.useRef(referenceDefaultQuad(value.asset.width,value.asset.height));
 const [loaded,setLoaded]=React.useState(false),[loadEpoch,setLoadEpoch]=React.useState(0),[processing,setBusy]=React.useState(true),[error,setError]=useErrorState(''),[dirty,setDirty]=React.useState(false),[size,setSize]=React.useState({w:value.asset.width,h:value.asset.height}),[shapes,setShapes]=React.useState([]),[selected,setSelected]=React.useState(''),[tool,setTool]=React.useState(initialTool),[color,setColor]=React.useState('#111111'),[recentColors,setRecentColors]=React.useState(()=>{try{const saved=lsRead().editorUsedColors;return Array.isArray(saved)?saved.filter(x=>/^#[0-9a-fA-F]{6}$/.test(x)).slice(0,12):[];}catch{return [];}}),[eyedrop,setEyedrop]=React.useState(false),[imageFill,setImageFill]=React.useState(false),[imageBackgroundColor,setImageBackgroundColor]=React.useState('#ffffff'),[background,setBackground]=React.useState('#ffffff'),[stroke,setStroke]=React.useState(12),[brushSettings,setBrushSettings]=React.useState({brush:{size:12,shape:'circle',opacity:1},eraser:{size:12,shape:'circle',opacity:1},mask:{size:40,shape:'circle',opacity:1},remove:{size:12,shape:'lasso'},heal:{size:30,shape:'circle'},blur:{size:12,shape:'circle'},liquify:{size:200,shape:'circle'},recolor:{size:12},quickselect:{size:32}}),[filled,setFilled]=React.useState(false),[tolerance,setTolerance]=React.useState(32),[fillGap,setFillGap]=React.useState(3),[fillGrow,setFillGrow]=React.useState(1),[fillAdvanced,setFillAdvanced]=React.useState(false),[scale,setScale]=React.useState(1),[pan,setPan]=React.useState({x:0,y:0}),[rev,setRev]=React.useState(0),[layerList,setLayerList]=React.useState([]),[activeId,setActiveId]=React.useState(''),[blurRadius,setBlurRadius]=React.useState(1),[liquifyStrength,setLiquifyStrength]=React.useState(.25),[recolorHue,setRecolorHue]=React.useState(0),[recolorSaturation,setRecolorSaturation]=React.useState(0),[recolorBrightness,setRecolorBrightness]=React.useState(0),[recolorThreshold,setRecolorThreshold]=React.useState(30),[recolorShape,setRecolorShape]=React.useState('lasso'),[recolorErase,setRecolorErase]=React.useState(false),[protectionPicker,setProtectionPicker]=React.useState(false),[protectionThreshold,setProtectionThreshold]=React.useState(30),[busyLabel,setBusyLabel]=React.useState('');
 const quickDraft=React.useRef(null),quickJob=React.useRef(null),selectionTask=React.useRef(null),spotCommit=React.useRef(null);
 const [selecting,setSelecting]=React.useState(false);
 const selectionSensitivity=65;
 const selectionTool=tool==='recolor';
 const quickSelectionMode=tool==='recolor'&&recolorShape==='quick';
 const [selectionExpansion,setSelectionExpansion]=React.useState(0),selectionExpansionRef=React.useRef(0);
 function stopQuickSelection(){const task=selectionTask.current;selectionTask.current=null;task?.cancel();if(alive.current)setSelecting(false);}
 const [quickRevision,setQuickRevision]=React.useState(0),[quickModels,setQuickModels]=React.useState(null);
 const [generationSize,setGenerationSize]=React.useState(()=>({...imageEditorSize(value,sizeSettings),grow:ccClamp(Math.round(Number(value.grow)||0),0,64),feather:ccClamp(Math.round(Number(value.feather??8)),0,31)})),[showMaskFeather,setShowMaskFeather]=React.useState(false);
 const previousImageLayer=React.useRef(''),previousImageTool=React.useRef('brush');
 const [helpOpen,setHelpOpen]=React.useState(false);
 const persistence=React.useRef({version:0,saved:-1,initial:0,queue:null,cache:new WeakMap(),closing:false,hasDocument:!!value.editorDocument,savedMeta:null,asset:value.asset,assetVersion:0});
 const [saving,setSaving]=React.useState(false),[closing,setClosing]=React.useState(false);
 const busy=processing||closing||!!busyLabel;
 const [exitMenu,setExitMenu]=React.useState(false),[maskErase,setMaskErase]=React.useState(false);
 const exitHost=React.useRef(null);
 React.useEffect(()=>{if(!exitMenu)return;const dismiss=e=>{if(!exitHost.current?.contains(e.target))setExitMenu(false);};document.addEventListener('pointerdown',dismiss,true);return()=>document.removeEventListener('pointerdown',dismiss,true);},[exitMenu]);
 function editorMask(create=false){let layer=doc.current.layers.find(l=>l.id===REFERENCE_MASK_LAYER);if(!layer&&create){const current=doc.current.layers.find(l=>l.id===doc.current.activeId);if(current?.id!==REFERENCE_MASK_LAYER)previousImageLayer.current=current?.id||previousImageLayer.current;layer={id:REFERENCE_MASK_LAYER,name:'遮罩图层',kind:'paint',visible:false,maskVisible:true,opacity:1,canvas:newCanvas(display.current.width,display.current.height)};doc.current.layers.push(layer);syncLayers(tool);}return layer;}
 async function seedEditorMask(){
  if(editorMask()||!value.mask)return;
  const bmp=await referenceLoad(value.mask,ctl.current.signal);try{const layer=editorMask(true);inpaintImportMask(layer.canvas,bmp);layer.maskPreviewRevision=(layer.maskPreviewRevision||0)+1;doc.current.maskPreviewKey='';}finally{bmp.close();}
  const entry=history.current.items[history.current.index];if(entry){const copy=newCanvas(display.current.width,display.current.height);copy.getContext('2d').drawImage(editorMask().canvas,0,0);entry.layers=[...entry.layers,{id:REFERENCE_MASK_LAYER,name:'遮罩图层',kind:'paint',visible:false,maskVisible:true,opacity:1,canvasSnapshot:copy}];}
 }
 function paintEditorMask(points,config,erase){const layer=editorMask(true),x=layer.canvas.getContext('2d');x.save();x.globalCompositeOperation=erase?'destination-out':'source-over';quickEditPaintStroke(x,points,config.size,'white',config.shape);x.restore();layer.maskPreviewRevision=(layer.maskPreviewRevision||0)+1;doc.current.maskPreviewKey='';paintDisplay();}
 React.useEffect(()=>{if(loaded)paintDisplay();},[theme,loaded]);
 function drawEditorMaskPreview(ctx){
  const mask=editorMask();if(!mask||mask.maskVisible===false)return;
  const d=doc.current,w=mask.canvas.width,h=mask.canvas.height,grow=ccClamp(Math.round(Number(generationSize.grow)||0),0,64),feather=showMaskFeather?ccClamp(Math.round(Number(generationSize.feather)||0),0,31):0,token=mask.canvas.__dshMaskToken||(mask.canvas.__dshMaskToken=Math.random().toString(36)),key=`${w}x${h}:${grow}:${feather}:${mask.maskPreviewRevision||0}:${token}`;
  if(!d.maskPreview||d.maskPreview.width!==w||d.maskPreview.height!==h||d.maskPreviewKey!==key){
   const raw=mask.canvas.getContext('2d').getImageData(0,0,w,h),expanded=newCanvas(w,h),ec=expanded.getContext('2d');
   if(grow)ec.putImageData(new ImageData(referenceExpandSelection(raw,grow),w,h),0,0);else ec.drawImage(mask.canvas,0,0);
   const effective=newCanvas(w,h),fc=effective.getContext('2d');
   if(feather){fc.filter=`blur(${Math.max(.5,feather)}px)`;fc.drawImage(expanded,0,0);fc.filter='none';}else fc.drawImage(expanded,0,0);
   d.maskPreview=newCanvas(w,h);const m=d.maskPreview.getContext('2d');m.clearRect(0,0,w,h);m.drawImage(effective,0,0);m.globalCompositeOperation='source-in';m.fillStyle=(viewport.current&&getComputedStyle(viewport.current).getPropertyValue('--cc-accent').trim())||theme?.['--cc-accent']||'#8ab7ff';m.fillRect(0,0,w,h);d.maskPreviewKey=key;
  }
  ctx.save();ctx.globalAlpha=.4;ctx.drawImage(d.maskPreview,0,0);ctx.restore();
 }
 const cancelEditor=async()=>{if(persistence.current.closing)return;setExitMenu(false);cancelQuick();drag.current=null;ctl.current.abort();onClose();};
 async function saveEditorExit(intent){
  if(busyRef.current||persistence.current.closing||!loaded)return;
  setExitMenu(false);setError('');
  let destination=null;
  try{
   if(intent==='inpaint'&&(!editorMask()||inpaintCoverage(editorMask().canvas)<=0))throw Error('请先用遮罩笔刷绘制局部重绘区域');
   if(intent==='saveas')destination=await outputChooseSaveTarget({filename:referenceEditedFilename(value.name)});
  }catch(e){if(e.name!=='AbortError')setError(errText(e));return;}
  // Pending crop/transform/selection previews were never confirmed and must not be exported.
  cancelQuick();drag.current=null;setEditMode('');setCrop(null);resetTransformDraft();setEditMenuOpen(false);setEyedrop(false);
  busyRef.current=true;setClosing(true);setSaving(true);persistence.current.closing=true;
  try{
   const asset=await referenceStore(await referenceBlob(flatten()),ctl.current.signal);
   let document=null,mask=null,coverage=0;
   if(intent==='reference'||intent==='inpaint'){
    const hs=history.current,items=hs.items.slice();items[hs.index]={...items[hs.index],generationSize:{...generationSize}};
    const capture={history:{items,index:hs.index},original:value.original||value.asset,unchangedAsset:asset,tool:{tool,color,stroke,previousImageLayer:previousImageLayer.current,brushAlpha:brushSettings.brush.opacity,brushSettings,filled,tolerance,fillGap,fillGrow}};
    const saved=await referenceEditorWriteDocument(capture,persistence.current.cache,ctl.current.signal);document=saved.document;
    if(editorMask()){coverage=inpaintCoverage(editorMask().canvas);if(coverage>0){const c=newCanvas(size.w,size.h),x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,size.w,size.h);x.drawImage(editorMask().canvas,0,0);mask=await referenceStore(await referenceBlob(c),ctl.current.signal);}}
   }
   const result={asset,original:value.original||value.asset,editorDocument:document,mask,coverage,settings:{...generationSize},name:value.name||'编辑图片',sourceOutput:value.sourceOutput||null,destination};
   let accepted;
   if(onExit)accepted=await onExit(intent,result);
   else if(intent==='reference'){await onSave(asset,result.settings,document);accepted=true;}
   else if(intent==='output'||intent==='saveas'){await referenceExportEdited(intent,result,{folder:USER.last?.savePath||'',prefix:USER.last?.prefix||'dsh_comfy'});accepted=true;}
   else throw Error('当前入口未连接局部重绘单元格');
   if(accepted!==false&&alive.current)onClose();
  }catch(e){if(alive.current&&e.name!=='AbortError')setError('保存失败，编辑内容仍保留：'+errText(e));}
  finally{busyRef.current=false;persistence.current.closing=false;if(alive.current){setClosing(false);setSaving(false);}}
 }
 const exitActions=h('div',{ref:exitHost,className:'cc-editor-exit-actions'},
  singleSave
   ?h('button',{type:'button',style:S.btn,'aria-label':saveLabel,disabled:busy||!loaded,onClick:()=>saveEditorExit(saveIntent)},saving?'正在保存…':saveLabel)
   :h('button',{type:'button',style:S.btn,'aria-label':'保存并退出','aria-haspopup':'menu','aria-expanded':exitMenu,disabled:busy||!loaded,onClick:()=>setExitMenu(v=>!v)},saving?'正在保存…':'保存并退出',h(PromptIcon,{name:'chevronDown',size:14})),
  !singleSave&&exitMenu?h('div',{className:'cc-editor-exit-menu',role:'menu','aria-label':'保存并退出'},...[['output','保存到输出'],['saveas','另存为'],['reference','设为图生图参考'],['inpaint','局部重绘']].map(([intent,label])=>h('button',{key:intent,type:'button',role:'menuitem',onClick:()=>saveEditorExit(intent)},label))):null,
  h('button',{type:'button',style:S.btn2,disabled:closing,onClick:cancelEditor},'取消'));

 React.useEffect(()=>{if(!loaded||tool!=='remove')return;let active=true;sidecarFetch(EXPANDER+'/quick-edit/status',{headers:instanceHeaders()}).then(r=>r.ok?r.json():null).then(v=>{if(active&&v)setQuickModels(v);}).catch(()=>{});return()=>{active=false;};},[loaded,tool]);
 const [reportReadError,clearReadError]=useReadErrorNotice(setError,'图片读取失败',()=>{if(alive.current)setLoadEpoch(v=>v+1);});
 const [previewBackground,setPreviewBackground]=React.useState(()=>{try{return normalizePreviewBackground(lsRead().previewBackground);}catch{return 'dark';}});
 const [editMenuOpen,setEditMenuOpen]=React.useState(false),[editMode,setEditMode]=React.useState(''),[crop,setCrop]=React.useState(null),[cropLocked,setCropLocked]=React.useState(false),[resizeDraft,setResizeDraft]=React.useState({w:value.asset.width,h:value.asset.height}),[resizeAnchor,setResizeAnchor]=React.useState('w'),[resizeMatchedPreset,setResizeMatchedPreset]=React.useState(false),[transformBaseMode,setTransformBaseMode]=React.useState('parallel'),[transformKeepRatio,setTransformKeepRatio]=React.useState(false),[transformQuad,setTransformQuad]=React.useState(()=>referenceDefaultQuad(value.asset.width,value.asset.height)),[transformAngleBadge,setTransformAngleBadge]=React.useState(null);
 const cropHistory=React.useRef({items:[],index:-1}),cropLive=React.useRef(null);
 const [cropRev,setCropRev]=React.useState(0);
 const [cropAllowOverflow,setCropAllowOverflow]=React.useState(false),cropOverflowLive=React.useRef(false);
 const cropCursor={n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize'};
 function previewCrop(frame,allowOverflow=cropOverflowLive.current){const next=referenceCanvasCropFrame(frame,size.w,size.h,allowOverflow);cropOverflowLive.current=allowOverflow;setCropAllowOverflow(allowOverflow);cropLive.current=next;setCrop(next);return next;}
 function recordCrop(frame,key='',allowOverflow=cropOverflowLive.current){
  const next=previewCrop(frame,allowOverflow),hs=cropHistory.current,old=hs.items[hs.index];
  if(old&&old.allowOverflow===allowOverflow&&referenceShapesEqual(old.frame,next))return;
  const entry={frame:{...next},allowOverflow,key,time:Date.now()};
  if(key&&hs.index>0&&hs.index===hs.items.length-1&&old?.key===key&&entry.time-old.time<650)hs.items[hs.index]=entry;
  else{hs.items=hs.items.slice(0,hs.index+1).concat(entry);if(hs.items.length>100)hs.items.shift();hs.index=hs.items.length-1;}
  setCropRev(v=>v+1);
 }
 function undoCrop(delta){
  const d=drag.current;if(d?.tool==='crop-resize'){drag.current=null;previewCrop(d.frame);try{viewport.current.releasePointerCapture(d.pointerId);}catch{}return;}
  const hs=cropHistory.current,next=hs.index+delta;if(next<0||next>=hs.items.length)return;
  hs.index=next;previewCrop(hs.items[next].frame,!!hs.items[next].allowOverflow);setCropRev(v=>v+1);
 }
 function cancelCanvasCrop(){cropHistory.current={items:[],index:-1};cropLive.current=null;cropOverflowLive.current=false;setCropAllowOverflow(false);setEditMode('');setCrop(null);setCropRev(v=>v+1);}
 function toggleCropOverflow(){const next=!cropOverflowLive.current;let frame=cropLive.current||crop;if(!next&&frame&&(frame.x+frame.w<=0||frame.y+frame.h<=0||frame.x>=size.w||frame.y>=size.h))frame={x:0,y:0,w:size.w,h:size.h};recordCrop(frame,'',next);}
 function resetCanvasCrop(){recordCrop({x:0,y:0,w:size.w,h:size.h});}

 React.useEffect(()=>{scaleRef.current=scale;},[scale]);
 React.useEffect(()=>{transformQuadRef.current=transformQuad;},[transformQuad]);
 React.useEffect(()=>{if(loaded&&(doc.current.fillEnabled||tool==='mask'))paintDisplay();},[generationSize.grow,generationSize.feather,showMaskFeather,loaded,tool]);
 React.useEffect(()=>{if(brushSettings.mask?.shape&&brushSettings.mask.shape!=='circle')setBrushSettings(old=>({...old,mask:{...old.mask,shape:'circle'}}));},[brushSettings.mask?.shape]);
 React.useEffect(()=>{setResizeDraft({w:size.w,h:size.h});},[size.w,size.h]);
 const newCanvas=(w,ht)=>{referenceCheckSize(w,ht);const c=document.createElement('canvas');c.width=w;c.height=ht;return c;};
 const uid=prefix=>prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 const shapeName=kind=>({rect:'矩形',ellipse:'椭圆',line:'直线',triangle:'三角形'})[kind]||'矢量图形';
 const updateShapes=next=>{doc.current.shapes=next;setShapes(next);paintDisplay();};
 const activeLayer=()=>doc.current.layers.find(l=>l.id===doc.current.activeId)||doc.current.layers[doc.current.layers.length-1];
 const activePaintLayer=()=>{const current=activeLayer();return current&&current.id!==REFERENCE_MASK_LAYER&&(current.kind==='paint'||current.kind==='base')?current:null;};
 const selectedShapeObject=()=>doc.current.shapes.find(s=>s.id===selected)||null;
 const activeVectorShape=()=>referenceShapesForLayer(doc.current.shapes,doc.current.activeId)[0]||null;
 function imageLayerFallback(){
  return doc.current.layers.find(l=>l.id===previousImageLayer.current&&l.id!==REFERENCE_MASK_LAYER)||doc.current.layers.find(l=>l.id!==REFERENCE_MASK_LAYER)||null;
 }
 function syncLayers(activeTool=tool){
  const d=doc.current,current=d.layers.find(l=>l.id===d.activeId),mask=d.layers.find(l=>l.id===REFERENCE_MASK_LAYER);
  if(current&&current.id!==REFERENCE_MASK_LAYER)previousImageLayer.current=current.id;
  if(activeTool==='mask'&&mask)d.activeId=mask.id;
  else if(!current||current.id===REFERENCE_MASK_LAYER)d.activeId=imageLayerFallback()?.id||'';
  if(mask)mask.name='遮罩图层';
  setLayerList(d.layers.map(l=>({id:l.id,name:l.name,kind:l.kind,visible:l.id===REFERENCE_MASK_LAYER?l.maskVisible!==false:l.visible,opacity:l.opacity})));
  setActiveId(d.activeId);
 }
 function activateTool(next){
  if(next!==tool)cancelQuick();
  if(next==='mask'&&tool!=='mask')previousImageTool.current=tool;
  else if(next!=='mask')previousImageTool.current=next;
  setTool(next);syncLayers(next);setSelected('');
 }
 React.useEffect(()=>{if(loaded)syncLayers(tool);},[tool,loaded]);
 function updateMaskSetting(key,value){
  const next={...generationSize,[key]:ccClamp(Math.round(Number(value)||0),0,key==='grow'?64:31)};
  setGenerationSize(next);recordMetadataChange('mask-setting:'+key,{generationSize:next});
 } 
 function pickColor(next){if(!/^#[0-9a-fA-F]{6}$/.test(next))return;setColor(next.toLowerCase());doc.current.fillColor=next.toLowerCase();}
 function noteUsedColor(candidate){const v=String(candidate||'').toLowerCase();if(!/^#[0-9a-f]{6}$/.test(v))return;setRecentColors(old=>{if(old[0]===v)return old;const next=[v,...old.filter(x=>x!==v)].slice(0,12);try{lsWrite({editorUsedColors:next});}catch{}return next;});}
 function colorCommit(){/* Choosing a brush color never modifies the picture or color history. */}
 function setFixedImageBackground(next){
  if(busyRef.current||!/^#[0-9a-fA-F]{6}$/.test(next))return;
  const value=next.toLowerCase();if(doc.current.imageBackgroundColor===value)return;
  doc.current.imageBackgroundColor=value;setImageBackgroundColor(value);
  if(doc.current.fillEnabled){paintDisplay();recordMetadataChange('image-background-color');}
 }
 function updateFill(checked){
  if(busyRef.current||doc.current.fillEnabled===checked)return;
  doc.current.fillEnabled=checked;setImageFill(checked);
  paintDisplay();recordMetadataChange('image-background-enabled',{},false);
 }
 function sourcePixel(e,keepTool=false){const r=board.current?.getBoundingClientRect(),canvas=display.current;if(!r||!r.width||!canvas)return false;const p=editorImageRect(e.clientX,e.clientY,r,size.w,size.h);if(p.x<0||p.x>=size.w||p.y<0||p.y>=size.h)return false;const px=Math.floor(p.x),py=Math.floor(p.y),image=canvas.getContext('2d',{willReadFrequently:true}).getImageData(px,py,1,1).data;if(image[3]===0)return false;const next='#'+[image[0],image[1],image[2]].map(v=>v.toString(16).padStart(2,'0')).join('');pickColor(next);if(!keepTool)setEyedrop(false);return true;}
 function previewEyedrop(e,boardRect,viewportRect){const host=eyedropLoupe.current,swatch=eyedropSwatch.current;if(!host||!swatch||!display.current)return;const p=editorImageRect(e.clientX,e.clientY,boardRect,size.w,size.h),px=Math.floor(p.x),py=Math.floor(p.y),canvas=host.querySelector('canvas'),ctx=canvas?.getContext('2d');if(!ctx||px<0||py<0||px>=size.w||py>=size.h){host.style.display='none';swatch.style.display='none';return;}const image=display.current.getContext('2d',{willReadFrequently:true}).getImageData(px,py,1,1).data,hex='#'+[image[0],image[1],image[2]].map(v=>v.toString(16).padStart(2,'0')).join('');ctx.clearRect(0,0,126,126);ctx.imageSmoothingEnabled=false;ctx.drawImage(display.current,px-4,py-4,9,9,0,0,126,126);ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=.6;for(let i=1;i<9;i++){const n=i*14;ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,126);ctx.moveTo(0,n);ctx.lineTo(126,n);ctx.stroke();}ctx.strokeStyle='#111';ctx.lineWidth=3;ctx.strokeRect(55,55,16,16);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.strokeRect(57,57,12,12);const x=e.clientX-viewportRect.left-(viewport.current?.clientLeft||0),y=e.clientY-viewportRect.top-(viewport.current?.clientTop||0),left=ccClamp(x+20,8,Math.max(8,viewportRect.width-140)),top=ccClamp(y-148,8,Math.max(8,viewportRect.height-140));host.style.left=left+'px';host.style.top=top+'px';host.style.display='block';swatch.style.left=x+'px';swatch.style.top=y+'px';swatch.style.backgroundColor=hex;swatch.style.display='block';}
 function paintDisplay(settings=generationSize){const c=display.current;if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);if(doc.current.fillEnabled){ctx.fillStyle=doc.current.imageBackgroundColor;ctx.fillRect(0,0,c.width,c.height);}const draft=quickDraft.current;
  const layers=draft?.preview?doc.current.layers.map(l=>l.id===draft.layerId?{...l,canvas:draft.preview}:l):doc.current.layers;
  referenceCompositeLayers(ctx,layers,doc.current.shapes);drawEditorMaskPreview(ctx);
  // Interaction feedback is drawn last, above every image/vector layer. It is
  // never a document layer, a worker input or an undo snapshot.
  if(draft?.kind==='heal'&&draft.feedback){ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.45;ctx.drawImage(draft.feedback,0,0);ctx.restore();}
 }
 function quickLayer(){const l=activePaintLayer();if(!l||!l.visible){setError('请先选择一个可见的像素图层');return null;}return l;}
 function quickCtx(l){return l.canvas.getContext('2d',{willReadFrequently:true});}
 function brushConfig(key){return brushSettings[key]||{size:12,shape:'circle',opacity:1};}
  function setBrushConfig(key,patch){setBrushSettings(old=>({...old,[key]:{...brushConfigFrom(old,key),...patch}}));}
  function brushConfigFrom(all,key){return all[key]||{size:12,shape:'circle',opacity:1};}
  function quickState(l,p,pointerId){const config=brushConfig(tool);return {pointerId:pointerId||0,tool,points:[p],last:p,layerId:l.id,stroke:Math.max(1,Math.min(512,Number(config.size)||1)),shape:config.shape||'circle',opacity:config.opacity??1,base:quickCtx(l).getImageData(0,0,size.w,size.h),blurRadius,strength:liquifyStrength};}
 function quickPreviewBlur(d){const l=doc.current.layers.find(x=>x.id===d.layerId);if(!l)return;const ctx=quickCtx(l);ctx.putImageData(d.base,0,0);
  const pad=Math.max(1,Math.ceil(d.blurRadius)+2),c=l.canvas;
  const padded=document.createElement('canvas');padded.width=size.w+pad*2;padded.height=size.h+pad*2;const pc=padded.getContext('2d');
  pc.drawImage(c,0,0,size.w,1,0,0,size.w+pad*2,pad);pc.drawImage(c,0,size.h-1,size.w,1,0,pad+size.h,size.w+pad*2,pad);
  pc.drawImage(c,0,0,1,size.h,0,0,pad,pad+size.h);pc.drawImage(c,size.w-1,0,1,size.h,pad+size.w,0,pad,pad+size.h);pc.drawImage(c,pad,pad);
  const blurred=document.createElement('canvas');blurred.width=size.w+pad*2;blurred.height=size.h+pad*2;const bc=blurred.getContext('2d');bc.filter=`blur(${d.blurRadius}px)`;bc.drawImage(padded,0,0);
  const filtered=document.createElement('canvas');filtered.width=size.w;filtered.height=size.h;const fc=filtered.getContext('2d');fc.drawImage(blurred,pad,pad,size.w,size.h,0,0,size.w,size.h);
  const mask=document.createElement('canvas');mask.width=size.w;mask.height=size.h;const mc=mask.getContext('2d');quickEditPaintStroke(mc,d.points,d.stroke,'white',d.shape);
  fc.globalCompositeOperation='destination-in';fc.drawImage(mask,0,0);ctx.globalAlpha=1;ctx.drawImage(filtered,0,0);paintDisplay();}
 // Quick tools keep selection and previews outside document/history until Apply.
 function clearQuickDraft(){stopQuickSelection();quickDraft.current=null;if(alive.current){setProtectionPicker(false);setQuickRevision(v=>v+1);}paintDisplay();}
 function cancelQuick(){
  const job=quickJob.current;if(job){job.cancelled=true;quickJob.current=null;if(job.cancel)job.cancel();else{job.controller.abort();
   sidecarFetch(EXPANDER+'/quick-edit/cancel',{method:'POST',headers:{'Content-Type':'application/json',...instanceHeaders()},body:JSON.stringify({request_id:job.id})}).catch(()=>{});
  }}
  if(drag.current&&QUICK_TOOLS.includes(drag.current.tool))drag.current=null;
  clearQuickDraft();
 }
 function makeQuickDraft(l,kind){
  const current=quickDraft.current;if(current?.kind===kind&&current.layerId===l.id)return current;
  clearQuickDraft();const base=referenceCanvas(size.w,size.h);base.getContext('2d').drawImage(l.canvas,0,0);
  const d={kind,layerId:l.id,base,mask:referenceCanvas(size.w,size.h),strokes:[],protectedDomains:[],preview:null};if(kind==='recolor')d.history={items:[referenceRecolorStep(d,recolorSettings())],index:0};quickDraft.current=d;setQuickRevision(v=>v+1);return d;
 }
 function paintQuickMask(d,strokeDraft=null,expansion=selectionExpansionRef.current){
  const mc=d.mask.getContext('2d');mc.clearRect(0,0,size.w,size.h);
  const draw=s=>{mc.save();if(d.kind==='recolor'&&s.exclude)mc.globalCompositeOperation='destination-out';
   if(s.shape==='wand'||s.shape==='quickselect'){if(s.shape==='quickselect'){mc.globalCompositeOperation='source-over';mc.clearRect(0,0,size.w,size.h);}mc.fillStyle='white';for(let i=0;i<s.runs.length;i+=2){const at=s.runs[i];mc.fillRect(at%size.w,Math.floor(at/size.w),s.runs[i+1],1);}}
   else if(s.shape==='lasso'){if(s.points.length>=3){mc.beginPath();mc.moveTo(s.points[0].x,s.points[0].y);for(const p of s.points.slice(1))mc.lineTo(p.x,p.y);mc.closePath();mc.fillStyle='white';mc.fill();}}
   else quickEditPaintStroke(mc,s.points,s.stroke,'white',s.shape);mc.restore();};
  for(const s of d.strokes)draw(s);
  if(strokeDraft)draw(strokeDraft);
  if(d.kind==='heal'){
   if(!d.feedback)d.feedback=referenceCanvas(size.w,size.h);
   const feedback=d.feedback.getContext('2d');feedback.save();feedback.clearRect(0,0,size.w,size.h);feedback.drawImage(d.mask,0,0);
   feedback.globalCompositeOperation='source-in';feedback.fillStyle=getComputedStyle(viewport.current).getPropertyValue('--cc-accent').trim()||'#8ab7ff';feedback.fillRect(0,0,size.w,size.h);feedback.restore();
  }
  if(d.kind==='recolor'||d.kind==='remove'){
   if(d.kind!=='recolor')expansion=0;
   d.rawSelection=null;if(expansion>0){const raw=mc.getImageData(0,0,size.w,size.h);d.rawSelection=referenceSelectionRuns(raw);const expanded=referenceExpandSelection(raw,expansion);mc.putImageData(new ImageData(expanded,size.w,size.h),0,0);}
   let x0=size.w,y0=size.h,x1=0,y1=0;for(const stroke of [...d.strokes,...(strokeDraft?[strokeDraft]:[])]){if(stroke.shape==='wand'||stroke.shape==='quickselect'){x0=Math.min(x0,stroke.bounds[0]);y0=Math.min(y0,stroke.bounds[1]);x1=Math.max(x1,stroke.bounds[2]);y1=Math.max(y1,stroke.bounds[3]);continue;}const pad=stroke.shape==='lasso'?1:stroke.stroke*(stroke.shape==='soft'?1.5:.6)+2;for(const p of stroke.points){x0=Math.min(x0,p.x-pad);y0=Math.min(y0,p.y-pad);x1=Math.max(x1,p.x+pad);y1=Math.max(y1,p.y+pad);}}d.outline=quickSelectionOutline(mc.getImageData(0,0,size.w,size.h),[Math.max(0,Math.floor(x0-expansion)),Math.max(0,Math.floor(y0-expansion)),Math.min(size.w,Math.ceil(x1+expansion)),Math.min(size.h,Math.ceil(y1+expansion))]);setQuickRevision(v=>v+1);}
  paintDisplay();
 }
 function recolorSettings(){return {hue:recolorHue,saturation:recolorSaturation,brightness:recolorBrightness,threshold:recolorThreshold,protectionThreshold,selectionSensitivity,selectionExpansion};}
 function recordQuickRecolor(overrides={}){const d=quickDraft.current;if(d?.kind!=='recolor'||!d.history)return;referenceRecolorPush(d,{...recolorSettings(),...overrides});setQuickRevision(v=>v+1);}
 function undoQuickRecolor(delta){
  const d=quickDraft.current;if(d?.kind!=='recolor')return false;
  if(selectionTask.current){stopQuickSelection();paintQuickMask(d);previewQuickColor();return true;}
  if(drag.current?.tool==='recolor')finishRef.current?.();
  const hs=d.history,next=hs.index+delta;if(next<0||next>=hs.items.length)return true;
  hs.index=next;const step=hs.items[next];d.strokes=step.strokes.slice();d.protectedDomains=step.protectedDomains.slice();d.preview=null;
  setRecolorHue(step.settings.hue);setRecolorSaturation(step.settings.saturation);setRecolorBrightness(step.settings.brightness);setRecolorThreshold(step.settings.threshold);setProtectionThreshold(step.settings.protectionThreshold);selectionExpansionRef.current=step.settings.selectionExpansion??0;setSelectionExpansion(selectionExpansionRef.current);
  paintQuickMask(d);finishQuickSelection(d,{chosen:step.chosen,settings:step.settings});return true;
 }
 function selectionSeedRuns(d,s){
  if(s.shape==='quickselect')return s.inputRuns;
  if(s.shape==='wand')return s.runs;
  d.seedCache ||= new WeakMap();if(d.seedCache.has(s))return d.seedCache.get(s);
  const mask=referenceCanvas(size.w,size.h),ctx=mask.getContext('2d');
  if(s.shape==='lasso'){if(s.points.length>=3){ctx.beginPath();ctx.moveTo(s.points[0].x,s.points[0].y);for(const p of s.points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle='white';ctx.fill();}}
  else quickEditPaintStroke(ctx,s.points,s.stroke,'white',s.shape);
  const runs=referenceSelectionRuns(ctx.getImageData(0,0,size.w,size.h));d.seedCache.set(s,runs);return runs;
 }
 async function selectQuickBrush(d,stroke){
  stopQuickSelection();if(!d.original)d.original=d.base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,size.w,size.h);
  const inputRuns=selectionSeedRuns(d,stroke);if(!inputRuns.length){paintQuickMask(d);return;}
  paintQuickMask(d);const prior=d.rawSelection||referenceSelectionRuns(d.mask.getContext('2d').getImageData(0,0,size.w,size.h));
  const seeds=d.strokes.map(s=>({runs:selectionSeedRuns(d,s),exclude:s.shape==='quickselect'?s.seedExclude:!!s.exclude}));seeds.push({runs:inputRuns,exclude:stroke.exclude});
  const historyIndex=d.history.index,task=referenceQuickSelectionTask({width:size.w,height:size.h,image:d.original.data.slice(),prior,seeds,sensitivity:selectionSensitivity});
  selectionTask.current=task;setSelecting(true);setError('');
  try{const result=await task.promise;if(!alive.current||selectionTask.current!==task||quickDraft.current!==d||d.history.index!==historyIndex)return;
   d.strokes.push({...result,shape:'quickselect',inputRuns,seedExclude:!!stroke.exclude});d.preview=null;paintQuickMask(d);finishQuickSelection(d);recordQuickRecolor();
  }catch(error){if(alive.current&&selectionTask.current===task&&error.name!=='AbortError'){paintQuickMask(d);previewQuickColor();setError('快速选择失败：'+errText(error));}}
  finally{if(selectionTask.current===task){selectionTask.current=null;if(alive.current)setSelecting(false);}}
 }
 function updateSelectionExpansion(value){
  const n=ccClamp(Math.round(Number(value)||0),0,64);selectionExpansionRef.current=n;setSelectionExpansion(n);
  const d=quickDraft.current;if(d?.kind==='recolor'){paintQuickMask(d,null,n);finishQuickSelection(d,{settings:{...recolorSettings(),selectionExpansion:n}});}
 }
 function commitSelectionExpansion(){recordQuickRecolor({selectionExpansion:selectionExpansionRef.current});}
 function finishQuickSelection(d,options={}){
  if(!d.original)d.original=d.base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,size.w,size.h);
  d.analysis=quickSelectionAnalyze(d.original,d.mask.getContext('2d',{willReadFrequently:true}).getImageData(0,0,size.w,size.h));
  const keep=(d.analysis.domains||[]).filter(x=>d.chosen?.has(x.id));d.chosen=new Set(options.chosen||(keep.length?keep:d.analysis.domains.slice(0,1)).map(x=>x.id));
  previewQuickColor(options.settings);setQuickRevision(v=>v+1);
 }
 function pickProtectedColor(d,p){
  if(!d.original||!d.analysis?.count)return;
  const x=ccClamp(Math.floor(p.x),0,size.w-1),y=ccClamp(Math.floor(p.y),0,size.h-1),i=(y*size.w+x)*4;
  if(!d.mask.getContext('2d').getImageData(x,y,1,1).data[3]||!d.original.data[i+3]){setError('请在选区内点击要保护的颜色');return;}
  // Always sample the original layer, even while a color-adjustment preview is visible.
  const rgb=Array.from(d.original.data.slice(i,i+3),v=>v/255),lab=quickSelectionLab(...rgb),color='#'+Array.from(d.original.data.slice(i,i+3),v=>v.toString(16).padStart(2,'0')).join('');
  if(!d.protectedDomains.some(v=>Math.hypot(...v.lab.map((c,k)=>c-lab[k]))<.01)){d.protectedDomains.push({id:uid('protected-color'),color,lab});recordQuickRecolor();}
  previewQuickColor();
 }
 function previewQuickColor(settings=recolorSettings()){
  const d=quickDraft.current;if(d?.kind!=='recolor'||!d.analysis)return;
  const result=quickSelectionAdjust(d.original,d.analysis,d.chosen,settings,d.protectedDomains);
  if(result){if(!d.preview)d.preview=referenceCanvas(size.w,size.h);d.preview.getContext('2d').putImageData(result,0,0);}else d.preview=null;
  paintDisplay();setQuickRevision(v=>v+1);
 }
 React.useEffect(()=>{const id=requestAnimationFrame(()=>previewQuickColor());return()=>cancelAnimationFrame(id);},[recolorHue,recolorSaturation,recolorBrightness,recolorThreshold,protectionThreshold]);
 async function quickRequest(path,payload,label){
  const job={id:uid('edit'),controller:new AbortController(),cancelled:false};quickJob.current=job;setBusyLabel(label);
  try{
   await requireSidecarFeature('quickEditVersion',3,'图片修复');
   if(job.cancelled||!alive.current)throw new DOMException('已取消','AbortError');
   const response=await sidecarFetch(EXPANDER+path,{method:'POST',headers:{'Content-Type':'application/json',...instanceHeaders()},signal:job.controller.signal,body:JSON.stringify({...payload,request_id:job.id})});
   if(!response.ok){const data=await response.json();throw Error(data.error||'图片处理失败');}
   if(job.cancelled||!alive.current)throw new DOMException('已取消','AbortError');
   const blob=await response.blob();if(job.cancelled||!alive.current)throw new DOMException('已取消','AbortError');
   if(blob.type.includes('json'))throw new DOMException('已取消','AbortError');
   return {blob,job};
  }finally{if(quickJob.current===job)quickJob.current=null;if(alive.current)setBusyLabel('');}
 }
 function repairSpotStroke(d){
  if(d?.kind!=='heal'||!d.strokes.length)return;
  const commit=run(async()=>{
   const l=doc.current.layers.find(x=>x.id===d.layerId);if(!l)return false;
   let job;
   try{
    const mask=d.mask.getContext('2d').getImageData(0,0,size.w,size.h),coverage=new Uint8Array(size.w*size.h);
    for(let i=0;i<coverage.length;i++)coverage[i]=mask.data[i*4+3];
    const original=d.base.getContext('2d').getImageData(0,0,size.w,size.h);
    const task=referenceSpotHealTask({width:size.w,height:size.h,image:original.data,mask:coverage});
    job={cancelled:false,cancel:task.cancel};quickJob.current=job;
    const pixels=await task.promise;if(job.cancelled||!alive.current||quickDraft.current!==d)return false;
    quickCtx(l).putImageData(new ImageData(pixels,size.w,size.h),0,0);clearQuickDraft();return true;
   }catch(e){if(e.name==='AbortError')return false;throw e;}
   finally{if(job&&quickJob.current===job)quickJob.current=null;if(quickDraft.current===d)clearQuickDraft();}
  },{fastHistory:true,changedIds:[d.layerId],keepQuickDraft:true});
  spotCommit.current=commit;commit.finally(()=>{if(spotCommit.current===commit)spotCommit.current=null;});
 }
 function repairQuickDraft(){
  const d=quickDraft.current;if(!d?.strokes.length)return;
  run(async()=>{
   const l=doc.current.layers.find(x=>x.id===d.layerId);if(!l)return false;

   try{
    const mask=referenceCanvas(size.w,size.h),mc=mask.getContext('2d');mc.fillStyle='black';mc.fillRect(0,0,size.w,size.h);mc.drawImage(d.mask,0,0);
    const {blob,job}=await quickRequest('/quick-edit/repair',{mode:'remove',image:d.base.toDataURL('image/png').split(',')[1],mask:mask.toDataURL('image/png').split(',')[1]},'正在去除…');
    const bitmap=await createImageBitmap(blob);
    try{if(job.cancelled||!alive.current||quickDraft.current!==d)return false;if(bitmap.width!==size.w||bitmap.height!==size.h)throw Error('修复结果尺寸发生变化');const ctx=quickCtx(l);ctx.clearRect(0,0,size.w,size.h);ctx.drawImage(bitmap,0,0);}finally{bitmap.close();}
    clearQuickDraft();return true;
   }catch(e){if(e.name!=='AbortError')throw e;return false;}
  },{fastHistory:true,changedIds:[d.layerId],keepQuickDraft:true});
 }
 function applyQuickColor(){const d=quickDraft.current;if(!d?.preview)return;run(()=>{const l=doc.current.layers.find(x=>x.id===d.layerId);if(!l)return false;const ctx=quickCtx(l);ctx.clearRect(0,0,size.w,size.h);ctx.drawImage(d.preview,0,0);clearQuickDraft();},{fastHistory:true,changedIds:[d.layerId],keepQuickDraft:true});}
 async function prepareQuickModel(){
  run(async()=>{setBusyLabel('正在准备 LaMa 模型…');try{await requireSidecarFeature('quickEditVersion',3,'图片编辑模型');const r=await sidecarFetch(EXPANDER+'/quick-edit/model',{method:'POST',headers:{'Content-Type':'application/json',...instanceHeaders()},body:'{}'});const data=await r.json();if(!r.ok)throw Error(data.error||'模型准备失败');setQuickModels(data);}finally{if(alive.current)setBusyLabel('');}return false;},{record:false,keepQuickDraft:true});
 }

 function editorFillRect(w=size.w,ht=size.h,settings=generationSize){let output;try{output=validateImageEditorSize(value,{w,h:ht},settings);}catch{}return output?editorFrameRect(w,ht,output.w,output.h):{x:0,y:0,w,h:ht};}
 function fitView(w,ht){const el=viewport.current;if(!el)return;const f=Math.max(.01,Math.min(1,(el.clientWidth-24)/w,(el.clientHeight-24)/ht));scaleRef.current=f;setScale(f);setPan({x:(el.clientWidth-w*f)/2,y:(el.clientHeight-ht*f)/2});}
 function dimensions(w,ht){setSize({w,h:ht});}
 async function snapshot({fast=false,changedIds=null}={}){
  const c=display.current,hs=history.current,previous=hs.items[hs.index];
  const changes=changedIds===null?null:new Set(changedIds);
  const dirtyLayers=doc.current.layers.filter(l=>{const old=previous?.layers.find(x=>x.id===l.id);return !changes||changes.has(l.id)||!old||previous.size.w!==l.canvas.width||previous.size.h!==l.canvas.height;});
  const bytes=dirtyLayers.reduce((total,l)=>total+l.canvas.width*l.canvas.height*4,0);if(fast&&bytes>48*1024*1024)fast=false;
  const entry={size:{w:c.width,h:c.height},shapes:JSON.parse(JSON.stringify(doc.current.shapes)),background:doc.current.background,frameRect:editorFillRect(c.width,c.height),generationSize:{...generationSize},fillEnabled:doc.current.fillEnabled,fillColor:doc.current.fillColor,imageBackgroundColor:doc.current.imageBackgroundColor,activeId:doc.current.activeId,layers:[]};
  for(const l of doc.current.layers){const rec={id:l.id,name:l.name,kind:l.kind,visible:l.visible,opacity:l.opacity,...(l.id===REFERENCE_MASK_LAYER?{maskVisible:l.maskVisible!==false}:{})};const old=previous?.layers.find(x=>x.id===l.id);if(old&&!dirtyLayers.includes(l)){if(old.blob)rec.blob=old.blob;else if(old.canvasSnapshot)rec.canvasSnapshot=old.canvasSnapshot;}else if(fast){const copy=newCanvas(l.canvas.width,l.canvas.height);copy.getContext('2d').drawImage(l.canvas,0,0);rec.canvasSnapshot=copy;}else rec.blob=await referenceBlob(l.canvas);entry.layers.push(rec);} 
  if(!alive.current)return;hs.items=hs.items.slice(0,hs.index+1).concat(entry);while(hs.items.length>1&&(hs.items.length>20||editorHistoryBytes(hs.items)>96*1024*1024))hs.items.shift();hs.index=hs.items.length-1;persistence.current.version++;setRev(v=>v+1);
 }
 function recordMetadataChange(kind,overrides={},merge=true){
  const hs=history.current,old=hs.items[hs.index];if(!old||busyRef.current)return;if(quickDraft.current)cancelQuick();
  const entry={...old,shapes:JSON.parse(JSON.stringify(doc.current.shapes)),layers:old.layers.map(x=>{const layer=doc.current.layers.find(l=>l.id===x.id);return {...x,...(x.id===REFERENCE_MASK_LAYER?{maskVisible:layer?.maskVisible!==false}:{}),visible:layer?.visible??x.visible,opacity:layer?.opacity??x.opacity,kind:layer?.kind??x.kind,name:layer?.name??x.name};}),background:doc.current.background,activeId:doc.current.activeId,fillColor:doc.current.fillColor,fillEnabled:doc.current.fillEnabled,imageBackgroundColor:doc.current.imageBackgroundColor,generationSize:{...generationSize},frameRect:editorFillRect(display.current.width,display.current.height),changeKind:kind,changeTime:Date.now(),...overrides};
  if(merge&&hs.index===hs.items.length-1&&old.changeKind===kind&&hs.index>0&&entry.changeTime-old.changeTime<650)hs.items[hs.index]=entry;else{hs.items=hs.items.slice(0,hs.index+1).concat(entry);if(hs.items.length>20)hs.items.shift();hs.index=hs.items.length-1;}
  persistence.current.version++;setRev(v=>v+1);setDirty(true);
 }
 function recordVectorChange(next,kind='vector-property'){
  if(referenceShapesEqual(next,doc.current.shapes))return false;updateShapes(next);recordMetadataChange(kind+':'+(selected||'new'),{shapes:JSON.parse(JSON.stringify(next))});return true;
 }
 async function run(fn,{record=true,quiet=false,fastHistory=false,changedIds=null,keepQuickDraft=false}={}){if(busyRef.current||persistence.current.closing)return;if(!keepQuickDraft&&quickDraft.current)cancelQuick();busyRef.current=true;if(!quiet)setBusy(true);setError('');try{const result=await fn();if(record&&result!==false){await snapshot({fast:fastHistory,changedIds:typeof changedIds==='function'?changedIds():changedIds});if(alive.current)setDirty(true);}}catch(e){if(alive.current)setError(errText(e));}finally{busyRef.current=false;if(alive.current&&!quiet)setBusy(false);}}
 React.useEffect(()=>{alive.current=true;busyRef.current=true;ctl.current=new AbortController();clearReadError();const signal=ctl.current.signal;setLoaded(false);setBusy(true);setError('');
  (async()=>{let bitmap;try{if(value.editorDocument){
   const saved=await referenceEditorReadDocument(value,signal,persistence.current.cache),entry=saved.history.items[saved.history.index];
   const layers=await referenceEditorLayerCanvases(entry,signal);if(!alive.current)return;
   for(const item of saved.history.items)for(const layer of item.layers)if(layer.id===REFERENCE_MASK_LAYER){if(typeof layer.maskVisible!=='boolean')layer.maskVisible=true;layer.visible=false;layer.name='遮罩图层';}
   for(const layer of layers)if(layer.id===REFERENCE_MASK_LAYER){if(typeof layer.maskVisible!=='boolean')layer.maskVisible=true;layer.visible=false;layer.name='遮罩图层';}
   previousImageLayer.current=saved.tool?.previousImageLayer||'';
   if(entry.generationSize)setGenerationSize({...imageEditorSize(value,sizeSettings),grow:value.grow??0,feather:value.feather??8,...entry.generationSize});
   history.current=saved.history;Object.assign(doc.current,{layers,shapes:entry.shapes,background:entry.background||'#ffffff',fillEnabled:entry.fillEnabled,imageBackgroundColor:entry.imageBackgroundColor,activeId:entry.activeId});
   const c=display.current;c.width=entry.size.w;c.height=entry.size.h;dimensions(c.width,c.height);setResizeDraft({w:c.width,h:c.height});setShapes(entry.shapes);setBackground(doc.current.background);setImageFill(entry.fillEnabled);setImageBackgroundColor(entry.imageBackgroundColor);
   if(/^#[0-9a-fA-F]{6}$/.test(saved.tool?.color||'')){doc.current.fillColor=saved.tool.color;setColor(saved.tool.color);}
   if(saved.tool?.stroke)setStroke(ccClamp(saved.tool.stroke,1,512));
    if(saved.tool?.brushSettings&&typeof saved.tool.brushSettings==='object'){const restored={...brushSettings};for(const key of Object.keys(restored)){const item=saved.tool.brushSettings[key];if(!item||typeof item!=='object')continue;restored[key]={...restored[key],size:ccClamp(Number(item.size)||restored[key].size,1,512),shape:key==='heal'?(QUICK_EDIT_SHAPES.some(([shape])=>shape===item.shape)?item.shape:'circle'):typeof item.shape==='string'?item.shape:restored[key].shape,opacity:ccClamp(Number(item.opacity??restored[key].opacity),0,1)};}setBrushSettings(restored);}else if(saved.tool?.stroke){const legacy=ccClamp(saved.tool.stroke,1,512),opacity=ccClamp(Number(saved.tool.brushAlpha??1),0,1),restored={...brushSettings};for(const key of Object.keys(restored))restored[key]={...restored[key],size:legacy,...(['brush','eraser'].includes(key)?{opacity}: {})};setBrushSettings(restored);}
   await seedEditorMask();syncLayers();paintDisplay();fitView(c.width,c.height);persistence.current.initial=persistence.current.version;persistence.current.saved=persistence.current.version;persistence.current.assetVersion=persistence.current.version;clearReadError();setLoaded(true);return;
  }bitmap=await referenceLoad(value.asset,signal);if(!alive.current){bitmap.close();return;}const w=bitmap.width,ht=bitmap.height,c=display.current;c.width=w;c.height=ht;const base=newCanvas(w,ht);base.getContext('2d').drawImage(bitmap,0,0);doc.current.layers=[{id:'base',name:'底图',kind:'base',visible:true,opacity:1,canvas:base}];doc.current.activeId='base';doc.current.shapes=[];doc.current.background='#ffffff';doc.current.fillEnabled=false;doc.current.fillColor='#111111';doc.current.imageBackgroundColor='#ffffff';setImageBackgroundColor('#ffffff');dimensions(w,ht);setResizeDraft({w,h:ht});setShapes([]);setSelected('');setCrop(null);resetTransformDraft(w,ht);setBackground('#ffffff');await seedEditorMask();syncLayers();paintDisplay();fitView(w,ht);await snapshot({fast:w*ht<=2*1024*1024});persistence.current.initial=persistence.current.version;persistence.current.saved=persistence.current.version;persistence.current.assetVersion=persistence.current.version;if(alive.current){clearReadError();setLoaded(true);}}catch(e){if(alive.current&&!signal.aborted)reportReadError(e);}finally{if(bitmap)try{bitmap.close();}catch{}busyRef.current=false;if(alive.current)setBusy(false);}})();
  return()=>{alive.current=false;cancelQuick();clearReadError();ctl.current.abort();if(raf.current)cancelAnimationFrame(raf.current);raf.current=0;drag.current=null;history.current={items:[],index:-1};};
 },[loadEpoch]);
 React.useEffect(()=>{const el=viewport.current;if(!el)return;let last={w:el.clientWidth,h:el.clientHeight};const ro=new ResizeObserver(()=>{if(!loaded)return;const now={w:el.clientWidth,h:el.clientHeight};const dx=(now.w-last.w)/2,dy=(now.h-last.h)/2;last=now;if(dx||dy)setPan(p=>({x:p.x+dx,y:p.y+dy}));});ro.observe(el);return()=>ro.disconnect();},[loaded]);
 React.useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=e=>{const onCanvas=!!board.current?.contains(e.target);if(e.ctrlKey&&onCanvas&&!editMode&&!busyRef.current){let key='';if(['brush','eraser','mask','heal','blur','liquify'].includes(tool))key=tool;else if(tool==='remove'&&brushSettings.remove?.shape!=='lasso')key='remove';else if(tool==='recolor'&&!protectionPicker&&recolorShape!=='lasso')key=quickSelectionMode?'quickselect':'recolor';if(key){e.preventDefault();e.stopPropagation();const max=key==='heal'?256:512;setBrushSettings(old=>{const current=ccClamp(Number(old[key]?.size)||12,1,max),factor=Math.pow(1.1,-e.deltaY/100),next=ccClamp(Math.round(current*factor),1,max);return next===current?old:{...old,[key]:{...old[key],size:next}};});return;}}e.preventDefault();const r=el.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,prev=scaleRef.current,next=ccClamp(prev*(e.deltaY>0?.9:1.1),.05,8);scaleRef.current=next;setPan(p=>({x:mx-(mx-p.x)*next/prev,y:my-(my-p.y)*next/prev}));setScale(next);};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[editMode,tool,brushSettings,protectionPicker,recolorShape,quickSelectionMode]);
 React.useEffect(()=>{
  if(!loaded)return;
  const onKey=e=>{
   if(!alive.current||persistence.current.closing||busyRef.current||!loaded)return;
   const t=e.target,k=String(e.key||'').toLowerCase();
   if(k==='escape'){
    const consume=()=>{e.preventDefault();e.stopImmediatePropagation();};
    if(helpOpen){consume();setHelpOpen(false);return;}
    if(exitMenu){consume();setExitMenu(false);return;}
    if(protectionPicker){consume();setProtectionPicker(false);return;}
    if(quickDraft.current){consume();cancelQuick();return;}
    if(eyedrop){consume();setEyedrop(false);return;}
    if(editMenuOpen){consume();setEditMenuOpen(false);return;}
    if(editMode){consume();if(editMode==='crop')cancelCanvasCrop();else{setEditMode('');setCrop(null);resetTransformDraft();}return;}
   }
   if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)&&!(quickDraft.current?.kind==='recolor'&&(e.ctrlKey||e.metaKey)&&['z','y'].includes(k)))return;
   if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.stopPropagation();undo(e.shiftKey?1:-1);}
   else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();e.stopPropagation();undo(1);}
   else if((k==='delete'||k==='backspace')&&selected){const chosen=selectedShapeObject();if(chosen){e.preventDefault();removeLayer(chosen.layerId);setSelected('');}}
  };
  window.addEventListener('keydown',onKey,true);
  return()=>window.removeEventListener('keydown',onKey,true);
 },[loaded,selected,shapes,rev,eyedrop,editMode,editMenuOpen,protectionPicker,exitMenu,helpOpen]);
 async function undo(delta){if(undoQuickRecolor(delta))return;if(quickDraft.current){cancelQuick();return;}if(editMode==='crop'){undoCrop(delta);return;}const hs=history.current,next=hs.index+delta;if(next<0||next>=hs.items.length)return;
  await run(async()=>{const entry=hs.items[next],w=entry.size.w,ht=entry.size.h,rebuilt=[];for(const rec of entry.layers){const cv=newCanvas(w,ht);if(rec.canvasSnapshot)cv.getContext('2d').drawImage(rec.canvasSnapshot,0,0);else {const bmp=await referenceRead(rec.blob);try{cv.getContext('2d').drawImage(bmp,0,0);}finally{bmp.close();}}rebuilt.push({id:rec.id,name:rec.name,kind:rec.kind,visible:rec.visible,opacity:rec.opacity,...(rec.id===REFERENCE_MASK_LAYER?{maskVisible:rec.maskVisible!==false}:{}),canvas:cv});}if(!alive.current)return;const composite=newCanvas(w,ht),out=composite.getContext('2d');if(entry.fillEnabled){out.fillStyle=entry.imageBackgroundColor||'#ffffff';out.fillRect(0,0,w,ht);}referenceCompositeLayers(out,rebuilt,entry.shapes.map(shape=>({...shape,layerId:shape.layerId||entry.activeId})));const c=display.current;if(c.width!==w)c.width=w;if(c.height!==ht)c.height=ht;const ctx=c.getContext('2d');ctx.clearRect(0,0,w,ht);ctx.drawImage(composite,0,0);doc.current.layers=rebuilt;doc.current.shapes=JSON.parse(JSON.stringify(entry.shapes)).map(shape=>({...shape,layerId:shape.layerId||entry.activeId}));doc.current.background=entry.background;doc.current.fillEnabled=!!entry.fillEnabled;/* Current tool color is a palette preference, not an undoable image edit. */doc.current.imageBackgroundColor=entry.imageBackgroundColor||'#ffffff';setImageBackgroundColor(doc.current.imageBackgroundColor);doc.current.activeId=entry.activeId;setShapes(doc.current.shapes);if(entry.generationSize)setGenerationSize(entry.generationSize);setBackground(entry.background);setImageFill(doc.current.fillEnabled);/* Do not rewind the current color swatch while restoring canvas history. */setSelected('');setCrop(current=>editMode==='crop'?normalizeCrop(current||{x:0,y:0,w,h:ht}):null);dimensions(w,ht);syncLayers();paintDisplay();hs.index=next;persistence.current.version++;setRev(v=>v+1);setDirty(true);},{record:false,quiet:true});
 }
 function rasterizeShapes(layerId=null){const targets=layerId?[layerId]:[...new Set(doc.current.shapes.map(s=>s.layerId))];if(!targets.length)return false;let changed=false;for(const id of targets){const layer=doc.current.layers.find(l=>l.id===id);if(!layer)continue;const owned=referenceShapesForLayer(doc.current.shapes,id);if(!owned.length)continue;const ctx=layer.canvas.getContext('2d');for(const shape of owned)referenceDrawShape(ctx,shape);doc.current.shapes=doc.current.shapes.filter(s=>s.layerId!==id);if(layer.kind==='vector')layer.kind='paint';changed=true;}if(changed){setShapes([...doc.current.shapes]);if(selected&&!doc.current.shapes.some(s=>s.id===selected))setSelected('');syncLayers();}return changed;}
 function rasterizeLayer(id){const layer=doc.current.layers.find(l=>l.id===id);if(!layer||layer.kind!=='vector')return;run(()=>{if(!rasterizeShapes(id))return false;paintDisplay();},{quiet:true,fastHistory:true,changedIds:[id]});}
 function resample(l,w,ht,kind,area){
  const out=newCanvas(w,ht),ctx=out.getContext('2d');
  if(kind==='rotate'){ctx.translate(w/2,ht/2);ctx.rotate(Math.PI/2);ctx.drawImage(l.canvas,-l.canvas.width/2,-l.canvas.height/2);}
  else if(kind==='flipX'||kind==='flipY'){ctx.translate(kind==='flipX'?w:0,kind==='flipY'?ht:0);ctx.scale(kind==='flipX'?-1:1,kind==='flipY'?-1:1);ctx.drawImage(l.canvas,0,0);}
  else if(kind==='scale-locked'){
   const factor=referenceUniformScale(l.canvas.width,l.canvas.height,w,ht,area?.anchor);
   ctx.drawImage(l.canvas,0,0,l.canvas.width*factor,l.canvas.height*factor);
  }else if(area)ctx.drawImage(l.canvas,-area.x,-area.y);
  else ctx.drawImage(l.canvas,0,0,w,ht);
  l.canvas=out;
 }
 function transform(w,ht,kind='stretch',area=null){
  referenceCheckSize(w,ht);const oldW=display.current.width,oldH=display.current.height;
  if(((kind==='stretch'||kind==='scale-locked')&&w===oldW&&ht===oldH)||(kind==='crop'&&area?.x===0&&area?.y===0&&w===oldW&&ht===oldH)){setEditMode('');setCrop(null);return false;}
  const next=referenceAffineShapes(doc.current.shapes,kind,oldW,oldH,w,ht,area);
  for(const layer of doc.current.layers)resample(layer,w,ht,kind,area);
  updateShapes(next);dimensions(w,ht);const c=display.current;c.width=w;c.height=ht;
  paintDisplay();fitView(w,ht);cancelCanvasCrop();
 }
 const rawPoint=e=>{const r=board.current.getBoundingClientRect();return editorImageRect(e.clientX,e.clientY,r,size.w,size.h);};
 const point=e=>{const p=rawPoint(e);return {x:ccClamp(p.x,0,size.w-.001),y:ccClamp(p.y,0,size.h-.001)};};
 const rect=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.max(1,Math.abs(b.x-a.x)),h:Math.max(1,Math.abs(b.y-a.y))});
 const normalizeCrop=frame=>({x:Math.round(frame.x||0),y:Math.round(frame.y||0),w:Math.max(1,Math.round(frame.w||1)),h:Math.max(1,Math.round(frame.h||1))});
 function setCropDimension(key,value){
  const frame=referenceCanvasCropFrame(cropLive.current||crop,size.w,size.h,cropOverflowLive.current);
  const point={x:frame.x+(key==='w'?Math.max(1,value):frame.w),y:frame.y+(key==='h'?Math.max(1,value):frame.h)};
  recordCrop(referenceCanvasCropResize(frame,key==='w'?'e':'s',point,size,cropLocked,false,scaleRef.current,cropOverflowLive.current),'field:'+key);
 }
 function setResizeDimension(key,value){
  const next=referenceScaleLockedSide(size.w,size.h,key,value);
  if(referenceScaleSizeAllowed(next)){setResizeMatchedPreset(false);setResizeAnchor(key);setResizeDraft(next);}
 }
 function resizeTo1024(side){setResizeDimension(side,1024);}
 function resizeToDetected1k(match){
  if(match?.canApply&&match.pixelError<=5&&referenceScaleSizeAllowed(match)){
   // The explicit preset action is the ONLY path allowed to slightly stretch.
   setResizeMatchedPreset(true);
   setResizeAnchor(size.w>=size.h?'w':'h');
   setResizeDraft({w:match.w,h:match.h});
  }
 }
 function beginCropMode(){cancelQuick();setEditMenuOpen(false);setEyedrop(false);setEditMode('crop');setCropLocked(false);const frame=previewCrop({x:0,y:0,w:size.w,h:size.h},false);cropHistory.current={items:[{frame:{...frame},allowOverflow:false,key:'',time:Date.now()}],index:0};setCropRev(v=>v+1);}
 function beginResizeMode(){cancelQuick();setEditMenuOpen(false);setEditMode('resize');setResizeMatchedPreset(false);setResizeAnchor(size.w>=size.h?'w':'h');setResizeDraft({w:size.w,h:size.h});}
 function resetTransformDraft(w=size.w,h=size.h){const quad=referenceDefaultQuad(w,h);transformQuadRef.current=quad;setTransformQuad(quad);setTransformAngleBadge(null);}
 function switchTransformBaseMode(next){setTransformKeepRatio(false);setTransformBaseMode(current=>{if(current===next)return current;resetTransformDraft();return next;});}
 function beginTransformMode(){cancelQuick();setEditMenuOpen(false);setEditMode('transform');setTransformBaseMode('parallel');setTransformKeepRatio(false);resetTransformDraft();}
 function previewBrush(e){if(!viewport.current||!board.current||!brushCursor.current)return;const host=viewport.current,tip=brushCursor.current,loupe=eyedropLoupe.current,swatch=eyedropSwatch.current;if(e.pointerType==='touch'){tip.style.display='none';if(loupe)loupe.style.display='none';if(swatch)swatch.style.display='none';host.style.cursor='default';return;}const rectEl=board.current.getBoundingClientRect(),vp=host.getBoundingClientRect();const inside=e.clientX>=rectEl.left&&e.clientX<=rectEl.right&&e.clientY>=rectEl.top&&e.clientY<=rectEl.bottom;const rightSampling=drag.current?.tool==='eyedrop-right',sampling=eyedrop||rightSampling,type=sampling?'eyedrop':tool;brushPointer.current={clientX:e.clientX,clientY:e.clientY,pointerType:e.pointerType};if(editMode==='crop'){tip.style.display='none';if(loupe)loupe.style.display='none';if(swatch)swatch.style.display='none';const handle=e.target?.closest?.('.cc-reference-overlay-panel')?'':referenceCanvasCropHandle(referenceCanvasCropFrame(cropLive.current||crop,size.w,size.h,cropOverflowLive.current),rawPoint(e),scaleRef.current);host.style.cursor=cropCursor[handle]||'default';return;}if(e.target?.closest?.('.cc-reference-overlay-panel')){tip.style.display='none';if(loupe)loupe.style.display='none';if(swatch)swatch.style.display='none';host.style.cursor='default';return;}if(sampling&&inside&&!editMode&&loaded){tip.style.display='none';previewEyedrop(e,rectEl,vp);host.style.cursor='none';return;}if(loupe)loupe.style.display='none';if(swatch)swatch.style.display='none';if(!editMode&&type==='recolor'&&(protectionPicker||recolorShape==='lasso'||!inside)){tip.style.display='none';host.style.cursor=protectionPicker?'crosshair':'default';return;}if(editMode||!inside||!(['brush','eraser','mask','fill','eyedrop'].includes(type)||QUICK_TOOLS.includes(type))||!loaded){tip.style.display='none';host.style.cursor='default';return;}const key=type==='recolor'?(quickSelectionMode?'quickselect':'recolor'):type,config=brushSettings[key],shape=type==='recolor'?(quickSelectionMode?'circle':recolorShape):config?.shape||'circle';if(type==='remove'&&shape==='lasso'){tip.style.display='none';host.style.cursor='crosshair';return;}const diameter=QUICK_TOOLS.includes(type)||['brush','eraser','mask'].includes(type)?Math.max(3,Math.max(1,Number(config?.size)||1)*scaleRef.current):28;tip.style.left=(e.clientX-vp.left)+'px';tip.style.top=(e.clientY-vp.top)+'px';tip.style.width=diameter+'px';tip.style.height=diameter+'px';tip.dataset.tool=type==='mask'&&maskErase?'eraser':type;tip.dataset.shape=['circle','square','soft'].includes(shape)?shape:'circle';tip.style.display='flex';host.style.cursor='none';}
 function hideBrushPreview(){if(brushCursor.current)brushCursor.current.style.display='none';if(eyedropLoupe.current)eyedropLoupe.current.style.display='none';if(eyedropSwatch.current)eyedropSwatch.current.style.display='none';if(viewport.current)viewport.current.style.cursor='default';brushPointer.current=null;}
 React.useEffect(()=>{if(brushPointer.current)previewBrush(brushPointer.current);},[tool,brushSettings,scale,eyedrop,loaded,editMode]);
 function textLineHeight(t){const fs=Math.max(8,Math.min(512,Number(t.fontSize)||48));return fs*(Number(t.lineHeight)||1.25);}
function textMetricsOf(t,line){
 const fs=Math.max(8,Math.min(512,Number(t.fontSize)||48)),ls=Number(t.letterSpacing)||0;
 const chars=Math.max(1,Array.from(String(line||'')).length);
 return {w:chars*fs*0.6+Math.max(0,chars-1)*ls,h:fs};
}
function textBoxOf(t){
 const lines=String(t.content||'').split('\n'),lh=textLineHeight(t),fs=Math.max(8,Math.min(512,Number(t.fontSize)||48));
 let maxW=1;for(const line of lines){maxW=Math.max(maxW,textMetricsOf(t,line).w);}
 const x=Number(t.x)||0,y=Number(t.y)||0,align=t.align||'center';
 const left=align==='left'?x:align==='right'?x-maxW:x-maxW/2;
 return {x:left,y,w:maxW,h:Math.max(fs,lines.length*lh)};
}
function findTextLayerAt(p){
 const layers=doc.current.layers;
 for(let i=layers.length-1;i>=0;i--){const l=layers[i];if(l.kind!=='text'||l.visible===false)continue;const b=textBoxOf(l.text||{});const pad=Math.max(6,(Number(l.text?.fontSize)||48)*0.25);if(p.x>=b.x-pad&&p.x<=b.x+b.w+pad&&p.y>=b.y-pad&&p.y<=b.y+b.h+pad)return l;}
 return null;
}
function paintTextLayer(layer){
 const t=layer.text||{},w=layer.canvas.width,h=layer.canvas.height,ctx=layer.canvas.getContext('2d');
 ctx.clearRect(0,0,w,h);
 const fs=Math.max(8,Math.min(512,Number(t.fontSize)||48)),lh=textLineHeight(t);
 ctx.font=(t.bold?'bold ':'')+(t.italic?'italic ':'')+fs+'px '+String(t.fontFamily||'sans-serif');
 if('letterSpacing' in ctx)ctx.letterSpacing=(Number(t.letterSpacing)||0)+'px';
 ctx.fillStyle=t.color||'#ffffff';ctx.textAlign=t.align||'center';ctx.textBaseline='top';
 const lines=String(t.content||'').split('\n');
 const xStart=(t.align==='left')?Number(t.x)||0:(t.align==='right')?w-(Number(t.x)||0):Number(t.x)||w/2;
 let y=Number(t.y)||0;
 for(const line of lines){ctx.fillText(line,xStart,y);if(t.underline){const m=textMetricsOf(t,line);const lx=(t.align==='left')?xStart:(t.align==='right')?xStart-m.w:xStart-m.w/2;ctx.fillRect(lx,y+fs*0.92,m.w,Math.max(1,fs*0.07));}y+=lh;}
 if('letterSpacing' in ctx)ctx.letterSpacing='0px';
 return layer;
}
function textLayerPanel(){
 const layer=doc.current.layers.find(l=>l.id===activeId&&l.kind==='text')||doc.current.layers.find(l=>l.kind==='text');
 if(!layer)return h(React.Fragment,null,h('strong',null,'添加文本'),h('span',{className:'cc-flyout-hint'},'在画布上点一下创建文本图层；每个文本图层只编辑一组文本，可创建多个文本图层。'));
 const t=layer.text||{},patch=p=>{layer.text={...layer.text,...p};paintTextLayer(layer);paintDisplay();recordMetadataChange('text:'+layer.id);setRev(v=>v+1);};
 const alignBtn=(key,label)=>h('button',{type:'button',style:{...S.btn2,...(t.align===key?{borderColor:'var(--cc-accent)',color:'var(--cc-accent)'}:{})},disabled:busy||!loaded,onClick:()=>patch({align:key})},label);
 return h(React.Fragment,null,
  h('strong',null,layer.name),
  h('textarea',{value:t.content||'',disabled:busy||!loaded,onChange:e=>patch({content:e.target.value}),'aria-label':'文本图层内容',placeholder:'输入文本，可换行',style:{width:'100%',boxSizing:'border-box',minHeight:96,padding:'8px 10px',resize:'vertical',fontSize:12,lineHeight:1.5,color:'var(--cc-text)',background:'var(--cc-surface)',border:'1px solid var(--cc-border)',borderRadius:6}}),
  numRow('字号',Math.round(Number(t.fontSize)||48),v=>patch({fontSize:ccClamp(v,8,512)}),8,512),
  numRow('字间距',Math.round(Number(t.letterSpacing)||0),v=>patch({letterSpacing:ccClamp(v,-40,120)}),-40,120),
  numRow('行距 %',Math.round((Number(t.lineHeight)||1.25)*100),v=>patch({lineHeight:ccClamp(v,80,300)/100}),80,300),
  h('div',{className:'cc-editor-color-row'},h('input',{type:'color',value:t.color||'#ffffff',disabled:busy||!loaded,'aria-label':'文本颜色',onChange:e=>patch({color:e.target.value})})),
  h('label',{style:{...S.field,display:'flex',flexDirection:'column',gap:4}},h('span',null,'字体'),h('select',{value:t.fontFamily||'sans-serif',disabled:busy||!loaded,'aria-label':'文本字体',onChange:e=>patch({fontFamily:e.target.value}),style:{width:'100%',padding:'7px 8px',fontSize:12,color:'var(--cc-text)',background:'var(--cc-surface)',border:'1px solid var(--cc-border)',borderRadius:6}},['sans-serif','serif','monospace','Noto Sans SC','Noto Serif SC','KaiTi','SimSun','Microsoft YaHei','Arial','Georgia','Courier New'].map(f=>h('option',{key:f,value:f},f==='sans-serif'?'无衬线':f==='serif'?'衬线':f==='monospace'?'等宽':f)))),
  h('div',{className:'cc-flyout-actions'},alignBtn('left','左对齐'),alignBtn('center','居中'),alignBtn('right','右对齐')),
  h('div',{className:'cc-flyout-actions'},h('button',{type:'button',style:{...S.btn2,...(t.bold?{borderColor:'var(--cc-accent)',color:'var(--cc-accent)'}:{})},disabled:busy||!loaded,onClick:()=>patch({bold:!t.bold})},'加粗'),h('button',{type:'button',style:{...S.btn2,...(t.italic?{borderColor:'var(--cc-accent)',color:'var(--cc-accent)'}:{})},disabled:busy||!loaded,onClick:()=>patch({italic:!t.italic})},'斜体'),h('button',{type:'button',style:{...S.btn2,...(t.underline?{borderColor:'var(--cc-accent)',color:'var(--cc-accent)'}:{})},disabled:busy||!loaded,onClick:()=>patch({underline:!t.underline})},'下划线')),
  h('div',{className:'cc-flyout-actions'},h('button',{type:'button',style:S.btn2,disabled:busy||!loaded,onClick:()=>{removeLayer(layer.id);setSelected('');}},'删除文本图层')),
  h('span',{className:'cc-flyout-hint'},'文本只保存在该文本图层；导出时叠加到图片上。'));
}
function createTextLayer(p){
 const current=activeLayer(),index=Math.max(1,doc.current.layers.indexOf(current));
 const layerId=uid('text'),count=doc.current.layers.filter(l=>l.kind==='text').length+1;
 const layer={id:layerId,name:'文本图层 '+count,kind:'text',visible:true,opacity:1,canvas:newCanvas(size.w,size.h),text:{content:'文本',x:Math.round(Number(p?.x)||size.w/2),y:Math.round(Number(p?.y)||size.h/2),fontSize:Math.round(ccClamp(size.w/12,24,256)),color:'#ffffff',fontFamily:'sans-serif',align:'center',bold:false,italic:false,underline:false,letterSpacing:0,lineHeight:1.25}};
 paintTextLayer(layer);
 doc.current.layers.splice(index+1,0,layer);doc.current.activeId=layerId;
 syncLayers();paintDisplay();recordMetadataChange('text-create:'+layerId);
 return layer;
}
function createVectorLayer(kind,p){const current=activeLayer(),index=Math.max(1,doc.current.layers.indexOf(current));const layerId=uid('vector'),shapeId='v'+Date.now()+Math.random().toString(36).slice(2);const layer={id:layerId,name:shapeName(kind),kind:'vector',visible:true,opacity:1,canvas:newCanvas(size.w,size.h)};const shape={id:shapeId,layerId,kind,x:p.x,y:p.y,w:1,h:1,color,stroke:Math.max(1,Math.min(512,Number(stroke)||1)),filled};doc.current.layers.splice(index+1,0,layer);doc.current.activeId=layerId;doc.current.shapes=[...doc.current.shapes,shape];setShapes(doc.current.shapes);setSelected(shapeId);syncLayers();paintDisplay();return {layerId,shapeId};}
 function down(e){if(!loaded||busyRef.current||selectionTask.current)return;if(e.button===2){if(editMode||!board.current?.contains(e.target))return;e.preventDefault();drag.current={tool:'eyedrop-right',pointerId:e.pointerId};try{viewport.current.setPointerCapture(e.pointerId);}catch{}previewBrush(e);return;}if(e.button!==0&&e.button!==1)return;e.preventDefault();if(e.button===1){drag.current={pan:true,x:e.clientX,y:e.clientY,startX:pan.x,startY:pan.y};viewport.current.setPointerCapture(e.pointerId);return;}if(editMode==='resize')return;if(editMode==='transform'){
  if(e.target.closest('.cc-reference-overlay-panel'))return;
  const p=rawPoint(e),hit=referenceTransformHandleHit(transformQuadRef.current,p,scaleRef.current,transformBaseMode);
  if(!hit)return;
  const quad=referenceCloneQuad(transformQuadRef.current),center=referenceQuadCenter(quad);
  if(hit.type==='rotate'){
   const vp=viewport.current?.getBoundingClientRect();
   drag.current={pointerId:e.pointerId,tool:'transform-rotate',quad,startAngle:Math.atan2(p.y-center.y,p.x-center.x),center};
   if(vp)setTransformAngleBadge({x:e.clientX-vp.left+14,y:e.clientY-vp.top+14,angle:0});
  }else if(hit.type==='move'){
   drag.current={pointerId:e.pointerId,tool:'transform-move',quad,start:p};
  }else{
   const handles=referenceQuadHandlePositions(quad);
   drag.current={pointerId:e.pointerId,tool:'transform-handle',quad,start:p,handle:hit.handle,baseMode:transformBaseMode,keepRatio:transformKeepRatio,startDist:referencePointDistance(center,handles[hit.handle]||center),center};
  }
  viewport.current.setPointerCapture(e.pointerId);return;
 }if(eyedrop){sourcePixel(e);return;}if(editMode==='crop'){
  if(e.target.closest('.cc-reference-overlay-panel'))return;
  const frame=referenceCanvasCropFrame(cropLive.current||crop,size.w,size.h,cropOverflowLive.current),handle=referenceCanvasCropHandle(frame,rawPoint(e),scaleRef.current);
  if(!handle)return;
  drag.current={pointerId:e.pointerId,tool:'crop-resize',handle,frame};
  viewport.current.setPointerCapture(e.pointerId);return;
 }const raw=rawPoint(e);if(raw.x<0||raw.y<0||raw.x>size.w||raw.y>size.h)return;const p=point(e);if(tool==='mask'){
  const layer=editorMask(true);if(layer.maskVisible===false){setError('请先显示遮罩图层，再绘制遮罩');return;}const base=newCanvas(size.w,size.h);base.getContext('2d').drawImage(layer.canvas,0,0);
  const config=brushConfig('mask');drag.current={tool:'mask',pointerId:e.pointerId,last:p,config:{...config},erase:maskErase,base};viewport.current.setPointerCapture(e.pointerId);paintEditorMask([p],config,maskErase);return;
 }if(QUICK_TOOLS.includes(tool)){const l=quickLayer();if(!l)return;if(selectionTool){if(protectionPicker){const existing=quickDraft.current;if(existing?.kind==='recolor')pickProtectedColor(existing,p);return;}const draft=makeQuickDraft(l,'recolor');const d={tool,quickSelection:quickSelectionMode,pointerId:e.pointerId,start:p,last:p,points:[p],stroke:Math.max(1,Math.min(512,Number(brushSettings[quickSelectionMode?'quickselect':tool]?.size)||12)),shape:quickSelectionMode?'circle':recolorShape,layerId:l.id,draft,exclude:e.shiftKey||recolorErase};draft.preview=null;drag.current=d;paintQuickMask(draft,d);viewport.current.setPointerCapture(e.pointerId);return;}const qd=quickState(l,p,e.pointerId);drag.current=qd;viewport.current.setPointerCapture(e.pointerId);if(tool==='remove'||tool==='heal'){qd.draft=makeQuickDraft(l,tool);paintQuickMask(qd.draft,qd);}else if(tool==='blur')quickPreviewBlur(qd);return;}if(tool==='text'){const hit=findTextLayerAt(p);if(hit){doc.current.activeId=hit.id;syncLayers();drag.current={tool:'text-move',pointerId:e.pointerId,layerId:hit.id,start:p,ox:Number(hit.text?.x)||0,oy:Number(hit.text?.y)||0};setSelected('');viewport.current.setPointerCapture(e.pointerId);return;}createTextLayer(p);return;}
 if(tool==='fill'){const l=activePaintLayer();if(!l||!l.visible){setError('请先选择一个像素图层，再使用填充。');return;}run(async()=>{const didFill=referenceFlood(l.canvas,p.x,p.y,color,Number(tolerance),fillGap,fillGrow);if(didFill){paintDisplay();noteUsedColor(color);}return didFill;},{quiet:true,fastHistory:true,changedIds:[l.id]});return;}const config=brushSettings[tool],d={start:p,last:p,tool,color,stroke:config?Math.max(1,Math.min(512,Number(config.size)||12)):stroke,shape:config?.shape||'circle',opacity:config?.opacity??1,pointerId:e.pointerId,layerId:activeLayer()?.id};if(tool==='select'){const hit=[...doc.current.shapes].reverse().find(s=>doc.current.layers.find(l=>l.id===s.layerId)?.visible&&referenceShapeHitTest(s,p));setSelected(hit?.id||'');if(!hit)return;doc.current.activeId=hit.layerId;syncLayers();d.shape={...hit};}else if(['rect','ellipse','line','triangle'].includes(tool)){const created=createVectorLayer(tool,p);d.id=created.shapeId;d.layerId=created.layerId;}else if(tool==='brush'||tool==='eraser'){const l=activePaintLayer();if(!l){setError('请先选择一个像素图层，再使用画笔或橡皮擦。');return;}const ctx=l.canvas.getContext('2d');ctx.save();ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';ctx.globalAlpha=d.opacity;quickEditPaintStroke(ctx,[p],Math.max(1,d.stroke),tool==='eraser'?'#000':color,d.shape);ctx.restore();paintDisplay();}drag.current=d;viewport.current.setPointerCapture(e.pointerId);} 
 function move(e){const d=drag.current;if(!d)return;e.preventDefault();if(d.pan){setPan({x:d.startX+e.clientX-d.x,y:d.startY+e.clientY-d.y});return;}if(d.pointerId!==e.pointerId)return;if(d.tool==='eyedrop-right')return;if(d.tool==='transform-move'){const p=rawPoint(e);setTransformQuad(referenceSnapTransformQuad(referenceQuadTranslate(d.quad,p.x-d.start.x,p.y-d.start.y),size.w,size.h,{scale:scaleRef.current,type:'move',bypass:e.altKey}));return;}if(d.tool==='transform-rotate'){const p=rawPoint(e),delta=Math.round((Math.atan2(p.y-d.center.y,p.x-d.center.x)-d.startAngle)*180/Math.PI),vp=viewport.current?.getBoundingClientRect();setTransformQuad(referenceQuadRotate(d.quad,delta,d.center));if(vp)setTransformAngleBadge({x:e.clientX-vp.left+14,y:e.clientY-vp.top+14,angle:referenceWrapAngle(delta)});return;}if(d.tool==='transform-handle'){const p=rawPoint(e),delta={x:p.x-d.start.x,y:p.y-d.start.y};let next=d.quad;if(d.keepRatio){const dist=Math.max(2,referencePointDistance(d.center,p));next=referenceQuadScaleFromCenter(d.quad,dist/Math.max(2,d.startDist),d.center);}else if(d.baseMode==='free')next=referenceFreeHandleDrag(d.quad,d.handle,delta,p);else next=referenceParallelHandleDrag(d.quad,d.handle,delta,p);setTransformQuad(referenceSnapTransformQuad(next,size.w,size.h,{scale:scaleRef.current,type:'handle',handle:d.handle,baseMode:d.baseMode,keepRatio:d.keepRatio,bypass:e.altKey}));return;}if(d.tool==='crop-resize'){previewCrop(referenceCanvasCropResize(d.frame,d.handle,rawPoint(e),size,cropLocked||e.shiftKey,!e.altKey,scaleRef.current,cropOverflowLive.current));return;}const p=point(e);d.moved=true;if(d.tool==='text-move'){const l=doc.current.layers.find(x=>x.id===d.layerId);if(l){l.text={...(l.text||{}),x:Math.round(d.ox+p.x-d.start.x),y:Math.round(d.oy+p.y-d.start.y)};paintTextLayer(l);paintDisplay();}d.last=p;return;}if(d.tool==='mask'){paintEditorMask([d.last,p],d.config,d.erase);d.last=p;return;}if(QUICK_TOOLS.includes(d.tool)&&d.points){const l=doc.current.layers.find(x=>x.id===d.layerId);if(l){const prev=d.last;d.points.push(p);d.last=p;if(d.tool==='blur')quickPreviewBlur(d);else if(d.tool==='liquify')quickEditLiquify(l.canvas,prev,p,d.stroke/2,d.strength,d);else paintQuickMask(d.draft,d);paintDisplay();}return;}if(d.tool==='brush'||d.tool==='eraser'){const l=activePaintLayer();if(!l)return;const ctx=l.canvas.getContext('2d');ctx.save();ctx.globalCompositeOperation=d.tool==='eraser'?'destination-out':'source-over';ctx.globalAlpha=d.opacity;quickEditPaintStroke(ctx,[d.last,p],Math.max(1,d.stroke),d.tool==='eraser'?'#000':d.color,d.shape);ctx.restore();paintDisplay();}else if(d.tool==='select'&&d.shape)updateShapes(doc.current.shapes.map(s=>s.id===d.shape.id?{...s,x:Math.round(Math.max(0,Math.min(size.w-s.w,d.shape.x+p.x-d.start.x))),y:Math.round(Math.max(0,Math.min(size.h-s.h,d.shape.y+p.y-d.start.y)))}:s));else if(d.id)updateShapes(doc.current.shapes.map(s=>s.id===d.id?{...s,...rect(d.start,p),reverse:(p.x-d.start.x)*(p.y-d.start.y)<0}:s));d.last=p;}
 function up(e){const d=drag.current;if(!d)return;drag.current=null;try{viewport.current.releasePointerCapture(e.pointerId);}catch{}if(d.tool==='eyedrop-right'){if(e.type!=='pointercancel'&&e.type!=='lostpointercapture')sourcePixel(e,true);previewBrush(e);return;}if(d.tool&&String(d.tool).startsWith('transform-')){if(e.type==='pointercancel'){const quad=referenceCloneQuad(d.quad);transformQuadRef.current=quad;setTransformQuad(quad);}setTransformAngleBadge(null);return;}if(d.pan||d.tool==='fill')return;if(d.tool==='text-move'){if(d.moved)recordMetadataChange('text-move:'+d.layerId);return;}if(d.tool==='mask'){
  if(e.type==='pointercancel'||e.type==='lostpointercapture'){const x=editorMask(true).canvas.getContext('2d');x.clearRect(0,0,size.w,size.h);x.drawImage(d.base,0,0);paintDisplay();return;}
  run(()=>true,{quiet:true,fastHistory:true,changedIds:[REFERENCE_MASK_LAYER]});return;
 }if(QUICK_TOOLS.includes(d.tool)){
  if(e.type==='pointercancel'||e.type==='lostpointercapture'){
   if(d.tool==='heal')clearQuickDraft();else if(d.tool==='remove'||d.tool==='recolor'){paintQuickMask(d.draft);if(d.tool==='recolor')previewQuickColor();}
   else{const l=doc.current.layers.find(x=>x.id===d.layerId);if(l)quickCtx(l).putImageData(d.base,0,0);paintDisplay();}return;
  }
  if(d.tool==='heal'){
   d.draft.strokes.push({points:d.points,stroke:d.stroke,shape:d.shape});paintQuickMask(d.draft);repairSpotStroke(d.draft);return;
  }
  if(d.tool==='remove'){if(d.shape==='lasso'&&d.points.length<3){paintQuickMask(d.draft);setQuickRevision(v=>v+1);return;}d.draft.strokes.push({points:d.points,stroke:d.stroke,shape:d.shape});paintQuickMask(d.draft);setQuickRevision(v=>v+1);return;}
  if(d.quickSelection){selectQuickBrush(d.draft,d);return;}
  if(d.tool==='recolor'){
   const draft=d.draft;if(d.shape==='lasso'&&d.points.length<3){paintQuickMask(draft);previewQuickColor();return;}draft.strokes.push({points:d.points,stroke:d.stroke,shape:d.shape,exclude:d.exclude});paintQuickMask(draft);finishQuickSelection(draft);recordQuickRecolor();return;
  }
  run(()=>true,{quiet:true,fastHistory:true,changedIds:[d.layerId]});paintDisplay();return;
 }if(d.tool==='crop-resize'){if(e.type==='pointercancel')previewCrop(d.frame);else recordCrop(cropLive.current||d.frame);return;}if(d.tool==='select'&&!d.moved)return;if(d.id||d.tool==='select'){
  if(d.shape&&referenceShapesEqual(d.shape,doc.current.shapes.find(s=>s.id===d.shape.id)))return;
  if(d.id){run(()=>true,{quiet:true,fastHistory:true,changedIds:[d.layerId]});noteUsedColor(d.color);}
  else recordMetadataChange('vector-move:'+(d.shape?.id||''),{shapes:JSON.parse(JSON.stringify(doc.current.shapes))},false);
  return;
 }run(async()=>{},{quiet:true,fastHistory:true,changedIds:[d.layerId]});if(d.tool==='brush')noteUsedColor(d.color);}
 finishRef.current=()=>{const d=drag.current;if(d)up({pointerId:d.pointerId});};
 React.useEffect(()=>{const onBlur=()=>finishRef.current?.();window.addEventListener('blur',onBlur);return()=>window.removeEventListener('blur',onBlur);},[]);
 function addLayer(){const l=activeLayer()?.id===REFERENCE_MASK_LAYER?imageLayerFallback():activeLayer();if(!l)return;run(async()=>{const canvas=newCanvas(size.w,size.h);const used=new Set(doc.current.layers.map(x=>x.name));let number=1;while(used.has('图层 '+number))number++;const nl={id:uid('layer'),name:'图层 '+number,kind:'paint',visible:true,opacity:1,canvas};doc.current.layers.splice(doc.current.layers.indexOf(l)+1,0,nl);doc.current.activeId=nl.id;previousImageLayer.current=nl.id;const nextTool=tool==='mask'?previousImageTool.current:tool;setTool(nextTool);syncLayers(nextTool);paintDisplay();},{quiet:true,fastHistory:true,changedIds:()=>[doc.current.activeId]});}
 function removeLayer(id){if(doc.current.layers.length<=1||id==='base')return;run(async()=>{if(!doc.current.layers.some(l=>l.id===id))return false;doc.current.layers=doc.current.layers.filter(l=>l.id!==id);updateShapes(doc.current.shapes.filter(s=>s.layerId!==id));if(doc.current.activeId===id)doc.current.activeId=doc.current.layers[doc.current.layers.length-1].id;syncLayers();paintDisplay();},{quiet:true,fastHistory:true,changedIds:[]});}
 function moveLayer(id,dir){run(async()=>{if(id===REFERENCE_MASK_LAYER)return false;const i=doc.current.layers.findIndex(l=>l.id===id);let j=i+dir;if(doc.current.layers[j]?.id===REFERENCE_MASK_LAYER)j+=dir;if(i<0||j<0||j>=doc.current.layers.length||doc.current.layers[j]?.id==='base')return false;const [l]=doc.current.layers.splice(i,1);doc.current.layers.splice(j,0,l);syncLayers();paintDisplay();},{quiet:true,fastHistory:true,changedIds:[]});}
 function toggleVisible(id){if(busyRef.current)return;const l=doc.current.layers.find(x=>x.id===id);if(!l)return;if(id===REFERENCE_MASK_LAYER){l.maskVisible=l.maskVisible===false;syncLayers();paintDisplay();recordMetadataChange('mask-visibility',{},false);return;}l.visible=!l.visible;if(!l.visible&&selectedShapeObject()?.layerId===id)setSelected('');syncLayers();paintDisplay();recordMetadataChange('visibility:'+id,{layers:history.current.items[history.current.index]?.layers.map(rec=>rec.id===id?{...rec,visible:l.visible}:{...rec})},false);} 
 function layerOpacity(id,v){if(busyRef.current)return;const l=doc.current.layers.find(x=>x.id===id);if(!l)return;const next=ccClamp(Number(v)||0,0,1);if(l.opacity===next)return;l.opacity=next;syncLayers();paintDisplay();recordMetadataChange('opacity:'+id,{layers:history.current.items[history.current.index]?.layers.map(rec=>rec.id===id?{...rec,opacity:next}:{...rec})});}
 function transformLayer(id,kind){if(busyRef.current||!loaded)return;const layer=doc.current.layers.find(l=>l.id===id);if(!layer)return;run(()=>{const old=layer.canvas,w=old.width,ht=old.height,out=newCanvas(w,ht),ctx=out.getContext('2d');ctx.save();if(kind==='flipX'){ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(old,0,0);}else if(kind==='flipY'){ctx.translate(0,ht);ctx.scale(1,-1);ctx.drawImage(old,0,0);}else if(kind==='rotate'){const factor=Math.min(1,w/ht,ht/w);ctx.translate(w/2,ht/2);ctx.rotate(Math.PI/2);ctx.scale(factor,factor);ctx.drawImage(old,-w/2,-ht/2);}else throw Error('不支持的图层变换');ctx.restore();layer.canvas=out;updateShapes(doc.current.shapes.map(s=>s.layerId===id?referenceAffineShapes([s],kind,w,ht,w,ht)[0]:s));paintDisplay();},{quiet:true,fastHistory:true,changedIds:[id]});}
 function selectLayer(id){if(id===REFERENCE_MASK_LAYER){activateTool('mask');return;}if(doc.current.activeId===id&&tool!=='mask')return;cancelQuick();doc.current.activeId=id;previousImageLayer.current=id;const nextTool=tool==='mask'?previousImageTool.current:tool;setTool(nextTool);if(selected){const chosen=doc.current.shapes.find(s=>s.id===selected);if(chosen&&chosen.layerId!==id)setSelected('');}syncLayers(nextTool);}
 const button=(label,fn,disabled=false)=>h('button',{type:'button',style:S.btn2,disabled:busy||!loaded||disabled,onClick:fn},label);
 async function resetOriginal(){const bitmap=await referenceLoad(value.original||value.asset,ctl.current.signal);if(!alive.current){bitmap.close();return;}const w=bitmap.width,ht=bitmap.height,c=display.current;c.width=w;c.height=ht;const base=newCanvas(w,ht);base.getContext('2d').drawImage(bitmap,0,0);bitmap.close();doc.current.layers=[{id:'base',name:'底图',kind:'base',visible:true,opacity:1,canvas:base}];doc.current.activeId='base';doc.current.shapes=[];doc.current.fillEnabled=false;doc.current.imageBackgroundColor='#ffffff';setImageBackgroundColor('#ffffff');setImageFill(false);dimensions(w,ht);setResizeDraft({w,h:ht});setShapes([]);setSelected('');setCrop(null);setEditMode('');syncLayers();paintDisplay();fitView(w,ht);} 
 function flatten(){const out=referenceCanvas(size.w,size.h),ctx=out.getContext('2d');if(doc.current.fillEnabled){ctx.fillStyle=doc.current.imageBackgroundColor;ctx.fillRect(0,0,out.width,out.height);}referenceCompositeLayers(ctx,doc.current.layers,doc.current.shapes);return out;}

 function renderTransformPreviewCanvas(sourceCanvas=transformSource.current,quad=transformQuadRef.current){
  const canvas=transformPreview.current;if(!canvas||!sourceCanvas)return;const mesh=Math.max(8,Math.min(22,Math.round(Math.max(size.w,size.h)/220)));referenceWarpCanvas(sourceCanvas,size.w,size.h,quad,mesh,canvas);
 }
 React.useEffect(()=>{
  if(editMode!=='transform'||!loaded){transformSource.current=null;return;}transformSource.current=flatten();
 },[editMode,loaded,size.w,size.h,previewBackground,imageFill,imageBackgroundColor,rev]);
 React.useEffect(()=>{if(editMode!=='transform'||!loaded)return;const frame=requestAnimationFrame(()=>renderTransformPreviewCanvas());return()=>cancelAnimationFrame(frame);},[transformQuad,editMode,loaded,size.w,size.h,previewBackground,imageFill,imageBackgroundColor,rev]);
 function applyFreeTransform(){
  const quad=referenceCloneQuad(transformQuadRef.current);if(editMode!=='transform')return false;if(referenceTransformUnchanged(quad,size.w,size.h)){setEditMode('');resetTransformDraft();return false;}
  doc.current.layers=doc.current.layers.map(layer=>{
   const rendered=referenceRenderLayerCanvas(layer,doc.current.shapes,size.w,size.h);
   const warped=referenceWarpCanvas(rendered,size.w,size.h,quad,Math.max(8,Math.min(22,Math.round(Math.max(size.w,size.h)/220))));
   return {...layer,canvas:warped,kind:layer.kind==='base'?'base':'paint'};
  });
  doc.current.shapes=[];setShapes([]);setSelected('');syncLayers();paintDisplay();setEditMode('');resetTransformDraft();return true;
 }
 const numRow=(label,val,change,min,max,step=1)=>h('label',{className:'cc-flyout-row'},h('span',null,label),h(DraggableNumberInput,{value:val,onChange:v=>change(Number(v)||0),label:label,step:step,precision:numberInputPrecision(step),dragPerPixel:step/10,className:'cc-parameter-number',allowEmpty:true,min:min,max:max,disabled:busy||!loaded}));
 function selectedShapePanel(){const layer=doc.current.layers.find(l=>l.id===activeId);const chosen=selectedShapeObject();if(!chosen||!layer||layer.kind!=='vector'||chosen.layerId!==layer.id)return h('span',{className:'cc-flyout-hint'},'选择某个矢量图层后，可在这里调节其图形尺寸与样式。');return h(React.Fragment,null,numRow('形状宽',Math.round(chosen.w),v=>recordVectorChange(doc.current.shapes.map(s=>s.id===chosen.id?{...s,w:ccClamp(v,1,8192)}:s)) ,1,8192),numRow('形状高',Math.round(chosen.h),v=>recordVectorChange(doc.current.shapes.map(s=>s.id===chosen.id?{...s,h:ccClamp(v,1,8192)}:s)),1,8192),h('div',{className:'cc-flyout-actions'},h('button',{type:'button',style:S.btn2,disabled:busy||!loaded,onClick:()=>{if(recordVectorChange(doc.current.shapes.map(s=>s.id===chosen.id?{...s,color,stroke:ccClamp(Number(stroke)||1,1,512),filled}:s),'vector-style'))noteUsedColor(color);}},'应用形状样式'),h('button',{type:'button',style:S.btn2,disabled:busy||!loaded,onClick:()=>{removeLayer(chosen.layerId);setSelected('');}},'删除图形')));}
 const toolLabels={mask:'局部重绘遮罩',brush:'画笔',eraser:'橡皮擦',fill:'油漆桶',text:'添加文本',line:'直线',remove:'智能去除',heal:'污点修复',blur:'模糊笔刷',recolor:'选区换色',liquify:'液化工具'};
 const tools=[['brush','画笔','brush'],['eraser','橡皮擦','eraser'],['fill','油漆桶','fill'],['remove','智能去除','remove'],['blur','模糊笔刷','blur'],['recolor','选区换色','recolor'],['liquify','液化工具','liquify']];
 const TOOL_GROUPS=[['brush','eraser','fill','mask'],['remove','heal','blur','recolor','liquify']];
 const QUICK_TOOLS=['remove','heal','blur','recolor','liquify'];
 function shapeStyle(){return h(React.Fragment,null,color?h('label',{className:'cc-flyout-row'},h('span',null,'颜色'),h('input',{type:'color',value:color,'aria-label':'图形颜色',disabled:busy||!loaded,onChange:e=>pickColor(e.target.value)})):null,numRow('描边',stroke,v=>setStroke(ccClamp(v,1,512)),1,512),h('label',{className:'cc-flyout-row'},h('span',null,'实心填充'),h('button',{type:'button',style:S.btn2,role:'switch','aria-checked':filled,disabled:busy||!loaded,onClick:()=>setFilled(v=>!v)},filled?'开启':'关闭')));} 
function fillOptions(){
  const profiles=[
   {key:'precise',name:'精准',hint:'边界严格，适合细线',tolerance:14,gap:0,grow:0},
   {key:'normal',name:'标准',hint:'适合大多数图像',tolerance:32,gap:3,grow:1},
   {key:'strong',name:'强力',hint:'尽量填满细缝与边缘',tolerance:60,gap:8,grow:2}
  ];
  const current=profiles.find(p=>p.tolerance===tolerance&&p.gap===fillGap&&p.grow===fillGrow);
  const changeProfile=p=>{setTolerance(p.tolerance);setFillGap(p.gap);setFillGrow(p.grow);};
  const descriptions={
   '颜色范围':'控制哪些相近的颜色会被一起填充。过高可能涂出边界。',
   '自动补线':'封住线稿上很短的断口，防止颜色漏出去。0 为关闭。',
   '填满边缘':'稍微覆盖边缘的浅色像素，减少白边；太高可能盖住细线。0 为关闭。'
  };
  const number=(name,value,setter,max)=>h('label',{className:'cc-fill-detail-row',title:descriptions[name]},
   h('span',{className:'cc-fill-detail-label'},name,h('span',{className:'cc-fill-info','aria-hidden':true},'ⓘ')),
   h(DraggableNumberInput,{value,onChange:v=>setter(ccClamp(Math.round(Number(v)||0),0,max)),label:name,step:1,precision:0,dragPerPixel:.1,min:0,max,className:'cc-parameter-number',disabled:busy||!loaded})
  );
  return h('div',{className:'cc-fill-panel'},
   h('div',{className:'cc-fill-head'},h('strong',null,'油漆桶'),h('span',{className:'cc-fill-head-note'},'点击区域即可填色')),
   h('div',{className:'cc-fill-preset-title'},'填充效果',current?null:h('span',{className:'cc-fill-custom'},'自定义')),
   h('div',{className:'cc-fill-presets',role:'group','aria-label':'填充效果'},...profiles.map(p=>h('button',{
     key:p.key,type:'button',className:'cc-fill-preset',title:p.hint,'data-cc-tooltip':p.hint,
     'aria-pressed':current?.key===p.key,disabled:busy||!loaded,onClick:()=>changeProfile(p)
    },p.name))),
   h('div',{className:'cc-fill-guidance'},'填不满试「强力」；越界试「精准」。'),
   h('button',{type:'button',className:'cc-fill-advanced-toggle','aria-expanded':fillAdvanced,onClick:()=>setFillAdvanced(v=>!v)},
    h('span',{'aria-hidden':true},fillAdvanced?'⌄':'›'),' 精细调整',h('span',{className:'cc-fill-advanced-note'},fillAdvanced?'收起':'可选')),
   fillAdvanced?h('div',{className:'cc-fill-details'},
    number('颜色范围',tolerance,setTolerance,255),
    number('自动补线',fillGap,setFillGap,32),
    number('填满边缘',fillGrow,setFillGrow,12),
    h('span',{className:'cc-fill-units'},'数值越高，处理范围越大；按需微调。')
   ):null,
   h('div',{className:'cc-fill-foot'},'仅填充当前像素图层')
  );
 }
  function flyout(t){
  const shapeBlock=(toolKey,withLasso=false,allowedShapes=null)=>{const config=brushConfig(toolKey),shapes=allowedShapes?QUICK_EDIT_SHAPES.filter(([key])=>allowedShapes.includes(key)):QUICK_EDIT_SHAPES,options=withLasso?[['lasso','套索'],...shapes.filter(([key])=>toolKey!=='remove'||key!=='soft')]:shapes;return h(React.Fragment,null,h('div',{className:'cc-fill-preset-title'},'笔刷形状'),h('div',{className:'cc-fill-presets cc-shape-row',role:'group','aria-label':toolKey==='remove'?'智能去除范围形状':toolKey==='heal'?'污点修复范围形状':'笔刷形状'},...options.map(([shapeKey,label])=>h('button',{key:shapeKey,type:'button',className:'cc-fill-preset','aria-pressed':config.shape===shapeKey,'aria-label':label,'data-cc-tooltip':label,disabled:busy||!loaded,onClick:()=>setBrushConfig(toolKey,{shape:shapeKey})},h(QuickEditShapeGlyph,{kind:shapeKey})))));};
  if(t==='mask')return h(React.Fragment,null,h('strong',null,'局部重绘遮罩'),
   h('div',{className:'cc-fill-presets cc-editor-icon-options',role:'group','aria-label':'遮罩工具'},...[[false,'遮罩笔刷','brush'],[true,'遮罩橡皮擦','eraser']].map(([erase,label,icon])=>h('button',{key:label,type:'button',className:'cc-fill-preset','aria-label':label,'data-cc-tooltip':label,'aria-pressed':maskErase===erase,disabled:busy,onClick:()=>setMaskErase(erase)},h(ReferenceToolIcon,{name:icon})))),
   numRow('笔刷大小',brushConfig('mask').size,v=>setBrushConfig('mask',{size:ccClamp(v,1,512)}),1,512),shapeBlock('mask',false,['circle']),h('span',{className:'cc-flyout-hint'},'主题色区域用于局部重绘，不进入导出的图片。'));
  if(t==='heal')return h(React.Fragment,null,h('strong',null,toolLabels[t]),
   numRow('笔刷大小',brushConfig('heal').size,v=>setBrushConfig('heal',{size:ccClamp(v,1,256)}),1,256),
   shapeBlock('heal'),
   h('span',{className:'cc-flyout-hint'},'涂抹小污点或细线，自动取用附近纹理并融合光照。松开鼠标即修复当前图层，一笔一次撤回。'));
  if(t==='remove')return h(React.Fragment,null,numRow('笔刷大小',brushConfig('remove').size,v=>setBrushConfig('remove',{size:ccClamp(v,1,512)}),1,512),h('span',{className:'cc-flyout-hint'},'涂抹或套索圈选，蚂蚁线内为待去除范围；应用修改后可撤回。'),shapeBlock('remove',true));
  if(t==='blur')return h(React.Fragment,null,h('strong',null,'模糊笔刷'),numRow('笔刷大小',brushConfig('blur').size,v=>setBrushConfig('blur',{size:ccClamp(v,1,512)}),1,512),numRow('模糊程度 (px)',blurRadius,v=>setBlurRadius(ccClamp(v,1,40)),1,40),shapeBlock('blur'));
  if(t==='liquify')return h(React.Fragment,null,h('strong',null,'液化工具'),numRow('笔刷大小',brushConfig('liquify').size,v=>setBrushConfig('liquify',{size:ccClamp(v,1,512)}),1,512),numRow('强度',liquifyStrength,v=>setLiquifyStrength(ccClamp(v,.01,1)),.01,1,.01));
  if(t==='recolor')return h('div',{className:'cc-recolor-tool-options'},
   h('div',{className:'cc-recolor-tool-row'},h('span',{className:'cc-flyout-hint'},'选区操作'),
    h('div',{className:'cc-fill-presets cc-recolor-selection-modes',role:'group','aria-label':'选区操作'},
     ...[[false,'添加选区','brush'],[true,'选区橡皮擦','eraser']].map(([erase,label,icon])=>h('button',{key:label,type:'button',className:'cc-fill-preset','aria-label':label,'aria-pressed':recolorErase===erase,'data-cc-tooltip':label,disabled:busy||selecting,onClick:()=>{setRecolorErase(erase);setProtectionPicker(false);}},h(ReferenceToolIcon,{name:icon}))))),
   t==='recolor'?h('div',{className:'cc-recolor-tool-row'},h('span',{className:'cc-flyout-hint'},'选区方式'),
    h('div',{className:'cc-fill-presets cc-recolor-shapes',role:'group','aria-label':'选区方式'},
     ...[['lasso','套索'],['quick','快速选择'],...QUICK_EDIT_SHAPES.filter(([key])=>key!=='soft')].map(([key,label])=>h('button',{key,type:'button',className:'cc-fill-preset','aria-label':label,'aria-pressed':recolorShape===key,'data-cc-tooltip':label,disabled:busy||selecting,onClick:()=>{setRecolorShape(key);setProtectionPicker(false);}},key==='quick'?h(ReferenceToolIcon,{name:'quickselect'}):h(QuickEditShapeGlyph,{kind:key}))))):null,
   recolorShape==='quick'?numRow('画笔大小',brushConfig('quickselect').size,v=>setBrushConfig('quickselect',{size:ccClamp(v,1,512)}),1,512):recolorShape!=='lasso'?numRow('画笔大小',brushConfig('recolor').size,v=>setBrushConfig('recolor',{size:ccClamp(v,1,512)}),1,512):null,
   h('div',{className:'cc-selection-expansion',onPointerUp:commitSelectionExpansion,onClick:commitSelectionExpansion,onKeyUp:commitSelectionExpansion,onBlur:commitSelectionExpansion},
    h('div',{className:'cc-flyout-row'},h('span',{'data-cc-tooltip':'按原图像素向外扩张选区，覆盖线稿边缘；0 恢复原选区'},'扩张（px）'),
     h('div',{className:'cc-strength-control'},h(DraggableNumberInput,{value:selectionExpansion,onChange:updateSelectionExpansion,label:'扩张（像素）',step:1,precision:0,dragPerPixel:.1,min:0,max:64,className:'cc-parameter-number',disabled:busy||selecting||!loaded}),h(ResetButton,{label:'重置扩张为 0',tooltip:'重置为 0',disabled:busy||selecting||!loaded||!selectionExpansion,onClick:()=>{updateSelectionExpansion(0);commitSelectionExpansion();}})))),
   h('span',{className:'cc-flyout-hint'},recolorShape==='quick'?'在物体内部涂抹，松手后贴合边界；Shift 扣除。扩张可覆盖线稿边缘，调回 0 恢复原边界。':'涂抹或套索圈选，Shift 临时扣除。扩张按原图像素计算。'));

  if(t==='text')return textLayerPanel();
 if(t==='brush'||t==='eraser'){const config=brushConfig(t);return h(React.Fragment,null,h('strong',null,toolLabels[t]),numRow('笔刷大小',config.size,v=>setBrushConfig(t,{size:ccClamp(v,1,512)}),1,512),numRow('透明度 (%)',Math.round(config.opacity*100),v=>setBrushConfig(t,{opacity:ccClamp(v,0,100)/100}),0,100),h('span',{className:'cc-flyout-hint'},'仅作用于当前选中的像素图层。'),shapeBlock(t));}if(t==='fill')return fillOptions();if(['rect','ellipse','line','triangle'].includes(t))return h(React.Fragment,null,h('strong',null,toolLabels[t]),shapeStyle(),selectedShapePanel());if(t==='select')return h(React.Fragment,null,h('strong',null,'选择形状'),h('span',{className:'cc-flyout-hint'},'点击画布上的矢量图形即可选中对应矢量图层并拖动图形。'),selectedShapePanel());return null;}
 const layerIcon=visible=>h('svg',{width:21,height:21,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.85,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M2.1 12S5.7 5.5 12 5.5s9.9 6.5 9.9 6.5-3.6 6.5-9.9 6.5S2.1 12 2.1 12Z'}),h('circle',{cx:12,cy:12,r:3}),!visible?h('path',{d:'M3 3l18 18'}):null);
 function duplicateLayer(id){const l=doc.current.layers.find(x=>x.id===id);if(!l||id===REFERENCE_MASK_LAYER)return;run(async()=>{const canvas=newCanvas(size.w,size.h);const ctx=canvas.getContext('2d');ctx.drawImage(l.canvas,0,0);for(const shape of referenceShapesForLayer(doc.current.shapes,l.id))referenceDrawShape(ctx,shape);const used=new Set(doc.current.layers.map(x=>x.name));let name=l.name+' 副本',n=2;while(used.has(name))name=l.name+' 副本 '+(n++);const copy={id:uid('layer'),name,kind:'paint',visible:true,opacity:l.opacity,canvas};doc.current.layers.splice(doc.current.layers.indexOf(l)+1,0,copy);doc.current.activeId=copy.id;previousImageLayer.current=copy.id;const nextTool=tool==='mask'?previousImageTool.current:tool;setTool(nextTool);syncLayers(nextTool);paintDisplay();},{quiet:true,fastHistory:true,changedIds:()=>[doc.current.activeId]});}
 function layerPanel(){
 const current=layerList.find(l=>l.id===activeId),imageLayers=layerList.filter(l=>l.id!==REFERENCE_MASK_LAYER);
 const toolbar=[
  ['添加图层','plus',addLayer,false],
  ['上移该图层','arrowUp',()=>moveLayer(activeId,1),!current||current.id===REFERENCE_MASK_LAYER||current.kind==='base'||imageLayers.indexOf(current)===imageLayers.length-1],
  ['下移该图层','arrowDown',()=>moveLayer(activeId,-1),!current||current.id===REFERENCE_MASK_LAYER||current.kind==='base'||imageLayers.indexOf(current)<=1]
 ];
 const canvasFlips=[['水平翻转画布','flipX'],['上下翻转画布','flipY']];
 return h(React.Fragment,null,
  h('div',{className:'cc-layer-list'},
   [...layerList].reverse().map(l=>h(l.id===REFERENCE_MASK_LAYER?'div':EditorLayerProperties,l.id===REFERENCE_MASK_LAYER?{key:l.id}:{key:l.id,layer:l,disabled:busy||!loaded,onOpacity:layerOpacity,onTransform:transformLayer,onRasterize:rasterizeLayer,onDuplicate:duplicateLayer},
    h('div',{className:'cc-layer-item'+(l.id===activeId?' active':''),'data-kind':l.id===REFERENCE_MASK_LAYER?'mask':l.kind,'data-layer-id':l.id,'aria-label':l.name+' 图层',onClick:()=>selectLayer(l.id)},
     h('button',{type:'button',style:S.btn2,title:l.visible?'隐藏图层':'显示图层','data-cc-tooltip':l.visible?'隐藏图层':'显示图层','aria-label':(l.visible?'隐藏图层 ':'显示图层 ')+l.name,onClick:e=>{e.stopPropagation();toggleVisible(l.id);}},layerIcon(l.visible)),
     h('span',{className:'cc-layer-name',title:l.name},l.name),
     l.kind==='vector'?h('span',{className:'cc-layer-badge'},'矢量'):null,
     h('button',{type:'button',style:S.btn2,className:'cc-layer-delete',title:l.kind==='base'?'底图不可删除':'删除 '+l.name,'aria-label':'删除 '+l.name,'data-cc-tooltip':l.kind==='base'?'底图不可删除':'删除图层',disabled:busy||!loaded||l.kind==='base',onClick:e=>{e.stopPropagation();removeLayer(l.id);}},h(PromptIcon,{name:'trash',size:16}))
    )
   ))
  ),
  h('div',{className:'cc-layer-actions',role:'toolbar','aria-label':'图层与画布操作'},
   ...toolbar.map(([label,icon,action,inactive])=>h('button',{key:label,type:'button',style:S.btn2,title:label,'aria-label':label,'data-cc-tooltip':label,disabled:busy||!loaded||inactive,onClick:action},icon==='arrowDown'?h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M12 4v16m-6-6 6 6 6-6'})):h(PromptIcon,{name:icon,size:15}))),
   ...canvasFlips.map(([label,kind])=>h('button',{key:kind,type:'button',style:S.btn2,title:label,'aria-label':label,'data-cc-tooltip':label,disabled:busy||!loaded,onClick:()=>run(()=>transform(size.w,size.h,kind),{quiet:true,fastHistory:true})},h(EditorTransformGlyph,{kind})))
  )
 );
}
const railTool=(t,body,pinned=false)=>h('div',{className:'cc-reference-tool',key:t},h('button',{type:'button',style:S.btn2,'data-cc-tooltip':toolLabels[t],'aria-label':toolLabels[t],'aria-pressed':tool===t,disabled:busy||!loaded,onClick:()=>{if(editMode==='crop')cancelCanvasCrop();activateTool(t);}},h(ReferenceToolIcon,{name:t})),body?h('div',{className:'cc-reference-flyout'+(pinned?' is-open':'')},h('div',{className:'cc-reference-flyout-body'},body)):null);
 const modalTitleActions=h('div',{className:'cc-editor-title-actions'},h('button',{type:'button',className:'cc-editor-menu-trigger','aria-haspopup':'menu','aria-expanded':editMenuOpen,onClick:()=>setEditMenuOpen(v=>!v)},'编辑 ',h('svg',{viewBox:'0 0 24 24',width:14,height:14,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'m6 9 6 6 6-6'}))),editMenuOpen?h('div',{className:'cc-editor-menu',role:'menu'},h('button',{type:'button',style:S.btn2,disabled:busy||!loaded,onClick:()=>{setEditMenuOpen(false);run(resetOriginal);}},'还原原图'),h('button',{type:'button',style:S.btn2,onClick:beginResizeMode},'缩放图片尺寸'),h('button',{type:'button',style:S.btn2,onClick:beginCropMode},'裁剪画布'),h('button',{type:'button',style:S.btn2,onClick:()=>{setEditMenuOpen(false);run(()=>transform(size.h,size.w,'rotate'),{quiet:true,fastHistory:true});}},'画布旋转 90°'),h('button',{type:'button',style:S.btn2,onClick:beginTransformMode},'自由变形')):null);
 const cropFrame=editMode==='crop'?referenceCanvasCropFrame(crop,size.w,size.h,cropAllowOverflow):null;
 const cropChanged=!!cropFrame&&(cropFrame.x!==0||cropFrame.y!==0||cropFrame.w!==size.w||cropFrame.h!==size.h);
 const cropSizeError=cropFrame&&cropFrame.w*cropFrame.h>REFERENCE_LIMITS.pixels?'画布总像素不能超过 16MP':'';
 const cropUndo=quickDraft.current?.kind==='recolor'?(selecting||quickDraft.current.history.index>0):editMode==='crop'?cropHistory.current.index>0:history.current.index>0;
 const cropRedo=quickDraft.current?.kind==='recolor'?quickDraft.current.history.index<quickDraft.current.history.items.length-1:editMode==='crop'?cropHistory.current.index<cropHistory.current.items.length-1:history.current.index<history.current.items.length-1;
 const cropPanel=editMode==='crop'?h('div',{className:'cc-reference-overlay-panel cc-canvas-crop-panel left',onPointerDown:e=>e.stopPropagation(),onPointerMove:e=>e.stopPropagation(),onPointerUp:e=>e.stopPropagation()},
  h('div',{className:'cc-canvas-crop-title'},h('strong',null,'裁剪画布'),h(ResetButton,{label:'重置裁剪范围',tooltip:'恢复整张画布，可撤回',disabled:busy||!loaded||!cropChanged,onClick:resetCanvasCrop})),
  numRow('宽',cropFrame.w,v=>setCropDimension('w',v),1,cropAllowOverflow?REFERENCE_LIMITS.edge:size.w-cropFrame.x),numRow('高',cropFrame.h,v=>setCropDimension('h',v),1,cropAllowOverflow?REFERENCE_LIMITS.edge:size.h-cropFrame.y),
  h('button',{type:'button',className:'cc-reference-lock-button','aria-pressed':cropLocked,onClick:()=>setCropLocked(v=>!v),'data-cc-tooltip':'锁定裁剪比例'},h(EditorAspectLockGlyph,{locked:cropLocked}),cropLocked?'锁定比例':'自由比例'),
  h('label',{className:'cc-canvas-crop-overflow','data-cc-tooltip':'允许扩展到画布外；新增区域使用透明或已选图片底色'},h('input',{type:'checkbox',checked:cropAllowOverflow,disabled:busy||!loaded,onChange:toggleCropOverflow}),'允许超出'),
  h('span',{className:'cc-flyout-hint'},'拖动边缘或角点调整画布。Alt 暂停吸附，Shift 临时锁定比例。'),
  cropSizeError?h('span',{role:'note',style:S.bad},cropSizeError):null,
  h('div',{className:'cc-reference-panel-actions'},h('button',{type:'button',style:S.btn2,disabled:busy||!loaded||!cropChanged||!!cropSizeError,onClick:()=>run(()=>transform(cropFrame.w,cropFrame.h,'crop',cropFrame),{quiet:true,fastHistory:true})},'应用修改'),h('button',{type:'button',style:S.btn2,onClick:cancelCanvasCrop},'取消'))):null;
 const imagePresetMatch=referenceMatch1kPreset(size.w,size.h,typeof IMAGE_SIZE_PRESETS!=='undefined'?IMAGE_SIZE_PRESETS:[]);
 const resizeIsChanged=resizeDraft.w!==size.w||resizeDraft.h!==size.h;
 const resizePanel=editMode==='resize'?h('div',{className:'cc-reference-overlay-panel left cc-editor-resize-panel',onPointerDown:e=>e.stopPropagation(),onPointerMove:e=>e.stopPropagation(),onPointerUp:e=>e.stopPropagation()},
  h('div',{className:'cc-reference-overlay-panel-title'},'缩放图片尺寸'),
  h('span',{className:'cc-editor-resize-caption'},'原图 '+size.w+' × '+size.h+' · 手动缩放始终等比例'),
  numRow('宽度',resizeDraft.w,v=>setResizeDimension('w',v),1,8192),
  numRow('高度',resizeDraft.h,v=>setResizeDimension('h',v),1,8192),
  h('div',{className:'cc-editor-resize-group'},
   h('span',{className:'cc-editor-resize-label'},'快捷设为 1024'),
   h('div',{className:'cc-editor-resize-quick'},
    h('button',{type:'button',style:S.btn2,disabled:busy||!loaded||!referenceScaleSizeAllowed(referenceScaleLockedSide(size.w,size.h,'w',1024)),onClick:()=>resizeTo1024('w'),'aria-label':'宽度设为 1024 像素，等比例调整高度'},'宽度 1024'),
    h('button',{type:'button',style:S.btn2,disabled:busy||!loaded||!referenceScaleSizeAllowed(referenceScaleLockedSide(size.w,size.h,'h',1024)),onClick:()=>resizeTo1024('h'),'aria-label':'高度设为 1024 像素，等比例调整宽度'},'高度 1024'))),
  h('div',{className:'cc-editor-resize-group'},
   h('span',{className:'cc-editor-resize-label'},'匹配 1K 比例预设'),
   imagePresetMatch?h(React.Fragment,null,
    h('button',{type:'button',style:S.btn2,className:'cc-editor-resize-match',disabled:busy||!loaded||!imagePresetMatch.canApply,onClick:()=>resizeToDetected1k(imagePresetMatch),
     title:imagePresetMatch.canApply?'误差不超过 5px：确认后允许轻微拉伸到预设精确尺寸':'图片已达到预设尺寸，或大于该预设的 1K 档位'},
     imagePresetMatch.canApply?'匹配 '+imagePresetMatch.label+' → '+imagePresetMatch.w+' × '+imagePresetMatch.h:'已达到 '+imagePresetMatch.label+' 的 1K 档位'),
    h('span',{className:'cc-editor-resize-hint'},'按 1K 尺寸计算：误差 ≤5px 才允许匹配，并轻微拉伸到预设精确尺寸。')):
    h('span',{className:'cc-editor-resize-hint'},'与预设尺寸差异超过 5px，不提供自动匹配；仍可使用上方快捷缩放')),
  h('div',{className:'cc-reference-panel-actions'},
   h('button',{type:'button',style:S.btn2,disabled:busy||!loaded||!resizeIsChanged||!referenceScaleSizeAllowed(resizeDraft),onClick:()=>run(()=>transform(resizeDraft.w,resizeDraft.h,resizeMatchedPreset?'stretch':'scale-locked',resizeMatchedPreset?null:{anchor:resizeAnchor}),{quiet:true,fastHistory:true})},'应用修改'),
   h('button',{type:'button',style:S.btn2,onClick:()=>setEditMode('')},'取消'))
 ):null;
 const transformPanel=editMode==='transform'?h('div',{className:'cc-reference-overlay-panel left cc-editor-transform-panel',style:{boxSizing:'border-box',width:290,minWidth:0,maxWidth:'calc(100% - 24px)',maxHeight:'calc(100% - 24px)',overflowY:'auto'}},
  h('div',{className:'cc-reference-overlay-panel-title'},'自由变形'),
  h('div',{className:'cc-fill-preset-title'},'变形模式'),
  h('div',{className:'cc-fill-presets',role:'group','aria-label':'自由变形模式'},
   h('button',{type:'button',className:'cc-fill-preset','aria-pressed':transformKeepRatio,disabled:busy||!loaded,onClick:()=>setTransformKeepRatio(true),title:'拖动控制点时保持当前整体比例'},'等比例'),
   h('button',{type:'button',className:'cc-fill-preset','aria-pressed':!transformKeepRatio&&transformBaseMode==='parallel',disabled:busy||!loaded,onClick:()=>switchTransformBaseMode('parallel'),title:'拖动边或角时保持平行四边形；切换自自由模式时会重置'},'平行'),
   h('button',{type:'button',className:'cc-fill-preset','aria-pressed':!transformKeepRatio&&transformBaseMode==='free',disabled:busy||!loaded,onClick:()=>switchTransformBaseMode('free'),title:'允许四角与四边自由拖动；切换自平行模式时会重置'},'自由')),
  h('span',{className:'cc-flyout-hint'},'拖动变形框内部可整体移动；底部旋转拉杆可旋转，角度自动吸附到最近整数。边角接近画布虚框时轻微吸附，Alt 暂停吸附。超出画布虚框的部分应用后会被裁剪。'),
  h('div',{className:'cc-reference-panel-actions'},
   h('button',{type:'button',style:S.btn2,disabled:busy||!loaded,onClick:()=>run(()=>applyFreeTransform(),{quiet:true,fastHistory:true,changedIds:doc.current.layers.map(l=>l.id)})},'应用修改'),
   h('button',{type:'button',className:'cc-reset-button','aria-label':'重置自由变形','data-cc-tooltip':'重置自由变形',disabled:busy||!loaded,onClick:()=>resetTransformDraft()},h(PromptIcon,{name:'reset',size:15})),
   h('button',{type:'button',style:S.btn2,onClick:()=>{resetTransformDraft();setEditMode('');}},'取消'))
 ):null;
 const transformHandles=referenceQuadHandlePositions(transformQuad);
 const transformRotateHandle=referenceRotateHandle(transformQuad,34/Math.max(.2,scale));
 const transformOverlay=editMode==='transform'?h('svg',{viewBox:`0 0 ${size.w} ${size.h}`,width:size.w,height:size.h,className:'cc-editor-transform-overlay','aria-hidden':true,style:{position:'absolute',left:0,top:0,overflow:'visible',pointerEvents:'none',zIndex:2}},
  h('line',{x1:transformRotateHandle.base.x,y1:transformRotateHandle.base.y,x2:transformRotateHandle.point.x,y2:transformRotateHandle.point.y,stroke:'var(--cc-accent)',strokeWidth:1.5/scale}),
  h('polygon',{points:transformQuad.map(p=>`${p.x},${p.y}`).join(' '),fill:'rgba(70,130,255,.08)',stroke:'var(--cc-accent)',strokeWidth:1.5/scale,strokeDasharray:6/scale}),
  ...Object.entries(transformHandles).map(([key,pos])=>h('rect',{key,x:pos.x-5/scale,y:pos.y-5/scale,width:10/scale,height:10/scale,rx:2/scale,ry:2/scale,fill:'#fff',stroke:'var(--cc-accent)',strokeWidth:1.2/scale})),
  h('circle',{cx:transformRotateHandle.point.x,cy:transformRotateHandle.point.y,r:5.5/scale,fill:'#fff',stroke:'var(--cc-accent)',strokeWidth:1.2/scale})
 ):null;
 const maskNumRow=(label,value,change,min,max)=>h('label',{className:'cc-flyout-row'},h('span',{style:{flex:'0 0 88px',width:88,minWidth:88}},label),h(DraggableNumberInput,{value,onChange:v=>change(Number(v)||0),label,step:1,precision:0,dragPerPixel:.1,className:'cc-parameter-number',allowEmpty:true,min,max,disabled:busy||!loaded}));
 const maskPanel=!editMode&&tool==='mask'?h('div',{className:'cc-reference-overlay-panel cc-mask-tool-panel cc-selection-recolor-panel',role:'group','aria-label':'局部重绘遮罩设置',onPointerDown:e=>e.stopPropagation()},flyout('mask'),h('div',{className:'cc-selection-section-divider'}),h('div',{className:'cc-mask-setting-row'},maskNumRow('遮罩扩展 (px)',generationSize.grow,v=>updateMaskSetting('grow',v),0,64)),h('div',{className:'cc-mask-setting-row'},maskNumRow('边缘过渡 (px)',generationSize.feather,v=>updateMaskSetting('feather',v),0,31),h('button',{type:'button',className:'cc-mask-feather-toggle',style:S.btn2,'aria-pressed':showMaskFeather,'aria-label':showMaskFeather?'隐藏边缘过渡预览':'显示边缘过渡预览','data-cc-tooltip':showMaskFeather?'隐藏边缘过渡预览':'显示边缘过渡预览',onClick:()=>setShowMaskFeather(v=>!v)},h(ReferenceToolIcon,{name:showMaskFeather?'eye':'eyeOff'}))),h('span',{className:'cc-flyout-hint'},'边缘过渡会让遮罩边缘逐渐变淡，减少局部重绘与原图之间的硬接缝。')):null;
 const pendingQuick=quickDraft.current;
 const selectionOutline=pendingQuick&&['recolor','remove'].includes(pendingQuick.kind)?pendingQuick.outline||'':'';
 const liveLasso=['recolor','remove'].includes(drag.current?.tool)&&drag.current?.shape==='lasso'?drag.current:null;

 const quickNeedsModel=tool==='remove'&&!quickModels?.lama;
 const recolorDomains=pendingQuick?.analysis?.domains||[];
 const activeDomain=recolorDomains.find(d=>pendingQuick?.chosen?.has(d.id))||recolorDomains[0];
 const colorHue=(activeDomain?.hue||0)+recolorHue;
 const recolorTracks={hue:'linear-gradient(to right,'+[-180,-120,-60,0,60,120,180].map(a=>`hsl(${(activeDomain?.hue||0)+a} 85% 52%)`).join(',')+')',saturation:`linear-gradient(to right,#888,hsl(${colorHue} 50% 50%),hsl(${colorHue} 100% 50%))`,brightness:`linear-gradient(to right,#000,${activeDomain?.color||'#888'},#fff)`,threshold:'linear-gradient(to right,var(--cc-border),var(--cc-accent))'};
 const quickPanel=!editMode&&['remove','recolor'].includes(tool)?h('div',{className:'cc-reference-overlay-panel cc-quick-action-panel cc-selection-recolor-panel'+(tool==='remove'?' cc-remove-selection-panel':''),style:{left:12,top:12,bottom:'auto',right:'auto',width:340,maxWidth:'calc(100% - 24px)',minWidth:0,maxHeight:'calc(100% - 24px)',overflowY:'auto',scrollbarWidth:'none'},onPointerDown:e=>e.stopPropagation()},
  h('strong',null,toolLabels[tool]),
  tool==='remove'?h(React.Fragment,null,flyout('remove'),quickNeedsModel?h('button',{type:'button',style:S.btn2,disabled:busy,onClick:prepareQuickModel},'准备 LaMa 模型'):null):null,
  selecting?h('div',{className:'cc-quick-selection-status',role:'status','aria-live':'polite'},h('span',{className:'cc-icon-spinner','aria-hidden':true},h(PromptIcon,{name:'spinner',size:14})),'正在贴合边界…'):null,
  selectionTool?h(React.Fragment,null,flyout(tool),h('div',{className:'cc-selection-section-divider'}),
   recolorDomains.length?h('div',{className:'cc-selection-colors',role:'group','aria-label':'选区色域'},...recolorDomains.map((domain,i)=>h('button',{key:domain.id,type:'button',className:'cc-selection-swatch','aria-label':'色域 '+(i+1)+' '+domain.color,'aria-pressed':!!pendingQuick.chosen?.has(domain.id),'data-cc-tooltip':'色域 '+(i+1)+' · '+domain.color+'；点击切换，Ctrl/⌘ 点击增减多选',disabled:busy||selecting,onClick:e=>{const current=new Set(pendingQuick.chosen);if(e.ctrlKey||e.metaKey){if(current.has(domain.id))current.delete(domain.id);else current.add(domain.id);}else{current.clear();current.add(domain.id);}pendingQuick.chosen=current;recordQuickRecolor();previewQuickColor();}},h('span',{style:{background:domain.color}})))):h('span',{className:'cc-flyout-hint'},'先涂抹或用套索选择区域'),
   h('div',{className:'cc-selection-protection'},
    h('div',{className:'cc-selection-protection-head'},h('span',{className:'cc-flyout-hint'},'保护色域'),
     h('button',{type:'button',style:S.btn2,className:'cc-selection-pick-protection','aria-label':'取色保护','aria-pressed':protectionPicker,'data-cc-tooltip':'在选区内取色，保护相近颜色',disabled:busy||selecting||!pendingQuick?.analysis?.count,onClick:()=>{setEyedrop(false);setProtectionPicker(v=>!v);}},h('svg',{viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'square','aria-hidden':true},h('path',{d:'m14 4 6 6M4 20l4-1L20 7l-3-3L5 16l-1 4M16 19h6'})),h('span',null,'取色保护'))),
    pendingQuick?.protectedDomains?.length?h('div',{className:'cc-selection-colors cc-selection-negative-colors',role:'group','aria-label':'保护色域'},...pendingQuick.protectedDomains.map((domain,i)=>h('button',{key:domain.id,type:'button',className:'cc-selection-swatch cc-selection-negative','aria-label':'移除保护色域 '+(i+1),'data-cc-tooltip':'保护 '+domain.color+'；点击移除',disabled:busy||selecting,onClick:()=>{pendingQuick.protectedDomains=pendingQuick.protectedDomains.filter(v=>v.id!==domain.id);recordQuickRecolor();previewQuickColor();}},h('span',{style:{background:domain.color}}),h('b',{'aria-hidden':true},'−')))):null,
    protectionPicker?h('span',{className:'cc-flyout-hint'},'可连续点击选区内取色；再次点击取色按钮或按 Esc 退出。'):null),
   h('div',{className:'cc-selection-fields'},
    pendingQuick?.protectedDomains?.length?h(ParameterSlider,{label:'保护范围',value:protectionThreshold,onChange:setProtectionThreshold,onCommit:v=>recordQuickRecolor({protectionThreshold:v}),min:0,max:100,resetValue:30,track:recolorTracks.threshold,disabled:busy||selecting||!loaded}):null,
    h(ParameterSlider,{label:'阈值',value:recolorThreshold,onChange:setRecolorThreshold,onCommit:v=>recordQuickRecolor({threshold:v}),min:0,max:100,resetValue:30,track:recolorTracks.threshold,disabled:busy||selecting||!loaded}),
    h(ParameterSlider,{label:'色相',value:recolorHue,onChange:setRecolorHue,onCommit:v=>recordQuickRecolor({hue:v}),min:-180,max:180,resetValue:0,track:recolorTracks.hue,unit:'°',disabled:busy||selecting||!loaded}),
    h(ParameterSlider,{label:'饱和度',value:recolorSaturation,onChange:setRecolorSaturation,onCommit:v=>recordQuickRecolor({saturation:v}),min:-100,max:100,resetValue:0,track:recolorTracks.saturation,unit:'%',disabled:busy||selecting||!loaded}),
    h(ParameterSlider,{label:'亮度',value:recolorBrightness,onChange:setRecolorBrightness,onCommit:v=>recordQuickRecolor({brightness:v}),min:-100,max:100,resetValue:0,track:recolorTracks.brightness,unit:'%',disabled:busy||selecting||!loaded})),
   h('span',{className:'cc-flyout-hint'},'色域包含相近颜色的明暗变化；保留纹理与光影层次。')):null,
  h('div',{className:'cc-flyout-actions'},
   h('button',{type:'button',style:S.btn,disabled:busy||selecting||quickNeedsModel||(selectionTool?!pendingQuick?.preview:!pendingQuick?.strokes.length),onClick:selectionTool?applyQuickColor:repairQuickDraft},'应用修改'),
   h('button',{type:'button',style:S.btn2,disabled:!pendingQuick&&!quickJob.current,onClick:cancelQuick},'移除选区'))):null;

 return h(OverlayModal,{title:'图片编辑器',titleAddon:h(ImageEditorHelp,{open:helpOpen,onOpenChange:setHelpOpen,theme}),titleActions:modalTitleActions,className:'cc-reference-dialog cc-reference-studio-dialog',theme,width:2400,maxHeight:'calc(100dvh - 28px)',zIndex:2147481800,onClose:cancelEditor,hideClose:true,headerActions:exitActions},h('style',null,REFERENCE_CSS+REFERENCE_STUDIO_CSS+REFERENCE_STUDIO_V13_CSS+REFERENCE_STUDIO_V15_CSS+REFERENCE_FILL_V17_CSS+REFERENCE_SCALE_V175_CSS+REFERENCE_SAVE_STATUS_CSS+REFERENCE_CANVAS_CROP_CSS+REFERENCE_SELECTION_RECOLOR_CSS),h('div',{className:'cc-reference-editor cc-reference-studio'},
  h('div',{className:'cc-reference-main'},
   h('div',{className:'cc-reference-rail',role:'toolbar','aria-label':regionalMode?'区域色块工具':'图生图编辑工具'},...(regionalMode?[['brush','eraser','fill','text']]:TOOL_GROUPS).map((group,gi)=>h(React.Fragment,{key:'grp'+gi},gi?h('div',{className:'cc-rail-sep',key:'sep'+gi}):null,...group.map(t=>railTool(t,['remove','recolor','mask'].includes(t)?null:flyout(t),t==='text'&&(tool==='text'||doc.current.layers.some(l=>l.id===activeId&&l.kind==='text')))))),h('div',{className:'cc-rail-sep'}),h('div',{className:'cc-reference-tool'},h('button',{type:'button',style:S.btn2,title:'撤回 (Ctrl+Z)','aria-label':'撤回图片编辑',disabled:busy||!loaded||!cropUndo,onClick:()=>undo(-1)},h(PromptIcon,{name:'undo',size:16}))),h('div',{className:'cc-reference-tool'},h('button',{type:'button',style:S.btn2,title:'重做 (Ctrl+Shift+Z)','aria-label':'重做图片编辑',disabled:busy||!loaded||!cropRedo,onClick:()=>undo(1)},h(PromptIcon,{name:'redo',size:16})))),
   h('div',{className:'cc-reference-viewport','data-editor-preview-background':previewBackground,ref:viewport,style:{cursor:editMode==='crop'?'default':tool==='select'?'default':'crosshair'},onPointerEnter:previewBrush,onPointerLeave:hideBrushPreview,onPointerDown:e=>{previewBrush(e);down(e);},onPointerMove:e=>{previewBrush(e);move(e);},onPointerUp:up,onPointerCancel:up,onLostPointerCapture:up,onContextMenu:e=>{if(drag.current?.tool==='eyedrop-right'||board.current?.contains(e.target))e.preventDefault();}},cropPanel,resizePanel,transformPanel,quickPanel,maskPanel,
    h('div',{ref:board,className:'cc-reference-board','data-pixel-view':scale>=1?'true':'false',style:{width:size.w,height:size.h,'--cc-editor-inv-scale':1/scale,transform:`translate(${pan.x}px,${pan.y}px) scale(${scale})`}},
     h('div',{className:'cc-editor-visual-clip'},
      h('canvas',{ref:display,'aria-label':'图生图编辑画布',style:{opacity:editMode==='transform'?.12:1}}),
      editMode==='transform'?h('canvas',{ref:transformPreview,className:'cc-editor-transform-canvas','aria-hidden':true,style:{position:'absolute',left:0,top:0,pointerEvents:'none'}}):null,
      editMode!=='transform'?h('svg',{viewBox:`0 0 ${size.w} ${size.h}`,width:size.w,height:size.h,'aria-hidden':true,className:'cc-selection-overlay'},...(()=>{const chosen=shapes.find(s=>s.id===selected&&doc.current.layers.find(l=>l.id===s.layerId)?.visible);return chosen?[h('rect',{key:'sel',x:chosen.x,y:chosen.y,width:chosen.w,height:chosen.h,fill:'none',stroke:'var(--cc-accent)',strokeWidth:1.5/scale,strokeDasharray:6/scale})]:[];})()):null),
     editMode==='transform'?h('svg',{viewBox:`0 0 ${size.w} ${size.h}`,width:size.w,height:size.h,className:'cc-editor-transform-bounds','aria-label':'原画布边界',style:{position:'absolute',left:0,top:0,overflow:'visible',pointerEvents:'none',zIndex:1}},
      h('rect',{x:0,y:0,width:size.w,height:size.h,fill:'none',stroke:'var(--cc-surface)',strokeWidth:3/scale}),
      h('rect',{x:0,y:0,width:size.w,height:size.h,fill:'none',stroke:'var(--cc-text)',strokeWidth:1.3/scale,strokeDasharray:6/scale})):null,
     transformOverlay,
     editMode!=='crop'&&editMode!=='transform'?h(EditorSizeGuide,{value,size,settings:generationSize}):null,
     cropFrame?h('div',{className:'cc-reference-crop-box',style:{left:cropFrame.x,top:cropFrame.y,width:cropFrame.w,height:cropFrame.h}},
      h('div',{className:'cc-reference-crop-label'},cropFrame.w+' × '+cropFrame.h),
      ...['nw','n','ne','e','se','s','sw','w'].map(handle=>h('span',{key:handle,className:'cc-editor-crop-handle', 'data-handle':handle}))):null),
    editMode!=='transform'&&(selectionOutline||liveLasso?.points.length>=2)?h(EditorSelectionAnts,{outline:selectionOutline,points:liveLasso?.points,pan,scale}):null,
    transformAngleBadge?h('div',{className:'cc-reference-angle-badge',style:{position:'absolute',left:transformAngleBadge.x,top:transformAngleBadge.y,pointerEvents:'none',padding:'4px 8px',borderRadius:6,background:'var(--cc-surface)',border:'1px solid var(--cc-border)',fontSize:12,fontWeight:600,boxShadow:'0 8px 24px rgba(0,0,0,.18)'}},transformAngleBadge.angle+'°'):null,
    h('div',{ref:brushCursor,className:'cc-editor-brush-cursor','aria-hidden':true},h('svg',{className:'cc-editor-brush-shapes',viewBox:'0 0 100 100',preserveAspectRatio:'none',fill:'none'},
     h('circle',{cx:50,cy:50,r:48.5,'data-cursor-shape':'circle','data-cursor-outline':true}),h('circle',{cx:50,cy:50,r:48.5,'data-cursor-shape':'circle','data-cursor-line':true}),
     h('circle',{cx:50,cy:50,r:48.5,'data-cursor-shape':'soft','data-cursor-outline':true}),h('circle',{cx:50,cy:50,r:48.5,'data-cursor-shape':'soft','data-cursor-line':true}),
     h('rect',{x:1.5,y:1.5,width:97,height:97,'data-cursor-shape':'square','data-cursor-outline':true}),h('rect',{x:1.5,y:1.5,width:97,height:97,'data-cursor-shape':'square','data-cursor-line':true})),
     eyedrop?h(ReferenceToolIcon,{name:'select'}):tool==='fill'?h(ReferenceToolIcon,{name:'fill'}):null),
    h('div',{ref:eyedropLoupe,className:'cc-editor-eyedrop-loupe','aria-hidden':true},h('canvas',{width:126,height:126})),
    h('div',{ref:eyedropSwatch,className:'cc-editor-eyedrop-swatch','aria-hidden':true})),
   h(EditorResizableSidebar,null,
   regionalMode?h('section',{className:'cc-editor-card','aria-label':'颜色'},h('strong',{className:'cc-editor-card-title'},'颜色'),
   h('div',{className:'cc-editor-recent-colors'},...(typeof REGIONAL_COLORS!=='undefined'?REGIONAL_COLORS:['#ffffff','#ff3b30','#34c759','#007aff','#ffcc00','#ff2d95','#00d4c8','#a855f7']).map(c=>h('button',{type:'button',key:c,style:{background:c,width:24,height:24,borderRadius:5,border:color===c?'2px solid #fff':'1px solid var(--cc-border)'},title:c,'aria-label':'选择颜色 '+c,disabled:busy,onClick:()=>{pickColor(c);colorCommit(c);}})))):h(EditorColorPalette,{color,onChange:pickColor,onCommit:colorCommit,recent:recentColors,onSample:()=>setEyedrop(v=>!v),sampleActive:eyedrop,disabled:busy||!loaded}),
    h('section',{className:'cc-editor-card cc-editor-background-card'},h('strong',{className:'cc-editor-card-title'},'画布背景'),
     h(EditorCanvasBackground,{value:previewBackground,onChange:mode=>{setPreviewBackground(mode);try{lsWrite({previewBackground:mode});}catch{}}}),
     h('div',{className:'cc-editor-image-fill-row'},
      h('span',null,'图片底色'),
      h('button',{type:'button',role:'switch',className:'cc-editor-image-fill-switch','aria-label':'图片底色开关','aria-checked':imageFill,'data-cc-tooltip':imageFill?'关闭图片底色':'开启图片底色',onClick:()=>updateFill(!imageFill),disabled:busy||!loaded},h('span',{className:'cc-switch-track','aria-hidden':true}))),
     h('input',{type:'color',className:'cc-editor-image-fill-swatch',value:imageBackgroundColor,disabled:busy||!loaded,'aria-label':'选择图片底色','data-cc-tooltip':'选择图片底色（不会更改画笔颜色）',onChange:e=>setFixedImageBackground(e.target.value)})),
    h('section',{className:'cc-editor-card cc-layer-card'},h('strong',{className:'cc-editor-card-title'},'图层'),layerPanel()))),
  error?h('div',{className:'cc-editor-exit-error',role:'alert'},error):null,
  busyLabel?h('div',{className:'cc-editor-saving-layer',role:'status','aria-live':'polite','aria-atomic':true},h('div',{className:'cc-editor-saving-card'},h('span',{className:'cc-icon-spinner','aria-hidden':true},h(PromptIcon,{name:'spinner',size:22})),h('div',{className:'cc-editor-saving-copy'},h('strong',null,busyLabel)),quickJob.current?h('button',{type:'button',style:{...S.btn2,pointerEvents:'auto'},onClick:cancelQuick},'取消处理'):null)):null,
  saving&&!busyLabel?h('div',{className:'cc-editor-saving-layer',role:'status','aria-live':'polite','aria-atomic':true},h('div',{className:'cc-editor-saving-card'},h('span',{className:'cc-icon-spinner','aria-hidden':true},h(PromptIcon,{name:'spinner',size:22})),h('div',{className:'cc-editor-saving-copy'},h('strong',null,'正在保存…'),closing?h('small',null,'保存完成后自动关闭'):null))):null));
}

// Shared pixel tools used by the unified image editor.
// Repair requests stay in quick_edit.py; brush and color algorithms stay local.
function QuickEditShapeGlyph({kind}){
 const base={viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
 if(kind==='wand')return h('svg',base,h('path',{d:'m4 20 12-12M14 4l6 6M4 3v4M2 5h4M19 15v6M16 18h6'}));
 if(kind==='lasso')return h('svg',base,h('path',{d:'M6 16c-6-5-2-12 6-12s12 7 6 11c-4 3-12 4-12 1 0-2 4-2 4 1s-3 5-5 4'}));
 if(kind==='square')return h('svg',base,h('rect',{x:5,y:5,width:14,height:14,rx:2}));
 if(kind==='soft')return h('svg',base,h('circle',{cx:12,cy:12,r:9,opacity:.3}),h('circle',{cx:12,cy:12,r:5.5}));
 return h('svg',base,h('circle',{cx:12,cy:12,r:8}));
}
function QuickEditGlyph({kind}){
 const path={remove:['M4 20 20 4','M4 4h6M4 4v6M20 14v6h-6','M11 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z'],blur:['M12 3c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12z'],recolor:['M4 20 18 6','M15 3v4M20 8h-4','M4 5v4M2 7h4'],liquify:['M3 8c4-7 8 7 13 0 2-3 4-3 5 0','M3 16c4-7 8 7 13 0 2-3 4-3 5 0']};
 return h('svg',{viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},...(path[kind]||path.remove).map((d,i)=>h('path',{key:i,d})));
}
function quickEditBound(v,a,b){return Math.max(a,Math.min(b,v));}
function quickEditSelect(data,width,height,x,y,tolerance,contiguous=true){
 const n=width*height,out=new Uint8Array(n),seed=(Math.floor(y)*width+Math.floor(x))*4;
 if(!data[seed+3])return out;
 const limit=(tolerance*2.55)**2*3;
 const match=i=>data[i*4+3]>0&&((data[i*4]-data[seed])**2+(data[i*4+1]-data[seed+1])**2+(data[i*4+2]-data[seed+2])**2)<=limit;
 if(!contiguous){for(let i=0;i<n;i++)if(match(i))out[i]=255;return out;}
 const seen=new Uint8Array(n),queue=new Uint32Array(n);let start=0,end=1;
 queue[0]=seed/4;seen[seed/4]=1;
 const add=i=>{if(!seen[i]){seen[i]=1;if(match(i))queue[end++]=i;}};
 while(start<end){const i=queue[start++];out[i]=255;const col=i%width;
  if(col)add(i-1);if(col<width-1)add(i+1);if(i>=width)add(i-width);if(i<n-width)add(i+width);
 }
 return out;
}
function quickEditRecolor(image,mask,color,strength,preserve=true){
 const out=new Uint8ClampedArray(image.data),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 const luminance=c=>.3*c[0]+.59*c[1]+.11*c[2];
 for(let p=0;p<mask.length;p++){
  const i=p*4,t=mask[p]/255*strength;if(!t||!out[i+3])continue;
  let c=rgb;
  if(preserve){
   const light=luminance([out[i],out[i+1],out[i+2]]),delta=light-luminance(rgb);c=rgb.map(v=>v+delta);
   const lo=Math.min(...c);if(lo<0)c=c.map(v=>light+(v-light)*light/(light-lo||1));
   const hi=Math.max(...c);if(hi>255)c=c.map(v=>light+(v-light)*(255-light)/(hi-light||1));
  }
  for(let k=0;k<3;k++)out[i+k]=out[i+k]*(1-t)+c[k]*t;
 }
 return new ImageData(out,image.width,image.height);
}
function quickEditWarpWeight(distance,radius){const t=distance/radius;return (1-t*t)**2;}
function quickEditLiquify(canvas,from,to,radius,strength,state={}){
 const dx=(to.x-from.x)*strength,dy=(to.y-from.y)*strength;if(Math.hypot(dx,dy)<.01)return;
 const w=canvas.width,ht=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true});
 // Accumulate coordinates, never repeatedly interpolate already-warped colors.
 if(!state.base)state.base=ctx.getImageData(0,0,w,ht);
 if(!state.displacement)state.displacement=new Float32Array(w*ht*2);
 const map=state.displacement;
 const x=quickEditBound(Math.floor(to.x-radius-2),0,w-1),y=quickEditBound(Math.floor(to.y-radius-2),0,ht-1);
 const ex=quickEditBound(Math.ceil(to.x+radius+2),x+1,w),ey=quickEditBound(Math.ceil(to.y+radius+2),y+1,ht),sw=ex-x,sh=ey-y;
 const pad=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy)))+2,bx=Math.max(0,x-pad),by=Math.max(0,y-pad),bw=Math.min(w,ex+pad)-bx,bh=Math.min(ht,ey+pad)-by;
 const previous=new Float32Array(bw*bh*2);
 for(let yy=0;yy<bh;yy++)previous.set(map.subarray(((by+yy)*w+bx)*2,((by+yy)*w+bx+bw)*2),yy*bw*2);
 const sampleMap=(sx,sy,c)=>{const px=quickEditBound(sx-bx,0,bw-1),py=quickEditBound(sy-by,0,bh-1),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;const a=(iy*bw+ix)*2+c,b=(iy*bw+Math.min(ix+1,bw-1))*2+c,z=(Math.min(iy+1,bh-1)*bw+ix)*2+c,t=(Math.min(iy+1,bh-1)*bw+Math.min(ix+1,bw-1))*2+c;return (previous[a]*(1-fx)+previous[b]*fx)*(1-fy)+(previous[z]*(1-fx)+previous[t]*fx)*fy;};
 const out=ctx.getImageData(x,y,sw,sh),src=state.base.data;
 for(let yy=y;yy<ey;yy++)for(let xx=x;xx<ex;xx++){
  const distance=Math.hypot(xx-to.x,yy-to.y);if(distance>=radius)continue;
  const f=quickEditWarpWeight(distance,radius),qx=quickEditBound(xx-dx*f,0,w-1),qy=quickEditBound(yy-dy*f,0,ht-1),i=(yy*w+xx)*2;
  map[i]=qx-xx+sampleMap(qx,qy,0);map[i+1]=qy-yy+sampleMap(qx,qy,1);
  const sx=quickEditBound(xx+map[i],0,w-1),sy=quickEditBound(yy+map[i+1],0,ht-1),ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,oi=((yy-y)*sw+xx-x)*4;
  // Bicubic, premultiplied alpha: crisp edges without transparent color halos.
  const fx2=fx*fx,fx3=fx2*fx,fy2=fy*fy,fy3=fy2*fy;
  const wx0=-.5*fx+fx2-.5*fx3,wx1=1-2.5*fx2+1.5*fx3,wx2=.5*fx+2*fx2-1.5*fx3,wx3=-.5*fx2+.5*fx3;
  const wy0=-.5*fy+fy2-.5*fy3,wy1=1-2.5*fy2+1.5*fy3,wy2=.5*fy+2*fy2-1.5*fy3,wy3=-.5*fy2+.5*fy3;
  let red=0,green=0,blue=0,alpha=0;
  for(let ky=0;ky<4;ky++){
   const row=quickEditBound(iy+ky-1,0,ht-1)*w,wy=ky===0?wy0:ky===1?wy1:ky===2?wy2:wy3;
   for(let kx=0;kx<4;kx++){
    const j=(row+quickEditBound(ix+kx-1,0,w-1))*4,weight=wy*(kx===0?wx0:kx===1?wx1:kx===2?wx2:wx3),a=src[j+3]*weight;
    alpha+=a;red+=src[j]*a;green+=src[j+1]*a;blue+=src[j+2]*a;
   }
  }
  out.data[oi+3]=quickEditBound(alpha,0,255);
  out.data[oi]=alpha>0?quickEditBound(red/alpha,0,255):0;out.data[oi+1]=alpha>0?quickEditBound(green/alpha,0,255):0;out.data[oi+2]=alpha>0?quickEditBound(blue/alpha,0,255):0;
 }
 ctx.putImageData(out,x,y);
}

const QUICK_EDIT_SHAPES=[['circle','圆形'],['square','正方形'],['soft','软边缘']];
let quickSoftScratch=null;
function quickSoftLayer(w,h){
 if(!quickSoftScratch||quickSoftScratch.mask.width!==w||quickSoftScratch.mask.height!==h){
  const mask=document.createElement('canvas'),blurred=document.createElement('canvas');
  mask.width=blurred.width=w;mask.height=blurred.height=h;quickSoftScratch={mask,blurred};
 }
 return quickSoftScratch;
}
function quickEditPaintStroke(ctx,points,diameter,color,shape='circle'){
 if(shape==='soft'){
  const w=ctx.canvas.width,h=ctx.canvas.height,scratch=quickSoftLayer(w,h),mask=scratch.mask.getContext('2d'),blurred=scratch.blurred.getContext('2d');
  mask.setTransform(1,0,0,1,0,0);mask.globalAlpha=1;mask.globalCompositeOperation='source-over';mask.filter='none';mask.clearRect(0,0,w,h);
  mask.strokeStyle='#fff';mask.fillStyle='#fff';mask.lineWidth=Math.max(1,diameter);mask.lineCap='round';mask.lineJoin='round';mask.beginPath();mask.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))mask.lineTo(p.x,p.y);mask.stroke();
  if(points.length===1){mask.beginPath();mask.arc(points[0].x,points[0].y,diameter/2,0,2*Math.PI);mask.fill();}
  blurred.setTransform(1,0,0,1,0,0);blurred.globalAlpha=1;blurred.globalCompositeOperation='source-over';blurred.clearRect(0,0,w,h);blurred.filter=`blur(${Math.max(.5,diameter*.18)}px)`;blurred.drawImage(scratch.mask,0,0);blurred.filter='none';
  if(ctx.globalCompositeOperation==='destination-out'){ctx.drawImage(scratch.blurred,0,0);return;}
  blurred.globalCompositeOperation='source-in';blurred.fillStyle=color;blurred.fillRect(0,0,w,h);blurred.globalCompositeOperation='source-over';ctx.drawImage(scratch.blurred,0,0);return;
 }
 ctx.save();
 ctx.filter='none';
 ctx.lineCap=shape==='square'?'butt':'round';ctx.lineJoin=shape==='square'?'miter':'round';
 ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=diameter;
 if(shape==='square'){const side=Math.max(1,Math.round(diameter)),stamp=(x,y)=>ctx.fillRect(Math.round(x-side/2),Math.round(y-side/2),side,side);stamp(points[0].x,points[0].y);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dist=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(dist/Math.max(1,diameter*.3)));for(let k=1;k<=steps;k++){const t=k/steps;stamp(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);}}ctx.restore();return;}
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();
 if(points.length===1){ctx.beginPath();ctx.arc(points[0].x,points[0].y,diameter/2,0,2*Math.PI);ctx.fill();}
 ctx.restore();
}


// Selection recolor is local and non-destructive until Apply. Color domains
// ignore lightness for chromatic colors, so highlights and shadows stay together.
function quickSelectionHue(r,g,b){
 const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,l=(max+min)/2;
 if(delta<1e-8)return [0,0,l];
 let hue=max===r?(g-b)/delta+(g<b?6:0):max===g?(b-r)/delta+2:(r-g)/delta+4;
 return [hue*60,delta/(1-Math.abs(2*l-1)),l];
}
function quickSelectionLab(r,g,b){
 const linear=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
 r=linear(r);g=linear(g);b=linear(b);
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
function quickSelectionRgb(L,a,b){
 const inverse=(a,b)=>{const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];};
 let rgb=inverse(a,b);
 if(rgb.some(v=>v<-.00001||v>1.00001)){
  // Reduce chroma to the displayable gamut instead of clipping channel values,
  // which would otherwise destroy lightness and highlight/shadow relationships.
  let low=0,high=1;for(let j=0;j<8;j++){const mid=(low+high)/2,test=inverse(a*mid,b*mid);if(test.every(v=>v>=-.00001&&v<=1.00001))low=mid;else high=mid;}rgb=inverse(a*low,b*low);
 }
 return rgb.map(v=>{v=Math.max(0,Math.min(1,v));return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);});
}
function quickSelectionAnalyze(image,mask){
 const pixels=image.data,area=mask.data;let count=0;
 for(let i=0;i<pixels.length;i+=4)if(area[i+3]&&pixels[i+3])count++;
 const cached=count<=2000000,indices=cached?new Uint32Array(count):null,samples=cached?new Float32Array(count*7):null,bins=new Map();let n=0;
 for(let i=0;i<pixels.length;i+=4){
  if(!area[i+3]||!pixels[i+3])continue;
  const rgb=[pixels[i]/255,pixels[i+1]/255,pixels[i+2]/255],[h,s,l]=quickSelectionHue(...rgb),weight=area[i+3]/255;
  if(cached){indices[n]=i;samples.set([...quickSelectionLab(...rgb),h,s,l,weight],n*7);}n++;
  const neutral=s<.12,key=neutral?'n'+(l<.25?0:l>.75?2:1):'h'+(Math.round(h/30)%12);
  let bin=bins.get(key);if(!bin){bin={id:key,neutral,hue:0,light:0,weight:0,rgb:[0,0,0],sin:0,cos:0};bins.set(key,bin);}
  const w=weight*pixels[i+3]/255;bin.weight+=w;bin.light+=l*w;bin.sin+=Math.sin(h*Math.PI/180)*w;bin.cos+=Math.cos(h*Math.PI/180)*w;rgb.forEach((v,j)=>bin.rgb[j]+=v*w);
 }
 const domains=[...bins.values()].sort((a,b)=>b.weight-a.weight);
 for(const d of domains){d.hue=(Math.atan2(d.sin,d.cos)*180/Math.PI+360)%360;d.light/=d.weight;d.color='#'+d.rgb.map(v=>Math.round(v/d.weight*255).toString(16).padStart(2,'0')).join('');}
 // Merge nearby hue bins split by a bin boundary. Keep neutral tones separate.
 for(let i=0;i<domains.length;i++)for(let j=domains.length-1;j>i;j--){const a=domains[i],b=domains[j],angle=Math.abs(a.hue-b.hue);if(!a.neutral&&!b.neutral&&Math.min(angle,360-angle)<24){const w=a.weight+b.weight;a.sin+=b.sin;a.cos+=b.cos;a.hue=(Math.atan2(a.sin,a.cos)*180/Math.PI+360)%360;a.light=(a.light*a.weight+b.light*b.weight)/w;a.rgb=a.rgb.map((v,k)=>v+b.rgb[k]);a.weight=w;a.color='#'+a.rgb.map(v=>Math.round(v/w*255).toString(16).padStart(2,'0')).join('');domains.splice(j,1);}}
 return {indices,samples,mask:cached?null:mask,domains:domains.sort((a,b)=>b.weight-a.weight),count};
}
function quickSelectionSmooth(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
function quickSelectionWeight(h,s,l,domain,threshold){
 const t=Math.max(0,Math.min(100,threshold))/100;
 if(domain.neutral)return (1-quickSelectionSmooth(.08,.22,s))*(1-quickSelectionSmooth(.08+t*.35,.12+t*.4,Math.abs(l-domain.light)));
 const angle=Math.abs(h-domain.hue),distance=Math.min(angle,360-angle),width=3+t*87;
 return (1-quickSelectionSmooth(width*.7,width,distance))*quickSelectionSmooth(.02,.12,s);
}
function quickSelectionProtectionWeight(L,a,b,domain,threshold=30){
 const [nL,na,nb]=domain.lab,distance=Math.hypot((L-nL)*.5,a-na,b-nb),radius=.015+Math.max(0,Math.min(100,threshold))*.0013;
 return 1-quickSelectionSmooth(radius*.7,radius,distance);
}
function quickSelectionAdjust(image,analysis,chosen,settings,protectedDomains=[]){
 if(!chosen.size||(!settings.hue&&!settings.saturation&&!settings.brightness))return null;
 const domains=analysis.domains.filter(d=>chosen.has(d.id));if(!domains.length)return null;
 const out=new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),src=image.data,dst=out.data,angle=settings.hue*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);let changed=false;
 for(let n=0;n<(analysis.indices?analysis.indices.length:src.length/4);n++){
  const i=analysis.indices?analysis.indices[n]:n*4;
  if(!analysis.indices&&(!analysis.mask.data[i+3]||!src[i+3]))continue;
  const k=analysis.samples?n*7:0,s=analysis.samples||[...quickSelectionLab(src[i]/255,src[i+1]/255,src[i+2]/255),...quickSelectionHue(src[i]/255,src[i+1]/255,src[i+2]/255),analysis.mask.data[i+3]/255];let weight=0;
  for(const domain of domains)weight=Math.max(weight,quickSelectionWeight(s[k+3],s[k+4],s[k+5],domain,settings.threshold));
  let protection=0;
  for(const domain of protectedDomains)protection=Math.max(protection,quickSelectionProtectionWeight(s[k],s[k+1],s[k+2],domain,settings.protectionThreshold));
  weight*=s[k+6]*(1-protection);if(weight<1/255)continue;
  let L=s[k],a=s[k+1],b=s[k+2],chroma=1+settings.saturation/100;
  L+=settings.brightness/100*(settings.brightness>0?1-L:L);
  const rgb=quickSelectionRgb(Math.max(0,Math.min(1,L)),(a*cos-b*sin)*chroma,(a*sin+b*cos)*chroma);
  for(let c=0;c<3;c++){dst[i+c]=src[i+c]+(rgb[c]-src[i+c])*weight;if(dst[i+c]!==src[i+c])changed=true;}
 }
 return changed?out:null;
}
function quickSelectionOutline(mask,bounds){
 const {width:w,height:h,data:p}=mask,inside=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&p[(y*w+x)*4+3]>=128;
 const lines=[];
 const [x0,y0,x1,y1]=bounds||[0,0,w,h];
 for(let y=y0;y<=y1;y++){let start=-1;for(let x=x0;x<=x1;x++){const edge=x<x1&&inside(x,y-1)!==inside(x,y);if(edge&&start<0)start=x;if(!edge&&start>=0){lines.push(`M${start} ${y}H${x}`);start=-1;}}}
 for(let x=x0;x<=x1;x++){let start=-1;for(let y=y0;y<=y1;y++){const edge=y<y1&&inside(x-1,y)!==inside(x,y);if(edge&&start<0)start=y;if(!edge&&start>=0){lines.push(`M${x} ${start}V${y}`);start=-1;}}}
 return lines.join('');
}
const REFERENCE_SELECTION_RECOLOR_CSS=`
.cc-selection-recolor-panel{display:flex;flex-direction:column;gap:8px}
.cc-selection-recolor-panel .cc-recolor-tool-options{display:flex;flex-direction:column;gap:6px}
.cc-selection-recolor-panel .cc-recolor-tool-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cc-selection-recolor-panel .cc-selection-section-divider{border-top:1px solid var(--cc-border);margin:2px 0}
.cc-mask-setting-row{display:flex;align-items:center;gap:6px;width:100%;min-width:0}.cc-mask-setting-row>.cc-flyout-row{flex:1 1 0;width:0;min-width:0}.cc-mask-setting-row>.cc-flyout-row .cc-drag-number{flex:1 1 0!important;width:0!important;min-width:0!important;max-width:none!important}.cc-mask-feather-toggle{flex:0 0 32px;width:32px;min-width:32px;height:32px;min-height:32px;padding:0!important}
.cc-selection-recolor-panel .cc-wand-tolerance{--cc-slider-label-width:84px}
.dsh-comfy-floating .cc-selection-recolor-panel .cc-flyout-row .cc-drag-number{flex:0 1 150px;min-width:80px}
.dsh-comfy-floating .cc-reference-board[data-pixel-view=true]{will-change:auto}
.dsh-comfy-floating .cc-reference-board[data-pixel-view=true] canvas{image-rendering:pixelated}
.cc-selection-expansion .cc-strength-control{display:flex;flex:0 1 180px;min-width:0;align-items:center;gap:6px}
.cc-selection-expansion .cc-strength-control .cc-drag-number{flex:1;min-width:0}
.cc-quick-selection-status{display:flex;align-items:center;gap:7px;color:var(--cc-muted);font-size:12px}
.cc-selection-recolor-panel .cc-selection-colors{display:flex;gap:7px;flex-wrap:wrap;max-height:84px;padding:3px;overflow:auto;scrollbar-width:none}
.cc-selection-recolor-panel .cc-selection-swatch{width:28px;height:28px;min-width:28px;padding:3px;border:1px solid var(--cc-border);border-radius:var(--cc-control-radius,6px);background:var(--cc-control);color:var(--cc-text);cursor:pointer}
.cc-selection-recolor-panel .cc-selection-swatch>span{display:block;width:100%;height:100%;border-radius:0}
.dsh-comfy-floating .cc-selection-recolor-panel .cc-selection-swatch[aria-pressed=true]{outline:2px solid var(--cc-accent);outline-offset:1px;border-color:var(--cc-accent)}
.cc-selection-recolor-panel .cc-selection-swatch:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.cc-selection-recolor-panel .cc-selection-protection{display:flex;flex-direction:column;gap:4px}
.cc-selection-recolor-panel .cc-selection-protection-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cc-selection-recolor-panel .cc-selection-pick-protection{display:inline-flex;gap:5px;align-items:center;min-height:28px;padding:3px 7px!important;font-size:11px}
.cc-selection-recolor-panel .cc-selection-pick-protection[aria-pressed=true]{background:var(--cc-accent-bg)!important;box-shadow:inset 0 0 0 1px var(--cc-accent)}
.cc-selection-recolor-panel .cc-selection-negative{position:relative;border-style:dashed}
.cc-selection-recolor-panel .cc-selection-negative>b{position:absolute;right:0;bottom:0;display:block;background:var(--cc-surface);color:var(--cc-text);font-size:12px;line-height:12px;padding:0 2px;font-weight:600}
.dsh-comfy-floating .cc-reference-studio :is(.cc-recolor-selection-modes,.cc-editor-icon-options){display:flex;justify-content:flex-end;gap:6px}
.dsh-comfy-floating .cc-reference-studio :is(.cc-recolor-selection-modes,.cc-editor-icon-options) .cc-fill-preset{flex:0 0 32px;width:32px;min-width:32px;height:32px;min-height:32px;padding:0!important}
.cc-selection-recolor-panel .cc-selection-fields{display:flex;flex-direction:column;gap:4px}
.dsh-comfy-floating .cc-reference-studio .cc-recolor-shapes{display:flex;flex-wrap:nowrap;justify-content:flex-end;gap:6px}
.dsh-comfy-floating .cc-reference-studio .cc-recolor-shapes .cc-fill-preset{flex:0 0 32px;width:32px;min-width:32px;height:32px;min-height:32px;padding:0!important}
.dsh-comfy-floating .cc-reference-studio .cc-shape-row{display:flex;flex-wrap:nowrap;justify-content:stretch;gap:6px}
.dsh-comfy-floating .cc-reference-studio .cc-shape-row .cc-fill-preset{flex:1 1 0;width:auto;min-width:0;height:32px;min-height:32px;padding:0!important}
.cc-selection-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.cc-selection-ants{animation:cc-selection-march .8s linear infinite}
@keyframes cc-selection-march{to{stroke-dashoffset:-8}}
@media(prefers-reduced-motion:reduce){.cc-selection-ants{animation:none}}
`;

// Draft history keeps immutable stroke references, not full image snapshots.
function referenceRecolorStep(draft,settings){
 return {strokes:draft.strokes.slice(),protectedDomains:draft.protectedDomains.slice(),chosen:[...(draft.chosen||[])].sort(),settings:{...settings}};
}
function referenceRecolorSameStep(a,b){
 return a&&b&&a.strokes.length===b.strokes.length&&a.strokes.every((s,i)=>s===b.strokes[i])&&a.protectedDomains.length===b.protectedDomains.length&&a.protectedDomains.every((s,i)=>s===b.protectedDomains[i])&&a.chosen.join('|')===b.chosen.join('|')&&Object.keys(b.settings).every(k=>a.settings[k]===b.settings[k]);
}
function referenceRecolorPush(draft,settings){
 const state=referenceRecolorStep(draft,settings),history=draft.history;
 if(referenceRecolorSameStep(history.items[history.index],state))return false;
 history.items.splice(history.index+1);history.items.push(state);history.index=history.items.length-1;
 if(history.items.length>201){history.items.splice(0,history.items.length-201);history.index=history.items.length-1;}
 return true;
}

// Independent seeded graph-cut selection. No vendor code or model dependency.
// Self-contained so the same function runs in a Blob Worker and focused checks.
function referenceQuickSelectionSolve(input){
 const {width:w,height:h}=input,image=input.image,prior=input.prior||[],strokes=input.seeds||[];
 const stride=Math.max(1,Math.ceil(Math.max(w,h)/192)),gw=Math.ceil(w/stride),gh=Math.ceil(h/stride),n=gw*gh;
 const rgb=new Float32Array(n*3),samples=new Uint32Array(n),alpha=new Uint32Array(n),old=new Float32Array(n),hard=new Uint8Array(n),fullHard=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x,j=(Math.floor(y/stride)*gw+Math.floor(x/stride)),at=p*4;
  samples[j]++;if(!image[at+3])continue;alpha[j]++;
  for(let k=0;k<3;k++)rgb[j*3+k]+=image[at+k];
 }
 for(let j=0;j<n;j++)for(let k=0;k<3;k++)rgb[j*3+k]/=Math.max(1,alpha[j]);
 const visit=(runs,fn)=>{for(let i=0;i<runs.length;i+=2){const a=runs[i],end=a+runs[i+1],y=Math.floor(a/w);for(let x=a%w;x<a%w+(end-a);x++)fn(y*w+x,Math.floor(y/stride)*gw+Math.floor(x/stride));}};
 visit(prior,(_,j)=>old[j]++);
 for(let j=0;j<n;j++)old[j]/=Math.max(1,samples[j]);
 for(const s of strokes)visit(s.runs,(p,j)=>{if(image[p*4+3])fullHard[p]=hard[j]=s.exclude?2:1;});
 let hasPositive=fullHard.includes(1);for(let j=0;j<n;j++){if(!alpha[j])hard[j]=2;if(old[j]>0)hasPositive=true;}
 if(!hasPositive)return {runs:new Uint32Array(),count:0,bounds:[0,0,0,0]};
 const histogram=()=>new Map(),fg=histogram(),bg=histogram();
 function sample(map,j){const r=rgb[j*3],g=rgb[j*3+1],b=rgb[j*3+2],key=(r>>5)*64+(g>>5)*8+(b>>5);let v=map.get(key);if(!v)map.set(key,v=[0,0,0,0]);v[0]+=r;v[1]+=g;v[2]+=b;v[3]++;}
 for(let j=0;j<n;j++)if(alpha[j]){
  if(hard[j]===1||(hard[j]!==2&&old[j]>.75))sample(fg,j);
  else if(hard[j]===2||(old[j]<.05&&(j%gw<2||j%gw>=gw-2||j<gw*2||j>=n-gw*2)))sample(bg,j);
 }
 const palette=map=>[...map.values()].sort((a,b)=>b[3]-a[3]).slice(0,48).map(v=>v.slice(0,3).map(c=>c/v[3]));
 const f=palette(fg),b=palette(bg);
 const distance=(j,p)=>{let best=195075;for(const c of p){let d=0;for(let k=0;k<3;k++)d+=(rgb[j*3+k]-c[k])**2;if(d<best)best=d;}return best;};
 // Residual graph: terminal capacities + eight-neighbor contrast edges.
 const source=n,sink=n+1,head=new Int32Array(n+2).fill(-1),to=new Int32Array(n*14+8),next=new Int32Array(to.length),cap=new Float64Array(to.length);let used=0;
 function edge(a,b,c,d=0){to[used]=b;cap[used]=c;next[used]=head[a];head[a]=used++;to[used]=a;cap[used]=d;next[used]=head[b];head[b]=used++;}
 const sensitivity=Math.max(0,Math.min(100,Number(input.sensitivity??65))),sigma=60-sensitivity*.5,inv=1/(2*sigma*sigma),H=1e7;
 for(let j=0;j<n;j++){
  const df=distance(j,f),db=distance(j,b),den=Math.max(700,Math.min(df,db)+700);
  let costF=Math.min(30,df/den)+.9*(1-old[j]),costB=Math.min(30,db/den)+.9*old[j];
  if(hard[j]===1){costF=0;costB=H;}else if(hard[j]===2){costF=H;costB=0;}
  edge(source,j,costB);edge(j,sink,costF);
  const x=j%gw,y=Math.floor(j/gw);
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=gw||ny>=gh)continue;const q=ny*gw+nx;let d=0;
   for(let k=0;k<3;k++)d+=(rgb[j*3+k]-rgb[q*3+k])**2;
   const c=alpha[j]&&alpha[q]?6*Math.exp(-Math.pow(d*inv,.75))/Math.hypot(dx,dy):0;edge(j,q,c,c);
  }
 }
 // Iterative Dinic avoids JavaScript call-stack limits on long narrow selections.
 const levels=new Int32Array(n+2),queue=new Int32Array(n+2),ptr=new Int32Array(n+2),nodes=new Int32Array(n+2),path=new Int32Array(n+2),limit=new Float64Array(n+2),eps=1e-7;
 function bfs(){levels.fill(-1);let a=0,z=1;queue[0]=source;levels[source]=0;while(a<z){const v=queue[a++];for(let e=head[v];e!==-1;e=next[e])if(cap[e]>eps&&levels[to[e]]<0){levels[to[e]]=levels[v]+1;queue[z++]=to[e];}}return levels[sink]>=0;}
 while(bfs()){
  ptr.set(head);let depth=0;nodes[0]=source;limit[0]=H;
  while(depth>=0){
   const v=nodes[depth];if(v===sink){const flow=limit[depth];for(let i=0;i<depth;i++){const e=path[i];cap[e]-=flow;cap[e^1]+=flow;}depth=0;continue;}
   let e=ptr[v];while(e!==-1&&(cap[e]<=eps||levels[to[e]]!==levels[v]+1))e=next[e];ptr[v]=e;
   if(e===-1){levels[v]=-1;depth--;if(depth>=0)ptr[nodes[depth]]=next[path[depth]];}
   else{path[depth]=e;nodes[depth+1]=to[e];limit[depth+1]=Math.min(limit[depth],cap[e]);depth++;}
  }
 }
 // Keep only foreground connected to explicit positive input / existing selection.
 const labels=new Uint8Array(n),connected=new Uint8Array(n);let a=0,z=0;
 for(let j=0;j<n;j++)if(levels[j]>=0&&alpha[j]){labels[j]=1;if(hard[j]===1||old[j]>.5){connected[j]=1;queue[z++]=j;}}
 while(a<z){const j=queue[a++],x=j%gw,y=Math.floor(j/gw);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=gw||yy>=gh)continue;const q=yy*gw+xx;if(labels[q]&&!connected[q]){connected[q]=1;queue[z++]=q;}}}
 const runs=[];let count=0,minX=w,minY=h,maxX=0,maxY=0;
 // Edge-aware upsampling restores original-resolution boundaries. Explicit brush
 // pixels are enforced AFTER upsampling, including strokes thinner than one cell.
 for(let y=0;y<h;y++){
  let start=-1;
  for(let x=0;x<=w;x++){
   let selected=false;const p=y*w+x;
   if(x<w&&image[p*4+3]){
    if(fullHard[p])selected=fullHard[p]===1;
    else{
     const fx=(x+.5)/stride-.5,fy=(y+.5)/stride-.5,ix=Math.floor(fx),iy=Math.floor(fy),x0=Math.max(0,Math.min(gw-1,ix)),x1=Math.max(0,Math.min(gw-1,ix+1)),y0=Math.max(0,Math.min(gh-1,iy)),y1=Math.max(0,Math.min(gh-1,iy+1));let yes=0,total=0;
     const first=connected[y0*gw+x0];
     if(first===connected[y0*gw+x1]&&first===connected[y1*gw+x0]&&first===connected[y1*gw+x1])selected=!!first;
     else{for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const xx=Math.max(0,Math.min(gw-1,ix+dx)),yy=Math.max(0,Math.min(gh-1,iy+dy)),j=yy*gw+xx;let d=0;
      for(let k=0;k<3;k++)d+=(image[p*4+k]-rgb[j*3+k])**2;
      const weight=Math.max(.001,(dx?fx-ix:1-fx+ix)*(dy?fy-iy:1-fy+iy))*Math.exp(-Math.min(40,d/1800));
      total+=weight;yes+=connected[j]*weight;
     }
     selected=yes>total*.5;}
    }
   }
   if(selected){if(start<0)start=x;count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x+1);minY=Math.min(minY,y);maxY=Math.max(maxY,y+1);}
   else if(start>=0){runs.push(y*w+start,x-start);start=-1;}
  }
 }
 return {runs:new Uint32Array(runs),count,bounds:count?[minX,minY,maxX,maxY]:[0,0,0,0]};
}

function referenceSelectionRuns(mask){
 const {width:w,height:h,data}=mask,runs=[];for(let y=0;y<h;y++){let start=-1;for(let x=0;x<=w;x++){if(x<w&&data[(y*w+x)*4+3]>0){if(start<0)start=x;}else if(start>=0){runs.push(y*w+start,x-start);start=-1;}}}return new Uint32Array(runs);
}

function referenceQuickSelectionTask(input){
 let worker=null,url='',timer=0,settled=false,rejectTask;
 const cleanup=()=>{clearTimeout(timer);worker?.terminate();if(url)URL.revokeObjectURL(url);};
 const promise=new Promise((resolve,reject)=>{
  rejectTask=reject;
  try{
   url=URL.createObjectURL(new Blob(['const solve='+referenceQuickSelectionSolve.toString()+';onmessage=e=>{try{const result=solve(e.data);postMessage({result},[result.runs.buffer]);}catch(error){postMessage({error:String(error.message||error)});}}'],{type:'text/javascript'}));
   worker=new Worker(url);worker.onmessage=e=>{if(settled)return;settled=true;cleanup();e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};
   worker.onerror=e=>{if(settled)return;settled=true;cleanup();reject(Error(e.message||'快速选择计算失败'));};
   timer=setTimeout(()=>{if(settled)return;settled=true;cleanup();reject(Error('快速选择耗时过长，请缩小图片或选区后重试'));},20000);
   worker.postMessage(input,[input.image.buffer]);
  }catch(error){settled=true;cleanup();reject(Error('无法启动快速选择后台线程：'+(error.message||error)));}
 });
 return {promise,cancel(){if(settled)return;settled=true;cleanup();rejectTask(new DOMException('已取消快速选择','AbortError'));}};
}

// Circular pixel expansion of a selection, without changing the source mask.
// Exact squared Euclidean distance transform, O(width * height), no radius loops.
function referenceExpandSelection(mask,radius){
 const {width:w,height:h,data}=mask,r=Math.max(0,Math.min(64,Math.round(Number(radius)||0))),out=new Uint8ClampedArray(data);
 if(!r)return out;
 const distance=new Float32Array(w*h),inf=1e12;
 for(let x=0;x<w;x++){
  let nearest=-1e6;
  for(let y=0;y<h;y++){if(data[(y*w+x)*4+3])nearest=y;distance[y*w+x]=(y-nearest)**2;}
  nearest=1e6;
  for(let y=h-1;y>=0;y--){if(data[(y*w+x)*4+3])nearest=y;distance[y*w+x]=Math.min(distance[y*w+x],(nearest-y)**2);}
 }
 const sites=new Int32Array(w),cuts=new Float64Array(w+1),r2=r*r;
 for(let y=0;y<h;y++){
  const row=y*w;let k=0;sites[0]=0;cuts[0]=-inf;cuts[1]=inf;
  for(let x=1;x<w;x++){
   let cut=((distance[row+x]+x*x)-(distance[row+sites[k]]+sites[k]*sites[k]))/(2*(x-sites[k]));
   while(k>0&&cut<=cuts[k]){k--;cut=((distance[row+x]+x*x)-(distance[row+sites[k]]+sites[k]*sites[k]))/(2*(x-sites[k]));}
   k++;sites[k]=x;cuts[k]=cut;cuts[k+1]=inf;
  }
  k=0;
  for(let x=0;x<w;x++){while(cuts[k+1]<x)k++;if((x-sites[k])**2+distance[row+sites[k]]<=r2){const p=(row+x)*4;out[p]=out[p+1]=out[p+2]=out[p+3]=255;}}
 }
 return out;
}

// PhotoCraft ants.rs browser port (MIT), ArtCraft Team and contributors, 2026.
// Pinned source and full license: docs/third-party/photocraft-ants/.
function referenceAntsStyle(ppp,time){
 ppp=Number.isFinite(ppp)&&ppp>0?ppp:1;
 const width=Math.max(1,Math.min(8,Math.ceil(ppp-.01))),dash=4*width;
 return {ppp,width,dash,phase:Math.floor(((Number.isFinite(time)?Math.max(0,time):0)*10*width)%(2*dash))};
}
function referencePaintAnts(ctx,lines,clip,style,snapSlanted=true){
 const {ppp,width:w,dash,phase}=style,half=Math.floor(w/2),period=2*dash,mod=v=>((v%period)+period)%period;
 const vx0=Math.floor(clip[0]*ppp-2*dash),vy0=Math.floor(clip[1]*ppp-2*dash),vx1=Math.ceil(clip[2]*ppp+2*dash),vy1=Math.ceil(clip[3]*ppp+2*dash);
 const quad=(x0,y0,x1,y1,color)=>{ctx.fillStyle=color;ctx.fillRect(x0,y0,x1-x0,y1-y0);};
 const runs=(lo,hi,off,paint)=>{for(let s=lo-mod(lo+off+phase);s<hi;s+=period){const a=Math.max(lo,s),b=Math.min(hi,s+dash);if(b>a)paint(a,b);}};
 for(const [px,py,qx,qy] of lines){
  if(![px,py,qx,qy].every(Number.isFinite)||Math.max(px,qx)<clip[0]-1||Math.min(px,qx)>clip[2]+1||Math.max(py,qy)<clip[1]-1||Math.min(py,qy)>clip[3]+1)continue;
  const ax=Math.round(px*ppp),ay=Math.round(py*ppp),bx=Math.round(qx*ppp),by=Math.round(qy*ppp);if(ax===bx&&ay===by)continue;
  if(ay===by){const x0=Math.max(Math.min(ax,bx)-half,vx0),x1=Math.min(Math.max(ax,bx)-half+w,vx1),y0=ay-half;if(x1<=x0)continue;
   quad(x0,y0,x1,y0+w,'#fff');for(let y=y0;y<y0+w;y++)runs(x0,x1,w*y,(s,e)=>quad(s,y,e,y+1,'#000'));
  }else if(ax===bx){const y0=Math.max(Math.min(ay,by)-half,vy0),y1=Math.min(Math.max(ay,by)-half+w,vy1),x0=ax-half;if(y1<=y0)continue;
   quad(x0,y0,x0+w,y1,'#fff');for(let x=x0;x<x0+w;x++)runs(y0,y1,w*x,(s,e)=>quad(x,s,x+1,e,'#000'));
  }else{
   const centre=w/2-half,x0=snapSlanted?ax+centre:px*ppp,y0=snapSlanted?ay+centre:py*ppp,x1=snapSlanted?bx+centre:qx*ppp,y1=snapSlanted?by+centre:qy*ppp,len=Math.hypot(x1-x0,y1-y0);if(!len)continue;
   const dx=(x1-x0)/len,dy=(y1-y0)/len;
   const line=(a,b,color)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x0+dx*a,y0+dy*a);ctx.lineTo(x0+dx*b,y0+dy*b);ctx.stroke();};
   line(0,len,'#fff');for(let t=-mod(Math.floor(x0)+Math.floor(y0)+phase);t<len;t+=period){const s=Math.max(t,0),e=Math.min(t+dash,len);if(e>s)line(s,e,'#000');}
  }
 }
}
// Host adapter: image-space mask boundaries → screen points → device pixels.
// The overlay is a sibling of the scaled image, never part of its pixel texture.
function referenceAntsSegments(path){
 const lines=[];for(const m of path.matchAll(/M(-?[\d.]+) (-?[\d.]+)([HV])(-?[\d.]+)/g)){const x=Number(m[1]),y=Number(m[2]),v=Number(m[4]);lines.push([x,y,m[3]==='H'?v:x,m[3]==='V'?v:y]);}return lines;
}
function EditorSelectionAnts({outline='',points=null,pan,scale}){
 const canvas=React.useRef(null),lines=referenceAntsSegments(outline);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const [x,y,a,b] of lines){x0=Math.min(x0,x,a);y0=Math.min(y0,y,b);x1=Math.max(x1,x,a);y1=Math.max(y1,y,b);}
 const bounds=lines.length?{x:x0,y:y0,width:x1-x0,height:y1-y0}:{x:0,y:0,width:0,height:0};
 React.useEffect(()=>{
  const el=canvas.current,host=el?.parentElement;if(!host)return;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const map=line=>line.map((v,i)=>v*scale+(i%2?pan.y:pan.x));
  const traced=lines.map(map),live=[];
  if(points?.length>=2){for(let i=1;i<points.length;i++)live.push(map([points[i-1].x,points[i-1].y,points[i].x,points[i].y]));if(points.length>=3)live.push(map([points[points.length-1].x,points[points.length-1].y,points[0].x,points[0].y]));}
  const draw=()=>{const rect=host.getBoundingClientRect(),ppp=window.devicePixelRatio||1,w=Math.ceil(rect.width*ppp),h=Math.ceil(rect.height*ppp);if(el.width!==w||el.height!==h){el.width=w;el.height=h;}
   const ctx=el.getContext('2d');ctx.clearRect(0,0,w,h);const style=referenceAntsStyle(ppp,reduced?0:performance.now()/1000);el.dataset.deviceLineWidth=style.width;
   referencePaintAnts(ctx,traced,[0,0,rect.width,rect.height],style,true);referencePaintAnts(ctx,live,[0,0,rect.width,rect.height],style,false);
  };
  draw();const timer=reduced?0:setInterval(draw,100),observer=typeof ResizeObserver==='function'?new ResizeObserver(draw):null;observer?.observe(host);window.addEventListener('resize',draw);
  return()=>{if(timer)clearInterval(timer);observer?.disconnect();window.removeEventListener('resize',draw);};
 },[outline,points?.length,pan.x,pan.y,scale]);
 return h('canvas',{ref:canvas,className:'cc-selection-screen-ants','aria-hidden':true,'data-live-selection':points?.length>=2?'true':undefined,'data-selection-path':outline,'data-selection-bounds':JSON.stringify(bounds),style:{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:2,imageRendering:'auto'}});
}
