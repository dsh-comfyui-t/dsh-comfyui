import {GROUND_SHADOW_GLSL} from './lighting.js';
import {normalizeRippleSettings,GROUND_EDGE_GLSL} from './ground_ripples.js';
import * as THREE from './vendor/three.module.js';
export const DIAMOND_SKEW=1/Math.sqrt(3);
export const GRID_PATTERNS=['square','diamond','hexagon','brick','triangle','dots','mirror'];
export function normalizeGroundGrid(value={},legacyVisible=true){
 return {...normalizeRippleSettings(value),visible:typeof value?.visible==='boolean'?value.visible:legacyVisible!==false,size:Number.isFinite(value?.size)?Math.max(.05,Math.min(20,value.size)):1,radius:Number.isFinite(value?.radius)?Math.max(1,Math.min(10000,value.radius)):50,transparent:value?.transparent!==false,floorVisible:value?.floorVisible!==false,ripples:value?.ripples!==false,pattern:GRID_PATTERNS.includes(value?.pattern)?value.pattern:'square',capture:value?.capture===true,lineColor:/^#[0-9a-fA-F]{6}$/.test(value?.lineColor||'')?value.lineColor:'#8b8e93',floorColor:/^#[0-9a-fA-F]{6}$/.test(value?.floorColor||'')?value.floorColor:'#ffffff'};
}
export const vertexShader=`uniform mat4 inverseViewProjection;uniform mat4 inverseProjection;uniform mat4 cameraWorld;uniform float orthographicCamera;varying vec3 rayNear;varying vec3 rayFar;
void main(){if(orthographicCamera>0.5){vec4 a=inverseViewProjection*vec4(position.xy,-1.0,1.0);rayNear=a.xyz/a.w;rayFar=rayNear+mat3(cameraWorld)*vec3(0.0,0.0,-1.0);}else{vec4 p=inverseProjection*vec4(position.xy,1.0,1.0);vec3 direction=p.xyz/abs(p.z);rayNear=cameraPosition;rayFar=rayNear+mat3(cameraWorld)*direction;}gl_Position=vec4(position.xy,0.0,1.0);}`;
export const planeFragment=`uniform mat4 viewProjection;uniform float groundHeight;uniform float orthographicCamera;varying vec3 rayNear;varying vec3 rayFar;
vec3 groundHit(){vec3 direction=rayFar-rayNear;if(abs(direction.y)<0.00000001)discard;float t=(groundHeight-rayNear.y)/direction.y;if(t<0.0&&orthographicCamera<0.5)discard;return rayNear+t*direction;}
void groundDepth(vec3 hit){vec4 clip=viewProjection*vec4(hit,1.0);float depth=clip.z/clip.w*.5+.5;if(depth<0.0&&orthographicCamera<0.5)discard;gl_FragDepth=clamp(depth,0.0000001,0.9999999);}
`;
function screenGround(material){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;return mesh;}
export function uniforms(height){return {inverseViewProjection:{value:new THREE.Matrix4()},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},viewProjection:{value:new THREE.Matrix4()},groundHeight:{value:height},orthographicCamera:{value:0}};}
export function createGroundGrid(){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{...uniforms(.001),cellSize:{value:.5},pattern:{value:0},groundRadius:{value:50},lineColor:{value:new THREE.Color('#8b8e93')}},vertexShader,
 fragmentShader:planeFragment+GROUND_EDGE_GLSL+`uniform float cellSize;uniform int pattern;uniform float groundRadius;uniform vec3 lineColor;
// Largest singular value: the shortest visible cell dimension, independent of screen rotation.
float densityOpacity(vec2 dx,vec2 dy){float a=dot(dx,dx),b=dot(dy,dy),c=dot(dx,dy);float footprint=sqrt(max(.5*(a+b+sqrt(max((a-b)*(a-b)+4.0*c*c,0.0))),0.0));return 1.0-smoothstep(.35,.85,footprint);}
float filteredLine(float distanceInPixels,float pixel){return 1.0-smoothstep(.3,.8,distanceInPixels);}
float aaLine(float coordinate,vec2 gradient){float pixel=max(length(gradient),0.0000001);float d=abs(fract(coordinate+0.5)-0.5)/pixel;return filteredLine(d,pixel);}
float patternAlpha(vec2 p,vec2 dx,vec2 dy){
 if(pattern==1){mat2 rhombus=mat2(${DIAMOND_SKEW},-${DIAMOND_SKEW},1.0,1.0);p=rhombus*p;dx=rhombus*dx;dy=rhombus*dy;return max(aaLine(p.x,vec2(dx.x,dy.x)),aaLine(p.y,vec2(dx.y,dy.y)));}
 if(pattern==2){vec2 r=vec2(1.0,1.73205080757),a=mod(p,r)-r*.5,b=mod(p-r*.5,r)-r*.5,g=dot(a,a)<dot(b,b)?a:b,q=abs(g);vec2 n=q.x>dot(q,vec2(.5,.86602540378))?vec2(sign(g.x),0.0):sign(g)*vec2(.5,.86602540378);float d=.5-max(q.x,dot(q,vec2(.5,.86602540378)));float pixel=max(length(vec2(dot(dx,n),dot(dy,n))),.0000001);return filteredLine(abs(d)/pixel,pixel);}
 if(pattern==3){float pixel=max(length(vec2(dx.x,dy.x)),.0000001);float d=abs(fract(p.x*.5+mod(floor(p.y),2.0)*.5+.5)-.5)*2.0/pixel;return max(aaLine(p.y,vec2(dx.y,dy.y)),filteredLine(d,pixel));}
 if(pattern==4)return max(aaLine(p.y,vec2(dx.y,dy.y)),max(aaLine(dot(p,vec2(.86602540378,.5)),vec2(dot(dx,vec2(.86602540378,.5)),dot(dy,vec2(.86602540378,.5)))),aaLine(dot(p,vec2(.86602540378,-.5)),vec2(dot(dx,vec2(.86602540378,-.5)),dot(dy,vec2(.86602540378,-.5))))));
 if(pattern==5){vec2 q=fract(p+.5)-.5;float pixel=max(min(length(dx),length(dy)),.0000001);float d=length(q);return (1.0-smoothstep(.035+pixel*.3,.035+pixel*.8,d))*(1.0-smoothstep(.35,1.0,pixel));}
 return max(aaLine(p.x,vec2(dx.x,dy.x)),aaLine(p.y,vec2(dx.y,dy.y)));
}
void main(){vec3 hit=groundHit();vec2 p=hit.xz/cellSize;vec2 dx=dFdx(p),dy=dFdy(p);float edge=groundEdgeOpacity(hit.xz,groundRadius);float distanceFade=1.0-smoothstep(groundRadius*.12,groundRadius*.95,length(hit.xz-cameraPosition.xz));float alpha=patternAlpha(p,dx,dy)*edge*distanceFade*densityOpacity(dx,dy);if(pattern==6)discard;if(alpha<.002)discard;groundDepth(hit);gl_FragColor=vec4(lineColor,alpha*.7);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const mesh=screenGround(material);mesh.name='Circular ground grid';mesh.renderOrder=2;return mesh;
}
export function createGroundFloor(color){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:true,uniforms:{...uniforms(-.005),groundColor:{value:new THREE.Color(color)},groundRadius:{value:50},solidGround:{value:0}},vertexShader,fragmentShader:planeFragment+GROUND_EDGE_GLSL+`uniform vec3 groundColor;uniform float groundRadius;uniform float solidGround;
void main(){vec3 hit=groundHit();if(solidGround<.5)discard;float edge=groundEdgeOpacity(hit.xz,groundRadius);if(edge<.001)discard;groundDepth(hit);gl_FragColor=vec4(groundColor,edge);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});material.color=material.uniforms.groundColor.value;
 const floor=screenGround(material);floor.name='Circular ground';
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,96),new THREE.ShadowMaterial({opacity:.55}));const edgeRadius={value:50};
 shadow.material.onBeforeCompile=shader=>{
  shader.uniforms.groundRadius=edgeRadius;
  shader.vertexShader='varying vec2 groundShadowXZ;varying vec3 groundShadowViewPosition;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n groundShadowXZ=(modelMatrix*vec4(transformed,1.0)).xz;groundShadowViewPosition=mvPosition.xyz;');
  shader.fragmentShader=GROUND_EDGE_GLSL+'uniform float groundRadius;varying vec2 groundShadowXZ;\n'+shader.fragmentShader.replace('void main() {',GROUND_SHADOW_GLSL+'\nvoid main() {').replace('1.0 - getShadowMask()','groundShadowAmount()').replace('#include <tonemapping_fragment>','gl_FragColor.a*=groundEdgeOpacity(groundShadowXZ,groundRadius);\n#include <tonemapping_fragment>');
 };
 shadow.material.customProgramCacheKey=()=> 'ground-shadow-energy-v2';floor.userData.shadowEdgeRadius=edgeRadius;shadow.rotation.x=-Math.PI/2;shadow.position.y=-.004;shadow.receiveShadow=true;shadow.renderOrder=1;shadow.frustumCulled=false;floor.add(shadow);floor.userData.shadowReceiver=shadow;return floor;
}
export function groundIntersection(camera,x,y,height=0){
 const near=new THREE.Vector3(x,y,-1).unproject(camera),far=new THREE.Vector3(x,y,1).unproject(camera),dy=far.y-near.y;
 if(Math.abs(dy)<1e-8)return null;const t=(height-near.y)/dy;return t>=0||camera.isOrthographicCamera?near.addScaledVector(far.sub(near),t):null;
}
export function updateGroundGrid(grid,camera,settings,floor){
 camera.updateMatrixWorld();const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),inverse=projection.clone().invert();
 for(const mesh of [grid,floor])if(mesh?.material.uniforms?.inverseViewProjection){if(mesh.material.uniforms.groundRadius)mesh.material.uniforms.groundRadius.value=settings.radius??50;if(mesh.material.uniforms.solidGround)mesh.material.uniforms.solidGround.value=settings.transparent===false?1:0;mesh.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);mesh.material.uniforms.cameraWorld.value.copy(camera.matrixWorld);mesh.material.uniforms.orthographicCamera.value=camera.isOrthographicCamera?1:0;mesh.material.uniforms.inverseViewProjection.value.copy(inverse);mesh.material.uniforms.viewProjection.value.copy(projection);}
 grid.material.uniforms.cellSize.value=settings.size;grid.material.uniforms.lineColor.value.set(settings.lineColor||'#8b8e93');if(floor?.material?.uniforms?.groundColor)floor.material.uniforms.groundColor.value.set(settings.floorColor||'#ffffff');grid.material.uniforms.pattern.value=Math.max(0,GRID_PATTERNS.indexOf(settings.pattern));
 if(floor?.userData.shadowEdgeRadius)floor.userData.shadowEdgeRadius.value=settings.radius??50;const shadow=floor?.userData.shadowReceiver;if(shadow){shadow.position.set(0,-.004,0);shadow.scale.set(settings.radius??50,settings.radius??50,1);}
}
