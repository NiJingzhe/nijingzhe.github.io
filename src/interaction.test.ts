import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { canActivateExhibit, getFrameObjects } from './interaction'

function createScene() {
  const scene = new THREE.Scene()
  const frame = new THREE.Group()
  frame.name = 'exhibit-frame:about'
  frame.userData.exhibitId = 'about'
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial())
  surface.name = 'exhibit-surface:about'
  surface.userData = { exhibitId: 'about', interactiveExhibitId: 'about' }
  surface.position.z = 0.1
  frame.add(surface)
  scene.add(frame)
  scene.updateMatrixWorld(true)
  return { scene, frame }
}

function createCamera(position: [number, number, number], target: [number, number, number]) {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 20)
  camera.position.set(...position)
  camera.lookAt(...target)
  camera.updateMatrixWorld(true)
  return camera
}

describe('exhibit activation', () => {
  it('requires distance, look-at angle, and an unobstructed first hit', () => {
    const { scene, frame } = createScene()
    expect(canActivateExhibit(createCamera([0, 0, 4], [0, 0, 0]), frame, scene)).toBe(true)
    expect(canActivateExhibit(createCamera([0, 0, 5], [0, 0, 0]), frame, scene)).toBe(false)
    expect(canActivateExhibit(createCamera([0, 0, 4], [1, 0, 4]), frame, scene)).toBe(false)

    const obstruction = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshBasicMaterial())
    obstruction.position.z = 2
    scene.add(obstruction)
    scene.updateMatrixWorld(true)
    expect(canActivateExhibit(createCamera([0, 0, 4], [0, 0, 0]), frame, scene)).toBe(false)
  })

  it('registers frame roots by exhibit id', () => {
    const { scene, frame } = createScene()
    expect(getFrameObjects(scene, ['about', 'work'])).toEqual(new Map([['about', frame]]))
  })
})
