-- Official post identities are distinct from the seven exterior GLB anchors.
-- Existing posts, reports, schedules and historical links are preserved.
alter table tbl_lokasi_3d drop constraint if exists tbl_lokasi_3d_hotspot_id_check;
alter table tbl_lokasi_3d add constraint tbl_lokasi_3d_hotspot_id_check check (hotspot_id in (
 'HOTSPOT_MAIN_ENTRANCE','HOTSPOT_CENTRAL_BLOCK','HOTSPOT_LEFT_WING','HOTSPOT_RIGHT_WING','HOTSPOT_FRONT_PLAZA','HOTSPOT_LEFT_TOWER','HOTSPOT_RIGHT_TOWER',
 'POST_DJM_MAIN_LOBBY','POST_DJM_CCTV_CONTROL','POST_DJM_SS_LEVEL_3','POST_DJM_MB_LEVEL_4_FRONT','POST_DJM_MB_LEVEL_4_REAR','POST_DJM_SS_LG_LIFT','POST_DJM_MB_LG_LIFT'));

do $$
declare
 item record;
 matches integer;
 post_id integer;
begin
 for item in select * from (values
  ('POST_DJM_MAIN_LOBBY','Pos Lobi Utama','Lobi utama',null),
  ('POST_DJM_CCTV_CONTROL','Pos Bilik Kawalan CCTV','Bilik kawalan CCTV',null),
  ('POST_DJM_SS_LEVEL_3','Pos Tingkat 3 Pejabat Setiausaha Kerajaan Johor','Pejabat Setiausaha Kerajaan Johor','Tingkat 3'),
  ('POST_DJM_MB_LEVEL_4_FRONT','Pos Tingkat 4 Hadapan Pejabat Menteri Besar Johor','Hadapan Pejabat Menteri Besar Johor','Tingkat 4'),
  ('POST_DJM_MB_LEVEL_4_REAR','Pos Tingkat 4 Belakang Pejabat Menteri Besar Johor','Belakang Pejabat Menteri Besar Johor','Tingkat 4'),
  ('POST_DJM_SS_LG_LIFT','Pos Lif LG Pejabat Setiausaha Kerajaan Johor','Lif Pejabat Setiausaha Kerajaan Johor','LG'),
  ('POST_DJM_MB_LG_LIFT','Pos Lif LG Pejabat Menteri Besar Johor','Lif Pejabat Menteri Besar Johor','LG')
 ) as official(hotspot_id,nama_pos,kawasan,label_aras)
 loop
  select count(*),min(id_pos) into matches,post_id from tbl_pos_kawalan p
   where lower(regexp_replace(trim(p.nama_pos),'\s+',' ','g'))=lower(item.nama_pos)
    and lower(regexp_replace(coalesce(p.nama_bangunan,''),'[^a-zA-Z0-9]','','g'))
     in ('bangunandatojaafarmuhammad','bangunandatojaafarmuhammadkotaiskandar');
  if matches>1 then
   raise exception 'Ambiguous official post: %. Resolve duplicate records before migration.',item.nama_pos;
  elsif matches=0 then
   insert into tbl_pos_kawalan(nama_pos,nama_bangunan,lokasi)
    values(item.nama_pos,'Bangunan Dato’ Jaafar Muhammad','Kota Iskandar') returning id_pos into post_id;
  end if;
  insert into tbl_lokasi_3d(hotspot_id,nama_paparan,kawasan,label_aras,id_pos)
   values(item.hotspot_id,item.nama_pos,item.kawasan,item.label_aras,post_id)
   on conflict(hotspot_id) do update set
    nama_paparan=excluded.nama_paparan,kawasan=excluded.kawasan,label_aras=excluded.label_aras
   where (tbl_lokasi_3d.nama_paparan,tbl_lokasi_3d.kawasan,tbl_lokasi_3d.label_aras)
    is distinct from (excluded.nama_paparan,excluded.kawasan,excluded.label_aras);
 end loop;
 -- Keep legacy link history without presenting architecture as operational posts.
 update tbl_lokasi_3d set status_aktif=false,tarikh_kemaskini=now()
  where hotspot_id like 'HOTSPOT\_%' escape '\' and status_aktif;
end $$;
