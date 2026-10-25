const catalogue = require('../config/djmSecurityPosts.json');
const buildingCatalogue = require('../config/securityBuildings.json');
const legacyHotspots = ['HOTSPOT_MAIN_ENTRANCE','HOTSPOT_CENTRAL_BLOCK','HOTSPOT_LEFT_WING','HOTSPOT_RIGHT_WING','HOTSPOT_FRONT_PLAZA','HOTSPOT_LEFT_TOWER','HOTSPOT_RIGHT_TOWER'];
const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/gu, ' ');
const buildingKey = value => normalize(value).replace(/[^a-z0-9]/gu, '');
function selectedBuilding(value = buildingCatalogue.defaultBuilding) {
  const building = typeof value === 'string' && buildingCatalogue.buildings.find(item => item.id === value);
  if (!building) { const error = new Error('Bangunan tidak sah'); error.status = 400; throw error; }
  return building;
}
function isBuilding(value, building = 'DJM') {
  return selectedBuilding(building).aliases.map(buildingKey).includes(buildingKey(value));
}
const isDjmBuilding = value => isBuilding(value, 'DJM');
function matchesOfficialPost(record, official, building = 'DJM') {
  return Boolean(official && isBuilding(record.nama_bangunan, building) && normalize(record.nama_pos) === normalize(official.name));
}
// Only fixed service aliases and alphanumeric keys from the server-owned catalogue enter SQL.
function buildingScopeSql(alias, building = 'DJM') {
  if (!['p'].includes(alias)) throw new Error('Unsupported building-scope alias');
  const keys = [...new Set(selectedBuilding(building).aliases.map(buildingKey))];
  return `lower(regexp_replace(coalesce(${alias}.nama_bangunan,''),'[^a-zA-Z0-9]','','g')) in (${keys.map(key => `'${key}'`).join(',')})`;
}
module.exports = { catalogue, buildingCatalogue, selectedBuilding, legacyHotspots, matchesOfficialPost, isBuilding, isDjmBuilding, buildingScopeSql };
