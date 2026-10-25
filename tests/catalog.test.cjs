const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const XLSX = require('xlsx');
const { parseCatalog } = require(join(process.env.BC_TEST_BUILD, 'catalog.js'));
const csv = text => new TextEncoder().encode(text);

test('importa CSV com acentos/BOM, ignora repetidos e separa blocos e safras', () => {
  const result = parseCatalog(csv('\ufeffSafra;Bloco de cruzamento;Número do balde\r\n2026;BC 1;1250\r\n2026;BC 2;1250\r\n2026;BC 1;1250\r\n2027;BC 1;1250'), 'cadastro.csv');
  assert.equal(result.entries.length, 3); assert.equal(result.duplicates, 1);
  assert.equal(result.entries[1].block, 'BC 2');
});
test('aceita vírgula, campos entre aspas e safra padrão quando a coluna não existe', () => {
  const result = parseCatalog(csv('Bloco,Balde\n"BC, norte",12'), 'cadastro.csv', '2026');
  assert.deepEqual(result.entries, [{ cycle: '2026', block: 'BC, norte', bucket: '12' }]);
  assert.deepEqual(parseCatalog(csv('Nome do Bloco;Balde\nBC_SIMPLES_KX26;12'), 'cadastro.csv').entries,
    [{ cycle: '', block: 'BC_SIMPLES_KX26', bucket: '12' }]);
});
test('recusa todo o arquivo se houver balde, bloco ou cabeçalho inválido', () => {
  for (const text of ['Safra;Bloco;Balde\n2026;BC;12\n2026;BC;1.5', 'Safra;Bloco;Balde\n2026;;12', 'Safra;Balde\n2026;12'])
    assert.throws(() => parseCatalog(csv(text), 'cadastro.csv'));
  assert.throws(() => parseCatalog(csv('Balde;Balde;Bloco\n1;2;BC'), 'cadastro.csv', '2026'), /repetidas/);
});
test('lê Excel com aba CADASTRO e preserva o formato do identificador', () => {
  const book = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([['Safra', 'Bloco', 'Balde'], ['2026', 'BC1', 12]]);
  sheet.C2.z = '0000'; XLSX.utils.book_append_sheet(book, sheet, 'CADASTRO');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Observações'], ['Teste']]), 'LEIA');
  const bytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  assert.equal(parseCatalog(bytes, 'cadastro.xlsx').entries[0].bucket, '0012');
  sheet.C2.f = '6+6';
  assert.throws(() => parseCatalog(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), 'cadastro.xlsx'), /fórmulas/);
});
test('recusa duas abas compatíveis sem a escolha explícita CADASTRO', () => {
  const book = XLSX.utils.book_new();
  for (const name of ['A', 'B']) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Safra', 'Bloco', 'Balde'], ['2026', 'BC1', '1']]), name);
  assert.throws(() => parseCatalog(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), 'cadastro.xlsx'), /CADASTRO/);
});
