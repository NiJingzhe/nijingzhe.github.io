/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import {
  GITHUB_URL,
  activateCrosshairTarget,
  getCrosshairTarget,
  getNormalizedElementRect,
  resolveCrosshairKeyboardTarget,
  resolveCrosshairPointerIntent,
  type CrosshairTarget,
} from './interaction'

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
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

describe('crosshair targeting', () => {
  it('requires the camera-center ray to hit an interactive exhibit surface', () => {
    const { scene } = createScene()

    expect(getCrosshairTarget(createCamera([0, 0, 4], [0, 0, 0]), scene)).toEqual({
      exhibitId: 'about',
      action: 'read',
    })
    expect(getCrosshairTarget(createCamera([0, 0, 4], [2, 0, 0]), scene)).toBeNull()
    expect(getCrosshairTarget(createCamera([0, 0, 5], [0, 0, 0]), scene)).toBeNull()
  })

  it('rejects an exhibit when another object is the center ray first hit', () => {
    const { scene } = createScene()
    const obstruction = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshBasicMaterial())
    obstruction.position.z = 2
    scene.add(obstruction)
    scene.updateMatrixWorld(true)

    expect(getCrosshairTarget(createCamera([0, 0, 4], [0, 0, 0]), scene)).toBeNull()
  })

  it('rejects a frame border even when the exhibit is nearby', () => {
    const { scene, frame } = createScene()
    const border = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshBasicMaterial())
    border.position.z = 0.25
    frame.add(border)
    scene.updateMatrixWorld(true)

    expect(getCrosshairTarget(createCamera([0, 0, 4], [0, 0, 0]), scene)).toBeNull()
  })

  it('maps the hit UV to the real GitHub control rectangle', () => {
    const { scene } = createScene()
    const centerCamera = createCamera([0, 0, 4], [0, 0, 0])
    const upperCamera = createCamera([0, 0, 4], [0, 0.6, 0])

    expect(getCrosshairTarget(centerCamera, scene, {
      githubRect: { left: 0.4, top: 0.4, right: 0.6, bottom: 0.6 },
    })).toEqual({ exhibitId: 'about', action: 'github' })
    expect(getCrosshairTarget(upperCamera, scene, {
      githubRect: { left: 0.4, top: 0.15, right: 0.6, bottom: 0.25 },
    })).toEqual({ exhibitId: 'about', action: 'github' })
    expect(getCrosshairTarget(centerCamera, scene, {
      githubRect: { left: 0, top: 0, right: 0.2, bottom: 0.2 },
    })).toEqual({ exhibitId: 'about', action: 'read' })
  })

  it('normalizes the actual control bounds within the texture source', () => {
    const source = document.createElement('div')
    const control = document.createElement('a')
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 40, left: 100, top: 40, right: 940, bottom: 690, width: 840, height: 650,
      toJSON: () => ({}),
    })
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue({
      x: 184, y: 365, left: 184, top: 365, right: 520, bottom: 430, width: 336, height: 65,
      toJSON: () => ({}),
    })

    expect(getNormalizedElementRect(source, control)).toEqual({
      left: 0.1,
      top: 0.5,
      right: 0.5,
      bottom: 0.6,
    })
  })
})

describe('crosshair input routing', () => {
  const target: CrosshairTarget = { exhibitId: 'about', action: 'read' }
  const canvas = document.createElement('canvas')

  it('activates a target only from a locked desktop primary click', () => {
    expect(resolveCrosshairPointerIntent({
      active: true,
      pointerType: 'mouse',
      button: 0,
      finePointer: true,
      pointerLockElement: canvas,
      canvas,
      target,
    })).toBe('activate')
    expect(resolveCrosshairPointerIntent({
      active: true,
      pointerType: 'mouse',
      button: 0,
      finePointer: true,
      pointerLockElement: canvas,
      canvas,
      target: null,
    })).toBe('none')
  })

  it('uses an unlocked desktop click only to enter pointer lock', () => {
    expect(resolveCrosshairPointerIntent({
      active: true,
      pointerType: 'mouse',
      button: 0,
      finePointer: true,
      pointerLockElement: null,
      canvas,
      target,
    })).toBe('request-pointer-lock')
    expect(resolveCrosshairPointerIntent({
      active: true,
      pointerType: 'touch',
      button: 0,
      finePointer: false,
      pointerLockElement: null,
      canvas,
      target,
    })).toBe('none')
  })

  it('keeps pointer lock while aiming and routes F to the same target', () => {
    expect(resolveCrosshairKeyboardTarget(true, 'f', false, target)).toBe(target)
    expect(resolveCrosshairKeyboardTarget(true, 'f', true, target)).toBeNull()
    expect(resolveCrosshairKeyboardTarget(false, 'f', false, target)).toBeNull()
    expect(resolveCrosshairKeyboardTarget(true, 'w', false, target)).toBeNull()
  })

  it('routes reading and GitHub actions without mixing them', () => {
    const onRead = vi.fn()
    const openExternal = vi.fn()

    activateCrosshairTarget(target, onRead, openExternal)
    expect(onRead).toHaveBeenCalledWith('about')
    expect(openExternal).not.toHaveBeenCalled()

    onRead.mockClear()
    activateCrosshairTarget({ exhibitId: 'about', action: 'github' }, onRead, openExternal)
    expect(onRead).not.toHaveBeenCalled()
    expect(openExternal).toHaveBeenCalledWith(GITHUB_URL, '_blank', 'noopener,noreferrer')
  })
})
