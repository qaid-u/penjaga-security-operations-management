import { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildingConfig } from './buildingConfig';
import { disposeModel, inspectBuilding } from './modelGeometry';
import { acquireBuildingBytes } from './buildingAssetCache';
import { getBuilding } from './buildingModels';

export function useBuildingAsset(url, building = getBuilding()) {
  const [state, setState] = useState({ data: null, progress: null, error: null });
  useEffect(() => {
    let active = true;
    let ownedScene;
    const request=acquireBuildingBytes(url,{timeoutMs:buildingConfig.loadTimeoutMs,onProgress:(progress)=>{if(active)setState({data:null,progress,error:null});}});
    async function load() {
      try {
        const bytes=await request.promise;
        if(!active)return;
        const gltf = await new GLTFLoader().parseAsync(bytes, new URL('.', new URL(url, window.location.href)).href);
        ownedScene = gltf.scene;
        if (!active) { disposeModel(ownedScene); return; }
        setState({ data: inspectBuilding(ownedScene, building), progress: 100, error: null });
      } catch (error) {
        if (active) setState({ data: null, progress: null, error: error.name === 'AbortError' ? 'Masa muat turun tamat. Sila cuba lagi.' : error.message });
      }
    }
    load();
    return () => { active = false; request.release(); if (ownedScene) disposeModel(ownedScene); };
  }, [url, building]);
  return state;
}
