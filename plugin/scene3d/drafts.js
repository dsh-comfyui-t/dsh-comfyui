/** Serial draft writes; saving progress never changes the last generation image. */
export class SceneDraftSession {
 constructor({channel,api,snapshot,metadata,onError,onSaved,delay=350}){
  Object.assign(this,{channel,api,snapshot,metadata,onError,onSaved,delay});
  this.version=0;this.saved=0;this.saving=null;this.timer=null;this.active=true;
 }
 mark(){
  if(!this.active)return;
  this.version++;clearTimeout(this.timer);
  this.timer=setTimeout(()=>this.flush().catch(this.onError),this.delay);
 }
 async flush(){
  clearTimeout(this.timer);
  if(this.saving){await this.saving;return this.flush();}
  if(this.saved>=this.version)return;
  const drain=this.drain();this.saving=drain;
  try{await drain;}finally{if(this.saving===drain)this.saving=null;}
 }
 async drain(){
  while(this.saved<this.version){
   if(!this.active)throw Error('临时场景已结束');
   const version=this.version,body={action:'save',channel:this.channel,scene:this.snapshot(),...this.metadata()};
   await this.api('drafts',body);this.saved=version;this.onSaved?.();
  }
 }
 stop(){this.active=false;clearTimeout(this.timer);}
}
