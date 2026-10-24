const { test } = require('node:test');
const assert = require('node:assert/strict');
const config = require('../app.config.js');
test('variante GitHub tem identidade separada e conserva configuracao de coleta', () => {
  const original = process.env.APP_VARIANT;
  try {
    const base = { name: 'Registro de BC', scheme: 'registrobc', android: { package: 'com.wheatresearchgdm.crossingblock' }, plugins: ['expo-sqlite'] };
    delete process.env.APP_VARIANT;
    assert.deepEqual(config({ config: base }), base);
    process.env.APP_VARIANT = 'github';
    const result = config({ config: base });
    assert.equal(result.android.package, 'com.wheatresearchgdm.crossingblock.github');
    assert.equal(result.scheme, 'registrobcgithub');
    assert.deepEqual(result.plugins, base.plugins);
    assert.equal(base.android.package, 'com.wheatresearchgdm.crossingblock');
  } finally { if (original === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = original; }
});
