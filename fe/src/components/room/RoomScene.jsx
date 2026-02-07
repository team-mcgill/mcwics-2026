import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const ROOM_HALF_SIZE = 22
const MOVE_SPEED = 6
const MOVE_ACCELERATION = 18
const MOVE_DECELERATION = 14
const TURN_SMOOTHING = 14
const CAMERA_FOLLOW_STIFFNESS = 8
const CAMERA_DISTANCE = 6.6
const CAMERA_LOOK_DISTANCE = 7.0
const CAMERA_PIVOT_HEIGHT = 1.45
const CAMERA_PITCH_MIN = -1.2
const CAMERA_PITCH_MAX = -0.02
const MOUSE_LOOK_SENSITIVITY = 0.006
const MOVEMENT_CODE_TO_DIRECTION = {
  KeyW: 'forward',
  KeyA: 'left',
  KeyS: 'backward',
  KeyD: 'right',
  ArrowUp: 'forward',
  ArrowLeft: 'left',
  ArrowDown: 'backward',
  ArrowRight: 'right',
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function shortestAngleDiff(from, to) {
  const wrapped = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI
  return wrapped < -Math.PI ? wrapped + Math.PI * 2 : wrapped
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function createTextTexture(text, { background, color }) {
  const fontSize = 34
  const paddingX = 16
  const paddingY = 10
  const deviceScale = 2

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  measureCtx.font = `${fontSize}px Inter, system-ui, sans-serif`

  const safeText = typeof text === 'string' ? text : ''
  const textWidth = Math.ceil(measureCtx.measureText(safeText).width)
  const width = Math.max(80, textWidth + paddingX * 2)
  const height = fontSize + paddingY * 2

  const canvas = document.createElement('canvas')
  canvas.width = width * deviceScale
  canvas.height = height * deviceScale

  const ctx = canvas.getContext('2d')
  ctx.scale(deviceScale, deviceScale)
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  drawRoundedRect(ctx, 0, 0, width, height, 12)
  ctx.fillStyle = background
  ctx.fill()

  ctx.fillStyle = color
  ctx.fillText(safeText, width / 2, height / 2 + 1)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function setSpriteText(sprite, text, style) {
  const texture = createTextTexture(text, style)
  const oldTexture = sprite.material.map
  sprite.material.map = texture
  sprite.material.needsUpdate = true
  sprite.scale.set(texture.image.width * 0.0031, texture.image.height * 0.0031, 1)
  oldTexture?.dispose()
}

function createTextSprite(text, style) {
  const material = new THREE.SpriteMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
  })
  const sprite = new THREE.Sprite(material)
  setSpriteText(sprite, text, style)
  return sprite
}

function createFallbackAvatar() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 1.1, 20),
    new THREE.MeshStandardMaterial({ color: '#d9d2c3', roughness: 0.45, metalness: 0.08 })
  )
  body.position.y = 0.8
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 20),
    new THREE.MeshStandardMaterial({ color: '#efe8d8', roughness: 0.5, metalness: 0.05 })
  )
  head.name = 'head'
  head.position.y = 1.78
  head.castShadow = true
  group.add(head)
  return group
}

function findHeadAnchor(root) {
  let head = null
  root.traverse((child) => {
    if (!head && child?.name?.toLowerCase().includes('head')) {
      head = child
    }
  })
  return head
}

function createCosmeticOverlay(imageData) {
  if (!imageData || typeof imageData !== 'string') return null

  const texture = new THREE.TextureLoader().load(imageData)
  texture.colorSpace = THREE.SRGBColorSpace

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.6),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  )

  mesh.renderOrder = 5
  mesh.position.set(0, 0.03, 0.18)
  return mesh
}

function disposeObject3D(object3D) {
  object3D.traverse((child) => {
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        if (material.map) material.map.dispose()
        material.dispose?.()
      })
    }

    if (child.geometry) {
      child.geometry.dispose?.()
    }
  })
}

export function RoomScene({ playersById, localPlayerId, onLocalMove }) {
  const containerRef = useRef(null)
  const playersRef = useRef(playersById)
  const localPlayerIdRef = useRef(localPlayerId)
  const onLocalMoveRef = useRef(onLocalMove)

  useEffect(() => {
    playersRef.current = playersById
  }, [playersById])

  useEffect(() => {
    localPlayerIdRef.current = localPlayerId
  }, [localPlayerId])

  useEffect(() => {
    onLocalMoveRef.current = onLocalMove
  }, [onLocalMove])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0a0a')

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 250)
    camera.position.set(0, 2.8, -6)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight('#f5f5dc', 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight('#ffffff', 0.7)
    directionalLight.position.set(8, 16, -5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.set(1024, 1024)
    directionalLight.shadow.camera.near = 0.1
    directionalLight.shadow.camera.far = 60
    scene.add(directionalLight)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.94, metalness: 0.05 })
    )
    floor.receiveShadow = true
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    const grid = new THREE.GridHelper(80, 80, '#2a2a2a', '#1a1a1a')
    grid.position.y = 0.01
    scene.add(grid)

    const wallMaterial = new THREE.MeshStandardMaterial({ color: '#131313', roughness: 0.85, metalness: 0.1 })
    const walls = [
      new THREE.Mesh(new THREE.BoxGeometry(80, 10, 0.6), wallMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(80, 10, 0.6), wallMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(0.6, 10, 80), wallMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(0.6, 10, 80), wallMaterial),
    ]
    walls[0].position.set(0, 5, ROOM_HALF_SIZE + 2)
    walls[1].position.set(0, 5, -ROOM_HALF_SIZE - 2)
    walls[2].position.set(ROOM_HALF_SIZE + 2, 5, 0)
    walls[3].position.set(-ROOM_HALF_SIZE - 2, 5, 0)
    walls.forEach((wall) => {
      wall.receiveShadow = true
      wall.castShadow = false
      scene.add(wall)
    })

    const avatars = new Map()
    const localMotion = {
      velocity: new THREE.Vector2(0, 0),
    }
    const lookState = {
      yaw: 0,
      pitch: -0.24,
      dragging: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
    }
    const cameraLookAt = new THREE.Vector3(0, CAMERA_PIVOT_HEIGHT, CAMERA_LOOK_DISTANCE)
    const worldForward = new THREE.Vector3(0, 0, 1)
    const worldRight = new THREE.Vector3(1, 0, 0)
    const keyState = {
      forward: false,
      left: false,
      backward: false,
      right: false,
    }

    const addAvatar = (player) => {
      const group = new THREE.Group()
      group.position.set(player.position?.x ?? 0, player.position?.y ?? 0, player.position?.z ?? 0)
      group.rotation.y = player.rotationY ?? 0

      const modelRoot = createFallbackAvatar()
      modelRoot.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      group.add(modelRoot)

      const headAnchor = findHeadAnchor(modelRoot) ?? group

      const nameSprite = createTextSprite(player.name ?? 'Guest', {
        background: 'rgba(16, 16, 16, 0.88)',
        color: '#f5f5dc',
      })
      nameSprite.position.set(0, 2.45, 0)
      group.add(nameSprite)

      const chatSprite = createTextSprite('', {
        background: 'rgba(212, 175, 55, 0.92)',
        color: '#0a0a0a',
      })
      chatSprite.visible = false
      chatSprite.position.set(0, 2.95, 0)
      group.add(chatSprite)

      let cosmeticOverlay = null
      let cosmeticKey = ''
      if (player.cosmeticImageData) {
        cosmeticOverlay = createCosmeticOverlay(player.cosmeticImageData)
        if (cosmeticOverlay) {
          cosmeticKey = player.cosmeticImageData
          headAnchor.add(cosmeticOverlay)
        }
      }

      scene.add(group)
      avatars.set(player.id, {
        id: player.id,
        group,
        headAnchor,
        modelRoot,
        nameSprite,
        chatSprite,
        chatSignature: '',
        cosmeticOverlay,
        cosmeticKey,
      })
    }

    const removeAvatar = (playerId) => {
      const avatar = avatars.get(playerId)
      if (!avatar) return

      avatar.nameSprite.material.map?.dispose()
      avatar.nameSprite.material.dispose?.()
      avatar.chatSprite.material.map?.dispose()
      avatar.chatSprite.material.dispose?.()

      if (avatar.cosmeticOverlay) {
        avatar.cosmeticOverlay.material.map?.dispose()
        avatar.cosmeticOverlay.material.dispose?.()
        avatar.cosmeticOverlay.geometry.dispose?.()
      }

      scene.remove(avatar.group)
      disposeObject3D(avatar.group)
      avatars.delete(playerId)
    }

    const syncAvatars = () => {
      const players = playersRef.current ?? {}
      const desiredIds = new Set(Object.keys(players))

      desiredIds.forEach((playerId) => {
        if (!avatars.has(playerId)) {
          addAvatar(players[playerId])
          return
        }

        const avatar = avatars.get(playerId)
        const player = players[playerId]
        const playerName = player.name ?? 'Guest'
        if (avatar.nameText !== playerName) {
          avatar.nameText = playerName
          setSpriteText(avatar.nameSprite, playerName, {
            background: 'rgba(16, 16, 16, 0.88)',
            color: '#f5f5dc',
          })
        }

        if (player.cosmeticImageData !== avatar.cosmeticKey) {
          if (avatar.cosmeticOverlay) {
            avatar.cosmeticOverlay.material.map?.dispose()
            avatar.cosmeticOverlay.material.dispose?.()
            avatar.cosmeticOverlay.geometry.dispose?.()
            avatar.cosmeticOverlay.removeFromParent()
            avatar.cosmeticOverlay = null
            avatar.cosmeticKey = ''
          }

          if (player.cosmeticImageData) {
            const overlay = createCosmeticOverlay(player.cosmeticImageData)
            if (overlay) {
              avatar.headAnchor.add(overlay)
              avatar.cosmeticOverlay = overlay
              avatar.cosmeticKey = player.cosmeticImageData
            }
          }
        }
      })

      Array.from(avatars.keys()).forEach((playerId) => {
        if (!desiredIds.has(playerId)) {
          removeAvatar(playerId)
        }
      })
    }

    const updateLocalMovement = (deltaSeconds) => {
      const localId = localPlayerIdRef.current
      if (!localId) return

      const avatar = avatars.get(localId)
      if (!avatar) return

      worldForward.set(Math.sin(lookState.yaw), 0, Math.cos(lookState.yaw)).normalize()
      worldRight.set(-Math.cos(lookState.yaw), 0, Math.sin(lookState.yaw)).normalize()

      const inputStrafe = (keyState.right ? 1 : 0) - (keyState.left ? 1 : 0)
      const inputForward = (keyState.forward ? 1 : 0) - (keyState.backward ? 1 : 0)
      const inputLength = Math.hypot(inputStrafe, inputForward)
      const hasInput = inputLength > 0

      const targetVelocity = new THREE.Vector2(0, 0)
      if (hasInput) {
        const normalizedStrafe = inputStrafe / inputLength
        const normalizedForward = inputForward / inputLength

        const moveWorldX = (worldRight.x * normalizedStrafe) + (worldForward.x * normalizedForward)
        const moveWorldZ = (worldRight.z * normalizedStrafe) + (worldForward.z * normalizedForward)
        targetVelocity.set(moveWorldX * MOVE_SPEED, moveWorldZ * MOVE_SPEED)
      }

      const velocityBlend = 1 - Math.exp(-(hasInput ? MOVE_ACCELERATION : MOVE_DECELERATION) * deltaSeconds)
      localMotion.velocity.lerp(targetVelocity, velocityBlend)

      if (!hasInput && localMotion.velocity.lengthSq() < 0.0004) {
        localMotion.velocity.set(0, 0)
      }

      const velocityX = localMotion.velocity.x
      const velocityZ = localMotion.velocity.y
      const velocityLengthSq = localMotion.velocity.lengthSq()

      if (velocityLengthSq > 0) {
        avatar.group.position.x = clamp(
          avatar.group.position.x + velocityX * deltaSeconds,
          -ROOM_HALF_SIZE,
          ROOM_HALF_SIZE
        )
        avatar.group.position.z = clamp(
          avatar.group.position.z + velocityZ * deltaSeconds,
          -ROOM_HALF_SIZE,
          ROOM_HALF_SIZE
        )
      }

      if (velocityLengthSq > 0.0012) {
        const targetRotation = Math.atan2(velocityX, velocityZ)
        const rotationBlend = 1 - Math.exp(-TURN_SMOOTHING * deltaSeconds)
        avatar.group.rotation.y += shortestAngleDiff(avatar.group.rotation.y, targetRotation) * rotationBlend
      }

      if (velocityLengthSq > 0.00001) {
        onLocalMoveRef.current?.({
          position: {
            x: avatar.group.position.x,
            y: avatar.group.position.y,
            z: avatar.group.position.z,
          },
          rotationY: avatar.group.rotation.y,
        })
      }
    }

    const updateRemoteAvatars = () => {
      const players = playersRef.current ?? {}
      const localId = localPlayerIdRef.current

      avatars.forEach((avatar, playerId) => {
        if (playerId === localId) return

        const state = players[playerId]
        if (!state) return

        const targetX = state.position?.x ?? 0
        const targetY = state.position?.y ?? 0
        const targetZ = state.position?.z ?? 0
        const targetRotation = state.rotationY ?? 0

        avatar.group.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.25)
        avatar.group.rotation.y += shortestAngleDiff(avatar.group.rotation.y, targetRotation) * 0.22
      })
    }

    const updateChatBubbles = () => {
      const now = Date.now()
      const players = playersRef.current ?? {}

      avatars.forEach((avatar, playerId) => {
        const state = players[playerId]
        if (!state) return

        const shouldShow = Boolean(state.chatText && state.chatExpiresAt && state.chatExpiresAt > now)
        if (!shouldShow) {
          avatar.chatSprite.visible = false
          return
        }

        const signature = `${state.chatText}|${state.chatExpiresAt}`
        if (avatar.chatSignature !== signature) {
          avatar.chatSignature = signature
          setSpriteText(avatar.chatSprite, state.chatText, {
            background: 'rgba(212, 175, 55, 0.92)',
            color: '#0a0a0a',
          })
        }

        avatar.chatSprite.visible = true
      })
    }

    const updateCamera = (deltaSeconds) => {
      const localId = localPlayerIdRef.current
      if (!localId) return

      const avatar = avatars.get(localId)
      if (!avatar) return

      const targetPosition = avatar.group.position.clone().add(new THREE.Vector3(0, CAMERA_PIVOT_HEIGHT, 0))
      const blend = 1 - Math.exp(-CAMERA_FOLLOW_STIFFNESS * deltaSeconds)

      const forward = new THREE.Vector3(
        Math.sin(lookState.yaw) * Math.cos(lookState.pitch),
        Math.sin(lookState.pitch),
        Math.cos(lookState.yaw) * Math.cos(lookState.pitch)
      ).normalize()

      const desiredPosition = new THREE.Vector3(
        targetPosition.x - (forward.x * CAMERA_DISTANCE),
        targetPosition.y - (forward.y * CAMERA_DISTANCE),
        targetPosition.z - (forward.z * CAMERA_DISTANCE)
      )
      const desiredLookAt = new THREE.Vector3(
        targetPosition.x + (forward.x * CAMERA_LOOK_DISTANCE),
        targetPosition.y + (forward.y * CAMERA_LOOK_DISTANCE),
        targetPosition.z + (forward.z * CAMERA_LOOK_DISTANCE)
      )

      camera.position.lerp(desiredPosition, blend)
      cameraLookAt.lerp(desiredLookAt, blend)
      camera.lookAt(cameraLookAt)
    }

    const onResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return

      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const onKeyDown = (event) => {
      const activeElement = document.activeElement
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )
      if (isTyping) return

      const direction = MOVEMENT_CODE_TO_DIRECTION[event.code]
      if (direction) {
        keyState[direction] = true
        if (event.code.startsWith('Arrow')) {
          event.preventDefault()
        }
      }
    }

    const onKeyUp = (event) => {
      const direction = MOVEMENT_CODE_TO_DIRECTION[event.code]
      if (direction) {
        keyState[direction] = false
      }
    }

    const canvas = renderer.domElement
    canvas.style.cursor = 'grab'

    const stopDragging = () => {
      lookState.dragging = false
      lookState.pointerId = null
      canvas.style.cursor = 'grab'
    }

    const onPointerDown = (event) => {
      if (event.button !== 0) return

      lookState.dragging = true
      lookState.pointerId = event.pointerId
      lookState.lastX = event.clientX
      lookState.lastY = event.clientY
      canvas.style.cursor = 'grabbing'

      if (typeof canvas.setPointerCapture === 'function') {
        canvas.setPointerCapture(event.pointerId)
      }
    }

    const onPointerMove = (event) => {
      if (!lookState.dragging || lookState.pointerId !== event.pointerId) return

      const deltaX = event.clientX - lookState.lastX
      const deltaY = event.clientY - lookState.lastY
      lookState.lastX = event.clientX
      lookState.lastY = event.clientY

      lookState.yaw += deltaX * MOUSE_LOOK_SENSITIVITY
      lookState.pitch = clamp(
        lookState.pitch - (deltaY * MOUSE_LOOK_SENSITIVITY),
        CAMERA_PITCH_MIN,
        CAMERA_PITCH_MAX
      )
    }

    const onPointerUp = (event) => {
      if (lookState.pointerId !== event.pointerId) return
      stopDragging()
    }

    const onPointerCancel = () => {
      stopDragging()
    }

    const onWindowBlur = () => {
      keyState.forward = false
      keyState.left = false
      keyState.backward = false
      keyState.right = false
      stopDragging()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        onWindowBlur()
      }
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)
    onResize()

    const clock = new THREE.Clock()
    let frameId = 0

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const deltaSeconds = Math.min(clock.getDelta(), 0.1)

      syncAvatars()
      updateLocalMovement(deltaSeconds)
      updateRemoteAvatars()
      updateChatBubbles()
      updateCamera(deltaSeconds)

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)

      avatars.forEach((_, playerId) => removeAvatar(playerId))
      renderer.dispose()
      scene.clear()

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
