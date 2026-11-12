import {fullViewportLayout} from './viewport.js';
import {captureFromAspect,captureTier,captureAspect} from './capture_size.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const layout=(settings,viewport)=>fullViewportLayout(Math.round(viewport.width),Math.round(viewport.height),captureAspect(settings),1,settings.fov,0,settings.frameScale??.92,settings.mode==='photo'||settings.mode==='firstPerson'?settings.frameRoll||0:0);

// Keep the scene's screen projection fixed while editing the crop rectangle.
// Capture projection uses the same factor, so the exported image still matches it.
export function preserveFrameProjection(before,after,viewport){
 const a=layout(before,viewport),b=layout(after,viewport);
 return clamp((Number(before.frameProjectionScale)||1)*a.verticalScale/b.verticalScale,.001,1000);
}
export function resizeFrameSettings(initial,rect,viewport,edge,deltaX,deltaY,lockRatio){
 const angle=(Number(initial.frameRoll)||0)*Math.PI/180,dx=deltaX*Math.cos(angle)+deltaY*Math.sin(angle),dy=-deltaX*Math.sin(angle)+deltaY*Math.cos(angle),ratio=rect.width/rect.height;
 let targetWidth=rect.width,targetHeight=rect.height;
 if(edge==='left'||edge==='right'){
  targetWidth=Math.max(32,rect.width+2*dx*(edge==='left'?-1:1));
  if(lockRatio)targetHeight=targetWidth/ratio;
 }else{
  targetHeight=Math.max(32,rect.height+2*dy*(edge==='top'?-1:1));
  if(lockRatio)targetWidth=targetHeight*ratio;
 }
 const output=lockRatio?{width:initial.width,height:initial.height,captureTier:captureTier(initial),frameAspect:captureAspect(initial)}:captureFromAspect(initial,targetWidth/targetHeight);
 const fit=fullViewportLayout(Math.round(viewport.width),Math.round(viewport.height),captureAspect(output),1,initial.fov,0,1,initial.frameRoll).frame;
 const frameScale=clamp(targetWidth/fit.width,.25,1),result={...output,frameScale};result.frameProjectionScale=preserveFrameProjection(initial,{...initial,...result},viewport);return result;
}
