const {dateRange} = require('../utils/dateRange');
const DAY=86400000;
const iso=date=>date.toISOString().slice(0,10);
const shift=(value,days)=>iso(new Date(Date.parse(value+'T00:00:00Z')+days*DAY));
const empty=()=>({total:0,classified:0,high:0,reviewed:0,attachments:0});
async function dashboardInsights(client,query) {
  const today=(await client.query("select (now() at time zone 'Asia/Kuala_Lumpur')::date::text as today")).rows[0].today;
  const requested=query.date?dateRange({from:query.date,to:query.date}):dateRange(query);
  const scopeValues=[];const scope=[];
  if(query.location){scopeValues.push(query.location);scope.push('l.id_pos=$'+scopeValues.length+'::int');}
  if(query.risk){scopeValues.push(query.risk);scope.push("(case when n.tahap_risiko in ('Low','Medium','High','Critical') then n.tahap_risiko else 'Unknown' end)=$"+scopeValues.length);}
  const reports=`select l.*, case when n.tahap_risiko in ('Low','Medium','High','Critical') then n.tahap_risiko else 'Unknown' end as risk from tbl_laporan_harian l left join lateral (select tahap_risiko from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1)n on true ${scope.length?'where '+scope.join(' and '):''}`;
  const first=requested?requested.from:(await client.query(`with scoped as (${reports}) select min(tarikh_laporan)::text as first from scoped where tarikh_laporan<=$${scopeValues.length+1}::date`,[...scopeValues,today])).rows[0].first||today;
  const end=requested&&requested.to<today?requested.to:today;
  const days=first>end?0:Math.round((Date.parse(end)-Date.parse(first))/DAY)+1;
  const previousFrom=days?shift(first,-days):first;
  const comparable=Boolean(requested&&days>0&&previousFrom>='1000-01-01');
  const from=first;
  const trendFrom=days>366?shift(end,-365):from;
  const period={from,to:requested?.to||today,observedTo:end,days,trendFrom,trendLimited:days>366,allTime:!requested};
  if(!days)return {period,current:empty(),previous:null,comparison:null,series:[],posts:[],backlog:[],futurePeriod:true};
  const offset=scopeValues.length;
  const args=[...scopeValues,comparable?previousFrom:from,end,from];
  const summary=await client.query(`with scoped as (${reports})
    select case when tarikh_laporan >= $${offset+3}::date then 'current' else 'previous' end as period,
      count(*)::int as total, count(*) filter(where risk<>'Unknown')::int as classified,
      count(*) filter(where risk in ('High','Critical'))::int as high,
      count(*) filter(where status_laporan in ('Diluluskan','Ditolak'))::int as reviewed,
      count(*) filter(where lampiran_fail is not null and lampiran_fail<>'[]')::int as attachments
    from scoped where tarikh_laporan between $${offset+1}::date and $${offset+2}::date group by 1`,args);
  const current=summary.rows.find(r=>r.period==='current')||empty();
  const previous=comparable?(summary.rows.find(r=>r.period==='previous')||empty()):null;
  const series=await client.query(`with scoped as (${reports}), counts as (
    select tarikh_laporan,count(*)::int as total,count(*) filter(where risk in ('High','Critical'))::int as high
    from scoped where tarikh_laporan between $${offset+1}::date and $${offset+2}::date group by tarikh_laporan)
    select d.day::date::text as date,coalesce(c.total,0)::int as reports,coalesce(c.high,0)::int as high,
      ${comparable?'coalesce(p.total,0)::int':'null::int'} as previous, ${comparable?'coalesce(p.high,0)::int':'null::int'} as previous_high
    from generate_series($${offset+3}::date,$${offset+2}::date,interval '1 day') d(day)
    left join counts c on c.tarikh_laporan=d.day::date
    left join counts p on p.tarikh_laporan=d.day::date-$${offset+4}::int order by d.day`,[...scopeValues,comparable?previousFrom:from,end,trendFrom,days]);
  const posts=await client.query(`with scoped as (${reports}) select s.id_pos,coalesce(p.nama_pos,'Pos tidak diketahui') as name,
    count(*)::int as reports,count(*) filter(where risk in ('High','Critical'))::int as high,
    count(*) filter(where risk<>'Unknown')::int as classified
    from scoped s left join tbl_pos_kawalan p on p.id_pos=s.id_pos
    where tarikh_laporan between $${offset+1}::date and $${offset+2}::date
    group by s.id_pos,p.nama_pos order by high desc,reports desc,s.id_pos limit 5`,[...scopeValues,from,end]);
  const backlog=await client.query(`with scoped as (${reports}) select
    case when $${offset+1}::date-tarikh_laporan<3 then '0–2 hari' when $${offset+1}::date-tarikh_laporan<7 then '3–6 hari' else '7+ hari' end as age,
    count(*)::int as count from scoped where status_laporan='Dihantar' and tarikh_laporan<=$${offset+1}::date group by 1`,[...scopeValues,today]);
  const rate=(n,d)=>d?Number((n/d*100).toFixed(1)):null;
  return {period,current,previous,comparison:previous?{from:previousFrom,to:shift(from,-1),volumeChange:previous.total?Number(((current.total-previous.total)/previous.total*100).toFixed(1)):null,riskShareChange:current.classified&&previous.classified?Number((rate(current.high,current.classified)-rate(previous.high,previous.classified)).toFixed(1)):null}:null,
    series:series.rows,posts:posts.rows,backlog:['0–2 hari','3–6 hari','7+ hari'].map(age=>({age,count:backlog.rows.find(r=>r.age===age)?.count||0})),futurePeriod:false};
}
module.exports={dashboardInsights};
