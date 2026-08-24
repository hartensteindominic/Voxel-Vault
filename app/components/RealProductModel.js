'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createStudioTwin, disposeStudioTwin, kindForItem, TWIN_COLORS } from '../../lib/studioTwin';

const CAMERA_DISTANCE = 4.8;
const STAGE_FILL = 0.86;
const EPSILON = 0.0001;

function modelUrlFor(item) {
  return item?.modelUri || item?.digitalTwin?.modelUrl || '';
}

function disposeLoadedObject(object) {
  if (!object) return;
  object.traverse((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((material) => {
      material.map?.dispose?.();
      material.normalMap?.dispose?.();
      material.roughnessMap?.dispose?.();
      material.metalnessMap?.dispose?.();
      material.emissiveMap?.dispose?.();
      material.dispose?.();
    });
  });
}

function createUniformFrame(object) {
  const frame = new THREE.Group();
  frame.add(object);
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  const size = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.getSize(new THREE.Vector3());
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());

  frame.userData.uniformMetrics = {
    center,
    size,
    turnDiameter: Math.max(Math.hypot(size.x, size.z), EPSILON),
  };
  return frame;
}

function fitUniformFrame(frame, camera) {
  const metrics = frame?.userData?.uniformMetrics;
  if (!metrics) return;

  const verticalView = 2 * CAMERA_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const horizontalView = verticalView * Math.max(camera.aspect, EPSILON);
  const scale = Math.min(
    (horizontalView * STAGE_FILL) / metrics.turnDiameter,
    (verticalView * STAGE_FILL) / Math.max(metrics.size.y, EPSILON),
  );

  frame.scale.setScalar(scale);
  frame.position.set(
    -metrics.center.x * scale,
    -metrics.center.y * scale,
    -metrics.center.z * scale,
  );
  frame.userData.fittedHeight = metrics.size.y * scale;
  frame.userData.fittedDiameter = metrics.turnDiameter * scale;
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
    let activeFrame = null;
    let twinDisposed = false;
    let intersecting = true;
    let pageVisible = !document.hidden;
    let dragging = false;
    let pointerId = null;
    let lastX = 0;
    let lastY = 0;
    let targetX = -0.08;
    let targetY = 0.35;
    let environmentTarget = null;
    let pmrem = null;

    const mobile = window.matchMedia?.('(max-width: 700px)').matches || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !mobile,
        alpha: true,
        powerPreference: mobile ? 'low-power' : 'high-performance',
      });
    } catch {
      onUnavailableRef.current?.();
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.01, 100);
    camera.position.set(0, 0.08, CAMERA_DISTANCE);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = `position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:auto;z-index:5;touch-action:${mobile ? 'pan-x pan-y' : 'none'};cursor:${mobile ? 'default' : 'grab'}`;
    root.appendChild(renderer.domElement);

    if (!mobile) {
      pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environmentTarget = pmrem.fromScene(room, 0.04);
      room.dispose?.();
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.86;
    }

    scene.add(new THREE.HemisphereLight(0xf7f2e8, 0x17171b, mobile ? 0.72 : 0.58));
    const key = new THREE.DirectionalLight(0xfff7ec, mobile ? 1.85 : 2.2);
    key.position.set(3.2, 4.4, 3.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9aaabd, 0.52);
    fill.position.set(-2.8, 1.8, -2.4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xd6c9ff, mobile ? 0.34 : 0.48);
    rim.position.set(0.4, 2.6, -3.2);
    scene.add(rim);

    const turntable = new THREE.Group();
    scene.add(turntable);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 1;
    scene.add(shadow);

    const kind = kindForItem(item);
    const twin = createStudioTwin(kind, TWIN_COLORS[kind] || TWIN_COLORS.spiral);
    activeFrame = createUniformFrame(twin);
    turntable.add(activeFrame);
    onLoadedRef.current?.(true);

    const updateShadow = () => {
      const fittedHeight = activeFrame?.userData?.fittedHeight || 2;
      const fittedDiameter = activeFrame?.userData?.fittedDiameter || 1.6;
      shadow.position.set(0, -(fittedHeight / 2) - 0.13, 0);
      shadow.scale.set(
        Math.max(0.58, fittedDiameter * 0.48),
        Math.max(0.22, fittedDiameter * 0.18),
        1,
      );
    };

    const fitActiveFrame = () => {
      if (!activeFrame) return;
      fitUniformFrame(activeFrame, camera);
      updateShadow();
    };

    const replaceActiveFrame = (nextFrame) => {
      if (activeFrame) turntable.remove(activeFrame);
      activeFrame = nextFrame;
      turntable.add(activeFrame);
      fitActiveFrame();
    };

    const resize = () => {
      if (!alive) return;
      const width = Math.max(root.clientWidth, 1);
      const height = Math.max(root.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      fitActiveFrame();
    };

    const render = () => {
      if (!alive) return;
      if (intersecting && pageVisible) {
        if (!dragging && !reduceMotion) targetY += mobile ? 0.0038 : 0.0046;
        turntable.rotation.x += (targetX - turntable.rotation.x) * 0.14;
        turntable.rotation.y += (targetY - turntable.rotation.y) * 0.14;
        turntable.position.y = reduceMotion ? 0 : Math.sin(performance.now() / 1250) * 0.025;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(render);
    };

    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${item?.name || 'Product'} auto-rotating 3D product view. Drag with a mouse to turn it.`);

    const pointerDown = (event) => {
      if (mobile && event.pointerType === 'touch') return;
      dragging = true;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture?.(pointerId);
    };
    const pointerMove = (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      targetY += (event.clientX - lastX) * 0.011;
      targetX = THREE.MathUtils.clamp(
        targetX + (event.clientY - lastY) * 0.008,
        -0.38,
        0.28,
      );
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const pointerUp = (event) => {
      if (event.pointerId !== pointerId) return;
      dragging = false;
      canvas.style.cursor = mobile ? 'default' : 'grab';
      canvas.releasePointerCapture?.(pointerId);
      pointerId = null;
    };
    const resetView = () => {
      targetX = -0.08;
      targetY = 0.35;
    };
    const contextLost = (event) => {
      event.preventDefault();
      onUnavailableRef.current?.();
    };
    const visibilityChanged = () => {
      pageVisible = !document.hidden;
    };

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('dblclick', resetView);
    canvas.addEventListener('webglcontextlost', contextLost, false);
    document.addEventListener('visibilitychange', visibilityChanged);

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    resize();

    const io = new IntersectionObserver(
      ([entry]) => { intersecting = Boolean(entry?.isIntersecting); },
      { rootMargin: '100px', threshold: 0.02 },
    );
    io.observe(root);

    const modelUrl = modelUrlFor(item);
    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(modelUrl, (gltf) => {
        if (!alive) {
          disposeLoadedObject(gltf.scene);
          return;
        }
        glb = gltf.scene;
        const glbFrame = createUniformFrame(glb);
        replaceActiveFrame(glbFrame);
        if (!twinDisposed) {
          disposeStudioTwin(twin);
          twinDisposed = true;
        }
      }, undefined, () => {
        // Keep the immediate product-specific studio twin when a remote GLB is unavailable.
      });
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
      canvas.removeEventListener('dblclick', resetView);
      canvas.removeEventListener('webglcontextlost', contextLost, false);
      document.removeEventListener('visibilitychange', visibilityChanged);

      if (!twinDisposed) disposeStudioTwin(twin);
      if (glb) disposeLoadedObject(glb);
      shadow.geometry.dispose();
      shadow.material.dispose();
      environmentTarget?.dispose?.();
      pmrem?.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [item?.id, item?.modelUri, item?.digitalTwin?.modelUrl, item?.name, item?.type]);

  return <div ref={host} className="vv3-realModel" aria-live="polite" />;
}
