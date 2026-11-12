// Temporary developer annotations are separate from scene data and deformation bones.
export function initializeJointReview({api, describe, onError, onSaved=()=>{}, busy=()=>false}) {
 const $=id=>document.getElementById(id), dialog=$('developer-dialog');
 let entries=[],pending=[],draining=null,enabled=false,reading=false;
 function render(){
  $('record-joints').checked=enabled;
  $('joint-review-indicator').hidden=!enabled&&!pending.length;
  $('joint-review-indicator').textContent=`${enabled?'关节记录中':'关节记录待保存'} · ${entries.length}${pending.length?' · 待保存 '+pending.length:''}`;
  $('joint-review-count').textContent=`已保存 ${entries.length} 项${pending.length?'，待保存 '+pending.length+' 项':''}`;
  $('retry-joint-review').hidden=!pending.length;
  const rows=entries.map(entry=>{
   const row=document.createElement('li'),text=document.createElement('div'),label=document.createElement('strong'),raw=document.createElement('code'),detail=document.createElement('small'),remove=document.createElement('button');
   label.textContent=entry.modelLabel+' / '+entry.jointLabel;raw.textContent=entry.bone;
   detail.textContent=`${entry.asset} · 点击 ${entry.clicks} 次`;text.append(label,raw,detail);
   remove.type='button';remove.textContent='撤销标记';remove.setAttribute('aria-label','撤销标记：'+entry.modelLabel+' / '+entry.bone);remove.disabled=!!pending.length;
   remove.onclick=()=>{remove.disabled=true;enqueue({action:'remove',id:entry.id});};row.append(text,remove);return row;
  });
  if(!rows.length){const empty=document.createElement('li');empty.textContent=reading?'正在读取记录…':'尚未记录关节';rows.push(empty);}
  $('joint-review-list').replaceChildren(...rows);
 }
 async function drain(){
  if(draining)return draining;
  draining=(async()=>{
   const changed=!!pending.length;
   while(pending.length){const value=await api('joint-review',pending[0]);entries=value.entries;pending.shift();render();}
   if(changed)onSaved();
  })();
  try{await draining;}finally{draining=null;render();}
 }
 function report(error){enabled=false;render();onError('关节记录尚未保存，请在开发者选项中重试：'+(error.message||error));}
 function enqueue(payload){pending.push(payload);render();void drain().catch(report);}
 async function open(){
  if(busy())return;
  $('file-options').hidden=true;$('file-menu').setAttribute('aria-expanded','false');
  dialog.showModal();reading=true;render();
  try{entries=(await api('joint-review')).entries;}catch(e){onError('读取关节记录失败：'+(e.message||e));}
  finally{reading=false;render();}
 }
 $('developer-options').addEventListener('click',open);
 $('joint-review-indicator').addEventListener('click',open);
 $('close-developer').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>$('file-menu').focus());
 $('record-joints').addEventListener('change',()=>{enabled=$('record-joints').checked;render();});
 $('retry-joint-review').addEventListener('click',()=>void drain().catch(report));
 render();
 return {
  record(object,bone,source){
   if(!enabled||!object||!bone||busy())return;
   const payload=describe(object,bone,source);if(payload)enqueue({action:'record',...payload});
  },
  flush:drain
 };
}
