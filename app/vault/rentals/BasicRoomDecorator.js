'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const ROOM_X = 3.45;
const ROOM_Z = 2.45;
const STEP = 0.35;
const ROTATE_STEP = Math.PI / 4;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTransform(raw, index = 0) {
  const position = Array.isArray(raw?.position) ? raw.position : [];
  const rotation = Array.isArray(raw?.rotation) ? raw.rotation : [];
  const scale = Array.isArray(raw?.scale) ? raw.scale : [];
  const untouchedDefault = position.every((value) => number(value) === 0) && rotation.every((value) => number(value) === 0) && scale.every((value) => number(value, 1) === 1);
  const fallbackX = ((index % 3) - 1) * 1.15;
  const fallbackZ = (Math.floor(index / 3) % 3 - 1) * .85;
  const uniformScale = clamp(number(scale[0], 1), .3, 2.2);
  return {
    position: [
      clamp(untouchedDefault && index ? fallbackX : number(position[0]), -ROOM_X, ROOM_X),
      0,
      clamp(untouchedDefault && index ? fallbackZ : number(position[2]), -ROOM_Z, ROOM_Z),
    ],
    rotation: [0, number(rotation[1]), 0],
    scale: [uniformScale, uniformScale, uniformScale],
  };
}

function sameItems(a, b) {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id && item.modelUrl === b[index]?.modelUrl);
}

export default function BasicRoomDecorator({ items = [], editable = false, savingId = '', onSave }) {
  const mountRef = useRef(null);
  const rootsRef = useRef(new Map());
  const selectionRef = useRef(null);
  const [selectedId, setSelectedId] = useState(items[0]?.id || '');
  const [sceneError, setSceneError] = useState('');
  const [transforms, setTransforms] = useState(() => Object.fromEntries(items.map((item, index) => [item.id, normalizeTransform(item.placedTransform, index)])));
  const previousItems = useRef(items);

  useEffect(() => {
    if (!sameItems(previousItems.current, items)) {
      setTransforms(Object.fromEntries(items.map((item, index) => [item.id, normalizeTransform(item.placedTransform, index)])));
      setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || '');
      previousItems.current = items;
    }
  }, [items]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);
  const selectedTransform = selected ? transforms[selected.id] || normalizeTransform(selected.placedTransform) : null;

  useEffect(() => {
    if (!mountRef.current) return undefined;
    let dead = false;
    let frame = 0;
    let observer = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    const resources = [];
    const roots = new Map();
    rootsRef.current = roots;
    setSceneError('');

    Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
    ]).then(([THREE, loaderModule]) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      const width = Math.max(280, mount.clientWidth || 360);
      const height = Math.max(300, mount.clientHeight || 380);
      const compact = width < 720 || window.matchMedia?.('(pointer: coarse)')?.matches;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      } catch {
        setSceneError('3D room preview is unavailable in this browser.');
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.35));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = !compact;
      renderer.domElement.style.touchAction = 'none';
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf7efe5);
      scene.add(new THREE.HemisphereLight(0xfffbf1, 0x765f86, 2.5));
      const key = new THREE.DirectionalLight(0xffffff, 3.8);
      key.position.set(4, 8, 6);
      key.castShadow = !compact;
      scene.add(key);

      camera = new THREE.PerspectiveCamera(42, width / height, .1, 50);
      let orbit = .76;
      let distance = 9.2;
      const cameraTarget = new THREE.Vector3(0, .9, 0);
      const updateCamera = () => {
        camera.position.set(Math.sin(orbit) * distance, 5.1, Math.cos(orbit) * distance);
        camera.lookAt(cameraTarget);
      };
      updateCamera();

      const floorGeometry = new THREE.BoxGeometry(7.6, .12, 5.6);
      const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xeadac5, roughness: .92 });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.position.y = -.06;
      floor.receiveShadow = !compact;
      scene.add(floor);
      resources.push(floorGeometry, floorMaterial);

      const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xfffbf4, roughness: .98 });
      const backGeometry = new THREE.BoxGeometry(7.6, 3.4, .1);
      const back = new THREE.Mesh(backGeometry, wallMaterial);
      back.position.set(0, 1.7, -2.85);
      back.receiveShadow = !compact;
      scene.add(back);
      const sideGeometry = new THREE.BoxGeometry(.1, 3.4, 5.6);
      const side = new THREE.Mesh(sideGeometry, wallMaterial);
      side.position.set(-3.85, 1.7, 0);
      side.receiveShadow = !compact;
      scene.add(side);
      resources.push(wallMaterial, backGeometry, sideGeometry);

      const grid = new THREE.GridHelper(7.2, 12, 0xd0bca6, 0xe6d8c8);
      grid.position.y = .012;
      scene.add(grid);

      const selectionGeometry = new THREE.RingGeometry(.45, .53, 40);
      const selectionMaterial = new THREE.MeshBasicMaterial({ color: 0x7138f5, side: THREE.DoubleSide, transparent: true, opacity: .88 });
      const selection = new THREE.Mesh(selectionGeometry, selectionMaterial);
      selection.rotation.x = -Math.PI / 2;
      selection.position.y = .025;
      selection.visible = false;
      scene.add(selection);
      selectionRef.current = selection;
      resources.push(selectionGeometry, selectionMaterial);

      const loader = new loaderModule.GLTFLoader();
      items.forEach((item, index) => {
        const root = new THREE.Group();
        root.userData.attachmentId = item.id;
        roots.set(item.id, root);
        scene.add(root);

        const addPlaceholder = () => {
          const geometry = new THREE.BoxGeometry(.9, .9, .9);
          const material = new THREE.MeshStandardMaterial({ color: index % 2 ? 0xc9ff54 : 0xff9b5e, roughness: .7 });
          const box = new THREE.Mesh(geometry, material);
          box.position.y = .45;
          box.castShadow = !compact;
          box.userData.attachmentId = item.id;
          root.add(box);
          resources.push(geometry, material);
        };

        if (!item.modelUrl) {
          addPlaceholder();
          return;
        }

        loader.load(item.modelUrl, (gltf) => {
          if (dead) return;
          const model = gltf.scene;
          model.traverse((object) => {
            if (!object?.isMesh) return;
            object.userData.attachmentId = item.id;
            object.castShadow = !compact;
            object.receiveShadow = !compact;
          });
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const largest = Math.max(size.x, size.y, size.z, .001);
          const fit = 1.25 / largest;
          model.scale.setScalar(fit);
          const fittedBox = new THREE.Box3().setFromObject(model);
          model.position.y -= fittedBox.min.y;
          root.add(model);
        }, undefined, addPlaceholder);
      });

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let dragStart = null;
      let moved = false;
      const pointers = new Map();
      let pinchStart = 0;
      const pointerDistance = () => {
        const pair = [...pointers.values()].slice(0, 2);
        return pair.length === 2 ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0;
      };
      const down = (event) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        renderer.domElement.setPointerCapture?.(event.pointerId);
        moved = false;
        dragStart = { x: event.clientX, orbit };
        if (pointers.size === 2) pinchStart = pointerDistance();
      };
      const move = (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
          const next = pointerDistance();
          if (pinchStart) distance = clamp(distance - (next - pinchStart) * .012, 7, 12.5);
          pinchStart = next;
          updateCamera();
          moved = true;
          return;
        }
        if (!dragStart) return;
        const dx = event.clientX - dragStart.x;
        if (Math.abs(dx) > 3) moved = true;
        orbit = dragStart.orbit - dx * .008;
        updateCamera();
      };
      const up = (event) => {
        pointers.delete(event.pointerId);
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        if (pointers.size < 2) pinchStart = 0;
        if (!moved && camera && scene) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObjects([...roots.values()], true);
          const id = hits.map((hit) => {
            let object = hit.object;
            while (object && !object.userData?.attachmentId) object = object.parent;
            return object?.userData?.attachmentId || '';
          }).find(Boolean);
          if (id) setSelectedId(id);
        }
        dragStart = null;
      };
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);

      let visible = true;
      observer = typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); }, { rootMargin: '100px' })
        : null;
      observer?.observe(mount);
      const animate = () => {
        frame = requestAnimationFrame(animate);
        if (!visible || !renderer || !scene || !camera) return;
        renderer.render(scene, camera);
      };
      animate();

      const resize = () => {
        if (!mountRef.current || !renderer || !camera) return;
        const nextWidth = Math.max(280, mountRef.current.clientWidth || 360);
        const nextHeight = Math.max(300, mountRef.current.clientHeight || 380);
        renderer.setSize(nextWidth, nextHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', resize);

      return () => {
        window.removeEventListener('resize', resize);
        renderer?.domElement?.removeEventListener('pointerdown', down);
        renderer?.domElement?.removeEventListener('pointermove', move);
        renderer?.domElement?.removeEventListener('pointerup', up);
        renderer?.domElement?.removeEventListener('pointercancel', up);
      };
    }).catch(() => {
      if (!dead) setSceneError('The Basic Room could not start. Your saved layout is still safe.');
    });

    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      observer?.disconnect?.();
      rootsRef.current.clear();
      selectionRef.current = null;
      resources.forEach((resource) => resource?.dispose?.());
      renderer?.dispose?.();
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
  }, [items]);

  useEffect(() => {
    for (const item of items) {
      const root = rootsRef.current.get(item.id);
      const transform = transforms[item.id];
      if (!root || !transform) continue;
      root.position.set(transform.position[0], 0, transform.position[2]);
      root.rotation.set(0, transform.rotation[1], 0);
      root.scale.setScalar(transform.scale[0]);
    }
    const selection = selectionRef.current;
    const transform = selectedId ? transforms[selectedId] : null;
    if (selection && transform) {
      selection.position.set(transform.position[0], .025, transform.position[2]);
      selection.scale.setScalar(Math.max(.8, transform.scale[0]));
      selection.visible = true;
    } else if (selection) {
      selection.visible = false;
    }
  }, [items, transforms, selectedId]);

  function changeSelected(mutator) {
    if (!editable || !selectedId) return;
    setTransforms((current) => {
      const previous = current[selectedId] || normalizeTransform(null);
      const next = mutator(previous);
      return { ...current, [selectedId]: normalizeTransform(next) };
    });
  }

  function move(dx, dz) {
    changeSelected((current) => ({ ...current, position: [current.position[0] + dx, 0, current.position[2] + dz] }));
  }

  function rotate() {
    changeSelected((current) => ({ ...current, rotation: [0, current.rotation[1] + ROTATE_STEP, 0] }));
  }

  function resize(delta) {
    changeSelected((current) => {
      const size = clamp(current.scale[0] + delta, .3, 2.2);
      return { ...current, scale: [size, size, size] };
    });
  }

  function reset() {
    if (!selected) return;
    setTransforms((current) => ({ ...current, [selected.id]: normalizeTransform(selected.placedTransform) }));
  }

  return <section className="roomDecorator">
    <div className="roomHeading">
      <div><span>BASIC ROOM · DECORATION LAYER</span><h4>Arrange your place.</h4></div>
      <small>Not a verified floor plan.</small>
    </div>

    <div className="roomCanvasWrap">
      <div ref={mountRef} className="roomCanvas" aria-label="Interactive basic 3D room for tenant voxel decoration" />
      {!items.length ? <div className="roomEmpty"><b>Your room is ready.</b><span>Add a minted voxel to start decorating.</span></div> : null}
      {sceneError ? <div className="roomError">{sceneError}</div> : null}
      <div className="roomHint">DRAG TO TURN ROOM · PINCH TO ZOOM · TAP A VOXEL</div>
    </div>

    {items.length ? <>
      <div className="itemTabs" aria-label="Choose a room item">
        {items.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>{item.name || 'Voxel'}</button>)}
      </div>

      <div className="roomControls" aria-label="Move selected voxel">
        <button type="button" onClick={() => move(-STEP, 0)} disabled={!editable}>←<span>Left</span></button>
        <button type="button" onClick={() => move(0, -STEP)} disabled={!editable}>↑<span>Back</span></button>
        <button type="button" onClick={() => move(0, STEP)} disabled={!editable}>↓<span>Forward</span></button>
        <button type="button" onClick={() => move(STEP, 0)} disabled={!editable}>→<span>Right</span></button>
        <button type="button" onClick={rotate} disabled={!editable}>↻<span>Rotate</span></button>
        <button type="button" onClick={() => resize(-.15)} disabled={!editable}>−<span>Smaller</span></button>
        <button type="button" onClick={() => resize(.15)} disabled={!editable}>＋<span>Larger</span></button>
      </div>

      <div className="roomActions">
        <button type="button" className="roomReset" onClick={reset} disabled={!editable}>Reset</button>
        <button type="button" className="roomSave" onClick={() => selected && onSave?.(selected.id, selectedTransform)} disabled={!editable || !selected || savingId === selected?.id}>{savingId === selected?.id ? 'Saving…' : 'Save layout'}</button>
      </div>
      {!editable ? <p className="roomReadOnly">This tenant layer is read-only because the lease is not currently editable.</p> : null}
    </> : null}

    <style jsx>{`
      .roomDecorator{margin-top:16px;border-radius:24px;background:#f6f0ff;padding:12px;border:1px solid rgba(113,56,245,.12)}
      .roomHeading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:5px 5px 10px}.roomHeading span{font-size:8px;letter-spacing:.14em;font-weight:950;color:#7138f5}.roomHeading h4{margin:3px 0 0;font-size:18px;letter-spacing:-.03em}.roomHeading small{color:#826f7e;font-size:10px;font-weight:750}
      .roomCanvasWrap{position:relative;min-height:330px;border-radius:20px;overflow:hidden;background:#f7efe5}.roomCanvas{position:absolute;inset:0}.roomHint{position:absolute;left:8px;right:8px;bottom:8px;text-align:center;font-size:7px;letter-spacing:.08em;font-weight:900;color:#786a65;pointer-events:none}.roomEmpty,.roomError{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:24px;color:#725f76;pointer-events:none}.roomEmpty b{font-size:20px}.roomEmpty span{font-size:12px;margin-top:4px}.roomError{background:#fff8f2;color:#8c5d55;font-size:12px}
      .itemTabs{display:flex;gap:7px;overflow-x:auto;padding:10px 1px 3px;scrollbar-width:none}.itemTabs::-webkit-scrollbar{display:none}.itemTabs button{border:1px solid rgba(113,56,245,.15);background:white;border-radius:999px;padding:9px 12px;white-space:nowrap;color:#65515f;font-size:11px;font-weight:850}.itemTabs button.active{background:#7138f5;color:white;border-color:#7138f5}
      .roomControls{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px}.roomControls button{min-height:54px;border:0;border-radius:16px;background:white;color:#4c3947;font-size:20px;font-weight:950;box-shadow:inset 0 0 0 1px rgba(72,45,35,.08)}.roomControls span{display:block;font-size:8px;letter-spacing:.04em;margin-top:2px;color:#8b7886}.roomControls button:disabled{opacity:.45}
      .roomActions{display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:9px}.roomActions button{min-height:48px;border:0;border-radius:16px;font-weight:950}.roomReset{background:#ece5e1;color:#624f47}.roomSave{background:#7138f5;color:white}.roomActions button:disabled{opacity:.5}.roomReadOnly{margin:9px 2px 2px;font-size:10px;color:#87737f;text-align:center}
      @media(max-width:520px){.roomHeading{align-items:flex-start;flex-direction:column;gap:3px}.roomCanvasWrap{min-height:300px}.roomControls{grid-template-columns:repeat(4,1fr)}.roomControls button{min-height:58px}.roomActions{grid-template-columns:1fr 1.8fr}}
    `}</style>
  </section>;
}
