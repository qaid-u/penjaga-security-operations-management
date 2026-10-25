# Exterior model catalogue

These Blender studies use the supplied photographs and aerial views. Dimensions, concealed connections and site details are approximate. Each model folder contains its source, export, previews, manifest and file guide.

| Building / shared asset | Editable Blender source | GLB export | Guide / reuse record |
| --- | --- | --- | --- |
| Bangunan Dato' Jaafar Muhammad (DJM; legacy SUK filenames) | [Bangunan_SUK_Exterior.blend](suk/Bangunan_SUK_Exterior.blend) | [Bangunan_SUK_Exterior.glb](suk/Bangunan_SUK_Exterior.glb) | [DJM guide](suk/README.md) |
| Bangunan Dato' Abdul Rahman Andak (BDARA) | [Blender source](bdara/Bangunan_Dato_Abdul_Rahman_Andak.blend) | [GLB](bdara/Bangunan_Dato_Abdul_Rahman_Andak.glb) | [BDARA guide](bdara/README.md) |
| Bangunan Dato' Mohamad Salleh Perang (BDMSP) | [Blender source](bdmsp/Bangunan_Dato_Mohamad_Salleh_Perang.blend) | [GLB](bdmsp/Bangunan_Dato_Mohamad_Salleh_Perang.glb) | [BDMSP guide](bdmsp/README.md) |
| Bangunan Dato' Muhamad Ibrahim Munsyi (BDMIM) | Shares the BDMSP source above | Shares the BDMSP export above | [BDMIM guide](bdmim/README.md), [reuse record](bdmim/model_reference.json) |
| Bangunan Sultan Ismail (BSI), Kota Iskandar | [Blender source](bsi/Bangunan_Sultan_Ismail_Kota_Iskandar.blend) | [GLB](bsi/Bangunan_Sultan_Ismail_Kota_Iskandar.glb) | [BSI guide](bsi/README.md) |
| Kediaman Rasmi Setiausaha Kerajaan Johor / Rumah VIP Setiausaha Kerajaan Johor | [Shared Blender source](rumah_ss_vip/Rumah_SS_VIP_Shared_Exterior.blend) | [Shared GLB](rumah_ss_vip/Rumah_SS_VIP_Shared_Exterior.glb) | [Residence guide](rumah_ss_vip/README.md), [two-identity record](rumah_ss_vip/shared_model_reference.json) |
| Kaunter UTC Pejabat Setiausaha Kerajaan Johor — Pos UTC | [UTC_Johor_Exterior.blend](utc/UTC_Johor_Exterior.blend) | [UTC_Johor_Exterior.glb](utc/UTC_Johor_Exterior.glb) | [UTC guide](utc/README.md) |

All six unique models are integrated into the dashboard showcase and 3D command centre as eight building choices. DJM initially uses [public/models/Bangunan_SUK.glb](../public/models/Bangunan_SUK.glb); the other five GLBs and six small WebP previews are deployed in [public/models/library/](../public/models/library/). Sharing geometry preserves separate building and post identities; it does not merge operational records. See the [integration guide](../docs/testing/BUILDING_LIBRARY_INTEGRATION.md).

Security-post positions remain unconfirmed. Exterior landmarks, decorative props and historical `HOTSPOT_*` anchors do not establish indoor post locations, room layouts or verified routes. See the [official DJM post configuration](../docs/testing/DJM_OFFICIAL_POSTS.md) for its seven named posts and unconfirmed positions.

Named `backups/` files preserve earlier models or the Blender session before a new study. They are recovery/history sources, not the preferred current exports. Automatic `.blend1` copies are ignored by Git. Preview PNGs document the model appearance; `suk/djm-posts-*.png` and browser screenshots document application checks. Earlier screenshots may show historical revisions. Use each folder's current manifest and guide to identify the latest source and export.
