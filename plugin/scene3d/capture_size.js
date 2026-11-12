/** Output pixels are derived from a standard 1K preset and a separately selected tier. */
export const CAPTURE_TIERS=[256,512,1024,2048];
export function captureAspect(settings){return Number.isFinite(settings.frameAspect)&&settings.frameAspect>=1/64&&settings.frameAspect<=64?settings.frameAspect:settings.width/settings.height;}
export function captureTier(settings){return CAPTURE_TIERS.includes(settings.captureTier)?settings.captureTier:1024;}
export function captureBase(settings){const scale=1024/captureTier(settings);return [Number.isFinite(settings.captureBaseWidth)&&settings.captureBaseWidth>0?settings.captureBaseWidth:settings.width*scale,Number.isFinite(settings.captureBaseHeight)&&settings.captureBaseHeight>0?settings.captureBaseHeight:settings.height*scale];}
export function inferCaptureTier(settings,presets){
 if(CAPTURE_TIERS.includes(settings.captureTier))return settings.captureTier;
 for(const tier of [1024,512,2048,256])for(const row of presets){
  const w=row.w*tier/1024,h=row.h*tier/1024;
  if((settings.width===w&&settings.height===h)||(settings.width===h&&settings.height===w))return tier;
 }
 return 1024; // Preserve arbitrary legacy pixel sizes exactly, treating them as a custom 1K base.
}
function checked(width,height,tier){
 width=Math.round(width);height=Math.round(height);
 if(!CAPTURE_TIERS.includes(tier)||width<64||height<64||width>4096||height>4096)throw Error('该比例在此档位下超出截图范围，请选择较小档位（每边需为 64–4096 像素）');
 return {width,height,captureTier:tier};
}
export function captureAtTier(settings,tier){const [width,height]=captureBase(settings);return {...checked(width*tier/1024,height*tier/1024,tier),captureBaseWidth:width,captureBaseHeight:height,frameAspect:captureAspect(settings)};}
export function captureFromPreset(settings,width,height){const tier=captureTier(settings);return {...checked(width*tier/1024,height*tier/1024,tier),captureBaseWidth:width,captureBaseHeight:height,frameAspect:width/height};}
export function swapCaptureRatio(settings){const [width,height]=captureBase(settings);return {...captureFromPreset(settings,height,width),frameAspect:1/captureAspect(settings)};}
export function captureFromAspect(settings,aspect){
 if(!Number.isFinite(aspect)||aspect<1/16||aspect>16)throw Error('自定义比例需在 1:16 至 16:1 之间');
 const [w,h]=captureBase(settings),area=w*h,width=Math.sqrt(area*aspect),height=Math.sqrt(area/aspect);
 return {...captureFromPreset(settings,width,height),frameAspect:aspect};
}
export function captureRatioParts(settings){const aspect=captureAspect(settings);let best=[1,1],error=Infinity;for(let d=1;d<=1000;d++){const n=Math.max(1,Math.round(aspect*d)),e=Math.abs(n/d-aspect);if(e<error){best=[n,d];error=e;}if(e<1e-8)break;}return best;}
export function ratioText(settings){return captureRatioParts(settings).join(':');}
export function capturePresetOptions(rows){
 return rows.map(row=>({value:row.w+'x'+row.h,width:row.w,height:row.h,label:row.label.replace(/\s*·\s*\d+\s*[×x]\s*\d+\s*$/,'')}));
}
