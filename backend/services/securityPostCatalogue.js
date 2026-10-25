const catalogue = require('../config/djmSecurityPosts.json');
const legacyHotspots = ['HOTSPOT_MAIN_ENTRANCE','HOTSPOT_CENTRAL_BLOCK','HOTSPOT_LEFT_WING','HOTSPOT_RIGHT_WING','HOTSPOT_FRONT_PLAZA','HOTSPOT_LEFT_TOWER','HOTSPOT_RIGHT_TOWER'];
const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/gu, ' ');
const buildingKey = value => normalize(value).replace(/[^a-z0-9]/gu, '');
function isDjmBuilding(value) {
  return ['bangunandatojaafarmuhammad', 'bangunandatojaafarmuhammadkotaiskandar'].includes(buildingKey(value));
}
function matchesOfficialPost(record, official) {
  return Boolean(official && isDjmBuilding(record.nama_bangunan) && normalize(record.nama_pos) === normalize(official.name));
}
// SQL counterpart of isDjmBuilding; fixed column aliases are supplied by this service only.
const buildingScopeSql = alias => `lower(regexp_replace(coalesce(${alias}.nama_bangunan,''),'[^a-zA-Z0-9]','','g')) in ('bangunandatojaafarmuhammad','bangunandatojaafarmuhammadkotaiskandar')`;
module.exports = { catalogue, legacyHotspots, matchesOfficialPost, isDjmBuilding, buildingScopeSql };
