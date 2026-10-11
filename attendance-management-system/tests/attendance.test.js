const test = require('node:test');
const assert = require('node:assert/strict');
const { attendanceRate, lowAttendance, VALID_STATUSES } = require('../lib-attendance');
test('attendance statuses are constrained to supported values', () => {
  assert.deepEqual(VALID_STATUSES, ['Present', 'Absent', 'Late', 'Leave']);
});
test('Present and Late count as attended; Leave is excluded from denominator', () => {
  assert.equal(attendanceRate([{status:'Present'},{status:'Late'},{status:'Absent'},{status:'Leave'}]), 66.7);
});
test('empty attendance has a zero rate', () => assert.equal(attendanceRate([]), 0));
test('low attendance is evaluated independently per subject', () => {
  const alerts = lowAttendance([
    {subject_id:1,status:'Present'}, {subject_id:1,status:'Absent'},
    {subject_id:2,status:'Present'}, {subject_id:2,status:'Present'},
    {subject_id:2,status:'Leave'}
  ], 75);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].subject_id, 1);
  assert.equal(alerts[0].rate, 50);
});
