import {appendFileSync,existsSync,mkdirSync,openSync,renameSync,statSync,unlinkSync} from 'node:fs'
import {dirname,join} from 'node:path'

const MAX_BYTES=3*1024*1024
export function rotateLog(path,maxBytes=MAX_BYTES,backups=3){
  if(!existsSync(path)||statSync(path).size<maxBytes)return
  for(let index=backups;index>=1;index--){
    const old=index===1?path:path+'.'+(index-1),next=path+'.'+index
    if(existsSync(next))unlinkSync(next)
    if(existsSync(old))renameSync(old,next)
  }
}
export function diagnosticRecord(root,event,fields={}){
  try{
    const path=join(root,'logs','sidecar-launcher.jsonl');mkdirSync(dirname(path),{recursive:true});rotateLog(path)
    appendFileSync(path,JSON.stringify({...fields,time:new Date().toISOString(),event,hostPid:process.pid,hostPlatform:process.platform})+'\n')
  }catch{/* Diagnostic failure cannot prevent launch or recovery. */}
}
export function bootstrapLog(root){
  try{
    const path=join(root,'logs','sidecar-bootstrap.log');mkdirSync(dirname(path),{recursive:true});rotateLog(path)
    return openSync(path,'a')
  }catch{return null}
}
