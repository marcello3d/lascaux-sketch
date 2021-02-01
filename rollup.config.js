import postcss from 'rollup-plugin-postcss';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import ignore from 'rollup-plugin-ignore';
import replace from '@rollup/plugin-replace';
import sourcemaps from 'rollup-plugin-sourcemaps';

export default {
  input: 'src/oekaki/bundle.tsx',
  output: [
    {
      file: 'dist/lascaux2.js',
      format: 'iife',
    },
    {
      file: 'dist/lascaux2.min.js',
      sourcemap: true,
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
    sourcemaps(),
    ignore(['crypto', 'cluster']),
    commonjs(),
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': JSON.stringify({}),
    }),
    nodeResolve({ browser: true }),
  ],
};
