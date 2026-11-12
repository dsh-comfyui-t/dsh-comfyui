/** One local progress connection shared by the status bar and open task details. */
export const RUNTIME_FEED={
 value:{connected:false,data:null},listeners:new Set(),source:null,timer:null,controller:null,generation:0,
 emit(){for(const fn of this.listeners)fn(this.value);},
 subscribe(fn){this.listeners.add(fn);if(this.listeners.size===1)this.start();return()=>{this.listeners.delete(fn);if(!this.listeners.size)this.stop();};},
 accept(data){
  if(!data||data.version!==1||!Array.isArray(data.jobs))return;
  if(INSTALLED_INSTANCE_ID&&data.instanceId!==INSTALLED_INSTANCE_ID)return;
  this.value={connected:true,data,receivedAt:Date.now()};this.emit();
 },
 async start(){
  const generation=++this.generation;this.controller=new AbortController();
  const poll=async()=>{
   try{const data=await jget(EXPANDER+'/runtime/status',5000,this.controller?.signal);if(this.generation===generation)this.accept(data);}
   catch(e){if(this.generation===generation){this.value={...this.value,connected:false};this.emit();}}
   if(this.generation===generation)this.timer=setTimeout(poll,1500);
  };
  try{
   await requireSidecarFeature('runtimeMonitorVersion',1,'资源占用与生成进度');if(this.generation!==generation)return;
   if(typeof EventSource==='function'){
    this.source=new EventSource(EXPANDER+'/runtime/events');
    this.source.onmessage=event=>{if(this.generation!==generation)return;try{this.accept(JSON.parse(event.data));}catch{}};
    this.source.onerror=()=>{if(this.generation!==generation)return;this.value={...this.value,connected:false};this.emit();};
   }else poll();
  }catch(e){if(this.generation===generation){this.value={...this.value,connected:false};this.emit();this.timer=setTimeout(()=>this.start(),4000);}}
 },
 stop(){this.generation++;clearTimeout(this.timer);this.timer=null;this.controller?.abort();this.source?.close();this.source=null;}
};
export function useRuntimeSnapshot(){
 const [state,setState]=React.useState(RUNTIME_FEED.value);
 React.useEffect(()=>RUNTIME_FEED.subscribe(setState),[]);return state;
}
export function runtimeBytes(value){if(!Number.isFinite(value)||value<0)return '—';const gb=value/1073741824;return gb>=1?gb.toFixed(gb>=100?0:1)+' GB':Math.round(value/1048576)+' MB';}
export function runtimePercent(value){return typeof value==='number'&&Number.isFinite(value)?Math.round(Math.max(0,Math.min(100,value)))+'%':'—';}
export function runtimePhase(type,label){
 const value=String(type||label||'');
 if(/sampl|detailer/i.test(value))return '采样中';
 if(/loader|load.*model/i.test(value))return '加载模型';
 if(/vae.*decode|decode/i.test(value))return '解码图像';
 if(/textencode|encode.*text|cliptext/i.test(value))return '编码提示词';
 if(/vae.*encode/i.test(value))return '编码图像';
 if(/upscale|scale.*image/i.test(value))return '放大图像';
 if(/preview|saveimage|dshpoststage/i.test(value))return '整理输出';
 return label?'处理节点':'准备工作流';
}
export function taskRuntimeView(task,feed){
 const row=feed?.jobs?.find(item=>item.promptId===task?.pid),active=['running','queued','submitting'].includes(task?.status);
 const finished=task?.status==='done',status=active&&row?.state==='running'?'running':task?.status;
 const value=active&&row?row.value:task?.progressValue,max=active&&row?row.max:task?.progressMax;
 const determinate=active&&typeof value==='number'&&Number.isFinite(value)&&typeof max==='number'&&Number.isFinite(max)&&max>0;
 const percent=determinate?Math.max(0,Math.min(100,value/max*100)):null;
 const nodeLabel=row?.nodeLabel||'',phase=row?.state==='error'?'执行失败，正在读取详情':row?.state==='cancelled'?'任务已取消':row?.state==='finishing'||row?.state==='finished'?'整理结果':runtimePhase(row?.nodeType,nodeLabel);
 return {status,row,phase,nodeLabel,value:determinate?value:null,max:determinate?max:null,percent,
  overall:finished?1:active&&typeof row?.overall==='number'?Math.max(0,Math.min(.99,row.overall)):null,
  completed:row?.completedNodes||0,total:row?.totalNodes||0,
  stale:!!row&&Date.now()-row.updatedAt>12000&&!feed?.progressConnected};
}
export function runtimeTaskOrder(jobs,feed){
 const rank={running:0,submitting:1,saving:2,queued:3};
 return (jobs||[]).filter(job=>Object.prototype.hasOwnProperty.call(rank,job.status)).slice().sort((a,b)=>{
  const av=taskRuntimeView(a,feed),bv=taskRuntimeView(b,feed);
  return (rank[av.status]??9)-(rank[bv.status]??9)||(a.queuePosition||999)-(b.queuePosition||999)||(a.submittedAt||0)-(b.submittedAt||0);
 });
}
export function RuntimeProgress({task,data,compact=false}){
 const view=taskRuntimeView(task,data),active=['running','queued','submitting','saving'].includes(view.status);
 if(!active)return null;
 if(view.status==='queued')return h('span',{className:'cc-runtime-subtle'},'排队'+(task.queuePosition?' · 第 '+task.queuePosition+' 个':''));
 if(view.status==='submitting')return h('span',{className:'cc-runtime-subtle'},'正在提交任务…');
 if(view.status==='saving')return h('span',{className:'cc-runtime-subtle'},'正在保存结果…');
 const message=view.stale?'进度连接中，保留上次数据':view.percent!==null?view.phase:!data?.progressConnected?(data?.progressMessage||'正在连接进度服务'):view.phase;
 if(compact)return h('div',{className:'cc-runtime-progress','data-compact':true},
  h('span',{className:'cc-runtime-compact-phase'},message),
  view.percent!==null?h(React.Fragment,null,
   h('span',{className:'cc-runtime-progress-numbers'},view.value+' / '+view.max,h('strong',null,runtimePercent(view.percent))),
   h('span',{className:'cc-runtime-track',role:'progressbar','aria-label':'当前节点进度','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.round(view.percent)},h('span',{style:{width:view.percent+'%'}}))):null);
 return h('div',{className:'cc-runtime-progress','data-compact':compact},
  h('div',{className:'cc-runtime-progress-line'},h('span',{'data-cc-tooltip':view.nodeLabel?view.nodeLabel+(view.row?.nodeId?' · 节点 '+view.row.nodeId:''):undefined},message),
   view.percent!==null?h('span',{className:'cc-runtime-progress-numbers'},view.value+' / '+view.max,h('strong',null,runtimePercent(view.percent))):null),
  view.percent!==null?h('div',{className:'cc-runtime-track',role:'progressbar','aria-label':'当前节点进度','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.round(view.percent)},h('span',{style:{width:view.percent+'%'}})):null,
  view.overall!==null&&view.total?h('div',{className:'cc-runtime-overall','data-cc-tooltip':'按工作流节点统计；不是耗时百分比或剩余时间估计'},
   h('span',null,'流程 '+view.completed+' / '+view.total+' 节点'),h('div',{className:'cc-runtime-track cc-runtime-track--workflow',role:'progressbar','aria-label':'工作流节点进度','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.round(view.overall*100)},h('span',{style:{width:view.overall*100+'%'}}))):null);
}
export function RuntimeTaskProgress({task}){const state=useRuntimeSnapshot();return h(RuntimeProgress,{task,data:state.data});}

// Non-modal anchored task list: it never installs a backdrop or locks page scrolling.
function runtimePopoverPlacement(anchor){
 const rect=anchor?.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight;
 if(!rect)return {top:8,left:8,width:Math.min(560,vw-16),maxHeight:Math.max(80,vh-16)};
 const width=Math.min(rect.width,vw-16),below=vh-rect.bottom-14,above=rect.top-14;
 const flip=below<180&&above>below,maxHeight=Math.max(80,Math.min(460,flip?above:below));
 return {left:Math.max(8,Math.min(rect.left,vw-width-8)),top:flip?Math.max(8,rect.top-maxHeight-6):Math.min(vh-maxHeight-8,rect.bottom+6),width,maxHeight};
}
function RuntimeTaskPopover({anchor,theme,onClose,onClear,clearing,canClear,children}){
 const panel=React.useRef(null),closeRef=React.useRef(onClose);closeRef.current=onClose;
 const [position,setPosition]=React.useState(()=>runtimePopoverPlacement(anchor.current));
 function dismiss(restore){closeRef.current();if(restore)anchor.current?.focus();}
 React.useEffect(()=>{
  const reposition=()=>{const rect=anchor.current?.getBoundingClientRect();if(!rect||rect.bottom<0||rect.top>window.innerHeight){dismiss(false);return;}setPosition(runtimePopoverPlacement(anchor.current));};
  const inside=target=>panel.current?.contains(target)||anchor.current?.contains(target);
  const outside=event=>{if(!inside(event.target))dismiss(false);};
  const keys=event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();event.stopPropagation();dismiss(true);}};
  reposition();panel.current?.focus();
  document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',outside,true);document.addEventListener('keydown',keys,true);
  window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(reposition):null;if(anchor.current)resize?.observe(anchor.current);
  return()=>{resize?.disconnect();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside,true);document.removeEventListener('keydown',keys,true);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);};
 },[]);
 return floating(h('section',{ref:panel,role:'dialog','aria-label':'生成任务','aria-modal':false,tabIndex:-1,className:'dsh-comfy-floating cc-runtime-popover',style:{...theme,...position,position:'fixed',zIndex:2147480500}},
  h('div',{className:'cc-runtime-popover-head'},h('strong',null,'生成任务'),h('button',{type:'button',className:'cc-runtime-cancel cc-runtime-clear','aria-label':'清除任务队列','data-cc-tooltip':'清除任务队列（仅排队任务）','aria-busy':clearing,disabled:clearing||!canClear,onClick:onClear},h(PromptIcon,{name:'trash',size:16}))),
  h('div',{className:'cc-runtime-popover-body'},children)));
}

export function RuntimeDashboard({jobs,theme,onOpenTask,online,onReleaseMemory}){
 const state=useRuntimeSnapshot(),data=state.data,resources=data?.resources||{};
 const [tasksOpen,setTasksOpen]=React.useState(false),[releasing,setReleasing]=React.useState(false),[clearing,setClearing]=React.useState(false);
 const taskAnchor=React.useRef(null),releaseLock=React.useRef(false);
 async function releaseMemory(){
  if(!online||releaseLock.current||!onReleaseMemory)return;
  releaseLock.current=true;setReleasing(true);
  try{await onReleaseMemory();}finally{releaseLock.current=false;setReleasing(false);}
 }
 async function clearQueue(){if(clearing||!online)return;setClearing(true);try{await BG.clearQueue();}finally{setClearing(false);}}
 const active=runtimeTaskOrder(jobs,data),current=active[0],queued=active.filter(job=>taskRuntimeView(job,data).status==='queued').length;
 const recent=(jobs||[]).filter(job=>!['running','queued','submitting','saving'].includes(job.status)).slice(0,12);
 const gpu=(resources.devices||[]).find(device=>device.total>0),cpu=resources.cpu||{},memory=resources.memory||{};
 const gpuValue=gpu?runtimeBytes(gpu.used)+' / '+runtimeBytes(gpu.total):!data?'—':!data.comfyOnline?'未连接':(resources.devices||[]).some(device=>device.scope==='shared')?'共享内存':'不可用';
 const stale=!state.connected||Date.now()-(state.receivedAt||0)>10000;
 function metric(label,value,percent){
  return h('span',{className:'cc-runtime-metric','data-level':percent>=95?'high':percent>=85?'warn':'normal'},
   h('span',{className:'cc-runtime-metric-line'},h('span',{className:'cc-runtime-metric-label'},label),h('span',{className:'cc-runtime-metric-value'},h('strong',null,value))),
   h('span',{className:'cc-runtime-track'},h('span',{style:{width:typeof percent==='number'?Math.max(0,Math.min(100,percent))+'%':'0%'}})));
 }
 function taskRow(job){
  const view=taskRuntimeView(job,data),running=view.status==='running',label=job.cancelling?'正在取消':{running:'正在生成',queued:'排队中',submitting:'提交中',saving:'保存中',done:'已完成',error:'失败',cancelled:'已取消','save-error':'保存失败'}[view.status]||view.status;
  const duration=job.generationMs?formatGenerationDuration(job):job.startedAt?Math.max(0,Math.floor((Date.now()-job.startedAt)/1000))+'s':null;
  return h('div',{key:job.localId||job.pid,className:'cc-runtime-task-row','data-status':view.status},
   h('button',{type:'button',className:'cc-runtime-task-detail',onClick:()=>{setTasksOpen(false);onOpenTask(job);}},
    h('div',{className:'cc-runtime-task-line'},h('span',{className:'cc-runtime-task-label'},h('i',{'aria-hidden':'true'}),label),h('strong',null,job.params?.prefix||'生成任务'),duration?h('span',{className:'cc-runtime-subtle'},duration):null),
    h('div',{className:'cc-runtime-task-meta'},job.params?.w?job.params.w+' × '+job.params.h:null,job.params?.steps?' · '+job.params.steps+' 步':null,job.pid?' · '+job.pid.slice(0,8):null),
    running||view.status==='queued'||view.status==='saving'?h(RuntimeProgress,{task:job,data}):job.message?h('span',{className:'cc-runtime-subtle'},job.message):null),
   ['running','queued'].includes(job.status)?h('button',{type:'button',className:'cc-runtime-cancel','aria-label':'取消任务 '+(job.pid||job.localId),'data-cc-tooltip':job.cancelling?'正在取消…':'取消此任务','aria-busy':!!job.cancelling,disabled:!!job.cancelling,onClick:e=>{e.stopPropagation();BG.cancel(job.pid||job.localId);}},h(PromptIcon,{name:'x',size:16})):null);
 }
 return h('div',{className:'cc-workbench-status'},
  h('div',{className:'cc-runtime-strip'},
   h('div',{className:'cc-runtime-resource-group'},
   h('div',{className:'cc-runtime-resources','data-stale':stale,role:'group','aria-label':'资源占用'},
    metric('CPU',runtimePercent(cpu.percent),cpu.percent),
    metric('内存',memory.total?runtimeBytes(memory.used)+' / '+runtimeBytes(memory.total):'—',memory.percent),
    metric('显存',gpuValue,gpu?.percent)),
   h('button',{type:'button',className:'cc-runtime-release','aria-label':releasing?'正在释放显存':'释放显存','data-cc-tooltip':'点击释放显存','aria-busy':releasing,disabled:!online||releasing,onClick:releaseMemory},h(PromptIcon,{name:releasing?'spinner':'broom',size:16}))),
   h('button',{ref:taskAnchor,type:'button',className:'cc-runtime-current','aria-label':'查看生成任务列表','aria-haspopup':'dialog','aria-expanded':tasksOpen,onClick:()=>setTasksOpen(value=>!value)},
    h('div',{className:'cc-runtime-task-line'},h('strong',null,current?taskRuntimeView(current,data).status==='running'?'当前任务':'生成任务':'暂无生图任务'),
     h('span',{className:'cc-runtime-count','aria-label':'进行中与排队任务共 '+active.length+' 个'},active.length),
     current?.startedAt?h('span',{className:'cc-runtime-subtle'},Math.max(0,Math.floor((Date.now()-current.startedAt)/1000))+'s'):null,
     !current&&data?.queueRunning?h('span',{className:'cc-runtime-subtle'},'ComfyUI 正在执行其他客户端任务'):null,
     h(PromptIcon,{name:'chevronDown',size:13})),
    current?h(RuntimeProgress,{task:current,data,compact:true}):stale?h('span',{className:'cc-runtime-subtle'},'正在连接…'):null)),
  tasksOpen?h(RuntimeTaskPopover,{anchor:taskAnchor,theme,onClose:()=>setTasksOpen(false),onClear:clearQueue,clearing,canClear:online&&Math.max(queued,Number(data?.queuePending)||0)>0},
   h('div',{className:'cc-runtime-list-head'},h('strong',null,'进行中'),h('span',null,active.length+' 个任务'+(queued?' · '+queued+' 个排队':''))),
   active.length?active.map(taskRow):h('p',{className:'cc-runtime-subtle'},'当前没有正在生成或排队的任务。'),
   recent.length?h('div',{className:'cc-runtime-recent'},h('strong',null,'最近任务'),recent.map(taskRow)):null,
   ):null);

}

export const RUNTIME_STATUS_CSS=`
.dsh-comfy-ui .cc-workbench-status{container-type:inline-size;width:100%;min-width:0;margin-block:calc(-1 * var(--cc-ui-space-sm))}
.dsh-comfy-ui .cc-runtime-resource-group{display:flex;gap:8px;align-items:stretch;min-width:0}
.dsh-comfy-ui .cc-runtime-resource-group>.cc-runtime-resources{flex:1;min-width:0}
.dsh-comfy-ui .cc-runtime-strip{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0;margin:0;container-type:inline-size}
.dsh-comfy-ui .cc-runtime-resources,.dsh-comfy-ui .cc-runtime-current{border:var(--cc-ui-border-width) solid var(--cc-border);border-radius:var(--cc-ui-radius-control);background:var(--cc-surface);color:var(--cc-text);font:inherit;text-align:left;min-width:0;padding:4px 8px}
.dsh-comfy-ui .cc-runtime-resources{display:grid;grid-template-columns:minmax(0,.65fr) minmax(0,1.2fr) minmax(0,1.2fr);gap:12px;align-items:center;cursor:default}
.dsh-comfy-ui .cc-runtime-resources[data-stale="true"]{opacity:.6}
.dsh-comfy-ui .cc-runtime-metric{display:flex;flex-direction:column;gap:3px;min-width:0;--cc-runtime-meter:var(--cc-accent)}
.dsh-comfy-ui .cc-runtime-metric[data-level="warn"]{--cc-runtime-meter:var(--cc-warn)}.dsh-comfy-ui .cc-runtime-metric[data-level="high"]{--cc-runtime-meter:var(--cc-bad)}
.dsh-comfy-ui .cc-runtime-metric-line{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11px;white-space:nowrap;min-width:0;min-height:20px}.dsh-comfy-ui .cc-runtime-metric-line>span{color:var(--cc-muted)}.dsh-comfy-ui .cc-runtime-metric-line strong{font-size:12px;font-weight:var(--cc-ui-weight-label)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-track{display:block;position:relative;height:4px;min-width:0;overflow:hidden;border-radius:20px;background:var(--cc-border)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-track>span{display:block;height:100%;background:var(--cc-runtime-meter,var(--cc-accent));border-radius:inherit;transition:width .12s linear}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-subtle{font-size:11px;line-height:1.5;color:var(--cc-muted);overflow-wrap:anywhere}
.dsh-comfy-ui .cc-runtime-current{display:flex;align-items:center;gap:10px;min-height:34px;cursor:pointer}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-task-line{display:flex;gap:8px;align-items:center;min-width:0;font-size:12px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-task-line>strong{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-ui .cc-runtime-count{font-size:18px;font-weight:700;line-height:1;min-width:1ch;color:var(--cc-accent);font-variant-numeric:tabular-nums}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-progress{display:flex;flex-direction:column;gap:5px;min-width:0}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-progress-line{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;min-width:0;color:var(--cc-muted)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-progress-numbers{display:flex;gap:10px;white-space:nowrap;font-variant-numeric:tabular-nums}.cc-runtime-progress-numbers strong{color:var(--cc-text)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-runtime-overall{display:flex;align-items:center;gap:9px;color:var(--cc-muted);font-size:10px}.cc-runtime-overall>span{white-space:nowrap}.cc-runtime-overall>.cc-runtime-track{flex:1;height:2px;opacity:.65}
.dsh-comfy-floating .cc-runtime-list-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-runtime-task-row{display:flex;align-items:center;gap:9px;padding:12px 0;border-bottom:var(--cc-ui-border-width) solid var(--cc-border)}
.dsh-comfy-floating .cc-runtime-task-detail{display:flex;flex-direction:column;gap:8px;flex:1;min-width:0;padding:0;border:0;background:transparent!important;color:var(--cc-text);font:inherit;text-align:left;cursor:pointer}
.dsh-comfy-floating .cc-runtime-task-meta{color:var(--cc-muted);font-size:11px}
.dsh-comfy-floating .cc-runtime-task-label{display:flex;align-items:center;gap:6px;font-size:11px;white-space:nowrap;color:var(--cc-muted)}
.dsh-comfy-floating .cc-runtime-task-label i{width:6px;height:6px;border-radius:50%;background:var(--cc-muted)}
.dsh-comfy-floating .cc-runtime-task-row[data-status="running"] .cc-runtime-task-label i{background:var(--cc-accent)}
.dsh-comfy-floating .cc-runtime-task-row[data-status="done"] .cc-runtime-task-label i{background:var(--cc-ok)}
.dsh-comfy-floating .cc-runtime-task-row:is([data-status="error"],[data-status="save-error"]) .cc-runtime-task-label i{background:var(--cc-bad)}
.dsh-comfy-floating .cc-runtime-cancel{width:30px;height:30px;display:grid;place-items:center;border:var(--cc-ui-border-width) solid var(--cc-border);border-radius:var(--cc-ui-radius-control);background:var(--cc-control);color:var(--cc-muted);cursor:pointer;padding:0}
.dsh-comfy-floating .cc-runtime-recent{display:flex;flex-direction:column;gap:5px;padding-top:10px}.dsh-comfy-floating .cc-runtime-recent>strong{font-size:12px;color:var(--cc-muted)}
/* Compact strip shares the same tokens as its task popover. */
.dsh-comfy-ui .cc-runtime-metric-line>.cc-runtime-metric-value{display:inline-flex;align-items:center;gap:4px;min-width:0;margin-left:auto;color:var(--cc-text)}
.dsh-comfy-ui .cc-runtime-metric-label{display:inline-flex;align-items:center;gap:3px}
.dsh-comfy-ui .cc-runtime-release{display:inline-grid;place-items:center;flex:none;width:34px;min-height:34px;padding:0;border:var(--cc-ui-border-width) solid var(--cc-border);border-radius:var(--cc-ui-radius-control);background:var(--cc-control);color:var(--cc-muted);cursor:pointer}
.dsh-comfy-ui .cc-runtime-release:enabled:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-ui .cc-runtime-release:focus-visible{outline:2px solid var(--cc-accent);outline-offset:1px}
.dsh-comfy-ui .cc-runtime-release[aria-busy="true"] svg{animation:cc-spin 1s linear infinite;transform-origin:center}
.dsh-comfy-ui .cc-runtime-resources>.cc-runtime-metric>.cc-runtime-track{height:2px}
.dsh-comfy-ui .cc-runtime-current>.cc-runtime-task-line{flex:none}
.dsh-comfy-ui .cc-runtime-current>.cc-runtime-task-line:only-child{flex:1}
.dsh-comfy-ui .cc-runtime-progress[data-compact="true"]{flex:1;flex-direction:row;align-items:center;gap:8px}
.dsh-comfy-ui .cc-runtime-progress[data-compact="true"]>.cc-runtime-track{flex:1;min-width:32px;height:3px}
.dsh-comfy-ui .cc-runtime-compact-phase{font-size:11px;color:var(--cc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:180px}
.dsh-comfy-floating.cc-runtime-popover{display:flex;flex-direction:column;padding:10px;border:var(--cc-ui-border-width) solid var(--cc-border);border-radius:var(--cc-ui-radius-panel);background:var(--cc-surface);color:var(--cc-text);box-shadow:0 8px 24px #0003;outline:none;box-sizing:border-box}
.dsh-comfy-floating .cc-runtime-popover-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 0 7px;font-size:12px;flex:none}
.dsh-comfy-floating .cc-runtime-popover-body{overflow:auto;overscroll-behavior:contain;min-height:0}
.dsh-comfy-floating .cc-runtime-popover-body{scrollbar-width:none}
.dsh-comfy-floating .cc-runtime-popover-body::-webkit-scrollbar{display:none;width:0;height:0}
.dsh-comfy-floating .cc-runtime-clear{margin-right:4px}
.dsh-comfy-floating .cc-runtime-cancel:enabled:is(:hover,:focus-visible){--cc-button-hover:color-mix(in srgb,var(--cc-bad) 16%,var(--cc-control));--cc-button-border:var(--cc-bad);color:var(--cc-bad)!important;background:var(--cc-button-hover)!important}
.dsh-comfy-floating .cc-runtime-cancel:disabled{opacity:.4;cursor:default}
.dsh-comfy-floating .cc-runtime-task-row{padding:9px 0}
.dsh-comfy-floating .cc-runtime-task-detail{gap:5px}
@container(max-width:740px){.dsh-comfy-ui .cc-runtime-strip{grid-template-columns:minmax(0,1fr);gap:4px}}
@media(max-width:850px){.dsh-comfy-ui .cc-runtime-strip{grid-template-columns:minmax(0,1fr);gap:4px}}
@media(max-width:480px){.dsh-comfy-ui .cc-runtime-resources{grid-template-columns:minmax(0,.65fr) minmax(0,1fr) minmax(0,1.1fr);gap:8px}.dsh-comfy-ui .cc-runtime-metric-line{flex-wrap:wrap;gap:0 4px;font-size:10px}.dsh-comfy-ui .cc-runtime-metric-line strong{font-size:10px}.dsh-comfy-ui .cc-runtime-progress[data-compact="true"]{gap:5px;flex-wrap:wrap}.dsh-comfy-ui .cc-runtime-compact-phase{max-width:100px}.dsh-comfy-ui .cc-runtime-current{gap:7px}}
@media(prefers-reduced-motion:reduce){.dsh-comfy-ui .cc-runtime-release[aria-busy="true"] svg{animation:none}}
`;
