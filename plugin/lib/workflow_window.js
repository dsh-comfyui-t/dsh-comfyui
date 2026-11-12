/** Native Electron workflow editor, with visible startup and operation errors. */
async function mountWorkflowEditor(root){
 const fallback={'--cc-bg':'#202124','--cc-surface':'#292a2d','--cc-control':'#303134','--cc-text':'#e8eaed','--cc-muted':'#bdc1c6','--cc-border':'#5f6368','--cc-accent':'#8ab4f8','--cc-hover':'#3c4043','--cc-accent-bg':'#394457','--cc-accent-text':'#d2e3fc','--cc-bad':'#f28b82','--cc-warn':'#fdd663','--cc-ok':'#81c995','--cc-scheme':'dark'};
 const style=document.createElement('style');style.textContent=UI_CSS;document.head.appendChild(style);
 function NativeWorkflowWindow(){
  const [data,setData]=React.useState(null),[error,setError]=useErrorState(''),[epoch,setEpoch]=React.useState(0);
  const channel=location.hash.slice(1),sessionTheme=data?.session.theme||{},accentKeys=['--cc-accent','--cc-accent-bg'],theme={...fallback,...Object.fromEntries(accentKeys.filter(k=>sessionTheme[k]).map(k=>[k,sessionTheme[k]]))};
  React.useEffect(()=>{
   const ctl=new AbortController();setError('');window.dshWorkflowBoot?.stage('正在读取编辑会话…');
   (async()=>{
    try{
     if(!/^[a-f0-9-]{32,80}$/.test(channel))throw Error('编辑会话无效，请从绘图台重新打开');
     const session=await jget('/workflow/session/'+channel,10000,ctl.signal);
     window.dshWorkflowBoot?.theme(session.theme);
     window.dshWorkflowBoot?.stage('正在连接 ComfyUI…');
     await requireComfyOnline('编辑自定义工作流',ctl.signal);
     window.dshWorkflowBoot?.stage('正在读取 ComfyUI 节点…');
     const info=await jget(COMFY+'/object_info',30000,ctl.signal);
     if(!ctl.signal.aborted){window.dshWorkflowBoot?.stage('正在准备节点画布…');setData({session,info});}
    }catch(e){if(!ctl.signal.aborted){const message='工作流编辑器加载失败：'+errText(e);setError(message);window.dshWorkflowBoot?.error(message);}}
   })();return()=>ctl.abort();
  },[channel,epoch]);
  const close=()=>{if(window.pywebview?.api)window.pywebview.api.close();else window.close();};
  return h(React.Fragment,null,h(ErrorNoticeViewport,{theme}),data?h(NativeComfyWorkflowEditor,{native:true,session:channel,workflow:data.session.workflow,info:data.info,theme,onSave:()=>{},onClose:close,onReady:()=>window.dshWorkflowBoot?.ready(),onFailure:e=>window.dshWorkflowBoot?.error('工作流画布加载失败：'+errText(e))}):h('main',{className:'dsh-comfy-floating cc-native-workflow',style:theme},h('p',{role:error?'alert':'status'},error||'正在读取编辑会话和 ComfyUI 节点…'),error?h('button',{type:'button',style:S.btn2,onClick:()=>setEpoch(v=>v+1)},'重试'):null));
 }
 require('react-dom').createRoot(root).render(h(NativeWorkflowWindow));
}
