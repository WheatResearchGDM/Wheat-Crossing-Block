// GitHub preview uses its own app identity and local data directory.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'github') return config;
  return {
    ...config,
    name: 'Registro de BC (GitHub)',
    scheme: 'registrobcgithub',
    android: { ...config.android, package: 'com.wheatresearchgdm.crossingblock.github' },
  };
};
