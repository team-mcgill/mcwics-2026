import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { TRIANGULATION } from '../lib/faceMesh/triangulation';
import { UV_COORDS, UV_VERTEX_COUNT } from '../lib/faceMesh/uv';
import { BrushControls } from './BrushControls';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

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
  const rafRef = useRef(0);
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
  }, []);

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
          video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, facingMode: 'user' },
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
        } catch {
          faceLandmarkerRef.current = await create('CPU');
        }

        if (!isActive) return;

        // Three.js setup
        const canvas = webglCanvasRef.current;
        if (!canvas) return;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
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

        const tick = () => {
          rafRef.current = requestAnimationFrame(tick);

          const v = videoRef.current;
          const landmarker = faceLandmarkerRef.current;
          const cam = cameraRef.current;
          const geo = geometryRef.current;
          const r = rendererRef.current;
          const sc = sceneRef.current;
          const wMesh = wireMeshRef.current;

          if (!v || !landmarker || !cam || !geo || !r || !sc || !wMesh) return;

          wMesh.visible = showFaceMeshRef.current;

          if (v.readyState >= 2 && v.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = v.currentTime;
            const res = landmarker.detectForVideo(v, performance.now());
            const landmarks = res.faceLandmarks[0];
            if (landmarks) {
              const attr = geo.getAttribute('position');
              const { width, height } = renderSizeRef.current;
              for (let i = 0; i < UV_VERTEX_COUNT; i++) {
                const lm = landmarks[i];
                const px = lm.x * width;
                const py = lm.y * height;

                const x = px - width / 2;
                const y = -(py - height / 2);

                attr.setXYZ(i, x, y, 0);
              }
              attr.needsUpdate = true;
              geo.computeBoundingSphere();
              geo.computeBoundingBox();
              hasLandmarksRef.current = true;
            }
          }

          r.render(sc, cam);
        };

        tick();
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

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
  }, [paintCanvas, updateRenderSize]);

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

    const { width } = renderSizeRef.current;
    const scale = width > 0 ? paintCanvas.width / width : paintCanvas.width / VIDEO_WIDTH;
    ctx.strokeStyle = brushColorRef.current;
    ctx.lineWidth = Math.max(1, brushSizeRef.current * scale);

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

    lastUvRef.current = uv;
    textureRef.current.needsUpdate = true;
  }, [paintCanvas]);

  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e) => {
      isDrawingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      const uv = getUvFromPointerEvent(e);
      if (uv) paintAtUv(uv);
    };

    const onPointerMove = (e) => {
      if (!isDrawingRef.current) return;
      const uv = getUvFromPointerEvent(e);
      if (uv) paintAtUv(uv);
    };

    const onPointerUp = () => {
      isDrawingRef.current = false;
      lastUvRef.current = null;
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
    textureRef.current.needsUpdate = true;
  }, [paintCanvas.width, paintCanvas.height]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    exportDesign: () => paintCanvas.toDataURL('image/png'),
    loadDesign: (dataUrl) => {
      const ctx = paintCtxRef.current;
      if (!ctx || !textureRef.current) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
        ctx.drawImage(img, 0, 0);
        textureRef.current.needsUpdate = true;
      };
      img.src = dataUrl;
    },
    clearDrawing,
  }), [paintCanvas, clearDrawing]);

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
