import * as THREE from 'three';

// Bias the receiver for these dense, continuous-surface models only.
// Keep self shadows and ground shadows; other assets retain their original material.
export function configureSkinShadows(material,profile){
 if(!profile)return;
 const normal=Number(profile.normalBias),depth=Number(profile.bias);
 if(!Number.isFinite(normal)||normal<=0||normal>.03||!Number.isFinite(depth)||Math.abs(depth)>.001)throw Error('素体阴影配置无效');
 const vertex=THREE.ShaderChunk.shadowmap_vertex.replace(/directionalLightShadows\[\s*i\s*\]\.shadowNormalBias/g,match=>'('+match+' + '+normal.toFixed(6)+')');
 const fragment=THREE.ShaderChunk.lights_fragment_begin.replace(/directionalLightShadow\.shadowBias/g,match=>'max('+match+', '+depth.toFixed(6)+')');
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <shadowmap_vertex>',vertex);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',fragment);
 };
 material.customProgramCacheKey=()=>`dsh-skin-shadow-${normal}-${depth}`;
 material.needsUpdate=true;
}
