/** Ground controls: live input changes the scene without creating history;
 * the final change event records exactly one history revision.
 * This module intentionally has no Three.js or DSH dependencies for DOM tests.
 */
const CONTROL_FIELDS=[
 ['grid-visible','visible','check'],['grid-size','size','number'],
 ['grid-pattern','pattern','text'],['grid-capture','capture','check'],
 ['grid-radius','radius','number'],['ground-transparent','transparent','check'],
 ['grid-color','lineColor','text'],['ground-color','floorColor','text'],
 ['floor','floorVisible','check'],['ground-ripples','ripples','check'],
 ['ripple-size','rippleSize','number'],['ripple-height','rippleHeight','number'],
 ['ripple-width','rippleWidth','number'],['ripple-density','rippleDensity','number']
];
export const liveGroundControlIds=CONTROL_FIELDS.filter(([id,key,type])=>type==='number'||id==='grid-color'||id==='ground-color').map(row=>row[0]);
export function bindGroundControls(getElement,changeGlobal){
 for(const [id,key,type] of CONTROL_FIELDS){
  const field=getElement(id);if(!field)throw Error('缺少地面控制控件：'+id);
  const read=()=>{
   if(type==='check')return field.checked;
   if(type==='number'){
    // Empty/partially typed values are not a valid scene change.
    const value=String(field.value).trim();if(!value)return undefined;
    const n=Number(value);return Number.isFinite(n)?n:undefined;
   }
   return field.value;
  };
  const apply=commit=>{const value=read();if(value!==undefined)changeGlobal({[key]:value},commit);};
  if(type==='number'||id==='grid-color'||id==='ground-color')field.addEventListener('input',()=>apply(false));
  field.addEventListener('change',()=>apply(true));
 }
}
