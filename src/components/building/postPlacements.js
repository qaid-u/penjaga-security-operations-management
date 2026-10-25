import { Box3, Vector3 } from 'three';

// Display estimates only. These rules do not establish surveyed/indoor positions.
// Fractions refer to a named mesh's world bounding box; offsets use model units.
const rules = {
  DJM: {
    POST_DJM_MAIN_LOBBY: { anchors:['Entrance_Platform'], fraction:[.5,.5,1], offset:[0,2,2], basis:'Proksi lobi pada pendekatan anjung utama yang kelihatan. Pintu dan bilik lobi sebenar belum disahkan.' },
    POST_DJM_CCTV_CONTROL: { anchors:['SUK_Main_Body'], fraction:[.70,.22,1], offset:[0,0,6], basis:'Cadangan ruang kawalan berdekatan teras/lobi. Gambar eksterior tidak menunjukkan bilik CCTV; lokasi ini andaian untuk visualisasi.' },
    POST_DJM_SS_LEVEL_3: { anchors:['SUK_Main_Body'], fraction:[.28,.70,1], offset:[0,0,4], basis:'Label Tingkat 3 dibekalkan. Ketinggian diinterpolasi pada fasad; andaian pejabat SS di bahagian kiri belum disahkan.' },
    POST_DJM_MB_LEVEL_4_FRONT: { anchors:['SUK_Main_Body'], fraction:[.72,.92,1], offset:[0,0,5], basis:'Label Tingkat 4 dan hadapan dibekalkan. Proksi fasad atas kanan; susunan pejabat MB dan ketinggian sebenar belum disahkan.' },
    POST_DJM_MB_LEVEL_4_REAR: { anchors:['SUK_Main_Body'], fraction:[.72,.92,0], offset:[0,0,-3], viewDirection:[.5,.45,-1], basis:'Label Tingkat 4 dan belakang dibekalkan. Proksi fasad belakang pada sisi MB yang diandaikan; tiada pelan pejabat dalaman.' },
    POST_DJM_SS_LG_LIFT: { anchors:['SUK_Left_Tower'], fraction:[.5,.05,1], offset:[0,0,2.5], basis:'Label LG dibekalkan. Penanda di kaki menara kiri sebagai proksi teras lif SS; model tidak mempunyai geometri LG dan teras lif sebenar belum diketahui.' },
    POST_DJM_MB_LG_LIFT: { anchors:['SUK_Right_Tower'], fraction:[.5,.05,1], offset:[0,0,2.5], basis:'Label LG dibekalkan. Penanda di kaki menara kanan sebagai proksi teras lif MB; pembahagian sisi dan kedudukan lif ialah andaian.' },
  },
  BDARA: {
    POST_BDARA: { anchors:['BDARA_EntryPlatform','BDARA_MainEntry_GlassDoors'], fraction:[.5,.5,1], offset:[0,1.7,5], basis:'Proksi pos pada pendekatan pintu masuk utama/anjung berdasarkan geometri ketibaan. Bilik pos sebenar tidak kelihatan.' },
  },
  BDMSP: {
    POST_BDMSP: { anchors:['BDMSP_EntryTiledRoof'], fraction:[.5,0,1], offset:[0,-2.8,2.5], basis:'Proksi pos pada pendekatan anjung rangka A. Nama bangunan diketahui; kedudukan dalaman pos belum dibekalkan.' },
  },
  BDMIM: {
    POST_BDMIM: { anchors:['BDMSP_EntryTiledRoof'], fraction:[.5,0,1], offset:[0,-2.8,2.5], basis:'Menggunakan proksi pendekatan anjung pada model yang dikongsi dengan BDMSP. Kesamaan geometri tidak membuktikan susunan pos sebenar BDMIM.' },
  },
  BSI_KOTA_ISKANDAR: {
    POST_BSI_CLERK: { anchors:['BSI_AxialEntryGallery'], fraction:[1,0,.65], offset:[2.5,-6.5,0], basis:'Proksi sisi galeri masuk bagi Pejabat Jurutulis. Gambar tidak menentukan lokasi pejabat atau arasnya.' },
    POST_BSI_DUN: { anchors:['BSI_MainHall'], fraction:[1,.58,.58], offset:[3,0,0], viewDirection:[1,.55,.45], basis:'Dewan utama digunakan sebagai perkaitan visual DUN. Identiti dewan, pintu masuk DUN dan kedudukan pos tidak dapat dipastikan daripada foto.' },
  },
  RUMAH_SS: {
    POST_RUMAH_SS: { anchors:['RUMAH_EntrancePavilion_Floor'], fraction:[.5,1,1], offset:[0,1,2], basis:'Proksi pendekatan anjung/akses kediaman. Foto tidak menunjukkan kedudukan pos atau rumah pengawal yang sebenar.' },
  },
  RUMAH_VIP: {
    POST_RUMAH_VIP: { anchors:['RUMAH_EntrancePavilion_Floor'], fraction:[.5,1,1], offset:[0,1,2], basis:'Proksi anjung pada model kediaman yang dikongsi. Identiti Rumah VIP berasingan; posisi pos sebenar tidak ditentukan oleh model Rumah SS.' },
  },
  UTC_JOHOR: {
    POST_UTC: { anchors:['UTC_StreetEntranceCanopy'], fraction:[0,0,.5], offset:[-2,-3,0], viewDirection:[-1,.30,.25], basis:'Proksi pintu masuk awam sebelah barat fasad UTC. Pos ialah kaunter dalaman; aras dan lokasi kaunter tidak dapat disimpulkan daripada eksterior.' },
  },
};

export function resolvePostPlacements(scene, building) {
  return building.hotspots.map((post) => {
    const rule = rules[building.id]?.[post.id];
    if (!rule) return { ...post, position:null, estimatedPosition:null, placement:{status:'unavailable',confidence:'low',basis:'Tiada asas anggaran untuk pos ini.'} };
    const anchorNode = rule.anchors.map((name) => scene.getObjectByName(name)).find(Boolean);
    if (!anchorNode) return { ...post, position:null, estimatedPosition:null,
      placement:{status:'unavailable',confidence:'low',reason:'reference-feature-missing',
        method:'geometry-heuristic-v1',buildingId:building.id,modelId:building.modelId,
        anchorNode:null,anchorFound:false,anchorCandidates:[...rule.anchors],knownFloor:post.floor || null,
        basis:'Komponen rujukan tidak ditemui dalam model. Penanda anggaran tidak dipaparkan kerana kedudukan tidak dapat diasaskan pada ciri bangunan.',
      },
    };
    const anchorBounds = new Box3().setFromObject(anchorNode);
    const span = anchorBounds.getSize(new Vector3());
    const point = anchorBounds.min.clone().add(span.multiply(new Vector3(...rule.fraction))).add(new Vector3(...rule.offset));
    if (!point.toArray().every(Number.isFinite)) throw new Error('Anggaran kedudukan model tidak sah.');
    return { ...post, position:null, estimatedPosition:point.toArray(),
      placement:{status:'estimated',confidence:'low',method:'geometry-heuristic-v1',
        buildingId:building.id, modelId:building.modelId, anchorNode:anchorNode.name,
        anchorFound:true, knownFloor:post.floor || null,
        viewDirection:rule.viewDirection || building.viewDirection,
        basis:rule.basis,
      },
    };
  });
}

export const markerPosition = (post) => post?.position || post?.estimatedPosition || null;
