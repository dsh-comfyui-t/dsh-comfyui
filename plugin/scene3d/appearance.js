import {configureSkinShadows} from './skin_shadows.js';
import * as THREE from 'three';

export function prepareObjectAppearance(object,{preserveMaterials=false,opaqueMaterials=[],clay,restBones,shadowProfile={normalBias:.012,bias:-.00002}}){
 object.traverse(node=>{
  if(node.isMesh){
   node.material=preserveMaterials?(Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone()):new THREE.MeshStandardMaterial({color:clay,roughness:.85,metalness:0,side:THREE.DoubleSide});
   // This model's exporter marked fully opaque textures as BLEND. Only the
   // audited opaque slots use depth writing; actual eye transparency stays.
   if(preserveMaterials)for(const material of (Array.isArray(node.material)?node.material:[node.material]))if(opaqueMaterials.includes(material.name)){material.transparent=false;material.depthWrite=true;}
   if(shadowProfile)for(const material of (Array.isArray(node.material)?node.material:[node.material]))configureSkinShadows(material,shadowProfile);
   node.userData.preserveMaterial=preserveMaterials;node.castShadow=true;node.receiveShadow=true;
   if(node.isSkinnedMesh)node.frustumCulled=false;
  }
  if(node.isBone)restBones.set(node,node.quaternion.clone());
 });
}
export function updateClayColor(object,clay){
 object.traverse(node=>{if(node.isMesh&&!node.userData.preserveMaterial)for(const material of (Array.isArray(node.material)?node.material:[node.material]))material.color.set(clay);});
}
