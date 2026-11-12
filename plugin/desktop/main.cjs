const {app,BrowserWindow,ipcMain,dialog,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseOptions,revealWindow,allowedFrame}=require('./policy.cjs');
const args=parseOptions(process.argv.slice(1));
if(!args){console.error('Invalid DSH editor launch arguments');app.exit(2);}else{
 const key=crypto.createHash('sha256').update(args.workerKey).digest('hex').slice(0,24);
 app.setName('DSH Editor');app.setPath('userData',path.join(app.getPath('appData'),'DSHComfyUI','windows',key));
 if(!app.requestSingleInstanceLock()){app.quit();}else{
  let win,dirty=false,sceneReady=false,allowClose=false,pendingClose=false,shown=false;
  let sequence=0;const journal=[];
  const emit=(type,message)=>{
   const item={pid:Number(process.env.DSH_EDITOR_OWNER_PID),seq:++sequence,type,message};journal.push(item);if(journal.length>32)journal.shift();
   const target=process.env.DSH_EDITOR_EVENT_PATH;
   if(target&&path.isAbsolute(target)&&path.basename(target)===args.workerKey+'.events.json'){
    try{const temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(journal),{mode:0o600});fs.renameSync(temp,target);}catch(error){console.error(error.message);}
   }
  };
  let activationTimers=[];
  const reveal=()=>{
   activationTimers.forEach(clearTimeout);activationTimers=[];
   if(!win||win.isDestroyed())return;
   revealWindow(win,app);shown=true;
   // Retry only during this explicit open/activate request; never run a
   // permanent focus loop that prevents switching to another application.
   if(process.platform==='win32'&&!win.isFocused())for(const delay of [120,400,900])activationTimers.push(setTimeout(()=>{if(win&&!win.isDestroyed()&&(win.isMinimized()||!win.isFocused()))revealWindow(win,app);},delay));
  };
  app.on('second-instance',reveal);app.on('activate',reveal);
  const control=process.env.DSH_EDITOR_CONTROL_PATH,owner=Number(process.env.DSH_EDITOR_OWNER_PID);
  let lastFocus='';
  const focusTimer=setInterval(()=>{
   if(!control||!path.isAbsolute(control)||path.basename(control)!==args.workerKey+'.focus.json')return;
   try{const command=JSON.parse(fs.readFileSync(control,'utf8'));
    if(command.pid===owner&&command.op==='focus'&&/^[a-f0-9]{32}$/.test(command.nonce)&&command.nonce!==lastFocus){lastFocus=command.nonce;reveal();}
   }catch{}
  },250);
  app.on('will-quit',()=>clearInterval(focusTimer));

  app.whenReady().then(()=>{
   const partition=session.fromPartition((args.kind==='scene3d'?'persist:':'')+'dsh-editor-'+key);
   partition.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
   partition.setPermissionCheckHandler(()=>false);
   win=new BrowserWindow({title:args.kind==='scene3d'?'DSH · 3D 参考编辑器':'DSH · 自定义工作流编辑器',width:1480,height:940,minWidth:900,minHeight:600,show:false,backgroundColor:'#202020',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,session:partition}});
   win.webContents.on('preload-error',(_event,_preload,error)=>emit('error','编辑器桥接加载失败：'+error.message));
   win.webContents.once('did-finish-load',async()=>{try{if(!await win.webContents.executeJavaScript('Boolean(window.pywebview?.api)'))emit('error','编辑器桥接未就绪，无法安全保存和关闭');}catch(error){emit('error','编辑器桥接检查失败：'+error.message);}});
   win.setMenu(null);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   const allowed=url=>{try{const a=new URL(url),b=new URL(args.url);return a.origin===b.origin&&a.pathname===b.pathname;}catch{return false;}};
   win.webContents.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault();});
   win.webContents.on('will-redirect',(event,url)=>{if(!allowed(url))event.preventDefault();});
   const handle=(name,callback)=>ipcMain.handle(name,(event,...values)=>{if(!allowedFrame(event,win,args.url))throw Error('Untrusted editor bridge sender');return callback(...values);});
   handle('editor:dirty',value=>{dirty=value===true;});
   handle('editor:close',()=>win.close());
   handle('editor:ready',()=>{sceneReady=true;emit('ready');});
   handle('editor:failed',message=>emit('error',String(message).slice(0,600)));
   handle('editor:close-result',saved=>{pendingClose=false;if(args.kind==='scene3d'&&saved===true){allowClose=true;win.close();}});
   handle('editor:discard-removed',()=>{if(args.kind==='scene3d'){allowClose=true;win.close();}});
   win.on('close',event=>{
    if(allowClose)return;
    if(args.kind==='scene3d'&&sceneReady){event.preventDefault();if(pendingClose)return;pendingClose=true;
     win.webContents.executeJavaScript('window.dshScene3D.requestClose()').then(()=>{pendingClose=false;}).catch(async error=>{pendingClose=false;if(!win||win.isDestroyed())return;emit('error','关闭前保存失败：'+error.message);await dialog.showMessageBox(win,{type:'error',title:'无法完成关闭',message:'无法保存场景草稿，窗口已保留，请稍后重试。'});});return;
    }
    if(args.kind==='workflow'){event.preventDefault();if(pendingClose)return;pendingClose=true;
     (async()=>{
      const accepted=await win.webContents.executeJavaScript('window.dshWorkflow?.requestClose?.()');
      if(accepted===true||(accepted==null&&!dirty)){allowClose=true;win.close();}
     })().catch(async error=>{emit('error','关闭前保存失败：'+error.message);await dialog.showMessageBox(win,{type:'error',title:'无法完成关闭',message:'无法确认工作流的保存状态，窗口已保留，请稍后重试。'});}).finally(()=>{pendingClose=false;});
    }
   });
   win.once('ready-to-show',reveal);
   if(args.kind==='scene3d')win.webContents.once('did-start-loading',()=>{if(!shown)reveal();});
   // Show a real loading window promptly, even when the local editor takes longer to render.
   const showTimer=setTimeout(()=>{if(!shown)reveal();},1500);
   win.on('closed',()=>{clearTimeout(showTimer);activationTimers.forEach(clearTimeout);app.quit();});
   // Only a verified save/discard handshake can override a stale renderer unload guard.
   win.webContents.on('will-prevent-unload',event=>{if(allowClose)event.preventDefault();});
   win.webContents.on('render-process-gone',(_event,details)=>emit('error','编辑页面进程异常：'+details.reason));
   win.loadURL(args.url).catch(error=>{emit('error','编辑器加载失败：'+error.message);reveal();});
  }).catch(error=>{emit('error',error.message);app.exit(1);});
  app.on('window-all-closed',()=>app.quit());
 }
}
