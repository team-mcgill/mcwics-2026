import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { TRIANGULATION } from '../lib/faceMesh/triangulation';
import { UV_COORDS, UV_VERTEX_COUNT } from '../lib/faceMesh/uv';
import { BrushControls } from './BrushControls';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const VIDEO_FPS = 24;
const MAX_PIXEL_RATIO = 1.5;

const DEFAULT_TEX_SIZE = 2048;

export const FaceMeshPainter = forwardRef(function FaceMeshPainter(props, ref) {
  const videoRef = useRef(null);
  const webglCanvasRef = useRef(null);
  const containerRef = useRef(null);

  const [brushColor, setBrushColor] = useState('#d4af37');
  const [brushSize, setBrushSize] = useState(5);
  const [showFaceMesh, setShowFaceMesh] = useState(true);
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(VIDEO_WIDTH / VIDEO_HEIGHT);

  const brushColorRef = useRef(brushColor);
  const brushSizeRef = useRef(brushSize);
  const showFaceMeshRef = useRef(showFaceMesh);

  useEffect(() => {
    brushColorRef.current = brushColor;
  }, [brushColor]);
  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);
  useEffect(() => {
    showFaceMeshRef.current = showFaceMesh;
  }, [showFaceMesh]);

  const faceLandmarkerRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const geometryRef = useRef(null);
  const paintMeshRef = useRef(null);
  const wireMeshRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const frameRequestRef = useRef(0);
  const frameLoopTypeRef = useRef(null);
  const renderSizeRef = useRef({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
  const hasLandmarksRef = useRef(false);

  const paintCanvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = DEFAULT_TEX_SIZE;
    c.height = DEFAULT_TEX_SIZE;
    return c;
  }, []);

  const paintCtxRef = useRef(null);

  useEffect(() => {
    const ctx = paintCanvas.getContext('2d');
    if (!ctx) {
      paintCtxRef.current = null;
      return;
    }
    ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    paintCtxRef.current = ctx;
  }, [paintCanvas]);

  const textureRef = useRef(null);

  const isDrawingRef = useRef(false);
  const lastUvRef = useRef(null);
  const strokesRef = useRef([]);
  const activeStrokeRef = useRef(null);

  // Accessory management refs
  const accessoriesRef = useRef(new Map());
  const gltfLoaderRef = useRef(new GLTFLoader());

  const getScaledBrushWidth = useCallback((size) => {
    const { width } = renderSizeRef.current;
    const scale = width > 0 ? paintCanvas.width / width : paintCanvas.width / VIDEO_WIDTH;
    return Math.max(1, size * scale);
  }, [paintCanvas.width]);

  const renderScene = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
  }, []);

  const loadAccessory = useCallback(async (itemId, modelUrl, transform = {}) => {
    const scene = sceneRef.current;
    if (!scene) return null;

    // Remove existing if any
    if (accessoriesRef.current.has(itemId)) {
      const existing = accessoriesRef.current.get(itemId);
      scene.remove(existing);
      accessoriesRef.current.delete(itemId);
    }

    try {
      const gltf = await new Promise((resolve, reject) => {
        gltfLoaderRef.current.load(modelUrl, resolve, undefined, reject);
      });

      const model = gltf.scene;

      // Apply default transform
      const defaultPos = transform.defaultPosition || { x: 0, y: 0, z: 0 };
      const defaultScale = transform.defaultScale || { x: 1, y: 1, z: 1 };
      const defaultRot = transform.defaultRotation || { x: 0, y: 0, z: 0 };

      model.position.set(defaultPos.x, defaultPos.y, defaultPos.z);
      model.scale.set(defaultScale.x, defaultScale.y, defaultScale.z);
      model.rotation.set(defaultRot.x, defaultRot.y, defaultRot.z);

      // Store original transform for face tracking updates
      model.userData = {
        itemId,
        originalTransform: { ...defaultPos },
      };

      scene.add(model);
      accessoriesRef.current.set(itemId, model);
      renderScene();
      return model;
    } catch (err) {
      console.error('Failed to load accessory:', err);
      return null;
    }
  }, [renderScene]);

  const unloadAccessory = useCallback((itemId) => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (accessoriesRef.current.has(itemId)) {
      const model = accessoriesRef.current.get(itemId);
      scene.remove(model);
      accessoriesRef.current.delete(itemId);
      renderScene();
    }
  }, [renderScene]);

  const toggleAccessory = useCallback(async (itemId, isEquipped, itemData = null) => {
    if (isEquipped) {
      if (itemData?.modelUrl) {
        await loadAccessory(itemId, itemData.modelUrl, {
          defaultPosition: itemData.defaultPosition,
          defaultScale: itemData.defaultScale,
          defaultRotation: itemData.defaultRotation,
        });
      }
    } else {
      unloadAccessory(itemId);
    }
  }, [loadAccessory, unloadAccessory]);

  const updateAccessoryPositions = useCallback((landmarks) => {
    if (!landmarks || accessoriesRef.current.size === 0) return;

    // Use forehead/nose bridge area as anchor (landmarks around 10-168)
    const anchorIndex = 10; // Forehead center
    const anchor = landmarks[anchorIndex];
    if (!anchor) return;

    const { width, height } = renderSizeRef.current;

    accessoriesRef.current.forEach((model) => {
      const basePos = model.userData.originalTransform;

      // Convert anchor to screen space and apply offset
      const anchorX = (anchor.x * width) - (width / 2);
      const anchorY = -((anchor.y * height) - (height / 2));

      model.position.x = anchorX + (basePos.x || 0);
      model.position.y = anchorY + (basePos.y || 0);
    });

    renderScene();
  }, [renderScene]);

  const drawStrokeList = useCallback((strokes) => {
    const ctx = paintCtxRef.current;
    const texture = textureRef.current;
    if (!ctx || !texture) return;

    ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);

    for (const stroke of strokes) {
      if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) {
        continue;
      }

      const lineWidth = getScaledBrushWidth(stroke.size);
      const points = stroke.points;

      if (points.length === 1) {
        ctx.beginPath();
        ctx.fillStyle = stroke.color;
        ctx.arc(points[0].x * paintCanvas.width, points[0].y * paintCanvas.height, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = lineWidth;
      ctx.moveTo(points[0].x * paintCanvas.width, points[0].y * paintCanvas.height);

      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x * paintCanvas.width, points[i].y * paintCanvas.height);
      }

      ctx.stroke();
    }

    texture.needsUpdate = true;
    renderScene();
  }, [getScaledBrushWidth, paintCanvas.height, paintCanvas.width, renderScene]);

  const updateRenderSize = useCallback((width, height) => {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    renderSizeRef.current = { width: safeWidth, height: safeHeight };

    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setSize(safeWidth, safeHeight, false);
    }

    const camera = cameraRef.current;
    if (camera) {
      camera.left = -safeWidth / 2;
      camera.right = safeWidth / 2;
      camera.top = safeHeight / 2;
      camera.bottom = -safeHeight / 2;
      camera.updateProjectionMatrix();
    }

    renderScene();
  }, [renderScene]);

  useEffect(() => {
    const wireMesh = wireMeshRef.current;
    if (!wireMesh) return;
    wireMesh.visible = showFaceMesh;
    renderScene();
  }, [showFaceMesh, renderScene]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        updateRenderSize(width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [updateRenderSize]);

  useEffect(() => {
    let isActive = true;
    let videoEl = null;
    const start = async () => {
      try {
        setError(null);
        setIsLoaded(false);

        // Camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT,
            frameRate: { ideal: VIDEO_FPS, max: VIDEO_FPS },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!isActive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (!videoRef.current) return;
        videoEl = videoRef.current;
        videoEl.srcObject = stream;
        await videoEl.play();

        if (!isActive) return;

        // MediaPipe Face Landmarker
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
        );

        if (!isActive) return;

        const create = async (delegate) => {
          return FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate,
            },
            runningMode: 'VIDEO',
            numFaces: 1,
          });
        };

        try {
          faceLandmarkerRef.current = await create('GPU');
          console.info('[FaceMeshPainter] FaceLandmarker delegate: GPU');
        } catch {
          faceLandmarkerRef.current = await create('CPU');
          console.info('[FaceMeshPainter] FaceLandmarker delegate: CPU (fallback)');
        }

        if (!isActive) return;

        // Three.js setup
        const canvas = webglCanvasRef.current;
        if (!canvas) return;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
        renderer.setSize(VIDEO_WIDTH, VIDEO_HEIGHT, false);
        renderer.setClearColor(0x000000, 0);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const { width: initialWidth, height: initialHeight } = renderSizeRef.current;
        const camera = new THREE.OrthographicCamera(
          -initialWidth / 2,
          initialWidth / 2,
          initialHeight / 2,
          -initialHeight / 2,
          -1000,
          1000
        );
        camera.position.z = 10;
        cameraRef.current = camera;

        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            updateRenderSize(rect.width, rect.height);
          }
        }

        const positions = new Float32Array(UV_VERTEX_COUNT * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(UV_COORDS, 2));
        geometry.setIndex(new THREE.BufferAttribute(TRIANGULATION, 1));
        geometry.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(0, 0, 0),
          Math.max(VIDEO_WIDTH, VIDEO_HEIGHT)
        );
        geometryRef.current = geometry;

        const texture = new THREE.CanvasTexture(paintCanvas);
        texture.flipY = false;
        textureRef.current = texture;

        const paintMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        const paintMesh = new THREE.Mesh(geometry, paintMaterial);
        paintMeshRef.current = paintMesh;
        scene.add(paintMesh);

        const wireMaterial = new THREE.MeshBasicMaterial({
          color: 0xd4af37,
          wireframe: true,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthTest: false,
        });
        const wireMesh = new THREE.Mesh(geometry, wireMaterial);
        wireMesh.renderOrder = 2;
        wireMeshRef.current = wireMesh;
        scene.add(wireMesh);

        setIsLoaded(true);
        renderScene();

        const processFrame = () => {
          const v = videoRef.current;
          const landmarker = faceLandmarkerRef.current;
          const geo = geometryRef.current;
          const wMesh = wireMeshRef.current;

          if (!v || !landmarker || !geo || !wMesh) return;

          wMesh.visible = showFaceMeshRef.current;

          if (v.readyState >= 2 && v.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = v.currentTime;
            const res = landmarker.detectForVideo(v, performance.now());
            const landmarks = res.faceLandmarks[0];
            if (landmarks) {
              const attr = geo.getAttribute('position');
              const pos = attr.array;
              const { width, height } = renderSizeRef.current;

              for (let i = 0; i < UV_VERTEX_COUNT; i++) {
                const lm = landmarks[i];
                const px = lm.x * width;
                const py = lm.y * height;

                const x = px - width / 2;
                const y = -(py - height / 2);
                const base = i * 3;

                pos[base] = x;
                pos[base + 1] = y;
                pos[base + 2] = 0;
              }

              attr.needsUpdate = true;
              hasLandmarksRef.current = true;

              // Update accessory positions to follow face
              updateAccessoryPositions(landmarks);
            }
          }

          renderScene();
        };

        const canUseVideoFrames =
          typeof videoEl.requestVideoFrameCallback === 'function' &&
          typeof videoEl.cancelVideoFrameCallback === 'function';

        if (canUseVideoFrames) {
          frameLoopTypeRef.current = 'video';
          const onVideoFrame = () => {
            if (!isActive) return;
            processFrame();
            frameRequestRef.current = videoEl.requestVideoFrameCallback(onVideoFrame);
          };
          frameRequestRef.current = videoEl.requestVideoFrameCallback(onVideoFrame);
        } else {
          frameLoopTypeRef.current = 'raf';
          const onAnimationFrame = () => {
            if (!isActive) return;
            processFrame();
            frameRequestRef.current = requestAnimationFrame(onAnimationFrame);
          };
          frameRequestRef.current = requestAnimationFrame(onAnimationFrame);
        }
      } catch (err) {
        if (!isActive) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof Error && /aborted/i.test(err.message)) return;
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    };

    start();

    return () => {
      isActive = false;

      if (frameLoopTypeRef.current === 'video' && frameRequestRef.current) {
        videoEl?.cancelVideoFrameCallback?.(frameRequestRef.current);
      }
      if (frameLoopTypeRef.current === 'raf' && frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
      frameRequestRef.current = 0;
      frameLoopTypeRef.current = null;

      const stream = videoEl?.srcObject ?? null;
      stream?.getTracks().forEach((t) => t.stop());

      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;

      textureRef.current?.dispose();
      textureRef.current = null;

      const geom = geometryRef.current;
      geom?.dispose();
      geometryRef.current = null;

      const r = rendererRef.current;
      r?.dispose();
      rendererRef.current = null;
    };
  }, [paintCanvas, updateRenderSize, renderScene]);

  const getUvFromPointerEvent = useCallback((e) => {
    const canvas = webglCanvasRef.current;
    const cam = cameraRef.current;
    const mesh = paintMeshRef.current;
    if (!canvas || !cam || !mesh || !hasLandmarksRef.current) return null;
    mesh.updateMatrixWorld();

    const rect = canvas.getBoundingClientRect();
    const localX = rect.width - (e.clientX - rect.left); // account for mirrored wrapper
    const localY = e.clientY - rect.top;

    const ndcX = (localX / rect.width) * 2 - 1;
    const ndcY = -(localY / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    const hits = raycasterRef.current.intersectObject(mesh);
    const hit = hits[0];
    if (!hit?.uv) return null;
    return hit.uv.clone();
  }, []);

  const paintAtUv = useCallback((uv) => {
    const ctx = paintCtxRef.current;
    if (!ctx || !textureRef.current) return;

    ctx.strokeStyle = brushColorRef.current;
    ctx.lineWidth = getScaledBrushWidth(brushSizeRef.current);

    const x = uv.x * paintCanvas.width;
    const y = uv.y * paintCanvas.height;

    if (lastUvRef.current) {
      const lx = lastUvRef.current.x * paintCanvas.width;
      const ly = lastUvRef.current.y * paintCanvas.height;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = brushColorRef.current;
      ctx.fill();
    }

    if (activeStrokeRef.current) {
      activeStrokeRef.current.points.push({ x: uv.x, y: uv.y });
    }

    lastUvRef.current = uv;
    textureRef.current.needsUpdate = true;
    renderScene();
  }, [getScaledBrushWidth, paintCanvas, renderScene]);

  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e) => {
      isDrawingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      const uv = getUvFromPointerEvent(e);
      if (!uv) return;

      const stroke = {
        color: brushColorRef.current,
        size: brushSizeRef.current,
        points: [],
      };

      strokesRef.current = [...strokesRef.current, stroke];
      activeStrokeRef.current = stroke;
      paintAtUv(uv);
    };

    const onPointerMove = (e) => {
      if (!isDrawingRef.current) return;
      const uv = getUvFromPointerEvent(e);
      if (uv) paintAtUv(uv);
    };

    const onPointerUp = () => {
      isDrawingRef.current = false;
      lastUvRef.current = null;
      activeStrokeRef.current = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, [getUvFromPointerEvent, paintAtUv]);

  const clearDrawing = useCallback(() => {
    const ctx = paintCtxRef.current;
    if (!ctx || !textureRef.current) return;
    ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    strokesRef.current = [];
    activeStrokeRef.current = null;
    lastUvRef.current = null;
    textureRef.current.needsUpdate = true;
    renderScene();
  }, [paintCanvas.width, paintCanvas.height, renderScene]);

  const normalizeStrokeData = useCallback((strokeData) => {
    if (!Array.isArray(strokeData)) return [];

    return strokeData
      .map((stroke) => {
        if (!stroke || typeof stroke !== 'object') return null;
        if (typeof stroke.color !== 'string' || !stroke.color.trim()) return null;
        if (!Number.isFinite(stroke.size)) return null;
        if (!Array.isArray(stroke.points)) return null;

        const points = stroke.points
          .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
          .map((point) => ({
            x: Math.max(0, Math.min(1, point.x)),
            y: Math.max(0, Math.min(1, point.y)),
          }));

        if (!points.length) return null;

        return {
          color: stroke.color,
          size: Math.max(1, Number(stroke.size)),
          points,
        };
      })
      .filter(Boolean);
  }, []);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    exportDesign: () => paintCanvas.toDataURL('image/png'),
    exportDesignState: () => ({
      imageData: paintCanvas.toDataURL('image/png'),
      strokeData: JSON.parse(JSON.stringify(strokesRef.current)),
    }),
    loadDesign: (input) => {
      const ctx = paintCtxRef.current;
      if (!ctx || !textureRef.current) return;

      const loadImage = (dataUrl) => {
        if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
          return;
        }

        strokesRef.current = [];
        activeStrokeRef.current = null;
        lastUvRef.current = null;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
          ctx.drawImage(img, 0, 0);
          textureRef.current.needsUpdate = true;
          renderScene();
        };
        img.src = dataUrl;
      };

      if (typeof input === 'string') {
        loadImage(input);
        return;
      }

      const strokeData = normalizeStrokeData(input?.strokeData);
      if (strokeData.length) {
        strokesRef.current = strokeData;
        activeStrokeRef.current = null;
        lastUvRef.current = null;
        drawStrokeList(strokeData);
        return;
      }

      loadImage(input?.imageData ?? input?.paintData ?? null);
    },
    exportStrokeData: () => JSON.parse(JSON.stringify(strokesRef.current)),
    setStrokeData: (strokeData) => {
      const normalized = normalizeStrokeData(strokeData);
      strokesRef.current = normalized;
      activeStrokeRef.current = null;
      lastUvRef.current = null;
      drawStrokeList(normalized);
    },
    clearDrawing,
    toggleAccessory,
    getActiveAccessories: () => Array.from(accessoriesRef.current.keys()),
  }), [clearDrawing, drawStrokeList, normalizeStrokeData, paintCanvas, renderScene, toggleAccessory]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.videoWidth && video.videoHeight) {
      setAspectRatio(video.videoWidth / video.videoHeight);
    }

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      updateRenderSize(rect.width, rect.height);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl border border-[#d4af37]/20"
        style={{ maxWidth: VIDEO_WIDTH, aspectRatio, transform: 'scaleX(-1)' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
          className="absolute inset-0 h-full w-full"
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />

        <canvas
          ref={webglCanvasRef}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          className="absolute inset-0 h-full w-full cursor-crosshair"
        />

        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-[#d4af37] font-light tracking-wider">Loading face mesh…</div>
          </div>
        )}
      </div>

      <BrushControls
        brushColor={brushColor}
        brushSize={brushSize}
        showFaceMesh={showFaceMesh}
        onColorChange={setBrushColor}
        onSizeChange={setBrushSize}
        onToggleFaceMesh={() => setShowFaceMesh((v) => !v)}
        onClearCanvas={clearDrawing}
      />
    </div>
  );
});
