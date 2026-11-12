// Cache execution results until acknowledged: a lost network response must not
// replay destructive scene operations. The cache belongs to one editor window.
export function createSceneCommandRunner({apply,capture,snapshot,finish,busy=()=>false}){
 const completed=new Map();
 return async function run(commands){
  for(const command of commands){
   if(busy())break;
   let result=completed.get(command.id);
   if(!result){
    try{
     const outcome=await apply(Array.isArray(command.operations)?command.operations:[]);
     result={applied:outcome?.applied||0,snapshot:snapshot()};
     try{result.screenshot=await capture();}catch(error){result.error='场景已执行，但截图回传失败：'+String(error?.message||error);}
    }catch(error){result={applied:Number(error?.applied)||0,error:String(error?.message||error)};}
    completed.set(command.id,result);
   }
   // Propagate transport errors to the poller, retaining the result for retry.
   await finish({id:command.id,...result});
   completed.delete(command.id);
  }
 };
}
