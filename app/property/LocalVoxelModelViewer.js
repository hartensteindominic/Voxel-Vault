'use client';

import { useEffect, useRef, useState } from 'react';
import { rasterizeImageUrl } from './rasterizeImageUrl';

const GRID = 32;
const MIN_GRID = 16;
const COLOR_STEP = 12;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function quantize(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0) / COLOR_STEP) * COLOR_STEP));
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rgbDistance(a, b) {
  const dr = Number(a?.[0] || 0) - Number(b?.[0] || 0);
  const dg = Number(a?.[1] || 0) - Number(b?.[1] || 0);
  const db = Number(a?.[2] || 0) - Number(b?.[2] || 0);
  return Math.hypot(dr, dg, db) / 441.673;
}

function averageRgb(pixels) {
  if (!pixels.length) return [128, 128, 128];
  const total = pixels.reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0]);
  return total.map((value) => value / pixels.length);
}

function recipeDimensions(sourceW, sourceH) {
  const width = Math.max(1, sourceW || 1);
  const height = Math.max(1, sourceH || 1);
  const ratio = clamp(width / height, 0.5, 2.25);
  if (ratio >= 1) return { width: GRID, height: Math.max(MIN_GRID, Math.round(GRID / ratio)) };
  return { width: Math.max(MIN_GRID, Math.round(GRID * ratio)), height: GRID };
}

function centeredMass(rawMask, width, height) {
  const mask = new Array(width * height).fill(false);
  const centerColumn = (width - 1) / 2;
  for (let row = 0; row < height; row += 1) {
    const candidates = [];
    for (let column = 0; column < width; column += 1) {
      if (rawMask[row * width + column]) candidates.push(column);
    }
    if (!candidates.length) continue;
    let nearest = candidates[0];
    for (const candidate of candidates) {
      if (Math.abs(candidate - centerColumn) < Math.abs(nearest - centerColumn)) nearest = candidate;
    }
    let left = nearest;
    let right = nearest;
    while (left > 0 && (rawMask[row * width + (left - 1)] || rawMask[row * width + Math.max(0, left - 2)])) left -= 1;
    while (right < width - 1 && (rawMask[row * width + (right + 1)] || rawMask[row * width + Math.min(width - 1, right + 2)])) right += 1;
    for (let column = left; column <= right; column += 1) {
      if (rawMask[row * width + column] || (column > left && column < right)) mask[row * width + column] = true;
    }
  }
  return mask;
}

function stabilizeMask(input, width, height) {
  let mask = input.slice();
  for (let pass = 0; pass < 2; pass += 1) {
    const next = mask.slice();
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const index = row * width + column;
        if (mask[index]) continue;
        let neighbors = 0;
        for (let y = Math.max(0, row - 1); y <= Math.min(height - 1, row + 1); y += 1) {
          for (let x = Math.max(0, column - 1); x <= Math.min(width - 1, column + 1); x += 1) {
            if (x === column && y === row) continue;
            if (mask[y * width + x]) neighbors += 1;
          }
        }
        if (neighbors >= 4) next[index] = true;
      }
    }
    mask = next;
  }
  return mask;
}

function keepBestComponent(input, width, height) {
  const visited = new Array(width * height).fill(false);
  let best = [];
  let bestScore = -Infinity;
  const directions = [-1, 0, 1];

  for (let start = 0; start < input.length; start += 1) {
    if (!input[start] || visited[start]) continue;
    const queue = [start];
    const cells = [];
    visited[start] = true;
    let cursor = 0;
    while (cursor < queue.length) {
      const index = queue[cursor];
      cursor += 1;
      cells.push(index);
      const row = Math.floor(index / width);
      const column = index % width;
      for (const dy of directions) {
        for (const dx of directions) {
          if (dx === 0 && dy === 0) continue;
          const x = column + dx;
          const y = row + dy;
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const next = y * width + x;
          if (input[next] && !visited[next]) {
            visited[next] = true;
            queue.push(next);
          }
        }
      }
    }

    let xTotal = 0;
    let yTotal = 0;
    for (const index of cells) {
      xTotal += index % width;
      yTotal += Math.floor(index / width);
    }
    const cx = cells.length ? xTotal / cells.length / Math.max(1, width - 1) : 0.5;
    const cy = cells.length ? yTotal / cells.length / Math.max(1, height - 1) : 0.55;
    const centerBias = 1 - Math.min(1, Math.abs(cx - 0.5) / 0.5);
    const verticalBias = 1 - Math.min(1, Math.abs(cy - 0.57) / 0.57);
    const score = cells.length * (0.68 + centerBias * 0.24 + verticalBias * 0.08);
    if (score > bestScore) {
      bestScore = score;
      best = cells;
    }
  }

  const result = new Array(width * height).fill(false);
  for (const index of best) result[index] = true;
  return result;
}

function fillSmallGaps(input, width, height) {
  const mask = input.slice();
  for (let row = 0; row < height; row += 1) {
    let left = -1;
    for (let column = 0; column < width; column += 1) {
      const active = input[row * width + column];
      if (!active) continue;
      if (left >= 0) {
        const gap = column - left - 1;
        if (gap > 0 && gap <= 2) {
          for (let fill = left + 1; fill < column; fill += 1) mask[row * width + fill] = true;
        }
      }
      left = column;
    }
  }
  return mask;
}

function sampleRecipeFromRaster(rasterCanvas, sourceW, sourceH) {
  const { width, height } = recipeDimensions(sourceW, sourceH);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local voxel sampling is unavailable in this browser.');

  context.filter = 'saturate(1.035) contrast(1.035)';
  context.drawImage(rasterCanvas, 0, 0, sourceW, sourceH, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const rgb = [];
  const luminance = [];
  const colors = [];

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const red = quantize(data[offset]);
    const green = quantize(data[offset + 1]);
    const blue = quantize(data[offset + 2]);
    rgb.push([red, green, blue]);
    colors.push(`${toHex(red)}${toHex(green)}${toHex(blue)}`);
    luminance.push((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255);
  }

  const skySamples = [];
  const groundSamples = [];
  const topRows = Math.max(2, Math.round(height * 0.15));
  const bottomRows = Math.max(2, Math.round(height * 0.13));
  for (let row = 0; row < topRows; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (row < 2 || column < 2 || column > width - 3) skySamples.push(rgb[row * width + column]);
    }
  }
  for (let row = height - bottomRows; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (row > height - 3 || column < 3 || column > width - 4) groundSamples.push(rgb[row * width + column]);
    }
  }
  const sky = averageRgb(skySamples);
  const ground = averageRgb(groundSamples);

  const edgeStrength = luminance.map((value, index) => {
    const row = Math.floor(index / width);
    const column = index % width;
    const left = luminance[row * width + Math.max(0, column - 1)] ?? value;
    const right = luminance[row * width + Math.min(width - 1, column + 1)] ?? value;
    const up = luminance[Math.max(0, row - 1) * width + column] ?? value;
    const down = luminance[Math.min(height - 1, row + 1) * width + column] ?? value;
    return clamp(Math.abs(left - right) * 1.55 + Math.abs(up - down) * 1.55);
  });

  const rawMask = new Array(width * height).fill(false);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      const x = width > 1 ? column / (width - 1) : 0.5;
      const y = height > 1 ? row / (height - 1) : 0.5;
      const center = 1 - Math.min(1, Math.abs(x - 0.5) / 0.5);
      const skyDistance = rgbDistance(rgb[index], sky);
      const groundDistance = rgbDistance(rgb[index], ground);
      const edge = edgeStrength[index];
      const outsideSide = x < 0.025 || x > 0.975;
      const obviousSky = y < 0.48 && skyDistance < 0.09 && edge < 0.12;
      const obviousGround = y > 0.80 && groundDistance < 0.08 && edge < 0.11;
      const structuralEvidence = skyDistance * 0.46 + groundDistance * 0.10 + edge * 0.32 + center * 0.12;
      const centralFacade = y > 0.18 && y < 0.91 && center > 0.12 && (skyDistance > 0.06 || edge > 0.065);
      rawMask[index] = !outsideSide && !obviousSky && !obviousGround && y > 0.035 && y < 0.97
        && (structuralEvidence > 0.20 || centralFacade);
    }
  }

  let mask = fillSmallGaps(keepBestComponent(stabilizeMask(rawMask, width, height), width, height), width, height);
  let activeCount = mask.filter(Boolean).length;

  if (activeCount < width * height * 0.10) {
    const relaxed = new Array(width * height).fill(false);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const index = row * width + column;
        const x = width > 1 ? column / (width - 1) : 0.5;
        const y = height > 1 ? row / (height - 1) : 0.5;
        const center = 1 - Math.min(1, Math.abs(x - 0.5) / 0.5);
        const skyDistance = rgbDistance(rgb[index], sky);
        const groundDistance = rgbDistance(rgb[index], ground);
        const edge = edgeStrength[index];
        relaxed[index] = x > 0.035 && x < 0.965 && y > 0.06 && y < 0.95 && center > 0.05
          && (skyDistance > 0.06 || groundDistance > 0.08 || edge > 0.07);
      }
    }
    mask = fillSmallGaps(keepBestComponent(stabilizeMask(relaxed, width, height), width, height), width, height);
    activeCount = mask.filter(Boolean).length;
  }

  if (activeCount < Math.max(18, Math.round(width * height * 0.055))) {
    mask = centeredMass(rawMask, width, height);
    activeCount = mask.filter(Boolean).length;
  }

  if (activeCount < Math.max(18, Math.round(width * height * 0.055))) {
    throw new Error('VoxelPop could not isolate enough of the uploaded building to make a trustworthy voxel. Try a clearer front or three-quarter photo.');
  }

  const smoothLuminance = luminance.map((value, index) => {
    const row = Math.floor(index / width);
    const column = index % width;
    let total = 0;
    let count = 0;
    for (let y = Math.max(0, row - 1); y <= Math.min(height - 1, row + 1); y += 1) {
      for (let x = Math.max(0, column - 1); x <= Math.min(width - 1, column + 1); x += 1) {
        total += luminance[y * width + x];
        count += 1;
      }
    }
    return count ? total / count : value;
  });

  const depths = luminance.map((value, index) => {
    if (!mask[index]) return 0;
    const edge = edgeStrength[index];
    const facadeRelief = Math.round(5 + (smoothLuminance[index] - 0.5) * 1.3 + Math.min(0.9, edge) * 1.6);
    return Math.max(4, Math.min(8, facadeRelief));
  });

  return { version: 1, width, height, colors, depths };
}

export default function LocalVoxelModelViewer({ imageUrl, sourceImageUrl, onReady }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onReady);
  const reportedRef = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    const sampleUrl = sourceImageUrl || imageUrl;
    if (!sampleUrl || !mountRef.current) return undefined;
    let dead = false;
    let cleanup = () => {};
    setReady(false);
    setError('');
    reportedRef.current = '';

    (async () => {
      let recipe;
      try {
        const { canvas: rasterCanvas, width: rasterW, height: rasterH } = await rasterizeImageUrl(sampleUrl);
        recipe = sampleRecipeFromRaster(rasterCanvas, rasterW, rasterH);
      } catch (sampleError) {
        if (!dead) setError(String(sampleError?.message || sampleError || 'Local voxel sampling failed.'));
        return;
      }

      let THREE;
      try {
        THREE = await import('three');
      } catch {
        if (!dead) setError('Interactive voxel 3D could not start. Your approved house photo remains visible.');
        return;
      }
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        if (!dead) setError('Interactive 3D is unavailable here. Your approved house photo remains visible.');
        return;
      }

      try {
        const initialWidth = Math.max(280, mount.clientWidth || 360);
        const initialHeight = Math.max(280, mount.clientHeight || 360);
        const compact = initialWidth < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.18 : 1.5));
        renderer.setSize(initialWidth, initialHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.04;
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity .34s ease';
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('aria-label', 'Interactive movable 3D voxel model. Drag to rotate the stacked cube volume and pinch to zoom.');
        mount.innerHTML = '';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfffbef, 0x21122d, 2.55));
        const key = new THREE.DirectionalLight(0xfff7ec, 3.25);
        key.position.set(5, 8, 7);
        key.castShadow = true;
        key.shadow.mapSize.set(compact ? 512 : 1024, compact ? 512 : 1024);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xd6c9ff, 1.15);
        fill.position.set(-4, 3, 5);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xc9ff54, 0.68);
        rim.position.set(-5, 3, -4);
        scene.add(rim);

        const longestSide = Math.max(recipe.width, recipe.height);
        const cell = (compact ? 6.05 : 6.5) / longestSide;
        const cubeSize = cell * 0.89;
        const facadeWidth = recipe.width * cell;
        const facadeHeight = recipe.height * cell;
        const maxDepth = Math.max(1, ...recipe.depths);
        const volumeDepth = maxDepth * cubeSize;
        const maxDimension = Math.max(facadeWidth, facadeHeight, volumeDepth * 1.35);
        const camera = new THREE.PerspectiveCamera(32, initialWidth / initialHeight, 0.1, 80);
        let cameraDistance = clamp(maxDimension * 1.65 + 1.7, 7.2, 13.8);
        camera.position.set(0, 0.08, cameraDistance);
        camera.lookAt(0, -0.08, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.055;
        root.rotation.y = 0.12;
        scene.add(root);

        const totalVoxels = recipe.depths.reduce((count, depth) => count + Math.max(0, Math.trunc(depth)), 0);
        const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, totalVoxels));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const backZ = -volumeDepth / 2;
        let instance = 0;

        for (let row = 0; row < recipe.height; row += 1) {
          for (let column = 0; column < recipe.width; column += 1) {
            const index = row * recipe.width + column;
            const depth = Math.max(0, Math.trunc(recipe.depths[index] || 0));
            if (!depth) continue;
            const x = (column - (recipe.width - 1) / 2) * cell;
            const y = ((recipe.height - 1) / 2 - row) * cell - 0.12;

            for (let layer = 0; layer < depth; layer += 1) {
              dummy.position.set(x, y, backZ + cubeSize * (layer + 0.5));
              dummy.rotation.set(0, 0, 0);
              dummy.scale.set(1, 1, 1);
              dummy.updateMatrix();
              mesh.setMatrixAt(instance, dummy.matrix);

              const layerShade = 0.66 + 0.34 * ((layer + 1) / depth);
              color.set(`#${recipe.colors[index]}`).multiplyScalar(layerShade);
              mesh.setColorAt(instance, color);
              instance += 1;
            }
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        root.add(mesh);

        const platformGeometry = new THREE.BoxGeometry(Math.max(3.1, facadeWidth + 0.8), 0.18, Math.max(2.5, volumeDepth + 0.85));
        const platformMaterial = new THREE.MeshStandardMaterial({ color: 0xeee7dd, roughness: 0.96, metalness: 0 });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.position.set(0, -facadeHeight / 2 - 0.29, -0.05);
        platform.castShadow = true;
        platform.receiveShadow = true;
        scene.add(platform);

        const edgeGeometry = new THREE.EdgesGeometry(platformGeometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xc9ff54, transparent: true, opacity: 0.82 });
        const platformEdge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        platformEdge.position.copy(platform.position);
        scene.add(platformEdge);

        const floorGeometry = new THREE.PlaneGeometry(15, 11);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x21162d, roughness: 1, transparent: true, opacity: 0.72 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, -facadeHeight / 2 - 0.40, -1.15);
        floor.receiveShadow = true;
        scene.add(floor);

        const pointers = new Map();
        let lastX = 0;
        let lastY = 0;
        let pinch = 0;
        let targetX = -0.055;
        let targetY = 0.12;

        const distance = () => {
          const pair = [...pointers.values()].slice(0, 2);
          return pair.length === 2 ? pointerDistance(pair[0], pair[1]) : 0;
        };
        const updateCamera = () => {
          camera.position.set(0, 0.08, cameraDistance);
          camera.lookAt(0, -0.08, 0);
        };
        const resetView = () => {
          targetX = -0.055;
          targetY = 0.12;
          cameraDistance = clamp(maxDimension * 1.65 + 1.7, 7.2, 13.8);
          updateCamera();
        };
        const down = (event) => {
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          renderer.domElement.setPointerCapture?.(event.pointerId);
          lastX = event.clientX;
          lastY = event.clientY;
          if (pointers.size === 2) pinch = distance();
        };
        const move = (event) => {
          if (!pointers.has(event.pointerId)) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size >= 2) {
            const next = distance();
            if (pinch) cameraDistance = clamp(cameraDistance - (next - pinch) * 0.011, 5.5, 15.5);
            pinch = next;
            updateCamera();
            return;
          }
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          targetY += dx * 0.008;
          targetX = clamp(targetX + dy * 0.0038, -0.42, 0.30);
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
          cameraDistance = clamp(cameraDistance + Math.sign(event.deltaY) * 0.42, 5.5, 15.5);
          updateCamera();
        };
        const keydown = (event) => {
          let handled = true;
          if (event.key === 'ArrowLeft') targetY -= 0.12;
          else if (event.key === 'ArrowRight') targetY += 0.12;
          else if (event.key === 'ArrowUp') targetX = clamp(targetX - 0.06, -0.42, 0.30);
          else if (event.key === 'ArrowDown') targetX = clamp(targetX + 0.06, -0.42, 0.30);
          else if (event.key === 'Home' || event.key === '0') resetView();
          else handled = false;
          if (handled) event.preventDefault();
        };
        renderer.domElement.addEventListener('pointerdown', down);
        renderer.domElement.addEventListener('pointermove', move);
        renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('pointercancel', up);
        renderer.domElement.addEventListener('wheel', wheel, { passive: false });
        renderer.domElement.addEventListener('keydown', keydown);
        renderer.domElement.addEventListener('dblclick', resetView);

        let frame = 0;
        let firstFrame = true;
        const animate = () => {
          frame = requestAnimationFrame(animate);
          if (!reducedMotion) {
            root.rotation.x += (targetX - root.rotation.x) * 0.09;
            root.rotation.y += (targetY - root.rotation.y) * 0.09;
          } else {
            root.rotation.x = targetX;
            root.rotation.y = targetY;
          }
          renderer.render(scene, camera);
          if (firstFrame) {
            firstFrame = false;
            renderer.domElement.style.opacity = '1';
            setReady(true);
            const signature = `${recipe.width}x${recipe.height}:${recipe.colors.slice(0, 6).join('')}:${totalVoxels}`;
            if (reportedRef.current !== signature) {
              reportedRef.current = signature;
              callbackRef.current?.(recipe);
            }
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
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        observer?.observe(mount);

        cleanup = () => {
          cancelAnimationFrame(frame);
          observer?.disconnect();
          renderer.domElement.removeEventListener('pointerdown', down);
          renderer.domElement.removeEventListener('pointermove', move);
          renderer.domElement.removeEventListener('pointerup', up);
          renderer.domElement.removeEventListener('pointercancel', up);
          renderer.domElement.removeEventListener('wheel', wheel);
          renderer.domElement.removeEventListener('keydown', keydown);
          renderer.domElement.removeEventListener('dblclick', resetView);
          geometry.dispose();
          material.dispose();
          platformGeometry.dispose();
          platformMaterial.dispose();
          edgeGeometry.dispose();
          edgeMaterial.dispose();
          floorGeometry.dispose();
          floorMaterial.dispose();
          renderer.dispose();
          renderer.forceContextLoss?.();
          mount.innerHTML = '';
        };
      } catch (sceneError) {
        if (!dead) setError(String(sceneError?.message || sceneError || 'Interactive voxel 3D could not start. Your approved house photo remains visible.'));
      }
    })();

    return () => {
      dead = true;
      cleanup();
    };
  }, [imageUrl, sourceImageUrl]);

  const posterUrl = sourceImageUrl || imageUrl;
  return <div className="viewerShell">
    {posterUrl ? <img className={`viewerPoster ${ready ? 'hidden' : ''}`} src={posterUrl} alt="Approved property photo"/> : null}
    <div className="viewerGlow" aria-hidden="true"/>
    <div ref={mountRef} className="viewerCanvas" aria-label="Interactive property voxel model"/>
    {!ready && !error ? <div className="viewerStage">APPROVED HOUSE → STACKING REAL VOXEL CUBES</div> : null}
    {ready ? <div className="viewerQuality">STACKED CUBE VOLUME · 32-CELL SOURCE GRID</div> : null}
    {error ? <div className="viewerError">{error}</div> : null}
    <div className="viewerHint">{ready ? '3D VOXEL · DRAG BUILDING · PINCH TO ZOOM · ROTATE VOXEL' : 'THE APPROVED HOUSE PHOTO STAYS VISIBLE WHILE VOXELS BUILD'}</div>
    <style jsx>{`
      .viewerShell{position:relative;width:100%;height:100%;min-height:280px;overflow:hidden;background:radial-gradient(circle at 50% 28%,#4a3560 0,#2a1b38 40%,#17101f 78%)}
      .viewerGlow{position:absolute;z-index:0;inset:10% 14% 20%;border-radius:50%;background:radial-gradient(circle,rgba(201,255,84,.12),rgba(113,56,245,.08) 45%,transparent 72%);filter:blur(22px)}
      .viewerCanvas,.viewerPoster{position:absolute;inset:0;width:100%;height:100%}.viewerCanvas{z-index:2}.viewerPoster{z-index:1;object-fit:contain;background:#18101f;transition:opacity .34s ease}.viewerPoster.hidden{opacity:0;pointer-events:none}
      .viewerStage,.viewerQuality{position:absolute;z-index:4;top:12px;padding:8px 10px;border-radius:999px;background:rgba(28,18,35,.78);color:#f4edff;font-size:7px;font-weight:1000;letter-spacing:.105em;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.08)}
      .viewerStage{left:12px}.viewerQuality{right:12px;color:#e9ffc1;border-color:rgba(201,255,84,.22)}
      .viewerError{position:absolute;z-index:5;left:12px;right:12px;bottom:38px;padding:9px 11px;border-radius:13px;background:rgba(28,18,35,.86);color:#efe8f5;font-size:9px;line-height:1.45;backdrop-filter:blur(9px)}
      .viewerHint{position:absolute;z-index:6;left:10px;right:10px;bottom:10px;color:#eee6f5;text-align:center;font-size:6.5px;font-weight:1000;letter-spacing:.105em;pointer-events:none;text-shadow:0 1px 7px #000}
    `}</style>
  </div>;
}
