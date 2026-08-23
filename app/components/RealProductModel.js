'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function modelUrlFor(item) {
  return item?.modelUri || item?.digitalTwin?.modelUrl || '';
}

export default function RealProductModel({ item, onLoaded, onUnavailable }) {
  const host = useRef(null);
  const onLoadedRef = useRef(onLoaded);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => { onLoadedRef.current = onLoaded; }, [onLoaded]);
  useEffect(() => { onUnavailableRef.current = onUnavailable; }, [onUnavailable]);

  useEffect(() => {
    const root = host.current;
    const modelUrl = modelUrlFor(item);
    if (!root || !modelUrl) {
      onUnavailableRef.current?.();
      return undefined;
    }

    let alive = true;
    let renderer;
    let raf = 0;
    let model = null;
    let visible = true;
    let dragging = false;
    let pointerId = null;
    let lastX = 0;
    let lastY = 0;
    let targetX = -0.08;
    let targetY = -0.18;
    let distance = 5.2;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      onUnavailableRef.current?.();
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:auto;z-index:5;touch-action:none';
    root.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x11131c, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 4.2); key.position.set(4, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x7566ff, 2.2); rim.position.set(-4, 3, -4); scene.add(rim);

    const normalize = object => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      object.scale.setScalar(2.65 / (Math.max(size.x, size.y, size.z) || 1));
      object.position.y += 0.05;
    };

    const resize = () => {
      if (!alive) return;
      const width = Math.max(root.clientWidth, 1);
      const height = Math.max(root.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const render = () => {
      if (!alive) return;
      if (visible) {
        if (model) {
          model.rotation.x += (targetX - model.rotation.x) * 0.12;
          model.rotation.y += (targetY - model.rotation.y) * 0.12;
        }
        camera.position.set(0, 0.15, distance);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(render);
    };

    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${item?.name || 'Product'} interactive 3D collectible. Drag to rotate and scroll or pinch to zoom.`);
    const pointerDown = event => { dragging = true; pointerId = event.pointerId; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture?.(pointerId); };
    const pointerMove = event => {
      if (!dragging || event.pointerId !== pointerId) return;
      targetY += (event.clientX - lastX) * 0.012;
      targetX = THREE.MathUtils.clamp(targetX + (event.clientY - lastY) * 0.01, -Math.PI / 2, Math.PI / 2);
      lastX = event.clientX; lastY = event.clientY;
    };
    const pointerUp = event => { if (event.pointerId !== pointerId) return; dragging = false; canvas.releasePointerCapture?.(pointerId); pointerId = null; };
    const wheel = event => { event.preventDefault(); distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.004, 3.1, 7.0); };
    const reset = () => { targetX = -0.08; targetY = -0.18; distance = 5.2; };

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('dblclick', reset);

    const ro = new ResizeObserver(resize); ro.observe(root); resize();
    const io = new IntersectionObserver(entries => { visible = Boolean(entries[0]?.isIntersecting); }, { rootMargin: '120px' });
    io.observe(root);

    const loader = new GLTFLoader();
    loader.load(modelUrl, gltf => {
      if (!alive) return;
      model = gltf.scene;
      normalize(model);
      model.rotation.set(targetX, targetY, 0);
      scene.add(model);
      onLoadedRef.current?.(true);
    }, undefined, error => {
      console.warn('3D model failed to load; keeping product-media fallback.', error);
      onUnavailableRef.current?.();
    });

    render();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('dblclick', reset);
      if (model) {
        scene.remove(model);
        model.traverse(node => {
          node.geometry?.dispose?.();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.filter(Boolean).forEach(material => { material.map?.dispose?.(); material.dispose?.(); });
        });
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [item?.id, item?.modelUri, item?.digitalTwin?.modelUrl]);

  return <div ref={host} className="vv3-realModel" aria-live="polite" />;
}
