import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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

    const container = containerRef.current;
    // Use fixed dimensions based on container or fallback
    const width = 300;
    const height = 300;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xd4af37, 0.5);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    // Load model
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        
        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        model.scale.setScalar(scale);
        
        model.position.sub(center.multiplyScalar(scale));
        model.position.y += 0.2;
        
        scene.add(model);
        modelRef.current = model;
        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.error('ModelPreview: failed to load model:', err);
        setError(err?.message || 'Failed to load model');
        setIsLoading(false);
      }
    );

    // Animation loop
    let isActive = true;
    const animate = () => {
      if (!isActive) return;
      frameRef.current = requestAnimationFrame(animate);
      
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.01;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      isActive = false;
      cancelAnimationFrame(frameRef.current);
      
      if (rendererRef.current) {
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }
    };
  }, [modelUrl]);

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full relative ${className}`}
      style={{ minHeight: '200px' }}
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
