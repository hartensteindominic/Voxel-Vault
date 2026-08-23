'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  animateStudioTwin,
  createStudioTwin,
  disposeStudioTwin,
  getStudioEnvMap,
  kindForItem,
  TWIN_COLORS,
} from '../../lib/studioTwin';

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
    if (!root) return undefined;

    let alive = true;
    let renderer;
    let raf = 0;
    let glb = null;
    let visible = true;
    let dragging = false;
    let pointerId = null;
    let lastX = 0;
    let lastY = 0;
    let targetX = -0.08;
    let targetY = 0.35;
    let distance = 4.6;
    const mobile = window.matchMedia?.('(max-width: 700px)').matches || /iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    try {
      renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: mobile ? 'low-power' : 'high-performance' });
    } catch {
      onUnavailableRef.current?.();
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:auto;z-index:5;touch-action:none';
    root.appendChild(renderer.domElement);

    scene.environment = getStudioEnvMap();
    scene.environmentIntensity = 1.12;
    let pmremTex = null;
    let pmrem = null;
    if (!mobile && root.clientHeight > 380) {
      pmrem = new THREE.PMREMGenerator(renderer);
      pmremTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = pmremTex;
      scene.environmentIntensity = 1.05;
    }

    scene.add(new THREE.HemisphereLight(0xf7f1e6, 0x1a1816, mobile ? 0.72 : 0.62));
    const key = new THREE.DirectionalLight(0xfff6ea, mobile ? 1.85 : 2.15);
    key.position.set(3, 4, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9aabbd, 0.58);
    fill.position.set(-2.4, 1.4, -1.6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe9c8, 0.32);
    rim.position.set(0.2, 2.2, -3);
    scene.add(rim);

    const kind = kindForItem(item);
    const quality = mobile || root.clientHeight < 380 ? 'compact' : 'hero';
    const twin = createStudioTwin(kind, TWIN_COLORS[kind] || TWIN_COLORS.spiral, quality);
    scene.add(twin);
    onLoadedRef.current?.(true);

    const subject = () => glb || twin;

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
        const obj = subject();
        if (!dragging) targetY += 0.008;
        obj.rotation.x += (targetX - obj.rotation.x) * 0.16;
        obj.rotation.y += (targetY - obj.rotation.y) * 0.16;
        obj.position.y = Math.sin(performance.now() / 1100) * 0.04;
        if (twin.visible) animateStudioTwin(twin, performance.now() / 1000);
        camera.position.set(0, 0.18, distance);
        camera.lookAt(0, 0.05, 0);
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(render);
    };

    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${item?.name || 'Product'} 3D NFT. Drag to turn.`);
    const pointerDown = (event) => {
      dragging = true;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture?.(pointerId);
    };
    const pointerMove = (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      targetY += (event.clientX - lastX) * 0.012;
      targetX = THREE.MathUtils.clamp(targetX + (event.clientY - lastY) * 0.01, -Math.PI / 2.4, Math.PI / 2.4);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const pointerUp = (event) => {
      if (event.pointerId !== pointerId) return;
      dragging = false;
      canvas.releasePointerCapture?.(pointerId);
      pointerId = null;
    };

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    resize();
    const io = new IntersectionObserver((entries) => { visible = Boolean(entries[0]?.isIntersecting); }, { rootMargin: '80px' });
    io.observe(root);

    const modelUrl = modelUrlFor(item);
    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(modelUrl, (gltf) => {
        if (!alive) return;
        glb = gltf.scene;
        const box = new THREE.Box3().setFromObject(glb);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        glb.position.sub(center);
        glb.scale.setScalar(2.5 / (Math.max(size.x, size.y, size.z) || 1));
        twin.visible = false;
        scene.add(glb);
      }, undefined, () => {});
    }

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
      disposeStudioTwin(twin);
      if (glb) {
        scene.remove(glb);
        glb.traverse((node) => {
          node.geometry?.dispose?.();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.filter(Boolean).forEach((material) => { material.map?.dispose?.(); material.dispose?.(); });
        });
      }
      pmremTex?.dispose?.();
      pmrem?.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [item?.id, item?.modelUri, item?.digitalTwin?.modelUrl, item?.name, item?.type]);

  return <div ref={host} className="vv3-realModel" aria-live="polite" />;
}
