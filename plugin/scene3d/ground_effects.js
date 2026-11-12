import {GROUND_EDGE_GLSL,mergeContactRegions,syncAutoRipples,createRippleSurfaces,setRippleSceneLights} from './ground_ripples.js';
import * as THREE from './vendor/three.module.js';
import {vertexShader,planeFragment,uniforms} from './ground_grid.js';

// Intersect posed triangles with y=0, then join the shared segment endpoints.
// Recomputed on edits/capture only; these contact contours never animate.
export function groundContacts(objects,limit=16){
 const groups=[],point=new THREE.Vector3(),box=new THREE.Box3();
 for(const object of objects){object.updateMatrixWorld(true);box.setFromObject(object,true);if(box.min.y>=-1e-5||box.max.y<=1e-5)continue;
  object.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||!mesh.geometry?.attributes.position)return;const geometry=mesh.geometry,index=geometry.index,count=index?.count||geometry.attributes.position.count,vertices=new Map(),segments=[],nodes=new Map(),parent=[];
   const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
   const vertex=i=>{if(vertices.has(i))return vertices.get(i);mesh.getVertexPosition(i,point);const value=point.clone().applyMatrix4(mesh.matrixWorld);vertices.set(i,value);return value;};
   const stride=Math.max(1,Math.ceil(count/3/16000));
   for(let k=0;k+2<count;k+=3*stride){const tri=[0,1,2].map(n=>vertex(index?index.getX(k+n):k+n));const hits=[];
    for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(a.y*b.y<0||Math.abs(a.y)<1e-7&&Math.abs(b.y)>1e-7){const t=a.y/(a.y-b.y);hits.push(new THREE.Vector2(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t));}}
    if(hits.length!==2||hits[0].distanceToSquared(hits[1])<1e-12)continue;const id=segments.length;segments.push(hits);parent.push(id);
    for(const p of hits){const key=Math.round(p.x*10000)+','+Math.round(p.y*10000),other=nodes.get(key);if(other!==undefined)parent[root(id)]=root(other);else nodes.set(key,id);}
   }
   const joined=new Map();segments.forEach((segment,i)=>{const key=root(i);if(!joined.has(key))joined.set(key,[]);joined.get(key).push(...segment);});
   for(const points of joined.values()){if(points.length<4)continue;const bounds=new THREE.Box2().setFromPoints(points),center=bounds.getCenter(new THREE.Vector2()),size=bounds.getSize(new THREE.Vector2());const c=new THREE.Vector4(center.x,center.y,Math.max(.025,size.x*.5),Math.max(.025,size.y*.5));c.objectId=object.userData.id||object.uuid;groups.push(c);}
  });
 }
 return mergeContactRegions(groups,limit);
}

function mirrorMaterial(){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:true,uniforms:{...uniforms(-.005),reflectionMap:{value:null},reflectionProjection:{value:new THREE.Matrix4()},waveCount:{value:0},waveRegions:{value:Array.from({length:32},()=>new THREE.Vector4())},groundRadius:{value:50},groundColor:{value:new THREE.Color('#dfefff')}},vertexShader,
 fragmentShader:planeFragment+GROUND_EDGE_GLSL+`uniform sampler2D reflectionMap;uniform vec3 groundColor;uniform mat4 reflectionProjection;uniform int waveCount;uniform vec4 waveRegions[32];uniform float groundRadius;
 void main(){vec3 hit=groundHit();float edge=groundEdgeOpacity(hit.xz,groundRadius);if(edge<.001)discard;vec4 depth=viewProjection*vec4(hit,1.0);if(abs(depth.z)<=depth.w)for(int i=0;i<32;i++){if(i>=waveCount)break;vec4 w=waveRegions[i];if(length((hit.xz-w.xy)/w.zw)<.9999)discard;}groundDepth(hit);vec4 q=reflectionProjection*vec4(hit,1.0);vec2 uv=q.xy/q.w*.5+.5;gl_FragColor=vec4(texture2D(reflectionMap,clamp(uv,vec2(.001),vec2(.999))).rgb*mix(vec3(1.),groundColor,.18),edge);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});material.color=material.uniforms.groundColor.value;return material;
}

// Preserve panorama pixels: no intermediate cubemap or prefiltered sky cache.
function createSkyBackground(texture){
 const material=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,toneMapped:false,uniforms:{skyMap:{value:texture},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},orthographicCamera:{value:0}},
 vertexShader:`uniform mat4 inverseProjection;uniform mat4 cameraWorld;uniform float orthographicCamera;varying vec3 direction;
 void main(){vec4 p=inverseProjection*vec4(position.xy,1.0,1.0);direction=mat3(cameraWorld)*(orthographicCamera>.5?vec3(0.0,0.0,-1.0):p.xyz/abs(p.z));gl_Position=vec4(position.xy,1.0,1.0);}`,
 fragmentShader:`uniform sampler2D skyMap;varying vec3 direction;
 void main(){vec3 d=normalize(direction);vec2 uv=vec2(atan(d.z,d.x)*0.159154943091895+.5,asin(clamp(d.y,-1.0,1.0))*0.318309886183791+.5);gl_FragColor=texture2D(skyMap,uv);
 #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.name='High resolution panorama';mesh.renderOrder=-10000;mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;
 mesh.onBeforeRender=(_renderer,_scene,camera)=>{material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);material.uniforms.cameraWorld.value.copy(camera.matrixWorld);material.uniforms.orthographicCamera.value=camera.isOrthographicCamera?1:0;material.uniformsNeedUpdate=true;};return mesh;
}
export function reflectionResolution(renderer){
 const size=renderer.getDrawingBufferSize?renderer.getDrawingBufferSize(new THREE.Vector2()):renderer.getSize(new THREE.Vector2()).multiplyScalar(renderer.getPixelRatio?.()||1);
 const limit=Math.min(4096,renderer.capabilities?.maxTextureSize||4096),scale=Math.min(1,limit/Math.max(size.x,size.y),Math.sqrt(16777216/Math.max(1,size.x*size.y))),width=Math.max(1,Math.round(size.x*scale)),height=Math.max(1,Math.round(size.y*scale));
 const budget=width*height>8388608?0:width*height>4194304?2:4,samples=Math.min(budget,renderer.capabilities?.maxSamples||0);
 return {width,height,samples};
}

export function createGroundEffects({clock=()=>performance.now(),error=()=>{},onRipplesChanged=()=>{},loadSky=()=>new THREE.TextureLoader().loadAsync('/scene3d/sky/blue-clouds-8k.jpg')}={}){
 let surfaces=null,sky=null,skyMesh=null,skyPromise=null,target=null,mirror=null,reflectionCamera=null,lastContacts=-Infinity,lastRevision=-1,contactsRevision=-1,lastView='',active=false,baseBackground=null,baseBackgroundIntensity=1,lastSkyError=-Infinity,pendingContactRevision=-1,contactChangedAt=0;
 const reflectionDirection=new THREE.Vector3(),reflectionLook=new THREE.Vector3(),reflectionProjection=new THREE.Matrix4(),clip=new THREE.Plane(new THREE.Vector3(0,1,0),0);
 function ensureSky(){if(sky)return Promise.resolve(sky);if(!skyPromise)skyPromise=loadSky().then(texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;sky=texture;return sky;}).catch(e=>{skyPromise=null;throw e;});return skyPromise;}
 async function prepare(ground){if(ground.pattern==='mirror')await ensureSky();}
 function update(renderer,scene,camera,grid,floor,ground,objects,{revision=0,force=false,exclude=[],background}={}){
  const isMirror=ground.pattern==='mirror';floor.userData.baseMaterial??=floor.material;
  if(!isMirror){if(surfaces)surfaces.group.visible=false;if(skyMesh)skyMesh.visible=false;floor.material=floor.userData.baseMaterial;if(active){scene.background=typeof background==='string'?new THREE.Color(background):baseBackground;scene.backgroundIntensity=baseBackgroundIntensity;active=false;}return;}
  if(!active){baseBackground=scene.background?.isColor?scene.background.clone():scene.background;baseBackgroundIntensity=scene.backgroundIntensity;}
  active=true;if(!mirror)mirror=mirrorMaterial();if(!surfaces)surfaces=createRippleSurfaces(floor);floor.material=mirror;
  if(sky){if(!skyMesh){sky.anisotropy=Math.min(8,renderer.capabilities?.getMaxAnisotropy?.()||1);skyMesh=createSkyBackground(sky);scene.add(skyMesh);}skyMesh.visible=true;}else{scene.background=new THREE.Color('#a8d4f5');if(!skyPromise&&clock()-lastSkyError>5000)ensureSky().catch(e=>{lastSkyError=clock();error(e);});}
  const now=clock(),resolution=reflectionResolution(renderer);camera.updateMatrixWorld();const view=camera.matrixWorld.elements.join(',')+'|'+camera.projectionMatrix.elements.join(',')+'|'+resolution.width+'x'+resolution.height+'x'+resolution.samples;
  if(pendingContactRevision!==revision){pendingContactRevision=revision;contactChangedAt=now;}
  if(ground.ripples&&(force||contactsRevision!==revision&&now-contactChangedAt>150)){const contacts=groundContacts(objects),next=syncAutoRipples(ground.autoRipples||[],contacts);if(JSON.stringify(next)!==JSON.stringify(ground.autoRipples||[])){ground.autoRipples=next;onRipplesChanged();}contactsRevision=revision;lastContacts=now;}
  mirror.uniforms.groundRadius.value=ground.radius;mirror.uniforms.groundColor.value.set(ground.floorColor||'#ffffff');surfaces.update(ground,mirror);setRippleSceneLights(surfaces.material,scene.children);
  if(!force&&target&&revision===lastRevision&&view===lastView&&sky===floor.userData.reflectedSky)return;
  const {width:w,height:h,samples}=resolution;
  if(!target||target.width!==w||target.height!==h||target.samples!==samples){target?.dispose();target=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,depthBuffer:true,samples,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true});target.texture.anisotropy=Math.min(4,renderer.capabilities?.getMaxAnisotropy?.()||1);}
  if(!reflectionCamera||reflectionCamera.type!==camera.type)reflectionCamera=camera.clone();else reflectionCamera.copy(camera,false);const reflected=reflectionCamera,direction=camera.getWorldDirection(reflectionDirection);reflected.position.copy(camera.position);reflected.position.y*=-1;direction.y*=-1;reflected.up.copy(camera.up);reflected.up.y*=-1;reflected.lookAt(reflectionLook.copy(reflected.position).add(direction));reflected.updateMatrixWorld();
  reflectionProjection.multiplyMatrices(reflected.projectionMatrix,reflected.matrixWorldInverse);
  const hidden=[grid,floor,...exclude].filter(Boolean),visibility=hidden.map(o=>o.visible),oldTarget=renderer.getRenderTarget(),planes=renderer.clippingPlanes,shadow=renderer.shadowMap.autoUpdate,viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
  hidden.forEach(o=>o.visible=false);
  try{renderer.clippingPlanes=[...planes,clip];renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear();renderer.render(scene,reflected);}
  finally{hidden.forEach((o,i)=>o.visible=visibility[i]);renderer.clippingPlanes=planes;renderer.shadowMap.autoUpdate=shadow;renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);}
  mirror.uniforms.reflectionMap.value=target.texture;mirror.uniforms.reflectionProjection.value.copy(reflectionProjection);lastRevision=revision;lastView=view;floor.userData.reflectedSky=sky;surfaces.update(ground,mirror);
 }
 return {prepare,update,manualMeshes:()=>surfaces?.meshes()||[],dispose(){surfaces?.dispose();target?.dispose();mirror?.dispose();if(skyMesh){skyMesh.removeFromParent();skyMesh.geometry.dispose();skyMesh.material.dispose();}sky?.dispose();}};
}
