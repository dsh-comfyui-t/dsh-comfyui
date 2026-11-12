import {sceneIcon} from './interface.js';

export function initializePoseChat({snapshot,peek=snapshot,apply,api,error}){
 const $=id=>document.getElementById(id),panel=$('pose-chat'),toggle=$('toggle-ai-pose'),form=$('pose-chat-form'),input=$('pose-chat-input'),log=$('pose-chat-messages'),send=$('pose-chat-send'),stop=$('pose-chat-stop'),label=$('pose-chat-target'),modelLabel=$('pose-chat-model'),state=$('pose-chat-status'),histories=new Map();
 // Deferred UI: keep implementation and data, but do not bind or activate the hidden chat.
 if(toggle.hidden){panel.hidden=true;document.body.classList.toggle('pose-chat-open',false);document.body.classList.add('ai-pose-deferred');return {refresh(){},dispose(){},async cancel(){},open(){}};}
 let pending='',epoch=0,disposed=false,targetLabel='',targetCount=-1,refreshKey='',activeTurn=null;
 const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
 toggle.replaceChildren(sceneIcon('chat'));toggle.classList.add('viewport-icon');toggle.dataset.tooltip='AI 场景搭建';toggle.setAttribute('aria-label','AI 场景搭建');$('pose-chat-close').replaceChildren(sceneIcon('close'));
 function scroll(){if(log.scrollHeight-log.scrollTop-log.clientHeight<180||!log.clientHeight)log.scrollTop=log.scrollHeight;}
 function message(role,text){
  const row=element('article','pose-chat-message');row.dataset.role=role;const title=element('strong','pose-chat-author',role==='user'?'你':'AI'),content=element('div','pose-chat-bubble');if(text)content.textContent=text;row.append(title,content);log.append(row);while(log.children.length>50)log.firstElementChild.remove();scroll();return {row,content};
 }
 function createTurn(target){
  const view=message('assistant'),details=element('details','pose-chat-process'),summary=element('summary'),steps=element('ol','pose-chat-steps'),outline=element('section','pose-chat-plan'),plan=element('p'),actions=element('ul','pose-chat-actions'),reply=element('p','pose-chat-reply');
  details.open=true;details.setAttribute('aria-live','off');outline.hidden=true;reply.hidden=true;actions.hidden=true;outline.append(element('strong','','场景方案'),plan);details.append(summary,steps);view.content.append(outline,details,actions,reply);
  return {...view,details,summary,steps,outline,plan,actions,reply,target,events:[],started:Date.now(),done:false,polling:false,timer:null,model:''};
 }
 function renderTurn(turn,updateSteps=true){
  turn.summary.textContent='执行过程 · '+(turn.done?turn.outcome||'已完成':turn.events.at(-1)?.label||'正在准备')+' · '+((Date.now()-turn.started)/1000).toFixed(1)+' 秒';
  if(updateSteps)turn.steps.replaceChildren(...turn.events.map((event,index)=>{const item=element('li','',event.label);item.dataset.state=turn.done?'done':index===turn.events.length-1?'active':'done';return item;}));scroll();
 }
 function event(turn,stage,text){if(turn.events.some(row=>row.stage===stage&&row.label===text))return;turn.events.push({stage,label:text});renderTurn(turn);}
 function ingest(turn,events){for(const row of Array.isArray(events)?events:[]){if(!row||typeof row.label!=='string')continue;if(row.model){turn.model=row.model;if(modelLabel)modelLabel.textContent=row.model;}if(row.plan){turn.plan.textContent=row.plan;turn.outline.hidden=false;}event(turn,row.stage,row.label);}}
 function finish(turn,outcome,text){
  if(!turn||turn.done)return;turn.done=true;turn.details.open=false;turn.outcome=outcome;clearInterval(turn.timer);if(text){turn.reply.hidden=false;turn.reply.textContent=text;}turn.row.dataset.outcome=outcome;renderTurn(turn);
 }
 function describeActions(turn,operations){
 const label=op=>op.type==='place'?'放置 '+(op.module||'模块'):op.type==='remove'?'删除 '+(op.id||''):op.type==='paint'?'改色 '+(op.color||''):op.type==='add'?'添加 '+(op.model||'物体')+(op.name?'「'+op.name+'」':''):op.type==='transform'?'调整物体 '+(op.id||''):op.type==='color'?'设置颜色 '+(op.color||''):op.type==='delete'?'删除物体 '+(op.id||''):op.type==='camera'?'调整镜头':'场景操作';
 turn.actions.replaceChildren(...operations.map(op=>element('li','',label(op))));turn.actions.hidden=!operations.length;
}
 function refresh(){if(disposed)return;const current=peek(),sc=current?.scene,name=sc?.name||'',count=(sc?.objects||[]).length,key=(sc?.id||'')+'|'+name+'|'+count+'|'+!!current?.busy+'|'+pending;if(key===refreshKey)return;refreshKey=key;if(name!==targetLabel||count!==targetCount){targetLabel=name;targetCount=count;label.textContent=name?'场景：'+name+' · '+count+' 个物体':'场景未加载';}send.disabled=!!pending||!current||current.busy;stop.hidden=!pending;input.disabled=!!pending;}
 function open(value){panel.hidden=!value;document.body.classList.toggle('pose-chat-open',value);toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-pressed',String(value));if(value){$('library').hidden=true;$('inspector').hidden=true;$('toggle-library').setAttribute('aria-expanded','false');refresh();input.focus({preventScroll:true});}else toggle.focus({preventScroll:true});}
 toggle.onclick=()=>open(panel.hidden);$('pose-chat-close').onclick=()=>open(false);
 async function cancel(){if(!pending)return;const request=pending;pending='';epoch++;finish(activeTurn,'已停止','本次场景未应用。');state.textContent='已停止';refresh();try{await api('ai-pose/cancel',{request_id:request});}catch{state.textContent='本次结果已忽略，后台任务可能仍在结束中';}}
 stop.onclick=cancel;
 async function poll(turn,request,serial){if(turn.polling||turn.done||disposed||serial!==epoch)return;turn.polling=true;try{const progress=await api('ai-pose/progress/'+request);if(!turn.done&&!disposed&&serial===epoch)ingest(turn,progress.events);}catch{}finally{turn.polling=false;}}
 form.onsubmit=async e=>{
  e.preventDefault();if(pending||disposed)return;const text=input.value.trim(),current=snapshot();if(!text)return;if(!current||current.busy){state.textContent='场景忙，请稍后再试';return;}
  const target=current.scene,signature=current.signature,serial=++epoch,request='pose-'+crypto.randomUUID(),history=histories.get(target.id)||[];pending=request;input.value='';message('user',text);const turn=activeTurn=createTurn(target);event(turn,'scene','已读取场景与 '+(target.objects||[]).length+' 个物体');state.textContent='正在请求 AI…';refresh();
  turn.timer=setInterval(()=>{if(turn.done||disposed||serial!==epoch)return;renderTurn(turn,false);poll(turn,request,serial);},900);turn.timer.unref?.();
  try{
   const result=await api('ai-pose',{request_id:request,message:text,scene:target,history:history.slice(-12)});if(disposed||serial!==epoch)return;
   ingest(turn,result.process);if(result.model){turn.model=result.model;if(modelLabel)modelLabel.textContent=result.model;}if(result.plan){turn.plan.textContent=result.plan;turn.outline.hidden=false;}
   const operations=result.operations||[];describeActions(turn,operations);
   event(turn,'local-check','正在检查场景是否仍匹配');
   const now=snapshot();if(!now||now.busy||now.signature!==signature){finish(turn,'未应用','场景已经变化，此次方案未执行。请按当前场景重新发送。');state.textContent='未应用，请重新发送';return;}
   event(turn,'apply',operations.length?'正在应用 '+operations.length+' 项场景操作':'无需修改场景');
   if(typeof requestAnimationFrame==='function')await new Promise(resolve=>requestAnimationFrame(resolve));
   if(disposed||serial!==epoch)return;const latest=snapshot();if(!latest||latest.busy||latest.signature!==signature){finish(turn,'未应用','场景已经变化，此次方案未执行。');state.textContent='未应用，请重新发送';return;}
   const outcome=await apply(operations,target)||{};let reply=result.reply||'已调整场景';event(turn,'complete',operations.length?'已应用 '+operations.length+' 项场景操作，可整体撤回':'已完成回复');finish(turn,'已完成',reply);
   histories.set(target.id,[...history,{role:'user',content:text},{role:'assistant',content:reply}].slice(-16));state.textContent=operations.length?'场景已应用 · Ctrl+Z 撤回':'AI 已回复';
  }catch(ex){if(!disposed&&serial===epoch){event(turn,'error','本次操作未完成');finish(turn,'未完成',ex.message||String(ex));state.textContent='操作未完成';error(ex);}}
  finally{if(serial===epoch){pending='';refresh();input.focus({preventScroll:true});}}
 };
 input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();open(false);}});
 function dispose(){if(disposed)return;finish(activeTurn,'已结束');if(pending)api('ai-pose/cancel',{request_id:pending}).catch(()=>{});disposed=true;epoch++;pending='';}
 window.addEventListener('pagehide',dispose);refresh();return {refresh,dispose,cancel,open};
}
