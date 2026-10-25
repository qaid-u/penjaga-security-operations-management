export const buildingConfig = {
  modelUrl: import.meta.env.VITE_BUILDING_MODEL_URL || `${import.meta.env.BASE_URL}models/Bangunan_SUK.glb`,
  // GLB already converts Blender Z-up to glTF Y-up. Do not rotate again.
  pixelRatio: [1, 1.5],
  background: '#eef2ed',
  loadTimeoutMs: 60000,
};
