const {contextBridge,ipcRenderer}=require('electron');
const api=Object.freeze({
 set_dirty:value=>ipcRenderer.invoke('editor:dirty',value===true),
 close:()=>ipcRenderer.invoke('editor:close'),
 ready:()=>ipcRenderer.invoke('editor:ready'),
 failed:message=>ipcRenderer.invoke('editor:failed',String(message).slice(0,600)),
 close_result:saved=>ipcRenderer.invoke('editor:close-result',saved===true),
 discard_removed:()=>ipcRenderer.invoke('editor:discard-removed')
});
// Preserve the existing editor bridge contract while changing the window host.
contextBridge.exposeInMainWorld('pywebview',Object.freeze({api}));
contextBridge.exposeInMainWorld('dshDesktop',Object.freeze({backend:'electron'}));
window.addEventListener('DOMContentLoaded',()=>window.dispatchEvent(new Event('pywebviewready')),{once:true});
