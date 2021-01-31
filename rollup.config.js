import postcss from 'rollup-plugin-postcss';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import ignore from 'rollup-plugin-ignore';
import injectProcessEnv from 'rollup-plugin-inject-process-env';

export default {
  input: 'src/oekaki/bundle.tsx',
  output: [
    {
      file: 'dist/lascaux2.js',
      format: 'iife',
    },
    {
      file: 'dist/lascaux2.min.js',
      format: 'iife',
      plugins: [terser()],
    },
  ],
  plugins: [
    postcss({
      extract: true,
      minimize: true,
    }),
    typescript({
      target: 'es2018',
      jsx: 'react',
    }),
    ignore(['crypto', 'cluster']),
    commonjs(),
    injectProcessEnv({
      NODE_ENV: 'production',
    }),
    nodeResolve({ browser: true }),
  ],
};
