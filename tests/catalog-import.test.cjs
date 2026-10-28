const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function service(native) {
  const source=fs.readFileSync(join(__dirname,'../src/services/catalog-import.ts'),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};
  vm.runInNewContext(compiled,{exports,atob,require(name){
    if(name==='expo')return{requireOptionalNativeModule:()=>native};
    if(name==='react-native')return{Platform:{OS:'android'}};
    if(name==='expo-document-picker')return{};
    if(name==='expo-file-system')return{};
    if(name==='../core/catalog')return require(join(process.env.BC_TEST_BUILD,'catalog.js'));
    throw new Error(name);
  }});
  return exports;
}
test('Atualizar relê o mesmo URI e incorpora edições sem abrir novamente o seletor',async()=>{
  let picks=0;const reads=[];
  const uri='content://onedrive/document/cadastro-original';
  let content='Nome do Bloco;Balde\nBC;1\nBC;2\n';
  const api=service({async chooseAsync(kind){picks++;assert.equal(kind,'catalog');return{uri,name:'cadastro.csv'}},
    async readCatalogAsync(location){reads.push(location);return{name:'cadastro.csv',base64:Buffer.from(content).toString('base64')}}});
  const first=await api.selectCatalog();assert.equal(first.entries.length,2);
  content='Nome do Bloco;Balde\nBC;2\nBC;3\n';
  const next=await api.reloadCatalog(first.source);
  assert.deepEqual(Array.from(next.entries,r=>r.bucket),['2','3']);
  assert.equal(picks,1);assert.deepEqual(reads,[uri,uri]);
  assert.equal(next.source.uri,uri);
});
test('cancelar seleção não lê arquivo; erro offline ou arquivo inválido rejeita a importação',async()=>{
  let reads=0;
  const canceled=service({async chooseAsync(){return null},async readCatalogAsync(){reads++}});
  assert.equal(await canceled.selectCatalog(),null);assert.equal(reads,0);
  const offline=service({async readCatalogAsync(){throw new Error('Sem conexão')}});
  await assert.rejects(offline.reloadCatalog({uri:'content://offline',name:'baldes.csv'}),/último cadastro e as avaliações foram mantidos/);
  const invalid=service({async readCatalogAsync(){return{name:'baldes.csv',base64:Buffer.from('Arquivo inválido').toString('base64')}}});
  await assert.rejects(invalid.reloadCatalog({uri:'content://invalid',name:'baldes.csv'}),/mantidos/);
});
test('recusa arquivo acima do limite antes da conversão e não pede novo arquivo',async()=>{
  const api=service({async readCatalogAsync(){return{name:'grande.csv',base64:'A'.repeat(7*1024*1024)}}});
  await assert.rejects(api.reloadCatalog({uri:'content://grande',name:'grande.csv'}),/5 MB/);
});
