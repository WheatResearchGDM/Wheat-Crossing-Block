const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { collectionLayout } = require(join(process.env.BC_TEST_BUILD, 'screen-layout.js'));

test('duas linhas fixas ocupam a área segura com cabeçalho vertical, sem rolagem', () => {
  for(const [width,height] of [[320,568],[360,640],[412,800],[600,900],[800,1200],[1100,760],[760,360]]) {
    const m=collectionLayout(width,height);
    const section=m.heading+m.labels+4*m.gap+2*m.rowHeight+1;
    const groups=m.horizontal?section:section*2+m.groupGap;
    const used=m.header+m.footer+m.status+groups+4;
    assert.ok(used<=height, `${width}x${height}: ocupa ${used}`);
    assert.ok(height-used<5, `espaço útil desperdiçado: ${height-used}`);
    assert.ok(m.rowHeight>=44, `linha muito baixa: ${m.rowHeight}`);
    assert.ok(m.header>=3*m.topButton);
    assert.ok(m.priority>=30);
    const column=((m.horizontal?(width-20-m.groupGap)/2:width-20)-12)/3;
    assert.ok(column>=64);
  }
  assert.ok(collectionLayout(800,1200).rowHeight>100);
});
