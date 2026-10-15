// One webpack 5 production build over the generated project, with the loader chosen by
// the LOADER environment variable (babel | swc). Everything except the loader rule is
// identical between the two: same entry, cache disabled, React kept external.
//
// bench.mjs passes the project and output directories through the environment.

import { join } from 'node:path';

const loaderName = process.env.LOADER;
const projectDir = process.env.PROJECT_DIR;
const outDir = process.env.OUT_DIR;

if (!['babel', 'swc'].includes(loaderName) || !projectDir || !outDir) {
  throw new Error('Set LOADER=babel|swc, PROJECT_DIR and OUT_DIR. bench.mjs does this for you.');
}

const loaders = {
  babel: {
    loader: 'babel-loader',
    options: {
      babelrc: false,
      configFile: false,
      presets: [
        ['@babel/preset-env', { targets: { chrome: '120' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
    },
  },
  swc: {
    loader: 'swc-loader',
    options: {
      swcrc: false,
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
        target: 'es2022',
      },
    },
  },
};

export default {
  mode: 'production',
  context: projectDir,
  entry: join(projectDir, 'index.js'),
  cache: false,
  devtool: false,
  output: { path: outDir, filename: 'main.js' },
  // React stays external for both loaders. babel-loader emits react/jsx-dev-runtime
  // here (NODE_ENV is unset, so Babel's env name is "development"), swc-loader emits
  // react/jsx-runtime, so both imports are listed.
  externalsType: 'commonjs',
  externals: {
    react: 'react',
    'react/jsx-runtime': 'react/jsx-runtime',
    'react/jsx-dev-runtime': 'react/jsx-dev-runtime',
  },
  resolve: { extensions: ['.tsx', '.js'] },
  resolveLoader: { modules: [join(import.meta.dirname, 'node_modules')] },
  module: {
    rules: [{ test: /\.tsx$/, exclude: /node_modules/, use: loaders[loaderName] }],
  },
  performance: { hints: false },
  stats: 'errors-warnings',
};
