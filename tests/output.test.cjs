const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const XLSX = require('xlsx');
const { buildOutput, fileFormat, outputPreferences, outputFilename, suggestedFilename, validateNickname } = require(join(process.env.BC_TEST_BUILD, 'output.js'));
const profile = { userId:'u',userName:'Fernanda',deviceId:'internal-uuid',cycle:'2026',block:'BC' };
const prefs = { nickname:'Tablet Fernanda',format:'xlsx' };
const row = changes => ({ schema_version:'1',record_id:'a',version:1,cycle:'2026',block:'BC',bucket:'0001',date:'2026-11-03',purpose:'EMASC',quantity:2,observation:'',user_id:'u',user_name:'Fernanda',device_id:'internal-uuid',created_at:'2026-11-03T12:00:00.000Z',updated_at:'2026-11-03T12:00:00.000Z',...changes });

test('XLSX real mantém colunas, quantidade numérica, balde textual, apelido e textos literais; inclui observação sem espigas',()=>{
  const records=[row(),row({record_id:'b',bucket:'2',quantity:0,observation:'=1+1'}),row({record_id:'c',bucket:'3',quantity:0,observation:'   '}),row({device_id:'other',quantity:99})];
  const copy=JSON.stringify(records);
  const output=buildOutput(profile,records,prefs);
  assert.equal(output.filename,'REGISTRO_BC_Tablet_Fernanda.xlsx');
  assert.equal(output.encoding,'base64');
  assert.equal(Buffer.from(output.content,'base64').subarray(0,2).toString(),'PK');
  const workbook=XLSX.read(output.content,{type:'base64'});
  assert.deepEqual(workbook.SheetNames,['Coletas']);
  const sheet=workbook.Sheets.Coletas;
  const data=XLSX.utils.sheet_to_json(sheet,{header:1});
  assert.equal(data.length,3);assert.equal(data[0].length,10);assert.equal(data[0][9],'Dispositivo');
  assert.equal(data[1][1],'0001');assert.equal(data[1][2],'03/11/2026');assert.equal(data[1][4],2);
  assert.equal(data[2][4],0);assert.equal(data[2][5],'=1+1');assert.equal(sheet.F3.t,'s');assert.equal(sheet.F3.f,undefined);
  assert.equal(data[1][9],'Tablet Fernanda');assert.ok(!JSON.stringify(data).includes('internal-uuid'));
  assert.equal(JSON.stringify(records),copy);
});

test('CSV usa o mesmo filtro de espigas OU observação e mantém proteção de fórmulas',()=>{
  const output=buildOutput(profile,[row({quantity:0,observation:'Nota; "revisar"'}),row({bucket:'2',quantity:0}),row({bucket:'3',quantity:0,observation:'=SUM(A1)'})],{...prefs,format:'csv'});
  assert.equal(output.mime,'text/csv');assert.equal(output.encoding,'utf8');
  assert.ok(output.content.startsWith('\ufeffNome do Bloco;'));assert.ok(output.content.includes('"0";"Nota; ""revisar"""'));
  assert.ok(output.content.includes('"\'=SUM(A1)"'));assert.ok(!output.content.includes('internal-uuid'));
  assert.equal(output.content.split('\r\n').length,4);
  for (const format of ['xlsx','csv']) assert.throws(()=>buildOutput(profile,[row({quantity:0,observation:'  '})],{...prefs,format}),/espigas ou observação/);
});

test('nome livre do arquivo existente prevalece sobre o apelido e extensão deve combinar com o conteúdo',()=>{
  const target={kind:'file',uri:'content://provider/1',name:'Avaliações BC — novembro.XLSX'};
  assert.equal(buildOutput(profile,[row()],prefs,target).filename,target.name);
  assert.equal(outputFilename({...prefs,nickname:'Novo nome'},target),target.name);
  assert.equal(fileFormat('qualquer nome.CSV'),'csv');
  for (const name of ['dados.xlsm','dados.xlsx.csv.exe','../dados.xlsx','pasta\\dados.xlsx']) assert.throws(()=>fileFormat(name));
  assert.throws(()=>buildOutput(profile,[row()],{...prefs,format:'csv'},target),/formato mudou/);
  assert.equal(suggestedFilename({...prefs,nickname:'São João / tablet'}),'REGISTRO_BC_Sao_Joao_tablet.xlsx');
  assert.equal(validateNickname(' Tablet '),'Tablet');
  for (const name of ['', ' ', 'x'.repeat(41), 'A\nB']) assert.throws(()=>validateNickname(name));
});

test('instalação nova usa Excel; atualização preserva destinos CSV antigos',()=>{
  assert.equal(outputPreferences(null,null).format,'xlsx');
  assert.equal(outputPreferences(null,{kind:'file',name:'antigo.csv'}).format,'csv');
  assert.equal(outputPreferences(null,{kind:'folder',name:'pasta'}).format,'csv');
  assert.deepEqual(outputPreferences(prefs,null),prefs);
});

function service(native) {
  const files=new Map(); const calls=[];
  class Directory {constructor(...parts){this.uri=parts.map(p=>typeof p==='string'?p:p.uri).join('/');}create(){}}
  class File {constructor(directory,name){this.uri=directory.uri+'/'+name;}async write(content,options){files.set(this.uri,Buffer.from(content,options.encoding==='base64'?'base64':'utf8'));}async base64(){return files.get(this.uri).toString('base64');}}
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(join(__dirname,'../src/services/export.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,require(name){
    if(name==='expo')return{requireOptionalNativeModule:()=>native};
    if(name==='expo-file-system')return{Directory,File,Paths:{document:'private'}};
    if(name==='expo-sharing')return{isAvailableAsync:async()=>true,shareAsync:async(...args)=>calls.push(args)};
    if(name==='../core/output')return require(join(process.env.BC_TEST_BUILD,'output.js'));
    throw new Error(name);
  }});
  return{api:exports,files,calls};
}

test('serviço grava bytes XLSX/CSV, aceita nomes livres e usa MIME correto no compartilhamento',async()=>{
  let selected={kind:'file',uri:'content://provider/custom',name:'Minha avaliação.xlsx'};
  const writes=[];
  const {api,files,calls}=service({async chooseAsync(){return selected;},async writeFileAsync(...args){writes.push(args);return{name:selected.name};}});
  const target=await api.chooseOutput(prefs,'open');assert.equal(target.name,selected.name);assert.equal(target.format,'xlsx');
  const filename=await api.exportOutput(profile,[row()],target,prefs);assert.equal(filename,selected.name);
  assert.equal(writes[0][2],selected.name);assert.equal(Buffer.from(writes[0][3],'base64').subarray(0,2).toString(),'PK');
  assert.equal(writes[0][4],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await api.shareOutput(profile,[row()],prefs);assert.equal(calls[0][1].mimeType,writes[0][4]);
  selected={...selected,name:'Arquivo antigo.csv'};
  const csvTarget=await api.chooseOutput(prefs,'open');assert.equal(csvTarget.format,'csv');
  await api.exportOutput(profile,[row()],csvTarget,{...prefs,format:'csv'});
  assert.equal(writes[1][2],selected.name);assert.equal(writes[1][4],'text/csv');
  assert.ok(Buffer.from(writes[1][3],'base64').toString('utf8').startsWith('\ufeffNome do Bloco'));
  assert.ok(files.size>=2);
  selected=null;assert.equal(await api.chooseOutput(prefs,'open'),null);
});

test('falha de escrita ou arquivo de formato incompatível não é tratado como sucesso',async()=>{
  const {api}=service({async writeFileAsync(){throw new Error('Gravação não confirmada');}});
  await assert.rejects(api.exportOutput(profile,[row()],{kind:'file',uri:'content://1',name:'dados.xlsx'},prefs),/não confirmada/);
  await assert.rejects(api.exportOutput(profile,[row()],{kind:'file',uri:'content://1',name:'dados.csv'},prefs),/formato mudou/);
});


test('erro do provedor apresenta orientação clara sem confirmar exportação',async()=>{
  const {api}=service({async writeFileAsync(){throw new Error("Call to function BCDocuments.writeFileAsync rejected: A gravação não pôde ser confirmada no destino. Os dados continuam no aparelho.");}});
  await assert.rejects(api.exportOutput(profile,[row()],{kind:'file',uri:'content://1',name:'dados.xlsx'},prefs),error=>{
    assert.ok(error.message.startsWith('A gravação no destino não foi confirmada.'));
    assert.ok(error.message.includes('A coleta continua salva no aparelho.'));
    assert.ok(error.message.includes('Enviar cópia dos dados'));
    assert.ok(!error.message.includes('BCDocuments'));
    return true;
  });
});
