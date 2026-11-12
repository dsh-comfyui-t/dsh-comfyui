/** Build a scene in isolation. On any failure, release every successfully
 * created asset before the live scene is touched. Avoid Promise.all fail-fast
 * because sibling builds can still resolve after the first rejection. */
export async function prepareSceneAssets(records,build,release){
 const results=await Promise.allSettled(records.map(record=>Promise.resolve().then(()=>build(record))));
 const created=results.filter(row=>row.status==='fulfilled').map(row=>row.value);
 const failure=results.find(row=>row.status==='rejected');
 if(failure){
  for(const asset of created){try{release(asset);}catch{/* Keep original load failure. */}}
  throw failure.reason;
 }
 return created;
}
