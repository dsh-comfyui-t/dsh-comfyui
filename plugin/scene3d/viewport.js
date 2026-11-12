/** Full-canvas projection with a camera frame fitted into the unobscured area. */
export function fullViewportLayout(width,height,shotWidth,shotHeight,fov,sidebar=0,frameScale=1,frameRoll=0){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),sw=Math.max(.000001,Number(shotWidth)||1),sh=Math.max(.000001,Number(shotHeight)||1),visibleWidth=Math.max(1,w-Math.max(0,Number(sidebar)||0));
 // Use one orientation-independent reference length. Swapping the ratio swaps frame sides,
 // rather than filling a much wider viewport and enlarging the entire horizontal frame.
 const zoom=Math.max(.25,Math.min(1,Number(frameScale)||1)),angle=(Number(frameRoll)||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle)),reference=Math.min(visibleWidth,h)/Math.max(sw,sh),scale=reference*Math.min(1,visibleWidth/((sw*c+sh*s)*reference),h/((sw*s+sh*c)*reference))*zoom,fw=sw*scale,fh=sh*scale,verticalScale=h/fh;
 return {width:w,height:h,aspect:w/h,verticalScale,offsetX:(w-visibleWidth)/w,displayFov:2*Math.atan(Math.tan(Number(fov)*Math.PI/360)*verticalScale)*180/Math.PI,frame:{left:(visibleWidth-fw)/2,top:(h-fh)/2,width:fw,height:fh}};
}
