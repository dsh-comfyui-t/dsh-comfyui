/** Global scene lights. Each light has an independent XYZ position, colour and strength. */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
// The effective radius follows light power; the user never edits a separate distance limit.
export function sceneLightRange(power){return clamp(Math.round(20*Math.sqrt(Math.max(0,Number(power)||0)/2.5)*10)/10,1,100);}
export function normalizeSceneLights(value,legacy={}){
 const fallback=()=>{
  const a=(Number(legacy.lightAngle??-35))*Math.PI/180,b=(Number(legacy.lightHeight??55))*Math.PI/180;
  return [{id:'light-primary',name:'光源 1',position:[Math.sin(a)*Math.cos(b)*6,Math.sin(b)*6,Math.cos(a)*Math.cos(b)*6],color:'#ffffff',power:clamp(legacy.lightPower??2.5,0,10),shadow:true,falloff:true,range:sceneLightRange(legacy.lightPower??2.5)}];
 };
 const rows=Array.isArray(value)?value:[]; // New scenes start without point lights; sun light is enough. Explicit [] also means none.
 const used=new Set();return rows.slice(0,8).map((entry,i)=>{
  const row=entry&&typeof entry==='object'?entry:{};
  const p=Array.isArray(row.position)&&row.position.length===3?row.position:fallback()[0].position;
  let id=/^[\w-]{1,70}$/.test(row.id||'')?row.id:'light-'+i;
  while(used.has(id))id+='-copy';used.add(id);
  return {id,name:String(row.name||('光源 '+(i+1))).slice(0,64),position:p.map(x=>clamp(x,-100,100)),color:/^#[0-9a-fA-F]{6}$/.test(row.color||'')?row.color.toLowerCase():'#ffffff',power:clamp(row.power??2.5,0,10),shadow:row.shadow===undefined?i===0:row.shadow===true,falloff:true,range:sceneLightRange(row.power??2.5)};
 });
}
/** One canvas-drawn bulb shared by all light markers. THREE.Sprite automatically
 * faces the active perspective/orthographic camera and remains raycastable.
 * The icon is a VIEW helper; capture mode hides it through setHelpersVisible.
 */
function createLightBulbTexture(THREE){
 if(typeof document==='undefined'){
  // Node/headless schema tests do not have DOM Canvas; the browser uses the
  // detailed drawing below instead. A 1x1 texture keeps the manager testable.
  return new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
 }
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext('2d');if(!ctx)return new THREE.Texture();
 ctx.clearRect(0,0,128,128);
 // Dark backing and bright outline work against light and dark scene colours.
 ctx.fillStyle='rgba(19,25,35,.88)';ctx.strokeStyle='rgba(241,245,249,.98)';ctx.lineWidth=3;
 ctx.beginPath();ctx.arc(64,64,52,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff8df';ctx.lineWidth=5.5;
 // Bulb globe, neck, two base strokes, plus distinct radial light rays.
 ctx.beginPath();ctx.moveTo(53,78);ctx.bezierCurveTo(53,70,44,67,44,55);
 ctx.bezierCurveTo(44,43,53,34,64,34);ctx.bezierCurveTo(75,34,84,43,84,55);
 ctx.bezierCurveTo(84,67,75,70,75,78);ctx.stroke();
 ctx.beginPath();ctx.moveTo(53,81);ctx.lineTo(75,81);ctx.moveTo(55,90);ctx.lineTo(73,90);ctx.moveTo(59,97);ctx.lineTo(69,97);ctx.stroke();
 ctx.lineWidth=4.5;ctx.beginPath();
 for(const [x1,y1,x2,y2] of [[64,22,64,16],[29,55,23,55],[99,55,105,55],[38,31,33,26],[90,31,95,26]]){ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);}
 ctx.stroke();
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;
 return texture;
}
export function createSceneLightManager(THREE,scene){
 const actors=new Map(),markers=[];let helpersVisible=true,groundRadius=50;
 let bulbTexture=null;
 function add(row,i){
  // Inverse-square attenuation is always enabled. Range follows strength.
  const light=new THREE.PointLight(row.color,sceneLightIntensity(row),0,1);
  light.userData.sceneLightId=row.id;light.name=row.name;
  light.position.fromArray(row.position);
  light.castShadow=!!row.shadow;light.shadow.mapSize.set(i===0?1024:512,i===0?1024:512);
  light.shadow.camera.near=.05;light.shadow.camera.far=sceneShadowFar(row,groundRadius);light.shadow.bias=0;light.shadow.normalBias=POINT_SHADOW_NORMAL_BIAS;
  if(!bulbTexture)bulbTexture=createLightBulbTexture(THREE);
  const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:bulbTexture,color:0xffffff,depthTest:false,depthWrite:false,transparent:true}));
  marker.scale.set(.24,.24,1);
  marker.name=row.name+' · 灯泡图标';marker.userData.sceneLightId=row.id;marker.renderOrder=20;marker.visible=helpersVisible;
  light.add(marker);scene.add(light);actors.set(row.id,{light,marker});markers.push(marker);
 }
 function sync(rows){
  const ids=new Set(rows.map(x=>x.id));
  for(const [id,{light,marker}] of actors)if(!ids.has(id)){scene.remove(light);marker.material.dispose();light.dispose?.();actors.delete(id);markers.splice(markers.indexOf(marker),1);}
  rows.forEach((row,i)=>{
   if(!actors.has(row.id))add(row,i);
   const {light,marker}=actors.get(row.id);
   light.name=row.name;light.position.fromArray(row.position);light.color.set(row.color);light.intensity=sceneLightIntensity(row);
   light.castShadow=!!row.shadow;light.distance=0;light.decay=1;marker.name=row.name+' · 灯泡图标';
   const far=sceneShadowFar(row,groundRadius);light.shadow.bias=0;light.shadow.normalBias=POINT_SHADOW_NORMAL_BIAS;if(light.shadow.camera.far!==far){light.shadow.camera.far=far;light.shadow.camera.updateProjectionMatrix();light.shadow.needsUpdate=true;}
  });
 }
 function get(id){return actors.get(id)?.light||null;}
 function pick(raycaster){return raycaster.intersectObjects(markers.filter(x=>x.visible),false)[0]?.object.userData.sceneLightId||null;}
 function setHelpersVisible(value){helpersVisible=!!value;markers.forEach(x=>{x.visible=helpersVisible;});}
 function dispose(){sync([]);bulbTexture?.dispose();bulbTexture=null;}
 return {sync,get,pick,setHelpersVisible,markers,dispose,setGroundRadius(radius){groundRadius=Math.max(1,Number(radius)||50);}};
}

// The UI power is calibrated at six metres, matching the original default light rig.
export const LIGHT_REFERENCE_DISTANCE=6;
// This Three.js version uses perspective cube depth, not linear radial depth.
// Offset receivers along their world-space normal; normalized depth bias causes detached shadows.
export const POINT_SHADOW_NORMAL_BIAS=.012;
export function sceneLightIntensity(row){return Math.max(0,Number(row.power)||0)*LIGHT_REFERENCE_DISTANCE;}
export function sceneShadowFar(row,radius=50){return row.falloff?Math.max(1,Number(row.range)||20):Math.max(100,Math.hypot(...row.position)+Math.max(1,Number(radius)||50)+2);}

// Match the light energy used by lit meshes, rather than a constant black shadow mask.
export const GROUND_SHADOW_GLSL=`
varying vec3 groundShadowViewPosition;
float groundLightEnergy(vec3 value){return max(dot(value,vec3(.2126,.7152,.0722)),0.0);}
float groundShadowAmount(){
 vec3 normal=normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0));
 float total=.02+groundLightEnergy(ambientLightColor),blocked=0.0;
 #if NUM_HEMI_LIGHTS > 0
 #pragma unroll_loop_start
 for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
  total+=groundLightEnergy(getHemisphereLightIrradiance(hemisphereLights[i],normal));
 }
 #pragma unroll_loop_end
 #endif
 #if NUM_POINT_LIGHTS > 0
 vec3 delta;
 float distanceToLight,energy,visibility;
 #if defined(USE_SHADOWMAP) && (defined(SHADOWMAP_TYPE_PCF) || defined(SHADOWMAP_TYPE_BASIC)) && NUM_POINT_LIGHT_SHADOWS > 0
 PointLightShadow groundPointShadow;
 #endif
 #pragma unroll_loop_start
 for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
  delta=pointLights[i].position-groundShadowViewPosition;
  distanceToLight=length(delta);
  energy=groundLightEnergy(pointLights[i].color)*getDistanceAttenuation(distanceToLight,pointLights[i].distance,pointLights[i].decay)*max(dot(normal,delta/max(distanceToLight,.0001)),0.0);
  visibility=1.0;
  #if defined(USE_SHADOWMAP) && (defined(SHADOWMAP_TYPE_PCF) || defined(SHADOWMAP_TYPE_BASIC))
  #if UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS
   groundPointShadow=pointLightShadows[i];
   visibility=receiveShadow?getPointShadow(pointShadowMap[i],groundPointShadow.shadowMapSize,groundPointShadow.shadowIntensity,groundPointShadow.shadowBias,groundPointShadow.shadowRadius,vPointShadowCoord[i],groundPointShadow.shadowCameraNear,groundPointShadow.shadowCameraFar):1.0;
  #endif
  #endif
  total+=energy;blocked+=energy*(1.0-visibility);
 }
 #pragma unroll_loop_end
 #endif
 return clamp(blocked/max(total,.0001),0.0,1.0);
}`;
