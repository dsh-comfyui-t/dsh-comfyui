function parseOptions(argv){
 const value=key=>{const items=argv.filter(a=>a.startsWith('--'+key+'='));return items.length===1?items[0].slice(key.length+3):'';};
 const kind=value('kind'),url=value('url'),workerKey=value('worker-key');
 try{const parsed=new URL(url);if(!['workflow','scene3d'].includes(kind)||parsed.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)||!parsed.port||parsed.username||parsed.password||parsed.search||parsed.pathname!='/'+kind+'/editor.html'||!/^dsh-electron-[a-f0-9]{32}$/.test(workerKey))return null;
  const channel=kind==='workflow'?parsed.hash.slice(1):new URLSearchParams(parsed.hash.slice(1)).get('channel');if(!/^[a-f0-9-]{8,80}$/.test(channel||''))return null;
  return {kind,url,workerKey};
 }catch{return null;}
}
function revealWindow(win,app){
 if(win.isMinimized())win.restore();
 win.show();
 // Windows may apply inherited startup display state on the first show.
 if(win.isMinimized())win.restore();
 win.moveTop();win.focus();if(process.platform==='darwin')app.focus({steal:true});
}
function allowedFrame(event,win,url){return event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url===url;}
module.exports={parseOptions,revealWindow,allowedFrame};
