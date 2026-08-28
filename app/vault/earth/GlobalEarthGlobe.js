'use client';

import { useEffect, useRef } from 'react';

function toVector(THREE, latitude, longitude, radius) {
  const lat = Number(latitude) * Math.PI / 180;
  const lon = Number(longitude) * Math.PI / 180;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

export default function GlobalEarthGlobe({ listings = [], selectedId = '', onSelect, onLocation }) {
