import { build } from 'esbuild';
await build({entryPoints:['src/cli/main.ts'],outfile:'dist/cli.js',bundle:true,platform:'node',format:'esm',packages:'external',target:'node22',sourcemap:true});
