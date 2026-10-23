import { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildingConfig } from './buildingConfig';
import { disposeModel, inspectBuilding } from './modelGeometry';

export function useBuildingAsset(url) {
  const [state, setState] = useState({ data: null, progress: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let ownedScene;
    const timeout = setTimeout(() => controller.abort(), buildingConfig.loadTimeoutMs);
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Fail model tidak tersedia (HTTP ${response.status}).`);
        const total = Number(response.headers.get('content-length'));
        const reader = response.body.getReader();
        let received = 0;
        const chunks = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value); received += value.length;
          if (active) setState({ data: null, progress: total ? Math.min(99, received / total * 100) : null, error: null });
        }
        const bytes = new Uint8Array(received);
        let offset = 0;
        chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.length; });
        if (new DataView(bytes.buffer).getUint32(0, true) !== 0x46546c67) throw new Error('Fail yang diterima bukan GLB yang sah.');
        const gltf = await new GLTFLoader().parseAsync(bytes.buffer, new URL('.', new URL(url, window.location.href)).href);
        ownedScene = gltf.scene;
        if (!active) { disposeModel(ownedScene); return; }
        setState({ data: inspectBuilding(ownedScene), progress: 100, error: null });
      } catch (error) {
        if (active) setState({ data: null, progress: null, error: error.name === 'AbortError' ? 'Masa muat turun tamat. Sila cuba lagi.' : error.message });
      } finally { clearTimeout(timeout); }
    }
    load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); if (ownedScene) disposeModel(ownedScene); };
  }, [url]);
  return state;
}
