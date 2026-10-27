const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('limpeza remove apenas CSV interno e cache; preserva banco e arquivos externos e pode ser repetida', async () => {
  const directory = fs.mkdtempSync(join(tmpdir(), 'bc-private-files-'));
  try {
    const document = join(directory, 'private', 'document'); const cache = join(directory, 'private', 'cache');
    const exported = join(document, 'exportacoes'); const database = join(document, 'SQLite'); const external = join(directory, 'external');
    for (const folder of [exported, database, join(cache, 'DocumentPicker'), external]) fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(join(exported, 'REGISTRO_BC.csv'), 'copia interna');
    fs.writeFileSync(join(database, 'app.db'), 'banco em uso');
    fs.writeFileSync(join(cache, 'DocumentPicker', 'entrada.xlsx'), 'copia temporaria');
    fs.writeFileSync(join(cache, 'temporario.txt'), 'cache');
    fs.writeFileSync(join(external, 'entrada.xlsx'), 'cadastro original');
    fs.writeFileSync(join(external, 'saida.csv'), 'csv exportado');
    class Directory {
      constructor(...parts) { this.uri = join(...parts.map(part => typeof part === 'string' ? part : part.uri)); }
      get exists() { return fs.existsSync(this.uri); }
      delete() { fs.rmSync(this.uri, { recursive: true }); }
      list() { return fs.readdirSync(this.uri).map(name => new Directory(this.uri, name)); }
    }
    const source = fs.readFileSync(join(__dirname, '../src/services/export.ts'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const result = { exports: {} };
    vm.runInNewContext(compiled, { exports: result.exports, require(name) {
      if (name === 'expo-file-system') return { Directory, Paths: { document, cache } };
      if (name === 'expo') return { requireOptionalNativeModule: () => null };
      if (name === 'expo-sharing') return {};
      if (name === '../core/model') return require(join(process.env.BC_TEST_BUILD, 'model.js'));
      throw new Error('Importação inesperada: ' + name);
    } });
    await result.exports.clearInternalCollectionFiles();
    await result.exports.clearInternalCollectionFiles();
    assert.equal(fs.existsSync(exported), false);
    assert.deepEqual(fs.readdirSync(cache), []);
    assert.equal(fs.readFileSync(join(database, 'app.db'), 'utf8'), 'banco em uso');
    assert.equal(fs.readFileSync(join(external, 'entrada.xlsx'), 'utf8'), 'cadastro original');
    assert.equal(fs.readFileSync(join(external, 'saida.csv'), 'utf8'), 'csv exportado');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
