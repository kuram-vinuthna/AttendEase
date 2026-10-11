const VALID_STATUSES = Object.freeze(['Present', 'Absent', 'Late', 'Leave']);
const ATTENDED_STATUSES = new Set(['Present', 'Late']);
function attendanceRate(records) {
  const eligible = records.filter(r => VALID_STATUSES.includes(r.status) && r.status !== 'Leave');
  if (!eligible.length) return 0;
  return Math.round(1000 * eligible.filter(r => ATTENDED_STATUSES.has(r.status)).length / eligible.length) / 10;
}
function lowAttendance(records, threshold = 75) {
  const bySubject = new Map();
  for (const record of records) {
    const key = record.subject_id == null ? 'general' : String(record.subject_id);
    if (!bySubject.has(key)) bySubject.set(key, { subject_id: record.subject_id ?? null, records: [] });
    bySubject.get(key).records.push(record);
  }
  return [...bySubject.values()].map(group => ({ subject_id: group.subject_id, rate: attendanceRate(group.records), total: group.records.filter(r => r.status !== 'Leave').length }))
    .filter(group => group.total > 0 && group.rate < threshold);
}
module.exports = { VALID_STATUSES, ATTENDED_STATUSES, attendanceRate, lowAttendance };
