import {test}from'node:test';import assert from'node:assert/strict';
import {analyze,parseCSV}from'./analyze-evaluation.mjs';
test('empty evaluation produces no invented participant statistics',()=>{const r=analyze([]);assert.equal(r.participants,0);assert.equal(r.groups[0].completion_rate,null);assert.equal(r.paired[0].successful_pairs,0);});
test('synthetic arithmetic example excludes failed completion times and pairs',()=>{
  const base={task_id:'T1',order:'AB',errors:'0',accuracy:'1',interactions:'2'};
  const r=analyze([{...base,participant_id:'P01',interface:'A',completed:'1',seconds:'20'},{...base,participant_id:'P01',interface:'B',completed:'1',seconds:'10'},{...base,participant_id:'P02',interface:'A',completed:'0',seconds:'180',accuracy:'0',errors:'3'}]);
  assert.equal(r.groups[0].completion_rate,.5);assert.equal(r.groups[0].successful_time_mean_seconds,20);assert.equal(r.groups[0].errors,3);assert.equal(r.paired[0].time_difference_B_minus_A_mean_seconds,-10);assert.equal(r.paired[0].successful_pairs,1);
});
test('CSV quoting works and duplicate/invalid trials fail',()=>{assert.deepEqual(parseCSV('a,b\n"x,y","z"\n'),[{a:'x,y',b:'z'}]);assert.throws(()=>analyze([{participant_id:'private-name'}]));assert.throws(()=>parseCSV('a\n"unterminated'));});
