const COMFY_NATIVE_STYLE="/* this CSS contains only the basic CSS needed to run the app and use it */\n\n.lgraphcanvas {\n  /*cursor: crosshair;*/\n  user-select: none;\n  -moz-user-select: none;\n  -webkit-user-select: none;\n  outline: none;\n  font-family: Tahoma, sans-serif;\n}\n\n.lgraphcanvas * {\n  box-sizing: border-box;\n}\n\n.litegraph.litecontextmenu {\n  font-family: Tahoma, sans-serif;\n  position: fixed;\n  top: 100px;\n  left: 100px;\n  min-width: 100px;\n  color: #aaf;\n  padding: 0;\n  box-shadow: 0 0 10px black !important;\n  background-color: #2e2e2e !important;\n  z-index: 10;\n  max-height: -webkit-fill-available;\n  overflow-y: auto;\n}\n\n/* Enable scrolling overflow in Firefox */\n@supports not (max-height: -webkit-fill-available) {\n  .litegraph.litecontextmenu {\n    max-height: 80vh;\n    overflow-y: scroll;\n  }\n}\n\n.litegraph.litecontextmenu.dark {\n  background-color: #000 !important;\n}\n\n.litegraph.litecontextmenu .litemenu-title img {\n  margin-top: 2px;\n  margin-left: 2px;\n  margin-right: 4px;\n}\n\n.litegraph.litecontextmenu .litemenu-entry {\n  margin: 2px;\n  padding: 2px;\n}\n\n.litegraph.litecontextmenu .litemenu-entry.submenu {\n  background-color: #2e2e2e !important;\n}\n\n.litegraph.litecontextmenu.dark .litemenu-entry.submenu {\n  background-color: #000 !important;\n}\n\n.litegraph .litemenubar ul {\n  font-family: Tahoma, sans-serif;\n  margin: 0;\n  padding: 0;\n}\n\n.litegraph .litemenubar li {\n  font-size: 14px;\n  color: #999;\n  display: inline-block;\n  min-width: 50px;\n  padding-left: 10px;\n  padding-right: 10px;\n  user-select: none;\n  -moz-user-select: none;\n  -webkit-user-select: none;\n  cursor: pointer;\n}\n\n.litegraph .litemenubar li:hover {\n  background-color: #777;\n  color: #eee;\n}\n\n.litegraph .litegraph .litemenubar-panel {\n  position: absolute;\n  top: 5px;\n  left: 5px;\n  min-width: 100px;\n  background-color: #444;\n  box-shadow: 0 0 3px black;\n  padding: 4px;\n  border-bottom: 2px solid #aaf;\n  z-index: 10;\n}\n\n.litegraph .litemenu-entry,\n.litemenu-title {\n  font-size: 12px;\n  color: #aaa;\n  padding: 0 0 0 4px;\n  margin: 2px;\n  padding-left: 2px;\n  -moz-user-select: none;\n  -webkit-user-select: none;\n  user-select: none;\n  cursor: pointer;\n}\n\n.litegraph .litemenu-entry .icon {\n  display: inline-block;\n  width: 12px;\n  height: 12px;\n  margin: 2px;\n  vertical-align: top;\n}\n\n.litegraph .litemenu-entry.checked .icon {\n  background-color: #aaf;\n}\n\n.litegraph .litemenu-entry .more {\n  float: right;\n  padding-right: 5px;\n}\n\n.litegraph .litemenu-entry.disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n\n.litegraph .litemenu-entry.separator {\n  display: block;\n  border-top: 1px solid #333;\n  border-bottom: 1px solid #666;\n  width: 100%;\n  height: 0px;\n  margin: 3px 0 2px 0;\n  background-color: transparent;\n  padding: 0 !important;\n  cursor: default !important;\n}\n\n.litegraph .litemenu-entry.has_submenu {\n  border-right: 2px solid cyan;\n}\n\n.litegraph .litemenu-title {\n  color: #dde;\n  background-color: #111;\n  margin: 0;\n  padding: 2px;\n  cursor: default;\n}\n\n.litegraph .litemenu-entry:hover:not(.disabled):not(.separator) {\n  background-color: #444 !important;\n  color: #eee;\n  transition: all 0.2s;\n}\n\n.litegraph .litemenu-entry .property_name {\n  display: inline-block;\n  text-align: left;\n  min-width: 80px;\n  min-height: 1.2em;\n}\n\n.litegraph .litemenu-entry .property_value {\n  display: inline-block;\n  background-color: rgba(0, 0, 0, 0.5);\n  text-align: right;\n  min-width: 80px;\n  min-height: 1.2em;\n  vertical-align: middle;\n  padding-right: 10px;\n}\n\n.litegraph.litesearchbox {\n  font-family: Tahoma, sans-serif;\n  position: absolute;\n  background-color: rgba(0, 0, 0, 0.5);\n  padding-top: 4px;\n}\n\n.litegraph.litesearchbox input,\n.litegraph.litesearchbox select {\n  margin-top: 3px;\n  min-width: 60px;\n  min-height: 1.5em;\n  background-color: black;\n  border: 0;\n  color: white;\n  padding-left: 10px;\n  margin-right: 5px;\n  max-width: 300px;\n}\n\n.litegraph.litesearchbox .name {\n  display: inline-block;\n  min-width: 60px;\n  min-height: 1.5em;\n  padding-left: 10px;\n}\n\n.litegraph.litesearchbox .helper {\n  overflow: auto;\n  max-height: 200px;\n  margin-top: 2px;\n}\n\n.litegraph.lite-search-item {\n  font-family: Tahoma, sans-serif;\n  background-color: rgba(0, 0, 0, 0.5);\n  color: white;\n  padding-top: 2px;\n}\n\n.litegraph.lite-search-item.not_in_filter {\n  /*background-color: rgba(50, 50, 50, 0.5);*/\n  /*color: #999;*/\n  color: #b99;\n  font-style: italic;\n}\n\n.litegraph.lite-search-item.generic_type {\n  /*background-color: rgba(50, 50, 50, 0.5);*/\n  /*color: #DD9;*/\n  color: #999;\n  font-style: italic;\n}\n\n.litegraph.lite-search-item:hover,\n.litegraph.lite-search-item.selected {\n  cursor: pointer;\n  background-color: white;\n  color: black;\n}\n\n.litegraph.lite-search-item-type {\n  display: inline-block;\n  background: rgba(0, 0, 0, 0.2);\n  margin-left: 5px;\n  font-size: 14px;\n  padding: 2px 5px;\n  position: relative;\n  top: -2px;\n  opacity: 0.8;\n  border-radius: 4px;\n}\n\n/* DIALOGs ******/\n\n.litegraph .dialog {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  margin-top: -150px;\n  margin-left: -200px;\n\n  background-color: #2a2a2a;\n\n  min-width: 400px;\n  min-height: 200px;\n  box-shadow: 0 0 4px #111;\n  border-radius: 6px;\n}\n\n.litegraph .dialog.settings {\n  left: 10px;\n  top: 10px;\n  height: calc(100% - 20px);\n  margin: auto;\n  max-width: 50%;\n}\n\n.litegraph .dialog.centered {\n  top: 50px;\n  left: 50%;\n  position: absolute;\n  transform: translateX(-50%);\n  min-width: 600px;\n  min-height: 300px;\n  height: calc(100% - 100px);\n  margin: auto;\n}\n\n.litegraph .dialog .close {\n  float: right;\n  margin: 4px;\n  margin-right: 10px;\n  cursor: pointer;\n  font-size: 1.4em;\n}\n\n.litegraph .dialog .close:hover {\n  color: white;\n}\n\n.litegraph .dialog .dialog-header {\n  color: #aaa;\n  border-bottom: 1px solid #161616;\n}\n\n.litegraph .dialog .dialog-header {\n  height: 40px;\n}\n.litegraph .dialog .dialog-footer {\n  height: 50px;\n  padding: 10px;\n  margin: 0;\n  border-top: 1px solid #1a1a1a;\n}\n\n.litegraph .dialog .dialog-header .dialog-title {\n  font: 20px \"Arial\";\n  margin: 4px;\n  padding: 4px 10px;\n  display: inline-block;\n}\n\n.litegraph .dialog .dialog-content,\n.litegraph .dialog .dialog-alt-content {\n  height: calc(100% - 90px);\n  width: 100%;\n  min-height: 100px;\n  display: inline-block;\n  color: #aaa;\n  /*background-color: black;*/\n  overflow: auto;\n}\n\n.litegraph .dialog .dialog-content h3 {\n  margin: 10px;\n}\n\n.litegraph .dialog .dialog-content .connections {\n  flex-direction: row;\n}\n\n.litegraph .dialog .dialog-content .connections .connections_side {\n  width: calc(50% - 5px);\n  min-height: 100px;\n  background-color: black;\n  display: flex;\n}\n\n.litegraph .dialog .node_type {\n  font-size: 1.2em;\n  display: block;\n  margin: 10px;\n}\n\n.litegraph .dialog .node_desc {\n  opacity: 0.5;\n  display: block;\n  margin: 10px;\n}\n\n.litegraph .dialog .separator {\n  display: block;\n  width: calc(100% - 4px);\n  height: 1px;\n  border-top: 1px solid #000;\n  border-bottom: 1px solid #333;\n  margin: 10px 2px;\n  padding: 0;\n}\n\n.litegraph .dialog .property {\n  margin-bottom: 2px;\n  padding: 4px;\n}\n\n.litegraph .dialog .property:hover {\n  background: #545454;\n}\n\n.litegraph .dialog .property_name {\n  color: #737373;\n  display: inline-block;\n  text-align: left;\n  vertical-align: top;\n  width: 160px;\n  padding-left: 4px;\n  overflow: hidden;\n  margin-right: 6px;\n}\n\n.litegraph .dialog .property:hover .property_name {\n  color: white;\n}\n\n.litegraph .dialog .property_value {\n  display: inline-block;\n  text-align: right;\n  color: #aaa;\n  background-color: #1a1a1a;\n  /*width: calc( 100% - 122px );*/\n  max-width: calc(100% - 162px);\n  min-width: 200px;\n  max-height: 300px;\n  min-height: 20px;\n  padding: 4px;\n  padding-right: 12px;\n  overflow: hidden;\n  cursor: pointer;\n  border-radius: 3px;\n}\n\n.litegraph .dialog .property_value:hover {\n  color: white;\n}\n\n.litegraph .dialog .property.boolean .property_value {\n  padding-right: 30px;\n  color: #a88;\n  /*width: auto;\n    float: right;*/\n}\n\n.litegraph .dialog .property.boolean.bool-on .property_name {\n  color: #8a8;\n}\n.litegraph .dialog .property.boolean.bool-on .property_value {\n  color: #8a8;\n}\n\n.litegraph .dialog .btn {\n  border: 0;\n  border-radius: 4px;\n  padding: 4px 20px;\n  margin-left: 0px;\n  background-color: #060606;\n  color: #8e8e8e;\n}\n\n.litegraph .dialog .btn:hover {\n  background-color: #111;\n  color: #fff;\n}\n\n.litegraph .dialog .btn.delete:hover {\n  background-color: #f33;\n  color: black;\n}\n\n.litegraph .bullet_icon {\n  margin-left: 10px;\n  border-radius: 10px;\n  width: 12px;\n  height: 12px;\n  background-color: #666;\n  display: inline-block;\n  margin-top: 2px;\n  margin-right: 4px;\n  transition: background-color 0.1s ease 0s;\n  -moz-transition: background-color 0.1s ease 0s;\n}\n\n.litegraph .bullet_icon:hover {\n  background-color: #698;\n  cursor: pointer;\n}\n\n/* OLD */\n\n.graphcontextmenu {\n  padding: 4px;\n  min-width: 100px;\n}\n\n.graphcontextmenu-title {\n  color: #dde;\n  background-color: #222;\n  margin: 0;\n  padding: 2px;\n  cursor: default;\n}\n\n.graphmenu-entry {\n  box-sizing: border-box;\n  margin: 2px;\n  padding-left: 20px;\n  user-select: none;\n  -moz-user-select: none;\n  -webkit-user-select: none;\n  transition: all linear 0.3s;\n}\n\n.graphmenu-entry.event,\n.litemenu-entry.event {\n  border-left: 8px solid orange;\n  padding-left: 12px;\n}\n\n.graphmenu-entry.disabled {\n  opacity: 0.3;\n}\n\n.graphmenu-entry.submenu {\n  border-right: 2px solid #eee;\n}\n\n.graphmenu-entry:hover {\n  background-color: #555;\n}\n\n.graphmenu-entry.separator {\n  background-color: #111;\n  border-bottom: 1px solid #666;\n  height: 1px;\n  width: calc(100% - 20px);\n  -moz-width: calc(100% - 20px);\n  -webkit-width: calc(100% - 20px);\n}\n\n.graphmenu-entry .property_name {\n  display: inline-block;\n  text-align: left;\n  min-width: 80px;\n  min-height: 1.2em;\n}\n\n.graphmenu-entry .property_value,\n.litemenu-entry .property_value {\n  display: inline-block;\n  background-color: rgba(0, 0, 0, 0.5);\n  text-align: right;\n  min-width: 80px;\n  min-height: 1.2em;\n  vertical-align: middle;\n  padding-right: 10px;\n}\n\n.graphdialog {\n  position: absolute;\n  top: 10px;\n  left: 10px;\n  min-height: 2em;\n  background-color: #333;\n  font-size: 1.2em;\n  box-shadow: 0 0 10px black !important;\n  z-index: 10;\n}\n\n.graphdialog.rounded {\n  border-radius: 12px;\n  padding-right: 2px;\n}\n\n.graphdialog .name {\n  display: inline-block;\n  min-width: 60px;\n  min-height: 1.5em;\n  padding-left: 10px;\n}\n\n.graphdialog input,\n.graphdialog textarea,\n.graphdialog select {\n  margin: 3px;\n  min-width: 60px;\n  min-height: 1.5em;\n  background-color: black;\n  border: 0;\n  color: white;\n  padding-left: 10px;\n  outline: none;\n}\n\n.graphdialog textarea {\n  min-height: 150px;\n}\n\n.graphdialog button {\n  margin-top: 3px;\n  vertical-align: top;\n  background-color: #999;\n  border: 0;\n}\n\n.graphdialog button.rounded,\n.graphdialog input.rounded {\n  border-radius: 0 12px 12px 0;\n}\n\n.graphdialog .helper {\n  overflow: auto;\n  max-height: 200px;\n}\n\n.graphdialog .help-item {\n  padding-left: 10px;\n}\n\n.graphdialog .help-item:hover,\n.graphdialog .help-item.selected {\n  cursor: pointer;\n  background-color: white;\n  color: black;\n}\n\n.litegraph .dialog {\n  min-height: 0;\n}\n.litegraph .dialog .dialog-content {\n  display: block;\n}\n.litegraph .graphdialog {\n  display: flex;\n  align-items: center;\n  border-radius: 20px;\n  padding: 4px 10px;\n  position: fixed;\n}\n.litegraph .graphdialog .name {\n  padding: 0;\n  min-height: 0;\n  font-size: 16px;\n  vertical-align: middle;\n}\n.litegraph .graphdialog .value {\n  font-size: 16px;\n  min-height: 0;\n  margin: 0 10px;\n  padding: 2px 5px;\n}\n.litegraph .graphdialog input[type=\"checkbox\"] {\n  width: 16px;\n  height: 16px;\n}\n.litegraph .graphdialog button {\n  padding: 4px 18px;\n  border-radius: 20px;\n  cursor: pointer;\n}\n\n.cc-comfy-native{height:100vh;display:flex;flex-direction:column;background:#202020;color:#ddd;font:13px Arial,sans-serif;color-scheme:dark;--comfy-menu-bg:#353535;--comfy-input-bg:#222;--input-text:#ddd;--fg-color:#ddd;--border-color:#4e4e4e;--bg-color:#202020}\n.cc-comfy-native *{box-sizing:border-box}.cc-comfy-native-top{height:52px;display:flex;align-items:center;gap:10px;background:#171717;border-bottom:1px solid #444;padding:8px 14px;flex-shrink:0}.cc-comfy-native-top strong{font-size:18px;color:#eee}.cc-comfy-native-label{color:#999;border-left:1px solid #555;padding-left:12px;white-space:nowrap}.cc-comfy-native input{min-width:120px;flex:1;max-width:480px;height:30px;border:1px solid #555;border-radius:4px;background:#222;color:#ddd;padding:4px 8px;font:inherit}.cc-comfy-native button{height:30px;white-space:nowrap;border:1px solid #555;border-radius:4px;background:#353535;color:#ddd;padding:4px 12px;cursor:pointer;font:inherit}.cc-comfy-native button:hover{background:#484848}.cc-comfy-native button:focus-visible,.cc-comfy-native input:focus-visible{outline:2px solid #80b5ff;outline-offset:1px}.cc-comfy-native button:disabled{opacity:.4;cursor:default}.cc-comfy-save-state{color:#aaa;font-size:12px;margin-right:auto;white-space:nowrap}.cc-comfy-native-stage{position:relative;flex:1;min-height:0;overflow:hidden}.cc-comfy-native-stage>canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}.cc-comfy-canvas-tools,.cc-comfy-canvas-zoom{position:absolute;display:flex;gap:1px;padding:4px;border:1px solid #444;border-radius:7px;background:#202020e8;box-shadow:0 2px 6px #0006}.cc-comfy-canvas-tools{top:16px;left:16px}.cc-comfy-canvas-zoom{right:16px;bottom:16px}.cc-comfy-canvas-tools button,.cc-comfy-canvas-zoom button{border:0;background:transparent}.cc-comfy-native footer{font-size:11px;color:#999;padding:5px 14px;background:#171717;border-top:1px solid #333}.cc-comfy-native-error{padding:8px 14px;background:#472323;color:#ffb0b0;white-space:pre-wrap}.litegraph.litecontextmenu{z-index:2147482600!important;background:#353535;color:#ddd;box-shadow:0 4px 12px #0008}.litegraph .litemenu-entry:hover{background:#555;color:#fff}.litegraph.litesearchbox{background:#353535;z-index:2147482600!important;box-shadow:0 4px 12px #0008}.litegraph.litesearchbox input,.litegraph.litesearchbox select{background:#222;color:#ddd;border:1px solid #555}.litegraph.lite-search-item{color:#ddd;background:#222}.litegraph.lite-search-item.selected,.litegraph.lite-search-item:hover{background:#555;color:#fff}\n@media(max-width:850px){.cc-comfy-native-label{display:none}.cc-comfy-native-top{gap:6px}.cc-comfy-native-top button{padding:4px 8px}}\n";
/** Comfy-Org LiteGraph canvas with an adapter for DSH's reusable workflow format. */
function nativeWorkflowType(definition){return Array.isArray(definition?.[0])||definition?.[0]==='COMBO'?'STRING':String(definition?.[0]||'*');}
const NATIVE_EXTERNAL_HINTS={
 image:'当前步骤图片：进入这个自定义工作流时的图片，包含前面生成后控制步骤已经完成的放大、调色等处理。',
 original:'最初原图：进入生成后控制流程之前的原始生成结果，不随前面的处理改变。适合与处理结果混合、恢复原图细节或对比。若这是第一个处理步骤，它通常与当前步骤图片相同。',
 clip:'CLIP：用于文本编码的模型对象。将它接入 CLIP 文本编码节点，才能把节点内填写的提示词转换为条件。',
 positive:'正面条件：生成流程已经编码好的 CONDITIONING，可直接连接采样器的 positive 输入。',
 negative:'负面条件：生成流程已经编码好的 CONDITIONING，可直接连接采样器的 negative 输入。'
};
function nativeExternalGroupDescription(group){return group.id==='all'?NATIVE_EXTERNAL_HINTS.image+'\n\n'+NATIVE_EXTERNAL_HINTS.original:NATIVE_EXTERNAL_HINTS[group.keys?.[0]]||'从当前生成流程读取'+group.title+'，只连接需要的接口即可。';}
function installNativeExternalHints(element,canvas,graph){
 const doc=element.ownerDocument,tip=doc.createElement('div');tip.setAttribute('role','tooltip');tip.style.cssText='position:fixed;z-index:2147482500;max-width:300px;padding:8px 10px;border:1px solid #555;border-radius:6px;background:#252730;color:#eee;font:12px/1.6 Arial,sans-serif;pointer-events:none;white-space:pre-wrap';tip.hidden=true;(doc.fullscreenElement||doc.body).append(tip);
 const hide=()=>{tip.hidden=true;};
 const move=event=>{if(event.buttons){hide();return;}const [x,y]=canvas.convertEventToCanvasOffset(event);let text='';
  for(const node of [...graph._nodes].reverse()){if(node.properties.dshKind!=='interface'||node.flags.collapsed)continue;const keys=nativeExternalKeys(node);for(let i=0;i<keys.length;i++){const point=node.getOutputPos(i);if(x>=point[0]-190&&x<=point[0]+12&&Math.abs(y-point[1])<=10){text=NATIVE_EXTERNAL_HINTS[keys[i]]||'';break;}}if(text)break;}
  if(!text){hide();return;}tip.textContent=text;tip.hidden=false;tip.style.left=Math.max(8,Math.min(event.clientX+14,doc.documentElement.clientWidth-tip.offsetWidth-8))+'px';tip.style.top=Math.max(8,Math.min(event.clientY+16,doc.documentElement.clientHeight-tip.offsetHeight-8))+'px';
 };
 element.addEventListener('pointermove',move);element.addEventListener('pointerleave',hide);element.addEventListener('wheel',hide);window.addEventListener('blur',hide);
 return {dispose(){element.removeEventListener('pointermove',move);element.removeEventListener('pointerleave',hide);element.removeEventListener('wheel',hide);window.removeEventListener('blur',hide);tip.remove();}};
}
const NATIVE_EXTERNAL_GROUPS=[
 {id:'all',type:'DSH/输入接口',title:'DSH 外部输入（全部）',keys:null},
 {id:'image',title:'当前步骤图片',keys:['image']},
 {id:'original',title:'基础生成原图',keys:['original']},
 {id:'model',title:'模型',keys:['model']},
 {id:'clip',title:'CLIP',keys:['clip']},
 {id:'vae',title:'VAE',keys:['vae']},
 {id:'conditioning',title:'正负条件（已编码）',keys:['positive','negative']},
 {id:'prompts',title:'正负提示词（文本）',keys:['pos','neg'],hidden:true},
 {id:'latent',title:'当前图片 Latent',keys:['latent']},
 {id:'sampling',title:'采样参数',keys:['seed','steps','cfg','sampler','scheduler']},
 {id:'size',title:'图片尺寸',keys:['width','height']}
].map(g=>({...g,type:g.type||'DSH/外部输入/'+g.title,title:g.id==='all'?'外部输入（全部）':'外部输入 · '+g.title}));
function nativeExternalTitle(title){const value=String(title||'');return value.startsWith('外部输入')?value:value==='DSH 外部输入（全部）'?'外部输入（全部）':'外部输入 · '+value;}
function nativeExternalKeys(node){const group=NATIVE_EXTERNAL_GROUPS.find(g=>g.id===(node.properties.dshInterface||'all'));return group?(group.keys||POST_INTERFACES.map(x=>x[0]).filter(key=>node.properties.dshLegacyPrompts||!['pos','neg'].includes(key))):[];}
function nativeExternalSource(nodes,key,preferred){const candidates=nodes.filter(n=>nativeExternalKeys(n).includes(key)),node=candidates.find(n=>n.properties.dshInterfaceId===preferred)||candidates[0];return node?{node,slot:nativeExternalKeys(node).indexOf(key)}:null;}
function nativeWorkflowCanvasSize(width,height,ratio=1){const scale=Math.max(.1,Number(ratio)||1);return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
function nativeWorkflowRead(graph,base){
 const all=graph._nodes||[],processing=all.filter(n=>n.properties.dshKind==='process').sort((a,b)=>String(a.properties.dshId).localeCompare(String(b.properties.dshId))),byId=new Map(all.map(n=>[n.id,n]));
 const linkAt=(n,index)=>{const id=n.inputs?.[index]?.link;return id==null?null:graph.links[id];};
 const sourceOf=link=>{const source=link&&byId.get(link.origin_id);if(!source)return null;return source.properties.dshKind==='interface'?(nativeExternalKeys(source)[link.origin_slot]?{interface:nativeExternalKeys(source)[link.origin_slot]}:null):source.properties.dshKind==='process'?{node:source.properties.dshId,slot:link.origin_slot}:null;};
 const appearance=n=>({pos:[...n.pos],size:[...n.size],title:n.title,color:n.color,bgcolor:n.bgcolor,shape:n.shape,flags:{...n.flags}});
 const interfaceLinks={};
 const nodes=processing.map(n=>{const inputs={...postClone(n.properties.dshUnknown||{})};
  for(const [index,input] of (n.inputs||[]).entries()){
   const value=sourceOf(linkAt(n,index)),widget=n.widgets?.find(w=>w.name===input.name);
   if(value){inputs[input.name]=value;if(value.interface){const source=byId.get(linkAt(n,index)?.origin_id);if(source?.properties.dshInterfaceId)(interfaceLinks[n.properties.dshId]||={})[input.name]=source.properties.dshInterfaceId;}}
   else if(widget&&!n.properties.dshOmitted?.includes(input.name))inputs[input.name]=widget.value;
  }
  return {id:n.properties.dshId,type:n.properties.dshType,inputs,x:n.pos[0],y:n.pos[1]};
 });
 const results=all.filter(n=>n.properties.dshKind==='result'),output=results.length===1?sourceOf(linkAt(results[0],0)):null;
 const reroutes=[...(graph.reroutes?.values()||[])].map(r=>{const data=r.asSerialisable();const targets=(data.linkIds||[]).flatMap(id=>{const link=graph.links[id],target=link&&byId.get(link.target_id);return target?[{kind:target.properties.dshKind,id:target.properties.dshId,index:results.indexOf(target),slot:link.target_slot,parentId:link.parentId}]:[];});return {...data,linkIds:undefined,targets};});
 return {...base,nodes,output:output?.node?output:null,editor:{version:1,nodes:Object.fromEntries(processing.map(n=>[n.properties.dshId,appearance(n)])),interfaces:all.filter(n=>n.properties.dshKind==='interface').map(n=>({...appearance(n),group:n.properties.dshInterface||'all',id:n.properties.dshInterfaceId})).sort((a,b)=>String(a.id||'').localeCompare(String(b.id||''))),interfaceLinks,result:results.map(appearance),groups:(graph._groups||[]).map(g=>g.serialize()),reroutes}};
}


const NATIVE_NODE_TOOLBAR_STYLE=`.cc-native-node-toolbar{position:absolute;z-index:45;display:flex;align-items:center;gap:3px;padding:5px 7px;border:1px solid #484a53;border-radius:9px;background:#252730;color:#a4a5aa;box-shadow:0 3px 10px #0004;transform:translateX(-50%)}.cc-native-node-toolbar[hidden]{display:none}.cc-native-node-toolbar button{display:flex;align-items:center;justify-content:center;gap:4px;width:32px;height:30px;min-height:0;padding:5px;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer}.cc-native-node-toolbar button:hover,.cc-native-node-toolbar button[aria-pressed=true]{background:#383b45;color:#eee}.cc-native-node-toolbar button:focus-visible{outline:2px solid #8faed2;outline-offset:-2px}.cc-native-node-toolbar .cc-node-tool-separator{width:1px;height:24px;margin:0 3px;background:#44464f}.cc-native-node-toolbar svg{display:block;width:18px;height:18px;flex:none}.cc-native-node-toolbar .cc-node-tool-color{width:32px}`;
function installNativeNodeToolbar({canvas,graph,element,info,fail,changed,LiteGraph,LGraphCanvas}){
 const doc=element.ownerDocument,toolbar=doc.createElement('div');toolbar.className='cc-native-node-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','节点快捷操作');toolbar.hidden=true;element.parentElement.append(toolbar);
 const paths={remove:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',color:'<circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/>',resize:'<path d="m3 3 6 6m-6-1V3h5m13 0-6 6m6-1V3h-5M3 21l6-6m-6 1v5h5m13 0-6-6m6 1v5h-5"/>',collapse:'<path d="m5 9 7 7 7-7M5 4h14"/>',more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'};
 let selected=[],signature='',disposed=false;
 const mutate=fn=>{graph.beforeChange();try{fn();}catch(error){fail(errText(error));}finally{graph.afterChange();canvas.setDirty(true,true);changed();update();}};
 const command=(key,event)=>{
  const node=selected[0];if(!node||canvas.read_only)return;LGraphCanvas.active_canvas=canvas;LiteGraph.closeAllContextMenus();
  try{
   if(key==='remove')mutate(()=>canvas.deleteSelected());
   else if(key==='info'){
    const spec=info[node.properties.dshType],group=NATIVE_EXTERNAL_GROUPS.find(g=>g.id===node.properties.dshInterface),text=selected.length>1?selected.map(n=>n.title).join('\n'):[spec?.description||group?.title||'工作流图片输出接口',node.properties.dshType?'类型：'+node.properties.dshType:'',...(node.inputs?.length?['输入：'+node.inputs.map(p=>p.name+' ('+p.type+')').join('、')]:[]),...(node.outputs?.length?['输出：'+node.outputs.map(p=>p.name+' ('+p.type+')').join('、')]:[])].filter(Boolean).join('\n\n');
    editorDocumentDialog({title:selected.length>1?'已选中 '+selected.length+' 个节点':node.title,message:text,choices:[['cancel','关闭']]});
   }else if(key==='color')LGraphCanvas.onMenuNodeColors(null,{},event,null,node);
   else if(key==='resize')mutate(()=>LGraphCanvas.onMenuResizeNode(null,{},event,null,node));
   else if(key==='collapse')mutate(()=>LGraphCanvas.onMenuNodeCollapse(null,{},event,null,node));
   else if(key==='more'){
    const trigger=new MouseEvent('contextmenu',{clientX:event.clientX,clientY:event.clientY,bubbles:false});trigger.canvasX=node.pos[0]+node.size[0]/2;trigger.canvasY=node.pos[1]+15;canvas.processContextMenu(node,trigger);
   }
  }catch(error){fail(errText(error));}
 };
 function render(){
  toolbar.replaceChildren();for(const [key,label] of [['remove','删除节点'],['info','节点说明'],['color','节点颜色'],['resize','自动调整节点大小'],['collapse','折叠或展开节点'],['more','更多节点选项']]){
   if(key==='info'||key==='resize'||key==='more'){const separator=doc.createElement('span');separator.className='cc-node-tool-separator';separator.setAttribute('aria-hidden','true');toolbar.append(separator);}
   const button=doc.createElement('button');button.type='button';button.title=label;button.setAttribute('aria-label',label);button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[key]+'</svg>';button.onclick=e=>command(key,e);
   if(key==='color'){button.className='cc-node-tool-color';button.setAttribute('aria-haspopup','menu');const swatch=button.querySelector('circle');swatch.setAttribute('fill',selected[0].bgcolor||selected[0].color||'#999');swatch.setAttribute('stroke','#aaa');swatch.setAttribute('stroke-width','1');}
   if(key==='collapse')button.setAttribute('aria-pressed',String(!!selected[0].flags.collapsed));if(key==='more')button.setAttribute('aria-haspopup','menu');toolbar.append(button);
  }
 }
 function update(){
  if(disposed)return;selected=Object.values(canvas.selected_nodes||{}).filter(n=>n.graph===graph);if(!selected.length||canvas.read_only||canvas.dragging_canvas||canvas.node_dragged){toolbar.hidden=true;return;}
  const next=selected.map(n=>[n.id,n.title,n.color,!!n.flags.collapsed].join('|')).join(';');if(next!==signature){signature=next;render();}
  const bounds=selected.reduce((b,n)=>{const r=n.getBounding();return [Math.min(b[0],r[0]),Math.min(b[1],r[1]),Math.max(b[2],r[0]+r[2]),Math.max(b[3],r[1]+r[3])];},[Infinity,Infinity,-Infinity,-Infinity]),top=canvas.ds.convertOffsetToCanvas([bounds[0],bounds[1]]),bottom=canvas.ds.convertOffsetToCanvas([bounds[2],bounds[3]]),width=element.parentElement.clientWidth,height=element.parentElement.clientHeight;
  if(bottom[0]<0||top[0]>width||bottom[1]<0||top[1]>height){toolbar.hidden=true;return;}toolbar.hidden=false;
  const half=(toolbar.offsetWidth||278)/2,x=Math.min(width-half-8,Math.max(half+8,(top[0]+bottom[0])/2)),y=top[1]>58?top[1]-52:Math.min(height-50,bottom[1]+10);
  toolbar.style.left=x+'px';toolbar.style.top=Math.max(8,y)+'px';
 }
 toolbar.addEventListener('pointerdown',e=>e.stopPropagation());toolbar.addEventListener('wheel',e=>e.stopPropagation());
 const priorSelection=canvas.onSelectionChange,priorDraw=canvas.onDrawForeground;canvas.onSelectionChange=(...args)=>{priorSelection?.(...args);update();};canvas.onDrawForeground=(...args)=>{priorDraw?.(...args);update();};
 return {update,dispose(){disposed=true;toolbar.remove();canvas.onSelectionChange=priorSelection;canvas.onDrawForeground=priorDraw;}};
}

// Associate primitive inputs with their native widgets. LiteGraph owns their
// inline positions, hover visibility, hit testing and connected-link rendering.
function nativeWorkflowAddInput(node,key,definition,value,onChange){
 const port=nativeWorkflowType(definition),config=definition[1]||{};
 const options=Array.isArray(definition[0])?definition[0]:definition[0]==='COMBO'?config.options:null;
 const hasWidget=!config.forceInput&&(options||['BOOLEAN','INT','FLOAT','STRING'].includes(port));
 const input=node.addInput(key,port,hasWidget?{widget:{name:key}}:undefined);
 let widget;
 if(hasWidget){
  if(options)widget=node.addWidget('combo',key,value??options[0],onChange,{values:options});
  else if(port==='BOOLEAN')widget=node.addWidget('toggle',key,value??false,onChange,{on:'true',off:'false'});
  else if(port==='INT'||port==='FLOAT')widget=node.addWidget('number',key,value??0,onChange,{min:config.min,max:config.max,step:port==='INT'?10:(config.step||.01)*10,precision:port==='INT'?0:3});
  else widget=node.addWidget('text',key,value??'',onChange,{});
  input._widget=widget;
 }
 return input;
}

function createNativeWorkflowCanvas(element,workflow,info,{onChange,onError}={}){
 const engine=comfyNativeEngine(),{LiteGraph,LGraph,LGraphNode,LGraphCanvas,LGraphGroup}=engine;
 // This is the actual Comfy-Org canvas renderer and widget engine, not DOM node cards.
 LiteGraph.NODE_TITLE_COLOR='#999';LiteGraph.NODE_DEFAULT_COLOR='#333';LiteGraph.NODE_DEFAULT_BGCOLOR='#353535';
 LiteGraph.WIDGET_BGCOLOR='#222';LiteGraph.WIDGET_TEXT_COLOR='#ddd';LiteGraph.WIDGET_OUTLINE_COLOR='#666';
 LiteGraph.context_menu_scaling=false;
 LiteGraph.NODE_DEFAULT_SHAPE=LiteGraph.ROUND_SHAPE;LiteGraph.MAX_NUMBER_OF_NODES=120;
 const valid=LiteGraph.isValidConnection.bind(LiteGraph);if(!LiteGraph._dshTypes){LiteGraph.isValidConnection=(a,b)=>a==='INT'&&b==='FLOAT'||valid(a,b);LiteGraph._dshTypes=true;}
 const graph=new LGraph(),canvas=new LGraphCanvas(element,graph,{autoresize:false});
 canvas.clear_background_color='#141414';canvas.background_image=LGraphCanvas.DEFAULT_BACKGROUND_IMAGE;canvas.show_info=false;
 canvas.render_shadows=true;canvas.render_connections_border=false;canvas.render_canvas_border=false;canvas.allow_searchbox=true;LGraphCanvas.active_canvas=canvas;
 canvas.default_connection_color_byType={IMAGE:'#64B5F6',LATENT:'#FF9CF9',MODEL:'#B39DDB',CLIP:'#FFD54F',VAE:'#FF6E6E',CONDITIONING:'#FFA931',INT:'#80CBC4',FLOAT:'#80CBC4',STRING:'#8BC34A',COMBO:'#8BC34A'};
 LGraphCanvas.link_type_colors={...LGraphCanvas.link_type_colors,...canvas.default_connection_color_byType};
 let loading=true,disposed=false;const legacyPrompts=workflow.nodes.some(n=>Object.values(n.inputs||{}).some(v=>['pos','neg'].includes(v?.interface)));
 const changed=()=>{if(!loading&&!disposed)onChange?.();};
 // Some upstream appearance commands only redraw; include their committed edits
 // in the existing unsaved-work protection without polling or treating pan/zoom as edits.
 const document=element.ownerDocument;let menuEditTimer;
 const menuEdit=event=>{if(!event.target?.closest?.('.litecontextmenu,.graphdialog'))return;if(event.type==='keydown'&&event.key!=='Enter')return;clearTimeout(menuEditTimer);menuEditTimer=setTimeout(()=>{canvas.setDirty(true,true);changed();},0);};


 const fail=message=>onError?.(message);
 const uuid=()=>crypto.randomUUID().replaceAll('-','');
 const syncWidgets=node=>{for(const widget of node.widgets||[]){const slot=node.inputs?.find(i=>i.name===widget.name);widget.disabled=slot?.link!=null;}};
 const guardConnection=function(index,type,output,source){
  if(source===this){fail('工作流不能循环连接');return false;}
  const reaches=(node,target,seen=new Set())=>{if(node===target)return true;if(!node||seen.has(node.id))return false;seen.add(node.id);return (node.inputs||[]).some(i=>i.link!=null&&reaches(graph.getNodeById(graph.links[i.link]?.origin_id),target,seen));};
  if(reaches(source,this)){fail('工作流不能循环连接');return false;}return true;
 };
 const registered=[];
 for(const [type,spec] of Object.entries(info)){
  if(/^(Save|Preview)/i.test(type))continue;
  const name=(spec.category||'其他')+'/'+type;registered.push(name);
  class ComfyNode extends LGraphNode{
   get displayType(){return this.title;}
   constructor(){super(NATIVE_NODE_LABELS[type]||spec.display_name||type);this.title=NATIVE_NODE_LABELS[type]||spec.display_name||type;
    this.serialize_widgets=true;
    this.properties={dshKind:'process',dshType:type,dshId:uuid(),dshUnknown:{},dshOmitted:Object.keys(spec.input?.optional||{}).filter(key=>!(key in (spec.input?.required||{})))};
    const defaults=postDefaults(spec);
    for(const [key,d] of Object.entries({...spec.input?.required,...spec.input?.optional})){
     const widgetChanged=()=>{this.properties.dshOmitted=this.properties.dshOmitted.filter(k=>k!==key);changed();};
     nativeWorkflowAddInput(this,key,d,defaults[key]??d[1]?.default,widgetChanged);
    }
    (spec.output||[]).forEach((t,i)=>this.addOutput(spec.output_name?.[i]||t,t));
    this.size=[Math.max(280,this.computeSize()[0]),this.computeSize()[1]];
    this.onConnectInput=guardConnection;this.onConnectionsChange=()=>{syncWidgets(this);changed();};this.onWidgetChanged=changed;
   }
  }
  ComfyNode.title=NATIVE_NODE_LABELS[type]||spec.display_name||type;ComfyNode.skip_list=!!spec.output_node||['__hidden__','_for_testing'].some(c=>(spec.category||'').split('/').includes(c))||Object.values(spec.input?.required||{}).some(d=>d[0]==='COMFY_AUTOGROW_V3');LiteGraph.registerNodeType(name,ComfyNode);
 }
 for(const group of NATIVE_EXTERNAL_GROUPS){
  class ExternalInputNode extends LGraphNode{
   get displayType(){return this.title;}
   constructor(){super(group.title);this.title=group.title;this.properties={dshKind:'interface',dshInterface:group.id,dshInterfaceId:uuid(),dshLegacyPrompts:group.id==='all'&&loading&&legacyPrompts};for(const key of nativeExternalKeys(this)){const port=POST_INTERFACES.find(x=>x[0]===key);this.addOutput(port[1],port[2]);}this.color='#233';this.bgcolor='#344';this.size=[240,this.computeSize()[1]];}
  }
  ExternalInputNode.title=group.title;ExternalInputNode.skip_list=!!group.hidden;LiteGraph.registerNodeType(group.type,ExternalInputNode);
 }
 class ResultNode extends LGraphNode{constructor(){super('DSH 处理结果');this.title='DSH 处理结果';this.properties={dshKind:'result'};this.addInput('处理后的图片','IMAGE');this.color='#232';this.bgcolor='#343';this.size=[240,70];this.onConnectInput=guardConnection;}}
 ResultNode.title='DSH 处理结果';
 LiteGraph.registerNodeType('DSH/处理结果',ResultNode);
 graph.onNodeAdded=node=>{
  if(node.properties.dshKind==='interface'&&graph._nodes.some(n=>n!==node&&n.properties.dshKind==='interface'&&n.properties.dshInterfaceId===node.properties.dshInterfaceId))node.properties.dshInterfaceId=uuid();
  if(node.properties.dshKind==='process'){
   const processing=graph._nodes.filter(n=>n.properties.dshKind==='process');
   if(processing.length>100){graph.remove(node);fail('工作流最多 100 个节点');return;}
   if(processing.some(n=>n!==node&&n.properties.dshId===node.properties.dshId))node.properties.dshId=uuid();
   if(!loading){const input=nativeExternalSource(graph._nodes.filter(n=>n.properties.dshKind==='interface'),'image'),required=info[node.properties.dshType]?.input?.required||{};(node.inputs||[]).forEach((slot,i)=>{if(slot.type==='IMAGE'&&input&&slot.name in required)input.node.connect(input.slot,node,i);});
    const result=graph._nodes.find(n=>n.properties.dshKind==='result');const output=node.outputs?.findIndex(o=>o.type==='IMAGE');if(result&&result.inputs[0].link==null&&output>=0)node.connect(output,result,0);
   }
  }
  graph._nodes.sort((a,b)=>(a.properties.dshKind==='result')-(b.properties.dshKind==='result'));
 };
 const applyAppearance=(node,a)=>{if(!a)return;if(a.size?.length===2)node.size=a.size;if(a.title)node.title=node.properties.dshKind==='interface'?nativeExternalTitle(a.title):a.title;if(a.color)node.color=a.color;if(a.bgcolor)node.bgcolor=a.bgcolor;if(a.shape!=null)node.shape=a.shape;node.flags={...node.flags,...a.flags};if(a.pos?.length===2)node.pos=a.pos;};
 const interfaces=(Array.isArray(workflow.editor?.interfaces)?workflow.editor.interfaces:[{pos:[-240,100]}]).map(a=>{const group=NATIVE_EXTERNAL_GROUPS.find(g=>g.id===(a.group||'all'));if(!group)throw Error('未知外部输入分组：'+a.group);const n=LiteGraph.createNode(group.type);if(typeof a.id==='string'&&a.id)n.properties.dshInterfaceId=a.id;applyAppearance(n,a);graph.add(n);return n;});
 const externalBinding=(key,preferred)=>{let source=nativeExternalSource(interfaces,key,preferred);if(!source){const group=NATIVE_EXTERNAL_GROUPS.find(g=>g.keys?.includes(key));if(!group)return null;const node=LiteGraph.createNode(group.type);node.pos=[-240,100+interfaces.length*100];graph.add(node);interfaces.push(node);source={node,slot:group.keys.indexOf(key)};}return source;};
 const results=(workflow.editor?.result?.length?workflow.editor.result:[{pos:[Math.max(750,...workflow.nodes.map(n=>(n.x||0)+380)),100]}]).map(a=>{const n=LiteGraph.createNode('DSH/处理结果');applyAppearance(n,a);graph.add(n);return n;});
 const loaded=new Map();
 for(const raw of workflow.nodes){
  const spec=info[raw.type],type=spec?(spec.category||'其他')+'/'+raw.type:null;
  if(!type||!registered.includes(type)){fail('ComfyUI 缺少节点 '+raw.type+'，无法安全编辑；请先安装节点');canvas.stopRendering();canvas.unbindEvents();throw Error('缺少 ComfyUI 节点：'+raw.type);}
  const node=LiteGraph.createNode(type);node.properties.dshId=raw.id;node.properties.dshOmitted=node.properties.dshOmitted.filter(key=>!(key in raw.inputs));node.pos=[raw.x??100,raw.y??100];
  const keys=new Set((node.inputs||[]).map(i=>i.name));node.properties.dshUnknown=Object.fromEntries(Object.entries(raw.inputs||{}).filter(([key])=>!keys.has(key)));
  for(const widget of node.widgets||[])if(raw.inputs[widget.name]!=null&&typeof raw.inputs[widget.name]!=='object')widget.value=raw.inputs[widget.name];
  applyAppearance(node,workflow.editor?.nodes?.[raw.id]);graph.add(node);loaded.set(raw.id,node);
 }
 for(const raw of workflow.nodes){const node=loaded.get(raw.id);for(const [key,value] of Object.entries(raw.inputs||{})){
  const slot=node.inputs.findIndex(i=>i.name===key);if(slot<0)continue;
  if(value?.interface){const source=externalBinding(value.interface,workflow.editor?.interfaceLinks?.[raw.id]?.[key]);if(source)source.node.connect(source.slot,node,slot);}
  else if(value?.node)loaded.get(value.node)?.connect(value.slot,node,slot);
 }syncWidgets(node);}
 if(workflow.output)loaded.get(workflow.output.node)?.connect(workflow.output.slot,results[0],0);
 for(const route of workflow.editor?.reroutes||[]){const links=(route.targets||[]).flatMap(t=>{const node=t.kind==='process'?loaded.get(t.id):t.kind==='result'?results[t.index]:null;const id=node?.inputs?.[t.slot]?.link;const link=id!=null?graph.links[id]:null;if(link){link.parentId=t.parentId;return [id];}return [];});if(links.length)graph.setReroute({...route,linkIds:links});}
 for(const data of workflow.editor?.groups||[]){const group=new LGraphGroup();group.configure(data);graph.add(group);}
 // Keep Comfy-Org's actual context-menu callbacks; only omit unsupported execution/subgraph commands.
 const extraInfo={'处理结果':{display_name:'DSH 处理结果',category:'DSH',description:'将最终处理后的 IMAGE 连接到此节点。',input:{required:{'处理后的图片':['IMAGE']}}}};
 for(const group of NATIVE_EXTERNAL_GROUPS.filter(g=>!g.hidden)){const keys=group.keys||POST_INTERFACES.map(x=>x[0]).filter(key=>!['pos','neg'].includes(key)),ports=keys.map(key=>POST_INTERFACES.find(x=>x[0]===key)),type=group.type.split('/').at(-1);extraInfo[type]={display_name:group.title,category:group.id==='all'?'DSH':'DSH/外部输入',description:nativeExternalGroupDescription(group),output:ports.map(x=>x[2]),output_name:ports.map(x=>x[1])};}
 const visible=registered.filter(name=>{const spec=LiteGraph.registered_node_types[name];return !spec.skip_list;});
 const catalog=[...nativeNodeCatalog(info,visible),...nativeNodeCatalog(extraInfo,[...NATIVE_EXTERNAL_GROUPS.filter(g=>!g.hidden).map(g=>g.type),'DSH/处理结果'])];
 const addNode=(item,event,options={})=>{
  graph.beforeChange();
  try{const node=LiteGraph.createNode(item.name);if(!node)throw Error('节点类型不可用：'+item.title);node.pos=canvas.convertEventToCanvasOffset(event);graph.add(node);if(node.graph!==graph)throw Error('工作流节点数量已达到上限');
   const slotIndex=(owner,output)=>{const slot=options.slot_from,slots=output?owner.outputs:owner.inputs;if(typeof slot==='number')return slot;if(typeof slot==='string')return slots.findIndex(p=>p.name===slot);if(slot&&typeof slot==='object')return slot.slot_index??slots.findIndex(p=>p.name===slot.name);return 0;};
   if(options.node_from){const from=options.node_from,index=slotIndex(from,true);if(from.outputs?.[index])from.connectByType(index,node,from.outputs[index].type);}
   if(options.node_to){const to=options.node_to,index=slotIndex(to,false);if(to.inputs?.[index])to.connectByTypeOutput(index,node,to.inputs[index].type);}
   canvas.setDirty(true,true);changed();return node;
  }finally{graph.afterChange();}
 };
 const addMenu=(_value,_options,event,parent)=>{
  const entriesFor=prefix=>{const entries=[],groups=new Set();for(const item of catalog){const path=item.category.split('/'),part=path[prefix.length];if(prefix.some((p,i)=>path[i]!==p))continue;
   if(path.length>prefix.length){if(groups.has(part))continue;groups.add(part);entries.push({content:NATIVE_CATEGORY_LABELS[part]||part,has_submenu:true,callback:(_v,_o,e,menu)=>{new LiteGraph.ContextMenu(entriesFor([...prefix,part]),{event:e,parentMenu:menu});return false;}});}
   else entries.push({content:item.title,callback:(_v,_o,_e,menu)=>{try{addNode(item,menu.getFirstEvent());}catch(error){fail(errText(error));}}});
  }return entries;};new LiteGraph.ContextMenu(entriesFor([]),{event,parentMenu:parent});return false;
 };
 const canvasMenu=canvas.getCanvasMenuOptions.bind(canvas),nodeMenu=canvas.getNodeMenuOptions.bind(canvas);
 canvas.getCanvasMenuOptions=()=>{const options=nativeMenuOptions(canvasMenu()).map(item=>item?.content==='添加节点'?{...item,callback:addMenu}:item);let copied=false;try{copied=!!localStorage.getItem('litegrapheditor_clipboard');}catch{}
  options.push({content:'粘贴',disabled:!copied,callback:(_v,_o,_event,menu)=>{try{canvas.pasteFromClipboard({position:canvas.convertEventToCanvasOffset(menu.getFirstEvent())});canvas.setDirty(true,true);changed();}catch(error){fail('粘贴失败：'+errText(error));}}});return options;
 };
 canvas.getNodeMenuOptions=n=>{const entries=nativeMenuOptions(nodeMenu(n));const cloneIndex=entries.findIndex(item=>item?.content==='克隆');entries.splice(cloneIndex<0?entries.length:cloneIndex,0,{content:'复制',callback:()=>{try{canvas.copyToClipboard(canvas.selectedItems.size?canvas.selectedItems:new Set([n]));}catch(error){fail('复制失败：'+errText(error));}}});const output=n.properties.dshKind==='process'?(n.outputs||[]).flatMap((o,i)=>o.type==='IMAGE'?[{content:'设为处理结果'+((n.outputs||[]).filter(s=>s.type==='IMAGE').length>1?' · '+o.name:''),callback:()=>{const result=graph._nodes.find(n=>n.properties.dshKind==='result');if(result){n.connect(i,result,0);canvas.setDirty(true,true);changed();}}}]:[]):[];return [...(output.length?[...output,null]:[]),...entries];};
 canvas.showSearchBox=(event,options)=>{LiteGraph.closeAllContextMenus();return showNativeNodeBrowser(canvas,event,catalog,{add:addNode,onError:fail,options});};
 const fit=()=>{const nodes=graph._nodes;if(!nodes.length)return;const x=Math.min(...nodes.map(n=>n.pos[0])),y=Math.min(...nodes.map(n=>n.pos[1]-30)),right=Math.max(...nodes.map(n=>n.pos[0]+n.size[0])),bottom=Math.max(...nodes.map(n=>n.pos[1]+n.size[1])),width=element.clientWidth,height=element.clientHeight;const scale=Math.min(1.2,Math.max(.25,Math.min((width-100)/(right-x),(height-100)/(bottom-y))));canvas.ds.scale=scale;canvas.ds.offset=[width/(2*scale)-(x+right)/2,height/(2*scale)-(y+bottom)/2];canvas.setDirty(true,true);};
 // Comfy-Org's renderer scales its background by devicePixelRatio internally.
 // Both backing canvases must have physical pixel dimensions or right-hand links are clipped.
 const resize=()=>{const ratio=window.devicePixelRatio||1,size=nativeWorkflowCanvasSize(element.parentElement.clientWidth,element.parentElement.clientHeight,ratio);canvas.resize(size.width,size.height);canvas.ctx.setTransform(ratio,0,0,ratio,0,0);canvas.setDirty(true,true);};const observer=new ResizeObserver(resize);observer.observe(element.parentElement);window.addEventListener('resize',resize);resize();fit();
 for(const type of ['pointerup','click','keydown'])document.addEventListener(type,menuEdit,true);
 const externalHints=installNativeExternalHints(element,canvas,graph);
 const nodeToolbar=installNativeNodeToolbar({canvas,graph,element,info,fail,changed,LiteGraph,LGraphCanvas});
 graph.on_change=changed;graph.onAfterChange=changed;canvas.onNodeMoved=changed;loading=false;
 return {graph,canvas,read:base=>nativeWorkflowRead(graph,base),fit,search:()=>{const r=element.getBoundingClientRect();LGraphCanvas.active_canvas=canvas;canvas.showSearchBox(new MouseEvent('click',{clientX:r.left+r.width/2,clientY:r.top+100}));},focus:kind=>{const n=graph._nodes.find(n=>n.properties.dshKind===kind);if(n){canvas.centerOnNode(n);canvas.setDirty(true,true);}},setReadOnly:value=>{canvas.read_only=value;nodeToolbar.update();canvas.allow_interaction=!value;canvas.allow_dragnodes=!value;if(value){LiteGraph.closeAllContextMenus();canvas.search_box?.close();canvas.prompt_box?.close();}},dispose:()=>{disposed=true;externalHints.dispose();nodeToolbar.dispose();clearTimeout(menuEditTimer);for(const type of ['pointerup','click','keydown'])document.removeEventListener(type,menuEdit,true);observer.disconnect();window.removeEventListener('resize',resize);canvas.stopRendering();canvas.unbindEvents();graph.on_change=null;graph.onAfterChange=null;canvas.search_box?.close();canvas.prompt_box?.close();LiteGraph.closeAllContextMenus();}};
}

function NativeComfyWorkflowEditor({workflow,info,onSave,onClose,session,onReady,onFailure}){
 const [name,setName]=React.useState(workflow.name||'未命名工作流'),[editing,setEditing]=React.useState(false),[titleDraft,setTitleDraft]=React.useState(''),[menu,setMenu]=React.useState(false),[error,setError]=useErrorState(''),[busy,setBusy]=React.useState(false),[dirty,setDirty]=React.useState(false),[ready,setReady]=React.useState(false);
 const element=React.useRef(null),editor=React.useRef(null),base=React.useRef(postClone(workflow)),baseline=React.useRef(''),currentName=React.useRef(name),lock=React.useRef(false),dirtyRef=React.useRef(false),changeTimer=React.useRef(null),titleInput=React.useRef(null),menuRoot=React.useRef(null),saveRef=React.useRef(null),renameRef=React.useRef(null);
 const snapshot=()=>editor.current?.read({...base.current,name:currentName.current});
 const mark=()=>{if(!editor.current)return;const value=JSON.stringify(snapshot())!==baseline.current;dirtyRef.current=value;setDirty(value);window.pywebview?.api.set_dirty(value);};
 const initialize=draft=>{clearTimeout(changeTimer.current);editor.current?.dispose();base.current=postClone(draft);currentName.current=draft.name||'未命名工作流';setName(currentName.current);editor.current=createNativeWorkflowCanvas(element.current,draft,info,{onChange:()=>{clearTimeout(changeTimer.current);changeTimer.current=setTimeout(mark,40);},onError:setError});baseline.current=JSON.stringify(snapshot());dirtyRef.current=false;setDirty(false);window.pywebview?.api.set_dirty(false);setReady(true);};
 React.useEffect(()=>{
  let readyFrame;try{initialize(workflow);readyFrame=requestAnimationFrame(()=>onReady?.());}catch(e){setError(errText(e));onFailure?.(e);}
  const ready=()=>window.pywebview?.api.set_dirty(dirtyRef.current);window.addEventListener('pywebviewready',ready);
  const requestSave=()=>saveRef.current(false),prepareClose=()=>{if(lock.current||document.querySelector('dialog[open]'))return 'blocked';if(renameRef.current?.()===false)return 'blocked';mark();return dirtyRef.current;};
  window.dshWorkflow={requestSave,prepareClose,async requestClose(){const state=prepareClose();if(state==='blocked')return false;if(!state)return true;const answer=await editorDocumentDialog({title:'保存工作流',message:'是否保存“'+currentName.current+'”的修改？',choices:[['cancel','取消'],['discard','不保存'],['save','保存']]});if(answer.action==='discard')return true;if(answer.action==='save')return await saveRef.current(false);return false;}};
  const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();renameRef.current?.();saveRef.current(e.shiftKey);}};window.addEventListener('keydown',key);
  return()=>{cancelAnimationFrame(readyFrame);clearTimeout(changeTimer.current);editor.current?.dispose();editor.current=null;window.removeEventListener('pywebviewready',ready);window.removeEventListener('keydown',key);if(window.dshWorkflow?.requestSave===requestSave)delete window.dshWorkflow;};
 },[]);
 React.useEffect(()=>{document.title=name+' · 自定义工作流';},[name]);
 React.useEffect(()=>{if(editing){titleInput.current?.focus();titleInput.current?.select();}},[editing]);
 React.useEffect(()=>{if(!menu)return;const dismiss=e=>{if(!menuRoot.current?.contains(e.target))setMenu(false);};const key=e=>{if(e.key==='Escape'){setMenu(false);menuRoot.current?.querySelector('button')?.focus();}};document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',key);menuRoot.current?.querySelector('[role=menuitem]')?.focus();return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',key);};},[menu]);
 function commitName(){if(!editing)return true;const value=(titleInput.current?.value||'').trim().slice(0,128);if(!value){setError('工作流名称不能为空');titleInput.current?.focus();return false;}currentName.current=value;setName(value);setEditing(false);setError('');mark();return true;}
 renameRef.current=()=>editing?commitName():true;
 async function save(asNew=false){
  if(lock.current||!editor.current||document.querySelector('dialog[open]'))return false;if(editing&&!commitName())return false;
  let draft=snapshot();
  if(asNew){const answer=await editorDocumentDialog({title:'另存为工作流',name:currentName.current+' 副本',choices:[['cancel','取消'],['save','另存为']]});if(answer.action!=='save')return false;draft={...draft,name:answer.name};delete draft.id;}
  const errors=postWorkflowErrors(draft,info);if(errors.length){setError(errors.join('；'));return false;}
  lock.current=true;setBusy(true);setError('');editor.current.setReadOnly(true);
  try{const r=await jpost('/workflow/session/'+session,{workflow:draft},20000);base.current=postClone(r.workflow);currentName.current=r.workflow.name;setName(r.workflow.name);baseline.current=JSON.stringify(snapshot());dirtyRef.current=false;setDirty(false);await window.pywebview?.api.set_dirty(false);onSave(r.workflow);return true;}
  catch(e){setError(errText(e));return false;}finally{lock.current=false;setBusy(false);editor.current?.setReadOnly(false);}
 }
 saveRef.current=save;
 async function newDocument(){if(lock.current)return;if(editing&&!commitName())return;mark();if(dirtyRef.current){const answer=await editorDocumentDialog({title:'新建工作流',message:'是否保存当前工作流的修改？',choices:[['cancel','取消'],['discard','不保存'],['save','保存']]});if(answer.action==='cancel'||answer.action==='save'&&!await save(false))return;}try{initialize({name:'未命名工作流',nodes:[],output:null});setError('');}catch(e){setError(errText(e));}}
 const action=fn=>{setMenu(false);fn();};
 const headerStyle=`.cc-comfy-native-top{position:relative;gap:6px}.cc-document-menu{position:relative;flex:none}.cc-comfy-native-top .cc-document-icon{display:flex;align-items:center;gap:8px;padding:5px 9px;background:transparent;border-color:transparent}.cc-document-menu-list{position:absolute;top:calc(100% + 6px);left:0;z-index:70;min-width:230px;padding:5px;background:var(--cc-surface,#252730);border:1px solid var(--cc-border,#555);border-radius:6px;box-shadow:0 8px 24px #0005}.cc-comfy-native-top .cc-document-menu-list button{display:flex;justify-content:space-between;gap:32px;width:100%;border:0;background:transparent;text-align:left;border-radius:3px}.cc-document-menu-list kbd{font:11px system-ui;color:var(--cc-muted,#999)}.cc-comfy-native-top .cc-document-title{min-width:0;max-width:50vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:transparent;border:1px solid transparent;text-align:left;font-weight:600}.cc-comfy-native-top input.cc-document-name{flex:none;width:340px;max-width:50vw}.cc-document-dirty{color:var(--cc-accent,#8faed2);font-size:17px}.cc-comfy-native-top .cc-document-status{margin-left:auto;color:var(--cc-muted,#aaa);font-size:12px}`;
 return h('main',{className:'cc-comfy-native'},h('style',null,COMFY_NATIVE_STYLE+COMFY_BROWSER_STYLE+NATIVE_NODE_TOOLBAR_STYLE+headerStyle),
  h('header',{className:'cc-comfy-native-top'},h('div',{className:'cc-document-menu',ref:menuRoot},h('button',{type:'button',className:'cc-document-icon','aria-label':'ComfyUI 文件菜单','aria-haspopup':'menu','aria-expanded':menu,disabled:busy||!ready,onClick:()=>setMenu(v=>!v)},h(OfflineComfyMark,{size:25}),h('span',{'aria-hidden':true},'▾')),menu?h('div',{role:'menu',className:'cc-document-menu-list'},...[[newDocument,'新建',''],[()=>save(false),'保存','Ctrl+S'],[()=>save(true),'另存为','Ctrl+Shift+S']].map(([fn,label,shortcut])=>h('button',{key:label,role:'menuitem',type:'button',onClick:()=>action(fn)},label,h('kbd',null,shortcut)))):null),
   editing?h('input',{ref:titleInput,className:'cc-document-name','aria-label':'工作流名称',maxLength:128,value:titleDraft,onChange:e=>setTitleDraft(e.target.value),onBlur:commitName,onKeyDown:e=>{if(e.key==='Enter'){e.preventDefault();commitName();}if(e.key==='Escape'){e.preventDefault();setEditing(false);}}}):h('button',{type:'button',className:'cc-document-title',title:name+' · 双击改名','aria-label':'工作流名称：'+name+'，双击改名',disabled:busy,onDoubleClick:()=>{setTitleDraft(currentName.current);setEditing(true);}},name),
   dirty?h('span',{className:'cc-document-dirty',title:'有未保存的修改','aria-label':'未保存'},'•'):null,h('span',{className:'cc-document-status',role:'status'},busy?'保存中…':'自定义工作流')),
  error?h('div',{role:'alert',className:'cc-comfy-native-error'},error):null,
  h('div',{className:'cc-comfy-native-stage'},h('canvas',{ref:element,tabIndex:0,'aria-label':'ComfyUI 原生工作流画布'}),
   h('nav',{className:'cc-comfy-canvas-tools','aria-label':'工作流操作'},h('button',{disabled:busy||!ready,onClick:()=>editor.current.search()},'添加节点'),h('button',{disabled:busy||!ready,onClick:()=>editor.current.focus('interface')},'输入接口'),h('button',{disabled:busy||!ready,onClick:()=>editor.current.focus('result')},'处理结果')),
   h('div',{className:'cc-comfy-canvas-zoom'},h('button',{disabled:busy||!ready,onClick:()=>editor.current.fit()},'适应全部'),h('button',{disabled:busy||!ready,onClick:()=>{editor.current.canvas.ds.scale=1;editor.current.canvas.setDirty(true,true);}},'100%'))),
  h('footer',null,'双击空白搜索节点 · 右键菜单 · 滚轮缩放 · 拖动端口连线 · 将结果连接到「DSH 处理结果」'));
}
