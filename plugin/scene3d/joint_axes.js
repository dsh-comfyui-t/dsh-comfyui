// Display and edit a joint's pose delta in scene XYZ, without altering its bind pose.
// Parent rotation is explicit so object rotation and posed ancestors remain correct.
export function toSceneJointDelta(local,rest,parentWorld){
 return parentWorld.clone().multiply(local).multiply(rest.clone().invert()).multiply(parentWorld.clone().invert()).normalize();
}
export function fromSceneJointDelta(delta,rest,parentWorld){
 return parentWorld.clone().invert().multiply(delta).multiply(parentWorld).multiply(rest).normalize();
}
