const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { collectionLayout } = require(join(process.env.BC_TEST_BUILD, 'screen-layout.js'));

test('até quatro linhas de cada finalidade cabem na área segura de tablets e celulares', () => {
  for (const [width,height] of [[320,568],[360,640],[412,800],[600,900],[800,1200],[1100,760],[760,360]]) {
    for(let emasc=1;emasc<=4;emasc++) for(let poli=1;poli<=4;poli++) {
      const m=collectionLayout(width,height,{ EMASC:emasc,POLI:poli });
      const group=n=>m.heading+m.labels+(n+2)*m.gap+n*m.rowHeight+1;
      const groups=m.horizontal?Math.max(group(emasc),group(poli)):group(emasc)+group(poli)+m.gap;
      const used=m.top+m.bucket+m.priority+m.footer+m.status+groups+4;
      assert.ok(used<=height, `${width}x${height}, ${emasc}/${poli}: ocupa ${used}`);
      const column=((m.horizontal?(width-20-m.gap)/2:width-20)-12)/3;
      assert.ok(column>=44+20, `colunas sem espaço para número e setas: ${column}`);
    }
  }
});
