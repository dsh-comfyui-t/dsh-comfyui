import * as THREE from './vendor/three.module.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),idValid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id),finite=(v,f=0)=>Number.isFinite(v)?v:f;
export const GROUND_FEATHER_START=.8;
export const GROUND_EDGE_GLSL=`float groundEdgeOpacity(vec2 point,float radius){return 1.0-smoothstep(radius*${GROUND_FEATHER_START},radius,length(point));}\n`;
export function groundEdgeOpacity(distance,radius){const t=Math.max(0,Math.min(1,(distance/radius-GROUND_FEATHER_START)/(1-GROUND_FEATHER_START)));return 1-t*t*(3-2*t);}
export const RIPPLE_RADIUS_SCALE=.6,RIPPLE_SPACING=.09,RIPPLE_DENSITY_MAX=32,RIPPLE_WIDTH_MIN=.01,RIPPLE_HEIGHT_MIN=.001;
export const RIPPLE_RING_MIN=3,RIPPLE_RING_MAX=9;
export function randomRippleRings(contact=null,random=Math.random){
 const u=clamp(finite(random(),.5),0,.999999999),thresholds=[.08,.27,.53,.75,.9,.97,1],count=3+thresholds.findIndex(limit=>u<limit),footprint=contact&&Number.isFinite(contact.z)&&Number.isFinite(contact.w)?Math.sqrt(Math.max(0,contact.z*contact.w)):0,bias=footprint>0?clamp(Math.round(Math.log2(footprint/.12)),-1,1):0;return clamp(count+bias,RIPPLE_RING_MIN,RIPPLE_RING_MAX);
}
export function normalizeRippleSettings(value={}){
 const records=(key,manual)=>Array.isArray(value[key])?value[key].slice(0,16).filter(v=>v&&idValid(v.id)&&(!manual?idValid(v.objectId):true)).map(v=>({id:v.id,...(!manual?{objectId:v.objectId,rx:clamp(finite(v.rx,.1),.025,1000),rz:clamp(finite(v.rz,.1),.025,1000)}:{size:clamp(finite(v.size,1),.25,20)}),x:clamp(finite(v.x),-10000,10000),z:clamp(finite(v.z),-10000,10000),rings:Number.isInteger(v.rings)&&v.rings>=RIPPLE_RING_MIN&&v.rings<=RIPPLE_RING_MAX?v.rings:5})):[];
 return {rippleDensity:clamp(finite(value.rippleDensity,1),.5,RIPPLE_DENSITY_MAX),rippleWidth:clamp(finite(value.rippleWidth,.05),RIPPLE_WIDTH_MIN,2),rippleHeight:clamp(finite(value.rippleHeight,.01),RIPPLE_HEIGHT_MIN,.5),rippleSize:clamp(finite(value.rippleSize,3),.25,100),autoRipples:records('autoRipples',false),manualRipples:records('manualRipples',true)};
}
export function mergeContactRegions(groups,limit=16){
 const result=[];
 for(const raw of groups){let next=raw.clone();next.objectId=raw.objectId||'';next.objectIds=new Set([next.objectId]);let changed=true;
  while(changed){changed=false;for(let i=result.length-1;i>=0;i--){const other=result[i],gap=.04;if(Math.abs(other.x-next.x)>other.z+next.z+gap||Math.abs(other.y-next.y)>other.w+next.w+gap)continue;
   const left=Math.min(other.x-other.z,next.x-next.z),right=Math.max(other.x+other.z,next.x+next.z),top=Math.min(other.y-other.w,next.y-next.w),bottom=Math.max(other.y+other.w,next.y+next.w);for(const id of other.objectIds)next.objectIds.add(id);next.set((left+right)/2,(top+bottom)/2,(right-left)/2,(bottom-top)/2);result.splice(i,1);changed=true;
  }}result.push(next);
 }
 for(const row of result){const ids=[...row.objectIds].sort();if(ids.length>1){let hash=2166136261;for(const c of ids.join('|'))hash=Math.imul(hash^c.charCodeAt(0),16777619);row.objectId='region-'+(hash>>>0).toString(16);}else row.objectId=ids[0];}
 return result.sort((a,b)=>b.z*b.w-a.z*a.w).slice(0,limit);
}
export function syncAutoRipples(previous,contacts,{random=randomRippleRings,uuid=()=>crypto.randomUUID()}={}){
 const unused=new Set(previous),next=[];
 for(const c of contacts){let matched=null,distance=Infinity;for(const row of unused){if(row.objectId!==c.objectId)continue;const d=(row.x-c.x)**2+(row.z-c.y)**2;if(d<distance){distance=d;matched=row;}}if(matched)unused.delete(matched);
  const round=n=>Math.round(n*1000)/1000;next.push({id:matched?.id||uuid(),objectId:c.objectId,x:round(c.x),z:round(c.y),rx:Math.max(.025,round(c.z)),rz:Math.max(.025,round(c.w)),rings:matched?.rings||random(c)});
 }
 return next;
}
export function rippleDescriptors(ground){
 const factor=RIPPLE_RADIUS_SCALE*(ground.rippleSize??3),width=ground.rippleWidth??.05,density=ground.rippleDensity??1,amplitude=ground.rippleHeight??.01;
 const describe=(row,manual)=>{const ringRadius=(manual ? .35*row.size : Math.max(row.rx,row.rz))*factor,outer=rippleLayout(ringRadius,width,density,row.rings).outer;return {...row,manual,ringRadius,density,amplitude,width,rx:outer,rz:outer};};
 return [...(ground.autoRipples||[]).map(r=>describe(r,false)),...(ground.manualRipples||[]).map(r=>describe(r,true))].slice(0,32);
}
// Ring center radius, center spacing and wave width are independent quantities.
export function rippleLayout(radius,width=.05,density=1,rings=5){const period=RIPPLE_SPACING*density;return {period,first:radius,count:rings,outer:radius+(rings-1)*period+width};}
export function rippleKernel(offset,width){
 const x=offset/width,a=Math.abs(x);if(a>=1)return {height:0,slope:0};const e=Math.exp(-4*x*x),shape=(1-8*x*x)*e,derivative=(64*x*x*x-24*x)*e/width,t=clamp((a-.7)/.3,0,1),window=1-t*t*t*(10-15*t+6*t*t),dw=t>0&&t<1?-30*t*t*(1-t)*(1-t)*Math.sign(x)/(.3*width):0;return {height:shape*window,slope:derivative*window+shape*dw};
}
export function rippleRadial(distance,rings,amplitude,ringRadius=1,width=.05,density=1){
 const {period,first}=rippleLayout(ringRadius,width,density,rings);let height=0,slope=0;for(let i=0;i<rings;i++){const center=first+i*period,weight=Math.exp(-.33*i),a=rippleKernel(distance-center,width),b=rippleKernel(distance+center,width);height+=amplitude*weight*(a.height+b.height);slope+=amplitude*weight*(a.slope+b.slope);}return {height,slope};
}
export function rippleProfile(radius,rings,amplitude,ringRadius=1,width=.05,density=1){
 if(radius<0||radius>=1||amplitude===0)return {height:0,slope:0};const {outer}=rippleLayout(ringRadius,width,density,rings),p=rippleRadial(radius*outer,rings,amplitude,ringRadius,width,density);return {height:p.height,slope:p.slope*outer};
}
export function rippleHeight(...args){return rippleProfile(...args).height;}
function radialSamples(radius,rings,width,density,limit){const {first,period,count,outer}=rippleLayout(radius,width,density,rings),values=[0,1];if(count*25+2>limit)return Array.from({length:limit},(_,i)=>i/(limit-1));for(let i=0;i<count;i++)for(let k=0;k<=24;k++)values.push(clamp((first+i*period+(k/12-1)*width)/outer,0,1));return [...new Set(values)].sort((a,b)=>a-b);}
export function createRippleGeometry(rx,rz,rings,amplitude=.01,width=.05,density=1,budget=300000){
 const ringRadius=Math.min(rx,rz),outerX=rippleLayout(rx,width,density,rings).outer,outerZ=rippleLayout(rz,width,density,rings).outer,outer=Math.min(outerX,outerZ),angular=clamp(Math.ceil(2*Math.PI*Math.max(outerX,outerZ)/width*2.5),192,512),samples=radialSamples(ringRadius,rings,width,density,Math.max(24,Math.floor(budget/(angular+1)))),radial=samples.length-1,positions=[],normals=[],indices=[];
 for(const t of samples){const profile=rippleProfile(t,rings,amplitude,ringRadius,width,density);for(let i=0;i<=angular;i++){const a=i/angular*Math.PI*2,c=Math.cos(a),s=Math.sin(a),nx=-profile.slope*c/outerX,nz=-profile.slope*s/outerZ,n=Math.hypot(nx,1,nz);positions.push(c*outerX*t,profile.height,s*outerZ*t);normals.push(nx/n,1/n,nz/n);}}
 for(let j=0;j<radial;j++)for(let i=0;i<angular;i++){const a=j*(angular+1)+i,b=a+angular+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
export function groupRippleRegions(rows){
 const groups=[];for(const row of rows){let joined=[row],again=true;while(again){again=false;for(let i=groups.length-1;i>=0;i--)if(groups[i].some(a=>joined.some(b=>Math.abs(a.x-b.x)<a.rx+b.rx&&Math.abs(a.z-b.z)<a.rz+b.rz))){joined.push(...groups.splice(i,1)[0]);again=true;}}groups.push(joined);}return groups;
}
function combinedGeometry(rows,budget){
 if(rows.length===1)return {geometry:createRippleGeometry(rows[0].ringRadius,rows[0].ringRadius,rows[0].rings,rows[0].amplitude,rows[0].width,rows[0].density,budget),x:rows[0].x,z:rows[0].z};
 const left=Math.min(...rows.map(r=>r.x-r.rx)),right=Math.max(...rows.map(r=>r.x+r.rx)),top=Math.min(...rows.map(r=>r.z-r.rz)),bottom=Math.max(...rows.map(r=>r.z+r.rz)),x=(left+right)/2,z=(top+bottom)/2;
 const spacing=Math.min(...rows.map(r=>(r.width??.05)/12)),limit=Math.max(64,Math.floor(Math.sqrt(budget))-1),nx=clamp(Math.ceil((right-left)/spacing),64,limit),nz=clamp(Math.ceil((bottom-top)/spacing),64,limit),positions=[],normals=[],indices=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const px=left+(right-left)*i/nx,pz=top+(bottom-top)*j/nz;let height=0,slopeX=0,slopeZ=0;for(const r of rows){const dx=px-r.x,dz=pz-r.z,radius=Math.hypot(dx/r.rx,dz/r.rz);if(radius>=0&&radius<1){const p=rippleProfile(radius,r.rings,r.amplitude,r.ringRadius,r.width,r.density);height+=p.height;if(radius>1e-9){slopeX-=p.slope*dx/(r.rx*r.rx*radius);slopeZ-=p.slope*dz/(r.rz*r.rz*radius);}}}const n=Math.hypot(slopeX,1,slopeZ);positions.push(px-x,height,pz-z);normals.push(slopeX/n,1/n,slopeZ/n);}
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+nx+1;indices.push(a,b,a+1,a+1,b,b+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return {geometry,x,z};
}

export const RIPPLE_WAVE_GLSL=`
vec2 rippleKernel(float offset,float width){float x=offset/width,a=abs(x);if(a>=1.0)return vec2(0.0);float e=exp(-4.0*x*x),shape=(1.0-8.0*x*x)*e,derivative=(64.0*x*x*x-24.0*x)*e/width,t=clamp((a-.7)/.3,0.0,1.0),window=1.0-t*t*t*(10.0-15.0*t+6.0*t*t),dw=t>0.0&&t<1.0?-30.0*t*t*(1.0-t)*(1.0-t)*sign(x)/(.3*width):0.0;return vec2(shape*window,derivative*window+shape*dw);}
vec2 rippleRadial(float distance,float first,float spacing,float rings,float width,float amplitude){vec2 result=vec2(0.0);for(int j=0;j<${RIPPLE_RING_MAX};j++){if(float(j)>=rings)break;float center=first+float(j)*spacing;result+=amplitude*exp(-.33*float(j))*(rippleKernel(distance-center,width)+rippleKernel(distance+center,width));}return result;}
`;
const RIPPLE_NORMAL_GLSL=`uniform vec4 regionParams[32];uniform vec2 ringGeometry[32];
`+RIPPLE_WAVE_GLSL+`vec2 profileSlope(vec2 point){vec2 slope=vec2(0.0);float pixelSpan=max(length(dFdx(point)),length(dFdy(point)));for(int i=0;i<32;i++){if(i>=regionCount)break;vec4 r=regions[i],p=regionParams[i];vec2 delta=point-r.xy;float t=length(delta/r.zw),radius=min(r.z,r.w),distance=t*radius;if(t<=0.0||t>=1.0)continue;vec2 wave=rippleRadial(distance,ringGeometry[i].x,ringGeometry[i].y,p.w,p.x,p.y);float visibility=1.0-smoothstep(p.x*.25,p.x,pixelSpan);slope+=wave.y*radius*delta/(r.zw*r.zw*t)*visibility;}return slope;}
`;
function waveMaterial(){return new THREE.ShaderMaterial({transparent:true,depthWrite:true,side:THREE.DoubleSide,uniforms:{reflectionMap:{value:null},reflectionProjection:{value:new THREE.Matrix4()},groundRadius:{value:50},lightCount:{value:0},lightPositions:{value:Array.from({length:8},()=>new THREE.Vector3())},lightColors:{value:Array.from({length:8},()=>new THREE.Color())},lightPowers:{value:Array(8).fill(0)},lightRanges:{value:Array(8).fill(0)},lightDecays:{value:Array(8).fill(0)},regionCount:{value:0},ringGeometry:{value:Array.from({length:32},()=>new THREE.Vector2())},regionParams:{value:Array.from({length:32},()=>new THREE.Vector4())},regions:{value:Array.from({length:32},()=>new THREE.Vector4())},lightDirection:{value:new THREE.Vector3(1,2,1).normalize()}},
 vertexShader:`varying vec3 worldPosition;varying vec3 worldNormal;void main(){vec4 p=modelMatrix*vec4(position,1.0);worldPosition=p.xyz;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}`,
 fragmentShader:GROUND_EDGE_GLSL+`uniform sampler2D reflectionMap;uniform mat4 reflectionProjection;uniform float groundRadius;uniform int lightCount;uniform vec3 lightPositions[8];uniform vec3 lightColors[8];uniform float lightPowers[8];uniform float lightRanges[8];uniform float lightDecays[8];uniform int regionCount;uniform vec4 regions[32];varying vec3 worldPosition;varying vec3 worldNormal;
`+RIPPLE_NORMAL_GLSL+`void main(){float edge=groundEdgeOpacity(worldPosition.xz,groundRadius);if(edge<.001)discard;bool inside=false;for(int i=0;i<32;i++){if(i>=regionCount)break;vec4 r=regions[i];if(length((worldPosition.xz-r.xy)/r.zw)<1.0001)inside=true;}if(!inside)discard;vec2 slope=profileSlope(worldPosition.xz);vec3 n=normalize(vec3(-slope.x,1.0,-slope.y)),v=normalize(cameraPosition-worldPosition);if(dot(n,v)<0.0)n=-n;vec4 p=reflectionProjection*vec4(worldPosition,1.0);vec2 uv=p.xy/p.w*.5+.5;vec3 nv=normalize(mat3(viewMatrix)*n),baseNormalView=normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0));float facing=max(dot(n,v),.001),fresnel=.02+.98*pow(1.0-facing,5.0),bend=clamp(length(n-vec3(0.0,1.0,0.0)),0.0,1.0);uv+=clamp((nv.xy-baseNormalView.xy)*(.003+.007*(1.0-facing)),vec2(-.02),vec2(.02));vec3 reflected=texture2D(reflectionMap,clamp(uv,vec2(.001),vec2(.999))).rgb;
 float variance=dot(fwidth(n),fwidth(n)),alpha2=.018+min(.15,variance*.35),k=.12;
 vec3 specular=vec3(0.0);
 for(int li=0;li<8;li++){
  if(li>=lightCount)break;
  vec3 delta=lightPositions[li]-worldPosition;
  if(dot(delta,delta)<.000001)continue;
  vec3 l=normalize(delta),h=normalize(v+l);
  float nl=max(dot(n,l),0.0),nh=max(dot(n,h),0.0),vh=max(dot(v,h),0.0);
  float denom=nh*nh*(alpha2-1.0)+1.0,distribution=alpha2/(3.14159265359*denom*denom);
  float geometry=(facing/(facing*(1.0-k)+k))*(nl/(nl*(1.0-k)+k));
  float fresnelSpec=.02+.98*pow(1.0-vh,5.0);
  float highlight=min(.18,distribution*fresnelSpec*geometry/(4.0*facing+.001));
  float distanceToLight=length(delta),attenuation=1.0;
  if(lightDecays[li]>0.0){attenuation=1.0/max(pow(distanceToLight,lightDecays[li]),0.01);if(lightRanges[li]>0.0){float ratio=distanceToLight/lightRanges[li];attenuation*=pow(clamp(1.0-pow(ratio,4.0),0.0,1.0),2.0);}}
  specular+=highlight*attenuation*max(lightPowers[li],0.0)*lightColors[li];
 }
 float baseFresnel=.02+.98*pow(1.0-clamp(v.y,0.0,1.0),5.0),reflectionGain=clamp((fresnel+.08)/(baseFresnel+.08),.75,1.25);vec3 color=reflected*mix(1.0,reflectionGain,min(1.0,bend*1.5))+specular*min(1.0,bend*2.0);gl_FragColor=vec4(color,edge);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});}
// Shadow rendering must clip the same circular support as the visible surface.
export function createRippleDepthMaterial(wave){
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
 depth.onBeforeCompile=shader=>{for(const name of ['groundRadius','regionCount','regions'])shader.uniforms[name]=wave.uniforms[name];
 shader.vertexShader='varying vec3 rippleShadowPosition;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n rippleShadowPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
 shader.fragmentShader='varying vec3 rippleShadowPosition;uniform float groundRadius;uniform int regionCount;uniform vec4 regions[32];\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n if(rippleShadowPosition.y<=.0005||length(rippleShadowPosition.xz)>=groundRadius)discard;bool rippleInside=false;for(int i=0;i<32;i++){if(i>=regionCount)break;vec4 r=regions[i];if(length((rippleShadowPosition.xz-r.xy)/r.zw)<1.0)rippleInside=true;}if(!rippleInside)discard;');};
 depth.customProgramCacheKey=()=> 'ripple-clipped-shadow-v1';return depth;
}
/** All scene point lights illuminate the ripple highlights; mirrors already reflect the scene itself. */
export function setRippleSceneLights(material,lights){
 const uniforms=material.uniforms,rows=lights.filter(light=>light?.isPointLight&&light.visible!==false).slice(0,8);
 uniforms.lightCount.value=rows.length;
 for(let i=0;i<8;i++){
  const light=rows[i];
  if(light){light.getWorldPosition(uniforms.lightPositions.value[i]);uniforms.lightColors.value[i].copy(light.color);uniforms.lightPowers.value[i]=Math.max(0,light.intensity/2.5);uniforms.lightRanges.value[i]=light.distance||0;uniforms.lightDecays.value[i]=light.decay||0;}
  else{uniforms.lightPositions.value[i].set(0,0,0);uniforms.lightColors.value[i].setRGB(0,0,0);uniforms.lightPowers.value[i]=0;uniforms.lightRanges.value[i]=0;uniforms.lightDecays.value[i]=0;}
 }
}
export function createRippleSurfaces(floor){
 const group=new THREE.Group();group.name='3D ground ripples';floor.add(group);const material=waveMaterial(),depth=createRippleDepthMaterial(material);let signature='';
 function update(ground,mirror){group.visible=ground.pattern==='mirror'&&ground.ripples;if(!group.visible){mirror.uniforms.waveCount.value=0;return;}
  const descriptors=rippleDescriptors(ground),key=JSON.stringify(descriptors);
  if(key!==signature){for(const child of [...group.children]){child.geometry.dispose();group.remove(child);}const groups=groupRippleRegions(descriptors),budget=Math.max(20000,Math.floor(300000/Math.max(1,groups.length)));for(const rows of groups){const built=combinedGeometry(rows,budget),mesh=new THREE.Mesh(built.geometry,material);mesh.position.set(built.x,-.005,built.z);mesh.name='3D 涟漪表面';mesh.userData.rippleId=rows.find(r=>r.manual)?.id||rows[0].id;mesh.userData.manualRipple=rows.some(r=>r.manual);mesh.userData.rippleDescriptors=rows;mesh.castShadow=true;mesh.customDepthMaterial=depth;group.add(mesh);}signature=key;}
  material.uniforms.regionCount.value=descriptors.length;descriptors.forEach((r,i)=>{material.uniforms.regionParams.value[i].set(r.width,r.amplitude,r.density,r.rings);material.uniforms.ringGeometry.value[i].set(r.ringRadius,RIPPLE_SPACING*r.density);});descriptors.forEach((r,i)=>material.uniforms.regions.value[i].set(r.x,r.z,r.rx,r.rz));mirror.uniforms.waveCount.value=descriptors.length;descriptors.forEach((r,i)=>mirror.uniforms.waveRegions.value[i].set(r.x,r.z,r.rx,r.rz));material.uniforms.reflectionMap.value=mirror.uniforms.reflectionMap.value;material.uniforms.reflectionProjection.value.copy(mirror.uniforms.reflectionProjection.value);material.uniforms.groundRadius.value=ground.radius;
 }
 return {group,update,material,meshes:()=>group.children.filter(m=>m.userData.manualRipple),dispose(){for(const mesh of group.children)mesh.geometry.dispose();material.dispose();depth.dispose();group.removeFromParent();}};
}
