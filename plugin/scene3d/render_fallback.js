// Keep a failed optional postprocessing pass from breaking the editor loop.
export function disposePostprocessing(composer,extra=[]){
 const passes=new Set([...(composer?.passes||[]),...extra]);
 for(const pass of passes)try{pass?.dispose?.();}catch{}
 try{composer?.dispose?.();}catch{}
}
export function renderWithFallback(renderer,composer,render,onFailure){
 if(!composer){render();return;}
 // EffectComposer/RenderPass may throw before restoring the framebuffer and
 // renderer flags. Restore the caller state before basic rendering resumes.
 const target=renderer.getRenderTarget(),autoClear=renderer.autoClear;
 const cubeFace=renderer.getActiveCubeFace?.(),mip=renderer.getActiveMipmapLevel?.();
 const scissorTest=renderer.getScissorTest();
 const vector=()=>({copy(v){Object.assign(this,v);return this;}});
 const viewport=renderer.getViewport(vector()),scissor=renderer.getScissor(vector());
 try{composer.render();}
 catch(error){
  renderer.setRenderTarget(target,cubeFace,mip);renderer.autoClear=autoClear;
  renderer.setViewport(viewport.x,viewport.y,viewport.z,viewport.w);
  renderer.setScissor(scissor.x,scissor.y,scissor.z,scissor.w);renderer.setScissorTest(scissorTest);
  onFailure(error);render();
 }
}
