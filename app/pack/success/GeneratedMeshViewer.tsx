'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import styles from './success.module.css';

export default function GeneratedMeshViewer({url,label}:{url:string;label:string}){
  const host=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');

  useEffect(()=>{
    const root=host.current;
    if(!root||!url) return;

    let disposed=false;
    let frame=0;
    const scene=new THREE.Scene();
    scene.background=new THREE.Color('#09090d');
    const camera=new THREE.PerspectiveCamera(34,1,.01,1000);
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.08;
    renderer.shadowMap.enabled=true;
    renderer.domElement.setAttribute('aria-label',`Movable 3D preview of ${label}`);
    root.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#f3f0ff','#14121b',2.25));
    const key=new THREE.DirectionalLight('#ffffff',3.4);
    key.position.set(5,8,6);
    key.castShadow=true;
    scene.add(key);
    const rim=new THREE.DirectionalLight('#8c63ff',2.2);
    rim.position.set(-6,4,-5);
    scene.add(rim);

    const floor=new THREE.Mesh(
      new THREE.CircleGeometry(4.5,48),
      new THREE.MeshStandardMaterial({color:'#111117',roughness:.92,metalness:.05}),
    );
    floor.rotation.x=-Math.PI/2;
    floor.receiveShadow=true;
    scene.add(floor);

    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;
    controls.dampingFactor=.06;
    controls.enablePan=false;
    controls.autoRotate=true;
    controls.autoRotateSpeed=.75;
    controls.minDistance=.5;
    controls.maxDistance=30;

    const resize=()=>{
      const width=Math.max(1,root.clientWidth);
      const height=Math.max(280,root.clientHeight);
      renderer.setSize(width,height,false);
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer=new ResizeObserver(resize);
    observer.observe(root);

    const loader=new GLTFLoader();
    loader.load(url,gltf=>{
      if(disposed) return;
      const model=gltf.scene;
      model.traverse(object=>{
        const mesh=object as THREE.Mesh;
        if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}
      });
      const box=new THREE.Box3().setFromObject(model);
      const center=box.getCenter(new THREE.Vector3());
      const size=box.getSize(new THREE.Vector3());
      const height=Math.max(size.y,.001);
      model.position.x-=center.x;
      model.position.y-=box.min.y;
      model.position.z-=center.z;
      scene.add(model);
      const dimension=Math.max(size.x,size.y,size.z,.5);
      camera.position.set(dimension*1.25,height*.72,dimension*1.55);
      controls.target.set(0,height*.48,0);
      controls.minDistance=Math.max(dimension*.7,.35);
      controls.maxDistance=Math.max(dimension*8,5);
      controls.update();
      setError('');
    },undefined,loadError=>{
      console.error('generated mesh viewer failed',loadError);
      if(!disposed) setError('3D preview could not load. The GLB download is still available.');
    });

    const animate=()=>{
      if(disposed) return;
      frame=requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene,camera);
    };
    animate();

    return()=>{
      disposed=true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse(object=>{
        const mesh=object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        materials.filter(Boolean).forEach(material=>{
          const standard=material as THREE.MeshStandardMaterial;
          standard.map?.dispose?.();
          standard.normalMap?.dispose?.();
          standard.roughnessMap?.dispose?.();
          standard.metalnessMap?.dispose?.();
          standard.dispose?.();
        });
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  },[url,label]);

  return <div className={styles.meshViewer}>
    <div className={styles.meshCanvas} ref={host}/>
    <span>DRAG TO MOVE · SCROLL TO ZOOM</span>
    {error&&<p>{error}</p>}
  </div>;
}
