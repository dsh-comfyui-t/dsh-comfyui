/** Shared, themed selects for the standalone editor. Native selects retain their data/event API. */
const views=new Map();let openView=null,sequence=0;
function icon(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:'12',height:'12',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d','m6 9 6 6 6-6');svg.append(p);return svg;}
function nameOf(select){return select.getAttribute('aria-label')||[...(select.closest('label')?.childNodes||[])].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim()||'选择';}
function enhance(select){
 if(views.has(select)||select.multiple)return;
 const wrapper=document.createElement('div');wrapper.className='cc-scene-select';select.before(wrapper);wrapper.append(select);select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 const trigger=document.createElement('button'),label=document.createElement('span');trigger.type='button';trigger.className='scene-select-trigger';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',nameOf(select));label.className='scene-select-value';trigger.append(label,icon());wrapper.append(trigger);
 let menu=null,list=null,search=null,cleanup=()=>{};
 function sync(){const text=select.selectedOptions[0]?.label||select.options[0]?.label||'未选择';if(label.textContent!==text)label.textContent=text;trigger.disabled=select.disabled;wrapper.setAttribute('aria-disabled',String(select.disabled));if(select.disabled&&menu)close(false);if(menu)for(const option of menu.querySelectorAll('[role="option"]'))option.setAttribute('aria-selected',String(option.dataset.value===select.value));}
 function close(focus=true){if(!menu)return;cleanup();menu.remove();menu=null;list=null;search=null;trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-controls');if(openView===view)openView=null;if(focus&&!trigger.disabled)trigger.focus({preventScroll:true});}
 function position(){const r=trigger.getBoundingClientRect(),width=Math.min(Math.max(r.width,180),innerWidth-16),below=innerHeight-r.bottom-12,above=r.top-12;menu.style.width=width+'px';const height=Math.min(320,Math.max(60,below>=150||below>=above?below:above));menu.style.maxHeight=height+'px';menu.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';menu.style.top=(below>=150||below>=above?r.bottom+4:Math.max(8,r.top-Math.min(menu.scrollHeight,height)-4))+'px';}
 function render(){
  const query=(search?.value||'').toLocaleLowerCase();list.replaceChildren();
  for(const option of select.options){if(option.hidden||!option.label.toLocaleLowerCase().includes(query))continue;const item=document.createElement('button');item.type='button';item.className='scene-select-option';item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.dataset.value=option.value;item.disabled=option.disabled;item.textContent=option.label;item.onclick=()=>{select.value=option.value;close();sync();select.dispatchEvent(new Event('change',{bubbles:true}));};list.append(item);}
  if(!list.children.length){const empty=document.createElement('span');empty.className='scene-select-empty';empty.textContent='没有匹配项';list.append(empty);}position();
 }
 function open(){
  if(select.disabled)return;if(menu){close();return;}openView?.close(false);openView=view;
  menu=document.createElement('div');menu.className='scene-select-menu';menu.id='scene-select-menu-'+(++sequence);menu.setAttribute('role','listbox');menu.setAttribute('aria-label',nameOf(select));
  if(select.options.length>12){search=document.createElement('input');search.type='search';search.className='scene-select-search';search.placeholder='搜索…';search.setAttribute('aria-label','筛选'+nameOf(select));search.oninput=render;menu.append(search);}
  list=document.createElement('div');list.className='scene-select-options';menu.append(list);document.body.append(menu);trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',menu.id);render();
  const current=list.querySelector('[aria-selected="true"]:not(:disabled)')||list.querySelector('[role="option"]:not(:disabled)');(search||current)?.focus({preventScroll:true});if(!search)current?.scrollIntoView({block:'nearest'});
  const outside=e=>{if(!menu?.contains(e.target)&&!wrapper.contains(e.target))close(false);},scroll=e=>{if(menu&&!menu.contains(e.target))close(false);},resize=()=>close(false);
  document.addEventListener('pointerdown',outside,true);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',resize);
  cleanup=()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',resize);};
  menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}if(e.key==='Tab'){close();return;}const options=[...list.querySelectorAll('[role="option"]:not(:disabled)')];if(!options.length)return;let index=options.indexOf(document.activeElement);if(e.key==='ArrowDown')index=Math.min(options.length-1,index+1);else if(e.key==='ArrowUp')index=index<0?options.length-1:Math.max(0,index-1);else if(e.key==='Home'&&e.target!==search)index=0;else if(e.key==='End'&&e.target!==search)index=options.length-1;else if(e.key==='Enter'&&e.target===search){e.preventDefault();options[0].click();return;}else return;e.preventDefault();options[index].focus({preventScroll:true});options[index].scrollIntoView({block:'nearest'});});
 }
 trigger.onclick=open;trigger.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!menu)open();}else if(e.key==='Escape'&&menu){e.preventDefault();close();}};
 const view={sync,close};views.set(select,view);select.addEventListener('change',sync);new MutationObserver(()=>{sync();if(menu)render();}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','label','hidden']});sync();
}
export function syncSceneSelectInputs(){for(const [select,view] of views){if(select.isConnected)view.sync();else{view.close(false);views.delete(select);}}}
export function initializeSceneSelectInputs(){document.querySelectorAll('#camera-sidebar select').forEach(enhance);syncSceneSelectInputs();}
