import * as THREE from 'three';

// Stored scenes contain local bone quaternions. Convert the changed parent bases
// once, preserving the authored joint rotation when loading the previous asset.
export function migrateRigPose(record,model){
 const migration=model?.poseMigration;
 if(!record?.bones||!migration||(record.rigRevision||1)>=migration.toRevision)return record;
 const bones={...record.bones};
 for(const [name,prefix]of Object.entries(migration.localPrefix||{})){
  if(bones[name])bones[name]=new THREE.Quaternion().fromArray(prefix).multiply(new THREE.Quaternion().fromArray(bones[name])).normalize().toArray();
 }
 return {...record,rigRevision:migration.toRevision,bones};
}
