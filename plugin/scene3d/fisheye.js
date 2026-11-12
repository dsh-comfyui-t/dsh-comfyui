import * as THREE from './vendor/three.module.js';
export const FISHEYE_MAX=6;
/** Pure coordinate model used by both preview-frame and screenshot projection. */
export function fisheyeFrameUniform(region,bufferWidth,bufferHeight){
 const r=region||{left:0,top:0,width:bufferWidth,height:bufferHeight};
 const w=Math.max(1,Number(region?.viewportWidth)||bufferWidth),h=Math.max(1,Number(region?.viewportHeight)||bufferHeight);
 return [(r.left+r.width/2)/w,1-(r.top+r.height/2)/h,r.width/(2*w),r.height/(2*h)];
}
export function fisheyeSampleUV(u,v,strength,frame,rollDegrees=0){
 const angle=Number(rollDegrees)*Math.PI/180,c=Math.cos(angle),si=Math.sin(angle);
 const dx=u-frame[0],dy=v-frame[1],x=c*dx+si*dy,y=-si*dx+c*dy;
 const localX=x/frame[2],localY=y/frame[3],radius2=localX*localX+localY*localY;
 const k=Math.max(0,Math.min(FISHEYE_MAX,Number(strength)||0))*.22,scale=(1+k*radius2)/(1+2*k);
 const warpedX=localX*scale*frame[2],warpedY=localY*scale*frame[3];
 return [frame[0]+c*warpedX-si*warpedY,frame[1]+si*warpedX+c*warpedY];
}
/** Reusable screen-space fisheye effect. Both live view and PNG capture invoke render(). */
export function createSceneFisheye(){
 let target=null,tw=0,th=0;
 const shader=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{screen:{value:null},strength:{value:0},roll:{value:0},frame:{value:new THREE.Vector4(.5,.5,.5,.5)}},
 vertexShader:'varying vec2 sceneFisheyeUV; void main(){sceneFisheyeUV=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`precision highp float;varying vec2 sceneFisheyeUV;uniform sampler2D screen;uniform float strength;uniform float roll;uniform vec4 frame;
 vec2 spin(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
 vec2 distortedUV(vec2 uv){vec2 local=spin(uv-frame.xy,-roll)/max(frame.zw,vec2(.0001));float radius2=dot(local,local);vec2 warped=local*(1.+strength*.22*radius2)/(1.+strength*.44);vec2 position=frame.xy+spin(warped*frame.zw,roll);
 if(any(greaterThan(abs(local),vec2(1.))))return uv;
 return clamp(position,vec2(0.),vec2(1.));}
 void main(){
 // Integrate four subpixel positions through the nonlinear lens, after MSAA resolves geometry edges.
 vec2 dx=dFdx(sceneFisheyeUV)*.25,dy=dFdy(sceneFisheyeUV)*.25;
 gl_FragColor=.25*(texture2D(screen,distortedUV(sceneFisheyeUV-dx-dy))+texture2D(screen,distortedUV(sceneFisheyeUV+dx-dy))+texture2D(screen,distortedUV(sceneFisheyeUV-dx+dy))+texture2D(screen,distortedUV(sceneFisheyeUV+dx+dy)));
 #include <colorspace_fragment>
 }`});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),shader),stage=new THREE.Scene(),view=new THREE.OrthographicCamera(-1,1,1,-1,0,1);stage.add(quad);
 function render(renderer,scene,camera,strength,region,rollDegrees=0){
  const amount=Math.max(0,Math.min(FISHEYE_MAX,Number(strength)||0));
  if(camera.isOrthographicCamera||amount<.001){renderer.render(scene,camera);return;}
  const size=renderer.getDrawingBufferSize(new THREE.Vector2()),w=Math.round(size.x),h=Math.round(size.y);
  // Bound multisample memory at large screenshot sizes; lens-space filtering stays enabled.
  const sampleLimit=w*h>8*1024*1024?0:w*h>4*1024*1024?2:4;
  if(!target||w!==tw||h!==th){target?.dispose();target=new THREE.WebGLRenderTarget(w,h,{samples:Math.min(sampleLimit,renderer.capabilities?.maxSamples||0),depthBuffer:true,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});tw=w;th=h;}
  const coords=fisheyeFrameUniform(region,w,h);shader.uniforms.frame.value.set(...coords);
  shader.uniforms.strength.value=amount;shader.uniforms.roll.value=THREE.MathUtils.degToRad(rollDegrees);shader.uniforms.screen.value=target.texture;
  const previous=renderer.getRenderTarget();
  try{renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);}
  finally{renderer.setRenderTarget(previous);}
  renderer.render(stage,view);
 }
 function dispose(){target?.dispose();quad.geometry.dispose();shader.dispose();}
 return {render,dispose};
}
