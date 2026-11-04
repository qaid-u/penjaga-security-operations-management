const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cleanText,validateModel,evaluate,trainModel,predict}=require('../ml/textModel');
const corpus=require('../ml/data/classification-corpus.json');
const split=require('../ml/data/classification-splits.json');
const model=require('../ml/model/nlp-model.json');
const challenge=require('../../tests/phase7/fixtures/independent-challenges.json');
test('synthetic classification corpus has balanced labels and no split or challenge text leakage',()=>{
  assert.equal(corpus.synthetic,true);
  assert.equal(corpus.samples.length,2000);
  const counts=corpus.samples.reduce((out,row)=>{assert.equal(row.synthetic,true);out[row.category]=(out[row.category]||0)+1;return out;},{});
  assert.equal(Object.keys(counts).length,8);assert.equal(new Set(Object.values(counts)).size,1);
  assert.ok(Object.values(counts).every(count=>count===250));
  assert.equal(split.train.length+split.test.length,corpus.samples.length);
  const texts=new Set(split.train.map(row=>cleanText(row.text)));
  const groups=new Set(split.train.map(row=>row.group));
  for(const row of split.test){assert.ok(!texts.has(cleanText(row.text)));assert.ok(!groups.has(row.group));}
  const all=new Set(corpus.samples.map(row=>cleanText(row.text)));
  for(const row of challenge.cases)assert.ok(!all.has(cleanText(row.text)),'Evaluation challenge copied into training');
});
test('deployed model contains only the training partition and its recorded metrics reproduce',()=>{
  assert.equal(validateModel(model),true);assert.equal(model.totalDocuments,split.train.length);
  assert.deepEqual(evaluate(model,split.test),model.metrics);
  assert.equal(model.metrics.operationalAccuracy,null);
  assert.ok(model.trainingSet.limitations.some(text=>text.includes('risk accuracy')));
  assert.equal(model.selection.candidates.length,36);
  assert.deepEqual(model.selection.selected,model.inference);
  assert.equal(Math.max(...model.selection.candidates.map(row=>row.macroF1)),model.metrics.macroF1);
});

test('invalid model inference settings fail safely',()=>{
  assert.throws(()=>validateModel({...model,inference:{...model.inference,alpha:0}}));
  assert.throws(()=>validateModel({...model,inference:{...model.inference,bigramWeight:2}}));
  assert.throws(()=>validateModel({...model,inference:{...model.inference,classPrior:'unknown'}}));
});

test('neutral report boilerplate is excluded without breaking legacy inference defaults',()=>{
  const trained=trainModel([{text:'catatan api menyala',category:'Kebakaran'},{text:'catatan pagar terbuka',category:'Keselamatan Fizikal'}],{excludedWords:['catatan']});
  assert.ok(trained.vocabulary.every(token=>!token.split('_').includes('catatan')));
  assert.deepEqual(predict(trained,'catatan'),[]);
  assert.equal(predict(trained,'api menyala')[0].category,'Kebakaran');
  assert.deepEqual(predict(trained,'api menyala'),predict({...trained,inference:{alpha:1,bigramWeight:1,classPrior:'empirical'}},'api menyala'));
});
