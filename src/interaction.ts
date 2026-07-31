import * as THREE from 'three'
import type { ExhibitId } from './content'

export const GITHUB_URL = 'https://github.com/NiJingzhe'

export type NormalizedRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type CrosshairTarget = {
  exhibitId: ExhibitId
  action: 'read' | 'github'
}

export type CrosshairTargetOptions = {
  maxDistance?: number
  maxAngleRadians?: number
  githubRect?: NormalizedRect | null
}

export type CrosshairPointerIntent = 'activate' | 'request-pointer-lock' | 'none'

const center = new THREE.Vector2(0, 0)
const crosshairRaycaster = new THREE.Raycaster()
const cameraPosition = new THREE.Vector3()
const frameCenter = new THREE.Vector3()
const cameraForward = new THREE.Vector3()
const toFrame = new THREE.Vector3()

export function getCrosshairTarget(
  camera: THREE.Camera,
  scene: THREE.Scene,
  {
    maxDistance = 4.5,
    maxAngleRadians = Math.PI / 6,
    githubRect = null,
  }: CrosshairTargetOptions = {},
): CrosshairTarget | null {
  crosshairRaycaster.setFromCamera(center, camera)
  crosshairRaycaster.near = 0
  crosshairRaycaster.far = maxDistance

  const intersection = crosshairRaycaster.intersectObjects(scene.children, true)[0]
  if (!intersection) return null

  const exhibitId = intersection.object.userData.interactiveExhibitId as ExhibitId | undefined
  if (!exhibitId) return null

  const frame = findExhibitFrame(intersection.object, exhibitId)
  if (!frame || !isWithinFacingAngle(camera, frame, maxAngleRadians)) return null

  const action = exhibitId === 'about'
    && intersection.uv
    && githubRect
    && isTexturePointInRect(intersection.uv, githubRect)
    ? 'github'
    : 'read'

  return { exhibitId, action }
}

export function getNormalizedElementRect(
  container: HTMLElement,
  target: HTMLElement,
): NormalizedRect | null {
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  if (containerRect.width <= 0 || containerRect.height <= 0 || targetRect.width <= 0 || targetRect.height <= 0) {
    return null
  }

  return {
    left: clampUnit((targetRect.left - containerRect.left) / containerRect.width),
    top: clampUnit((targetRect.top - containerRect.top) / containerRect.height),
    right: clampUnit((targetRect.right - containerRect.left) / containerRect.width),
    bottom: clampUnit((targetRect.bottom - containerRect.top) / containerRect.height),
  }
}

export function resolveCrosshairPointerIntent({
  active,
  pointerType,
  button,
  finePointer,
  pointerLockElement,
  canvas,
  target,
}: {
  active: boolean
  pointerType: string
  button: number
  finePointer: boolean
  pointerLockElement: Element | null
  canvas: HTMLCanvasElement
  target: CrosshairTarget | null
}): CrosshairPointerIntent {
  if (!active || pointerType !== 'mouse' || button !== 0 || !finePointer) return 'none'
  if (pointerLockElement !== canvas) return 'request-pointer-lock'
  return target ? 'activate' : 'none'
}

export function resolveCrosshairKeyboardTarget(
  active: boolean,
  key: string,
  repeat: boolean,
  target: CrosshairTarget | null,
): CrosshairTarget | null {
  return active && key.toLowerCase() === 'f' && !repeat ? target : null
}

export function activateCrosshairTarget(
  target: CrosshairTarget,
  onRead: (id: ExhibitId) => void,
  openExternal: (url: string, target: string, features: string) => void,
) {
  if (target.action === 'github') {
    openExternal(GITHUB_URL, '_blank', 'noopener,noreferrer')
    return
  }
  onRead(target.exhibitId)
}

function findExhibitFrame(object: THREE.Object3D, exhibitId: ExhibitId): THREE.Object3D | null {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current.name === `exhibit-frame:${exhibitId}`) return current
    current = current.parent
  }
  return null
}

function isWithinFacingAngle(camera: THREE.Camera, frame: THREE.Object3D, maxAngleRadians: number) {
  camera.getWorldPosition(cameraPosition)
  frame.getWorldPosition(frameCenter)
  camera.getWorldDirection(cameraForward)
  toFrame.subVectors(frameCenter, cameraPosition)
  return toFrame.lengthSq() > 0 && cameraForward.dot(toFrame.normalize()) >= Math.cos(maxAngleRadians)
}

function isTexturePointInRect(uv: THREE.Vector2, rect: NormalizedRect) {
  const x = uv.x
  const y = 1 - uv.y
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value))
}
