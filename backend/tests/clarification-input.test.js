const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseClarificationInput}=require('../ml/clarificationInput');
const {draftHashFor}=require('../ml/eventDialogue');

test('multipart and JSON clarification input preserve only bounded user answers',()=>{
  const value={draftHash:draftHashFor('CCTV rosak',1),clarifications:[{questionId:'q-test',value:'unknown'}]};
  assert.deepEqual(parseClarificationInput(value),value);
  assert.deepEqual(parseClarificationInput(JSON.stringify(value)),value);
  assert.deepEqual(parseClarificationInput(undefined),{});
  assert.deepEqual(parseClarificationInput({}),{});
  for(const candidate of ['{bad}',[],{draftHash:'fake',clarifications:[]},{analysis:{events:[]}},{clarifications:value.clarifications},{...value,clarifications:[...value.clarifications,...value.clarifications]},{...value,clarifications:[{questionId:'q-test',value:'x'.repeat(501)}]},{...value,clarifications:[{questionId:'q-test',value:'unknown',confirmed:true}]}])assert.throws(()=>parseClarificationInput(candidate),error=>error.status===400);
});

test('draft identity binds the exact original narrative and selected post',()=>{
  assert.equal(draftHashFor('CCTV rosak',1),draftHashFor('CCTV rosak','1'));
  assert.notEqual(draftHashFor('CCTV rosak',1),draftHashFor(' CCTV rosak ',1));
  assert.notEqual(draftHashFor('CCTV rosak',1),draftHashFor('CCTV rosak',2));
});
