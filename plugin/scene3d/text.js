import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
const fonts=new Map(),faces=new Map(),pages=new Map();
export async function loadTextFont(key='sans',content=''){
 key=key==='serif'?'serif':'sans';
 if(!faces.has(key)){const face=new FontFace('SceneNoto-'+key,`url(/scene3d/fonts/${key}.ttf)`);faces.set(key,face.load().then(f=>{document.fonts.add(f);return f;}).catch(e=>{faces.delete(key);throw e;}));}
 if(!fonts.has(key))fonts.set(key,Promise.all([new FontLoader().loadAsync('/scene3d/fonts/'+key+'.typeface.json'),faces.get(key)]).then(([font])=>font).catch(e=>{fonts.delete(key);throw e;}));
 const font=await fonts.get(key),needed=[...new Set([...content].map(c=>(c.codePointAt(0)>>8).toString(16)))].filter(page=>page!=='0'&&font.data.pages?.includes(page));
 await Promise.all(needed.map(page=>{const id=key+'/'+page;if(!pages.has(id))pages.set(id,fetch('/scene3d/fonts/'+key+'-pages/'+page+'.json').then(r=>{if(!r.ok)throw Error('文字字形资源缺失');return r.json();}).then(glyphs=>Object.assign(font.data.glyphs,glyphs)).catch(e=>{pages.delete(id);throw e;}));return pages.get(id);}));return font;
}
export function normalizeText(value={}){
 return {content:String(value.content||'文字').slice(0,256),font:value.font==='serif'?'serif':'sans',size:Math.max(.02,Math.min(10,Number(value.size)||.5)),depth:Math.max(0,Math.min(5,Number(value.depth)||0)),color:/^#[0-9a-f]{6}$/i.test(value.color||'')?value.color:'#eeeeee',receiveShadow:value.receiveShadow!==false,castShadow:value.castShadow!==false,faceCameraId:String(value.faceCameraId||''),followCamera:!!value.followCamera};
}
export async function rebuildTextObject(object,value){
 const text=normalizeText(value),font=await loadTextFont(text.font,text.content);
 const geometry=text.depth>0?new TextGeometry(text.content,{font,size:text.size,depth:text.depth,curveSegments:5,bevelEnabled:false}):new THREE.ShapeGeometry(font.generateShapes(text.content,text.size),5);
 geometry.computeBoundingBox();const bounds=geometry.boundingBox;geometry.translate(-(bounds.max.x+bounds.min.x)/2,-(bounds.max.y+bounds.min.y)/2,0);
 const material=new THREE.MeshStandardMaterial({color:text.color,side:THREE.DoubleSide,roughness:.8});
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=text.castShadow;mesh.receiveShadow=text.receiveShadow;mesh.userData.ownedGeometry=true;mesh.userData.preserveMaterial=true;
 for(const old of [...object.children]){object.remove(old);old.geometry?.dispose();if(Array.isArray(old.material))old.material.forEach(m=>m.dispose());else old.material?.dispose();}
 object.add(mesh);object.userData.text=text;return object;
}
export async function createTextObject(record){const group=new THREE.Group();await rebuildTextObject(group,record.text);return group;}
export function faceTextObject(object,shot,follow=false){
 if(!object?.userData.text||!shot)return;
 object.lookAt(new THREE.Vector3().fromArray(shot.camera.position));object.userData.text.faceCameraId=shot.id;object.userData.text.followCamera=follow;
}
export function updateTextFacing(objects,shots,activeShot,camera){
 for(const o of objects){const text=o.userData.text;if(!text?.followCamera)continue;const index=shots.findIndex(s=>s.id===text.faceCameraId);if(index<0)continue;o.lookAt(index===activeShot?camera.position:new THREE.Vector3().fromArray(shots[index].camera.position));}
}
export function filterCSS(filter={}){
 const value=(key,min,max,base)=>Math.max(min,Math.min(max,Number(filter[key])||base));
 return `brightness(${value('brightness',.25,2,1)}) contrast(${value('contrast',.25,2,1)}) saturate(${filter.saturation===0?0:value('saturation',0,2,1)}) grayscale(${filter.style==='mono'?1:0}) sepia(${filter.style==='warm'?.32:0})`;
}
export function drawShotTexts(context,texts,width,height){
 for(const t of texts||[]){context.save();context.font=`${Math.max(8,Number(t.size)||48)*(height/1024)}px SceneNoto-${t.font==='serif'?'serif':'sans'}`;context.fillStyle=t.color||'#ffffff';context.textAlign='center';context.textBaseline='middle';context.shadowColor=t.shadow?'#000a':'transparent';context.shadowBlur=t.shadow?4:0;const lines=String(t.content||'').split('\n');lines.forEach((line,i)=>context.fillText(line,(t.x??.5)*width,((t.y??.85)*height)+(i-(lines.length-1)/2)*Number(t.size||48)*height/1024*1.2));context.restore();}
}
export function mirrorPartner(name){let other=name.replace(/Left/g,'__RIGHT__').replace(/Right/g,'Left').replace(/__RIGHT__/g,'Right').replace(/\.L(?=\.|_|$)/g,'.__R__').replace(/\.R(?=\.|_|$)/g,'.L').replace(/\.__R__/g,'.R');if(other===name)other=name.replace(/L$/,'__R__').replace(/R$/,'L').replace(/__R__$/,'R');return other;}
export function copyLimbPose(bones,direction,get,rest,set){
 const byName=new Map(bones.map(n=>[n.name,n]));let count=0;
 const left=name=>/Left|\.L(?:\.|_|$)|L$/.test(name),right=name=>/Right|\.R(?:\.|_|$)|R$/.test(name);
 for(const source of bones){if(!(direction==='left-to-right'?left(source.name):right(source.name)))continue;const target=byName.get(mirrorPartner(source.name));if(!target||target===source)continue;const delta=rest(source).clone().invert().multiply(get(source));const mirrored=rest(target).clone().multiply(new THREE.Quaternion(delta.x,-delta.y,-delta.z,delta.w)).normalize();set(target,mirrored);count++;}
 return count;
}

// Mirror only the selected limb branch; the source and unrelated branches stay unchanged.
export function copySelectedLimbPose(bones,source,get,rest,set){
 const byName=new Map(bones.map(n=>[n.name,n]));if(!source||!byName.has(mirrorPartner(source.name))||mirrorPartner(source.name)===source.name)return 0;
 let count=0;source.traverse(n=>{if(!n.isBone)return;const target=byName.get(mirrorPartner(n.name)),base=rest(n);if(!target||target===n||!base||!rest(target))return;const delta=base.clone().invert().multiply(get(n));set(target,rest(target).clone().multiply(new THREE.Quaternion(delta.x,-delta.y,-delta.z,delta.w)).normalize());count++;});return count;
}
