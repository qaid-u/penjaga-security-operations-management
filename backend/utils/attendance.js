// Duty dates and times are local Malaysian civil time, regardless of DB timezone.
const todaySql = "(now() at time zone 'Asia/Kuala_Lumpur')::date";
const eligibleSql = (alias = '') => {
  const p = alias ? `${alias}.` : '';
  return `(${p}tarikh_tugas = ${todaySql} or
    (${p}tarikh_tugas = ${todaySql} - 1 and ${p}masa_tamat < ${p}masa_mula))`;
};
const checkInSql = (alias = '') => {
  const p = alias ? `${alias}.` : '';
  return `(${eligibleSql(alias)} and (${p}tarikh_tugas = ${todaySql} or
    (now() at time zone 'Asia/Kuala_Lumpur') <= ${p}tarikh_tugas + ${p}masa_tamat + interval '1 day'))`;
};
module.exports = { todaySql, eligibleSql, checkInSql };
