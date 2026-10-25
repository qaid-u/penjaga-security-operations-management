-- Register the eight modeled building identities without merging their records.
-- Existing post IDs, reports, schedules, admin links/unlinks and inactive history survive.
select pg_advisory_xact_lock(730006);
alter table tbl_lokasi_3d add column if not exists building_id varchar(40) not null default 'DJM';
alter table tbl_lokasi_3d drop constraint if exists tbl_lokasi_3d_hotspot_id_check;
alter table tbl_lokasi_3d add constraint tbl_lokasi_3d_hotspot_id_check check (hotspot_id in (
 'HOTSPOT_MAIN_ENTRANCE','HOTSPOT_CENTRAL_BLOCK','HOTSPOT_LEFT_WING','HOTSPOT_RIGHT_WING','HOTSPOT_FRONT_PLAZA','HOTSPOT_LEFT_TOWER','HOTSPOT_RIGHT_TOWER',
 'POST_DJM_MAIN_LOBBY','POST_DJM_CCTV_CONTROL','POST_DJM_SS_LEVEL_3','POST_DJM_MB_LEVEL_4_FRONT','POST_DJM_MB_LEVEL_4_REAR','POST_DJM_SS_LG_LIFT','POST_DJM_MB_LG_LIFT',
 'POST_BDARA','POST_BDMSP','POST_BDMIM','POST_BSI_CLERK','POST_BSI_DUN','POST_RUMAH_SS','POST_RUMAH_VIP','POST_UTC'));
alter table tbl_lokasi_3d drop constraint if exists tbl_lokasi_3d_building_hotspot_check;
alter table tbl_lokasi_3d add constraint tbl_lokasi_3d_building_hotspot_check check (
 (building_id='DJM' and hotspot_id in ('HOTSPOT_MAIN_ENTRANCE','HOTSPOT_CENTRAL_BLOCK','HOTSPOT_LEFT_WING','HOTSPOT_RIGHT_WING','HOTSPOT_FRONT_PLAZA','HOTSPOT_LEFT_TOWER','HOTSPOT_RIGHT_TOWER',
 'POST_DJM_MAIN_LOBBY','POST_DJM_CCTV_CONTROL','POST_DJM_SS_LEVEL_3','POST_DJM_MB_LEVEL_4_FRONT','POST_DJM_MB_LEVEL_4_REAR','POST_DJM_SS_LG_LIFT','POST_DJM_MB_LG_LIFT')) or
 (building_id='BDARA' and hotspot_id='POST_BDARA') or
 (building_id='BDMSP' and hotspot_id='POST_BDMSP') or
 (building_id='BDMIM' and hotspot_id='POST_BDMIM') or
 (building_id='BSI_KOTA_ISKANDAR' and hotspot_id in ('POST_BSI_CLERK','POST_BSI_DUN')) or
 (building_id='RUMAH_SS' and hotspot_id='POST_RUMAH_SS') or
 (building_id='RUMAH_VIP' and hotspot_id='POST_RUMAH_VIP') or
 (building_id='UTC_JOHOR' and hotspot_id='POST_UTC'));
create index if not exists idx_lokasi_3d_building_active on tbl_lokasi_3d(building_id,status_aktif,id_lokasi);

do $$
declare item record; matches integer; post_id integer;
begin
 for item in select * from (values
  ('BDARA','POST_BDARA','Pos BDARA','Bangunan Dato’ Abdul Rahman Andak','Kota Iskandar','Bangunan Dato’ Abdul Rahman Andak',array['bangunandatoabdulrahmanandak','bangunandatoabdulrahmanandakkotaiskandar','bdara']),
  ('BDMSP','POST_BDMSP','Pos BDMSP','Bangunan Dato’ Mohamad Salleh Perang','Kota Iskandar','Bangunan Dato’ Mohamad Salleh Perang',array['bangunandatomohamadsallehperang','bangunandatomohamadsallehperangkotaiskandar','bangunandatomohamedsallehperang','bangunandatomohamedsallehperangkotaiskandar','bdmsp']),
  ('BDMIM','POST_BDMIM','Pos BDMIM','Bangunan Dato’ Muhamad Ibrahim Munsyi','Kota Iskandar','Bangunan Dato’ Muhamad Ibrahim Munsyi',array['bangunandatomuhamadibrahimmunsyi','bangunandatomuhamadibrahimmunsyikotaiskandar','bdmim']),
  ('BSI_KOTA_ISKANDAR','POST_BSI_CLERK','Pos Pejabat Jurutulis','Bangunan Sultan Ismail','Kota Iskandar','Pejabat Jurutulis',array['bangunansultanismail','bangunansultanismailbsi','bangunansultanismailkotaiskandar','bangunansultanismailbsikotaiskandar','bsikotaiskandar']),
  ('BSI_KOTA_ISKANDAR','POST_BSI_DUN','Pos Dewan Undangan Negeri (DUN)','Bangunan Sultan Ismail','Kota Iskandar','Dewan Undangan Negeri',array['bangunansultanismail','bangunansultanismailbsi','bangunansultanismailkotaiskandar','bangunansultanismailbsikotaiskandar','bsikotaiskandar']),
  ('RUMAH_SS','POST_RUMAH_SS','Pos Rumah SS','Kediaman Rasmi Setiausaha Kerajaan Johor','Johor','Kediaman rasmi',array['kediamanrasmisetiausahakerajaanjohor','rumahss']),
  ('RUMAH_VIP','POST_RUMAH_VIP','Pos Rumah VIP','Rumah VIP Setiausaha Kerajaan Johor','Johor','Rumah VIP',array['rumahvipsetiausahakerajaanjohor','rumahvip']),
  ('UTC_JOHOR','POST_UTC','Pos UTC','Kaunter UTC Pejabat Setiausaha Kerajaan Johor','Johor Bahru','Kaunter UTC',array['kaunterutcpejabatsetiausahakerajaanjohor','utcjohor','utc'])
 ) as official(building_id,hotspot_id,nama_pos,nama_bangunan,site,kawasan,building_keys)
 loop
  select count(*),min(id_pos) into matches,post_id from tbl_pos_kawalan p
   where lower(regexp_replace(trim(p.nama_pos),'\s+',' ','g'))=lower(item.nama_pos)
    and lower(regexp_replace(coalesce(p.nama_bangunan,''),'[^a-zA-Z0-9]','','g'))=any(item.building_keys);
  if matches>1 then
   raise exception 'Ambiguous official post: % in %. Resolve duplicates before migration.',item.nama_pos,item.nama_bangunan;
  elsif matches=0 then
   insert into tbl_pos_kawalan(nama_pos,nama_bangunan,lokasi)
    values(item.nama_pos,item.nama_bangunan,item.site) returning id_pos into post_id;
  end if;
  insert into tbl_lokasi_3d(building_id,hotspot_id,nama_paparan,kawasan,label_aras,id_pos)
   values(item.building_id,item.hotspot_id,item.nama_pos,item.kawasan,null,post_id)
   on conflict(hotspot_id) do update set
    building_id=excluded.building_id,nama_paparan=excluded.nama_paparan,kawasan=excluded.kawasan,label_aras=excluded.label_aras
   where (tbl_lokasi_3d.building_id,tbl_lokasi_3d.nama_paparan,tbl_lokasi_3d.kawasan,tbl_lokasi_3d.label_aras)
    is distinct from (excluded.building_id,excluded.nama_paparan,excluded.kawasan,excluded.label_aras);
 end loop;
end $$;
