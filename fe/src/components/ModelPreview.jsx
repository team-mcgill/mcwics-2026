import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PREVIEW_MAX_PIXEL_RATIO = 1.25;
const PREVIEW_TARGET_FPS = 24;
const PREVIEW_ROTATION_SPEED = 0.55;
const PREVIEW_FRAME_PADDING = 1.35;
const PREVIEW_TARGET_RADIUS = 1.15;

THREE.Cache.enabled = true;
const previewLoader = new GLTFLoader();

function disposeModel(root) {
  if (!root) return;

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose?.();

    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material?.dispose?.());
      return;
    }

    child.material?.dispose?.();
  });
}

function centerAndFrameModel(model, camera) {
  const initialBox = new THREE.Box3().setFromObject(model);
  if (initialBox.isEmpty()) return;

  const initialCenter = initialBox.getCenter(new THREE.Vector3());
  model.position.sub(initialCenter);

  const normalizedBox = new THREE.Box3().setFromObject(model);
  const normalizedSphere = normalizedBox.getBoundingSphere(new THREE.Sphere());
  const radius = Number(normalizedSphere?.radius);

  if (Number.isFinite(radius) && radius > 0) {
    const scale = PREVIEW_TARGET_RADIUS / radius;
    model.scale.multiplyScalar(scale);
  }

  const finalBox = new THREE.Box3().setFromObject(model);
  const finalCenter = finalBox.getCenter(new THREE.Vector3());
  model.position.sub(finalCenter);

  const finalSphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  const finalRadius = Math.max(0.001, Number(finalSphere.radius) || PREVIEW_TARGET_RADIUS);
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const distance = (finalRadius / Math.tan(halfFov)) * PREVIEW_FRAME_PADDING;

  camera.position.set(0, 0, distance);
  camera.near = Math.max(0.01, distance - finalRadius * 4);
  camera.far = distance + finalRadius * 4;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
}

export function ModelPreview({ modelUrl, className = '' }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const frameRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || !modelUrl) return;

    setIsLoading(true);
    setError(null);

    const container = containerRef.current;
    const getSize = () => {
      const width = Math.max(container.clientWidth || 0, 120);
      const height = Math.max(container.clientHeight || 0, 120);
      return { width, height };
    };

    const initialSize = getSize();
    const width = initialSize.width;
    const height = initialSize.height;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PREVIEW_MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x111111, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.62);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.82);
    directionalLight.position.set(4, 6, 5);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xd4af37, 0.42);
    directionalLight2.position.set(-4, 3, -4);
    scene.add(directionalLight2);

    let destroyed = false;
    let isVisible = true;
    let hasLoadedModel = false;
    let lastFrameAt = 0;
    const frameIntervalMs = 1000 / PREVIEW_TARGET_FPS;

    const renderScene = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    const stopAnimation = () => {
      if (!frameRef.current) return;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };

    const animate = (timestamp) => {
      if (destroyed) return;
      frameRef.current = requestAnimationFrame(animate);

      if (!isVisible) return;

      if (lastFrameAt && timestamp - lastFrameAt < frameIntervalMs) {
        return;
      }

      const deltaSeconds = lastFrameAt ? Math.min(0.1, (timestamp - lastFrameAt) / 1000) : 0;
      lastFrameAt = timestamp;

      if (modelRef.current) {
        modelRef.current.rotation.y += PREVIEW_ROTATION_SPEED * deltaSeconds;
      }

      renderScene();
    };

    const startAnimation = () => {
      if (frameRef.current || !hasLoadedModel || !isVisible) return;
      frameRef.current = requestAnimationFrame(animate);
    };

    // Load model
    previewLoader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        if (destroyed) {
          disposeModel(model);
          return;
        }

        model.rotation.set(0, 0, 0);
        centerAndFrameModel(model, camera);

        scene.add(model);
        modelRef.current = model;
        hasLoadedModel = true;
        setIsLoading(false);

        renderScene();
        startAnimation();
      },
      undefined,
      (err) => {
        if (destroyed) return;
        console.error('ModelPreview: failed to load model:', err);
        setError(err?.message || 'Failed to load model');
        setIsLoading(false);
      }
    );

    const handleResize = () => {
      const nextSize = getSize();
      camera.aspect = nextSize.width / nextSize.height;
      camera.updateProjectionMatrix();
      renderer.setSize(nextSize.width, nextSize.height, false);
      renderScene();
    };

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }

    let intersectionObserver;
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          isVisible = Boolean(entry?.isIntersecting);

          if (isVisible) {
            lastFrameAt = 0;
            renderScene();
            startAnimation();
          } else {
            stopAnimation();
          }
        },
        { threshold: 0.05 }
      );
      intersectionObserver.observe(container);
    }

    return () => {
      destroyed = true;
      stopAnimation();

      if (resizeObserver) {
        resizeObserver.disconnect();
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }

      intersectionObserver?.disconnect();

      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeModel(modelRef.current);
        modelRef.current = null;
      }

      if (rendererRef.current) {
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      scene.clear();
    };
  }, [modelUrl]);

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full relative ${className}`}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin h-8 w-8 border-2 border-[#d4af37] border-t-transparent rounded-full" />
            <span className="text-[#d4af37] text-xs">Loading 3D...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <span className="text-red-400 text-xs text-center px-4">{error}</span>
        </div>
      )}
    </div>
  );
}
