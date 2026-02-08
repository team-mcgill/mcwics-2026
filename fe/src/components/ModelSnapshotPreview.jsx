import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SNAPSHOT_SIZE = 320;
const SNAPSHOT_FRAME_PADDING = 1.35;
const SNAPSHOT_TARGET_RADIUS = 1.15;
const SNAPSHOT_YAW_RADIANS = 0.38;
const SNAPSHOT_BG_RGB = 17;

THREE.Cache.enabled = true;
const loader = new GLTFLoader();
const snapshotCache = new Map();
const pendingSnapshots = new Map();

function waitForTextureImage(texture) {
  const image = texture?.image;
  if (!image) return Promise.resolve();

  if (typeof image.decode === 'function') {
    return image.decode().catch(() => {});
  }

  if (typeof image.complete === 'boolean') {
    if (image.complete) return Promise.resolve();

    return new Promise((resolve) => {
      const done = () => {
        image.removeEventListener?.('load', done);
        image.removeEventListener?.('error', done);
        resolve();
      };

      image.addEventListener?.('load', done, { once: true });
      image.addEventListener?.('error', done, { once: true });
    });
  }

  return Promise.resolve();
}

async function waitForModelTextures(model) {
  const waits = [];

  model.traverse((child) => {
    if (!child.isMesh) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      waits.push(waitForTextureImage(material.map));
      waits.push(waitForTextureImage(material.emissiveMap));
      waits.push(waitForTextureImage(material.metalnessMap));
      waits.push(waitForTextureImage(material.roughnessMap));
      waits.push(waitForTextureImage(material.normalMap));
      waits.push(waitForTextureImage(material.alphaMap));
    });
  });

  if (!waits.length) return;
  await Promise.all(waits);
}

function waitNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function isLikelyBlankSnapshot(canvas) {
  const width = canvas?.width || 0;
  const height = canvas?.height || 0;
  if (!width || !height) return true;

  const probe = document.createElement('canvas');
  probe.width = width;
  probe.height = height;

  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(canvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height).data;
  let changed = 0;

  for (let y = 0; y < height; y += 20) {
    for (let x = 0; x < width; x += 20) {
      const idx = (y * width + x) * 4;
      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];
      const dist = Math.abs(r - SNAPSHOT_BG_RGB) + Math.abs(g - SNAPSHOT_BG_RGB) + Math.abs(b - SNAPSHOT_BG_RGB);
      if (dist > 16) {
        changed += 1;
      }
    }
  }

  return changed < 5;
}

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

  const normalizedSphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  const radius = Number(normalizedSphere?.radius);

  if (Number.isFinite(radius) && radius > 0) {
    const scale = SNAPSHOT_TARGET_RADIUS / radius;
    model.scale.multiplyScalar(scale);
  }

  const finalBox = new THREE.Box3().setFromObject(model);
  const finalCenter = finalBox.getCenter(new THREE.Vector3());
  model.position.sub(finalCenter);

  const finalSphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  const finalRadius = Math.max(0.001, Number(finalSphere.radius) || SNAPSHOT_TARGET_RADIUS);
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const distance = (finalRadius / Math.tan(halfFov)) * SNAPSHOT_FRAME_PADDING;

  camera.position.set(0, 0, distance);
  camera.near = Math.max(0.01, distance - finalRadius * 4);
  camera.far = distance + finalRadius * 4;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
}

function renderSnapshot(modelUrl) {
  if (snapshotCache.has(modelUrl)) {
    return Promise.resolve(snapshotCache.get(modelUrl));
  }

  const pending = pendingSnapshots.get(modelUrl);
  if (pending) return pending;

  const task = new Promise((resolve, reject) => {
    loader.load(
      modelUrl,
      async (gltf) => {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'low-power',
          preserveDrawingBuffer: true,
        });
        renderer.setSize(SNAPSHOT_SIZE, SNAPSHOT_SIZE, false);
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x111111, 1);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.62);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.82);
        directionalLight.position.set(4, 6, 5);
        scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xd4af37, 0.42);
        directionalLight2.position.set(-4, 3, -4);
        scene.add(directionalLight2);

        const model = gltf.scene;
        model.rotation.set(0, SNAPSHOT_YAW_RADIANS, 0);
        centerAndFrameModel(model, camera);
        scene.add(model);

        try {
          await waitForModelTextures(model);
          renderer.render(scene, camera);
          await waitNextFrame();
          renderer.render(scene, camera);

          if (isLikelyBlankSnapshot(renderer.domElement)) {
            throw new Error('Rendered snapshot was blank');
          }

          const dataUrl = renderer.domElement.toDataURL('image/png');
          snapshotCache.set(modelUrl, dataUrl);
          resolve(dataUrl);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to render snapshot'));
        } finally {
          scene.remove(model);
          disposeModel(model);
          scene.clear();
          renderer.dispose();
        }
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error('Failed to render snapshot'));
      }
    );
  })
    .finally(() => {
      pendingSnapshots.delete(modelUrl);
    });

  pendingSnapshots.set(modelUrl, task);
  return task;
}

export function ModelSnapshotPreview({ modelUrl, fallbackSrc = '', alt = '3D snapshot', className = '' }) {
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(modelUrl));
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!modelUrl) {
      setSnapshotUrl('');
      setIsLoading(false);
      setError('');
      return undefined;
    }

    setIsLoading(true);
    setError('');

    renderSnapshot(modelUrl)
      .then((dataUrl) => {
        if (cancelled) return;
        setSnapshotUrl(dataUrl);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to render preview');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  if (snapshotUrl) {
    return <img src={snapshotUrl} alt={alt} className={`w-full h-full object-cover ${className}`} />;
  }

  if (!isLoading && fallbackSrc) {
    return <img src={fallbackSrc} alt={alt} className={`w-full h-full object-cover ${className}`} />;
  }

  return (
    <div className={`w-full h-full flex items-center justify-center bg-[#0a0a0a] ${className}`}>
      {isLoading ? (
        <div className="animate-spin h-5 w-5 border-2 border-[#d4af37] border-t-transparent rounded-full" />
      ) : (
        <span className="text-red-400 text-[10px] px-2 text-center">{error || 'Preview unavailable'}</span>
      )}
    </div>
  );
}
