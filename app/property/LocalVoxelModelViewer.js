'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_GRID = 40;
const MIN_SHORT_SIDE = 18;

function quantize(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0) / 16) * 16));
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function gridFor(image) {
  const sourceWidth = Math.max(1, image.naturalWidth || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || 1);
  const ratio = sourceWidth / sourceHeight;
  if (ratio >= 1) {
    return {
      width: MAX_GRID,
      height: Math.max(MIN_SHORT_SIDE, Math.min(MAX_GRID, Math.round(MAX_GRID / ratio))),
    };
  }
  return {
    width: Math.max(MIN_SHORT_SIDE, Math.min(MAX_GRID, Math.round(MAX_GRID * ratio))),
    height: MAX_GRID,
  };
}

function sampleRecipe(image) {
  const { width, height } = gridFor(image);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');

  context.filter = 'saturate(1.06) contrast(1.05)';
  context.drawImage(
    image,
    0,
    0,
    image.naturalWidth || 1,
    image.naturalHeight || 1,
    0,
    0,
    width,
    height,
  );

  const data = context.getImageData(0, 0, width, height).data;
  const luminance = [];
  const colors = [];
  const saturation = [];

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const red = quantize(data[offset]);
    const green = quantize(data[offset + 1]);
    const blue = quantize(data[offset + 2]);
    colors.push(`${toHex(red)}${toHex(green)}${toHex(blue)}`);
    luminance.push((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255);
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    saturation.push(max ? (max - min) / max : 0);
  }

  const depths = luminance.map((value, index) => {
    const row = Math.floor(index / width);
    const column = index % width;
    const left = luminance[row * width + Math.max(0, column - 1)] ?? value;
    const right = luminance[row * width + Math.min(width - 1, column + 1)] ?? value;
    const up = luminance[Math.max(0, row - 1) * width + column] ?? value;
    const down = luminance[Math.min(height - 1, row + 1) * width + column] ?? value;
    const edge = Math.min(1, (Math.abs(value - left) + Math.abs(value - right) + Math.abs(value - up) + Math.abs(value - down)) * 1.65);
    const detail = Math.min(1, edge * 0.78 + saturation[index] * 0.22);
    return Math.max(1, Math.min(9, Math.round(1.5 + detail * 6.2 + (1 - value) * 1.1)));
  });

  return { version: 1, width, height, colors, depths };
}

export default function LocalVoxelModelViewer({ imageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [readyRecipe, setReadyRecipe] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    if (!imageUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setReady(false);
    setReadyRecipe(null);
    setSubmitted(false);
    setError('');

    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl;

    image.onload = () => {
      let recipe;
      try {
        recipe = sampleRecipe(image);
      } catch (sampleError) {
        if (!dead) setError(String(sampleError?.message || sampleError || 'Local voxel sampling failed.'));
        return;
      }

      import('three').then((THREE) => {
        if (dead || !mountRef.current) return;
        const mount = mountRef.current;
        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        } catch {
          setError('Interactive 3D is unavailable here. The VoxelPop image remains visible.');
          return;
        }

        const initialWidth = Math.max(280, mount.clientWidth || 360);
        const initialHeight = Math.max(280, mount.clientHeight || 360);
        const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.45));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.04;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .42s ease';
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x180f25, 2.2));
        const key = new THREE.DirectionalLight(0xffedd5, 3.7);
        key.position.set(5, 7, 8);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xbca8ff, 1.7);
        rim.position.set(-5, 2, -3);
        scene.add(rim);

        const cell = 6.35 / Math.max(recipe.width, recipe.height);
        const modelWidth = recipe.width * cell;
        const modelHeight = recipe.height * cell;
        const modelExtent = Math.max(modelWidth, modelHeight);
        const camera = new THREE.PerspectiveCamera(35, initialWidth / initialHeight, 0.1, 80);
        let cameraDistance = modelExtent * (compact ? 1.72 : 1.58);
        const minDistance = modelExtent * 1.12;
        const maxDistance = modelExtent * 2.3;
        camera.position.set(0, 0.12, cameraDistance);
        camera.lookAt(0, 0, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.06;
        root.rotation.y = 0.14;
        scene.add(root);

        const geometry = new THREE.BoxGeometry(cell * 0.92, cell * 0.92, 1);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.01 });
        const mesh = new THREE.InstancedMesh(geometry, material, recipe.width * recipe.height);
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        for (let row = 0; row < recipe.height; row += 1) {
          for (let column = 0; column < recipe.width; column += 1) {
            const index = row * recipe.width + column;
            const depth = 0.07 + (recipe.depths[index] / 9) * 0.5;
            dummy.position.set(
              (column - (recipe.width - 1) / 2) * cell,
              ((recipe.height - 1) / 2 - row) * cell,
              depth / 2 - 0.23,
            );
            dummy.scale.set(1, 1, depth);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
            color.set(`#${recipe.colors[index]}`);
            mesh.setColorAt(index, color);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        root.add(mesh);

        const texture = new THREE.Texture(image);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        const facadeGeometry = new THREE.PlaneGeometry(modelWidth, modelHeight);
        const facadeMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.34, side: THREE.DoubleSide });
        const facade = new THREE.Mesh(facadeGeometry, facadeMaterial);
        facade.position.z = -0.27;
        root.add(facade);

        const frameGeometry = new THREE.BoxGeometry(modelWidth + cell * 0.46, modelHeight + cell * 0.46, 0.08);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x21172c, roughness: 0.93, metalness: 0 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = -0.34;
        root.add(frame);

        const shadowGeometry = new THREE.CircleGeometry(modelExtent * 0.59, 48);
        const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x120c18, transparent: true, opacity: 0.24 });
        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, -(modelHeight / 2 + 0.36), 0.48);
        scene.add(shadow);

        const pointers = new Map();
        let moved = false;
        let lastX = 0;
        let lastY = 0;
        let pinch = 0;
        let targetX = -0.06;
        let targetY = 0.14;

        const distance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
        };
        const updateCamera = () => {
          camera.position.set(0, 0.12, cameraDistance);
          camera.lookAt(0, 0, 0);
        };
        const down = (event) => {
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          renderer.domElement.setPointerCapture?.(event.pointerId);
          lastX = event.clientX;
          lastY = event.clientY;
          moved = false;
          if (pointers.size === 2) pinch = distance();
        };
        const move = (event) => {
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size >= 2) {
            const next = distance();
            if (pinch) cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance - (next - pinch) * 0.012));
            pinch = next;
            updateCamera();
            moved = true;
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
          targetY += dx * 0.007;
          targetX = Math.max(-0.48, Math.min(0.34, targetX + dy * 0.0036));
          lastX = event.clientX;
          lastY = event.clientY;
        };
        const up = (event) => {
          pointers.delete(event.pointerId);
          renderer.domElement.releasePointerCapture?.(event.pointerId);
          if (pointers.size < 2) pinch = 0;
        };
        const wheel = (event) => {
          event.preventDefault();
          cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance + Math.sign(event.deltaY) * 0.42));
          updateCamera();
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);
        renderer.domElement.addEventListener('wheel', wheel, { passive: false });

        let frameHandle = 0;
        let firstFrame = true;
        const animate = () => {
          frameHandle = requestAnimationFrame(animate);
          if (!reducedMotion && pointers.size === 0 && !moved) targetY += 0.00032;
          root.rotation.x += (targetX - root.rotation.x) * 0.075;
          root.rotation.y += (targetY - root.rotation.y) * 0.075;
          renderer.render(scene, camera);
          if (firstFrame) {
            firstFrame = false;
            renderer.domElement.style.opacity = '1';
            setReady(true);
            setReadyRecipe(recipe);
          }
        };
        animate();

        const resize = () => {
          if (!mountRef.current) return;
          const width = Math.max(280, mountRef.current.clientWidth || 360);
          const height = Math.max(280, mountRef.current.clientHeight || 360);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', resize);

        cleanup = () => {
          cancelAnimationFrame(frameHandle);
          window.removeEventListener('resize', resize);
          renderer.domElement.removeEventListener('pointerdown', down);
          renderer.domElement.removeEventListener('pointermove', move);
          renderer.domElement.removeEventListener('pointerup', up);
          renderer.domElement.removeEventListener('pointercancel', up);
          renderer.domElement.removeEventListener('wheel', wheel);
          geometry.dispose();
          material.dispose();
          facadeGeometry.dispose();
          facadeMaterial.dispose();
          frameGeometry.dispose();
          frameMaterial.dispose();
          shadowGeometry.dispose();
          shadowMaterial.dispose();
          texture.dispose();
          renderer.dispose();
          mount.innerHTML = '';
        };
      }).catch(() => {
        if (!dead) setError('Interactive 3D could not start. The VoxelPop image remains visible.');
      });
    };
    image.onerror = () => {
      if (!dead) setError('The VoxelPop image could not be opened for local 3D.');
    };

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl]);

  function continueFrom3D() {
    if (!readyRecipe || submitted || typeof callbackRef.current !== 'function') return;
    setSubmitted(true);
    callbackRef.current(readyRecipe);
  }

  return <div className="localViewerShell">
    {imageUrl ? <img className={`localPoster ${ready ? 'hidden' : ''}`} src={imageUrl} alt="VoxelPop rendered 3D image"/> : null}
    <div ref={mountRef} className="localCanvas" aria-label="Interactive on-device VoxelPop 3D model"/>
    {!ready && !error ? <div className="stage">3D IMAGE · BUILDING LOCAL 3D</div> : null}
    {error ? <div className="softError">{error}</div> : null}
    {ready && typeof onReady === 'function' ? <button className="continueButton" type="button" onClick={continueFrom3D} disabled={submitted}>{submitted ? 'OPENING MAP…' : 'LOOKS RIGHT → ADD ADDRESS'}</button> : null}
    <div className="hint">{ready ? 'DRAG · PINCH TO ZOOM · FRONT VIEW FOLLOWS YOUR PHOTO' : '3D IMAGE → INTERACTIVE 3D'}</div>
    <style jsx>{`
      .localViewerShell{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:radial-gradient(circle at 50% 32%,#3a2850,#18101f 64%)}
      .localPoster,.localCanvas{position:absolute;inset:0;width:100%;height:100%}.localPoster{z-index:1;object-fit:contain;background:#18101f;opacity:1;transition:opacity .42s ease;image-rendering:pixelated}.localPoster.hidden{opacity:0;pointer-events:none}.localCanvas{z-index:2}
      .stage{position:absolute;z-index:4;left:12px;top:12px;padding:8px 10px;border-radius:999px;background:rgba(28,18,35,.78);backdrop-filter:blur(10px);color:#f4edff;font-size:7px;font-weight:1000;letter-spacing:.12em}
      .softError{position:absolute;z-index:5;left:12px;right:12px;bottom:42px;padding:9px 11px;border-radius:13px;background:rgba(28,18,35,.84);color:#efe8f5;font-size:9px;line-height:1.45;backdrop-filter:blur(9px)}
      .continueButton{position:absolute;z-index:8;left:14px;right:14px;bottom:42px;min-height:48px;border:0;border-radius:16px;background:linear-gradient(180deg,#c9ff54,#aee63c);color:#22310d;font:1000 11px Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.05em;box-shadow:0 6px 0 #7fae28;cursor:pointer}.continueButton:active:not(:disabled){transform:translateY(2px)}.continueButton:disabled{opacity:.65;cursor:default}
      .hint{position:absolute;z-index:6;left:10px;right:10px;bottom:10px;color:#d8cedf;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.1em;pointer-events:none;text-shadow:0 1px 6px #000}
    `}</style>
  </div>;
}
