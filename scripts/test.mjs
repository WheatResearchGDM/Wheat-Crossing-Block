import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const build = mkdtempSync(join(tmpdir(), 'bc-tests-'));
try {
  for (const file of readdirSync('src/core').filter(f => f.endsWith('.ts'))) {
    const source = readFileSync(join('src/core', file), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
    writeFileSync(join(build, file.replace('.ts', '.js')), output.outputText);
  }
  const tests = readdirSync('tests').filter(f => f.endsWith('.test.cjs')).map(f => join('tests', f));
  const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit', env: { ...process.env, BC_TEST_BUILD: build, NODE_PATH: join(process.cwd(), 'node_modules') } });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(build, { recursive: true, force: true });
}
