import * as THREE from 'three'

export type ActivationOptions = {
  maxDistance?: number
  maxAngleRadians?: number
}

export function canActivateExhibit(
  camera: THREE.Camera,
  frame: THREE.Object3D,
  scene: THREE.Scene,
  { maxDistance = 4.5, maxAngleRadians = Math.PI / 6 }: ActivationOptions = {},
): boolean {
  const cameraPosition = new THREE.Vector3()
  const frameCenter = new THREE.Vector3()
  const toFrame = new THREE.Vector3()
  const cameraForward = new THREE.Vector3()
  frame.getWorldPosition(frameCenter)
  camera.getWorldPosition(cameraPosition)
  toFrame.subVectors(frameCenter, cameraPosition)
  const distance = toFrame.length()
  if (distance > maxDistance || distance === 0) return false

  toFrame.normalize()
  camera.getWorldDirection(cameraForward)
  if (cameraForward.dot(toFrame) < Math.cos(maxAngleRadians)) return false

  const raycaster = new THREE.Raycaster(cameraPosition, toFrame, 0, distance + 0.2)
  const intersections = raycaster.intersectObjects(scene.children, true)
  const firstHit = intersections[0]?.object
  const exhibitId = frame.userData.exhibitId
  if (!firstHit) return false
  let hit: THREE.Object3D | null = firstHit
  while (hit && hit !== frame) {
    if (hit.userData.interactiveExhibitId === exhibitId) return true
    hit = hit.parent
  }
  return false
}

export function getFrameObjects(scene: THREE.Scene, exhibitIds: readonly string[]): Map<string, THREE.Object3D> {
  return new Map(
    exhibitIds
      .map((id) => [id, scene.getObjectByName(`exhibit-frame:${id}`)] as const)
      .filter((entry): entry is [string, THREE.Object3D] => Boolean(entry[1])),
  )
}
