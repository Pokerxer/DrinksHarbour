import {defineConfig} from 'vitest/config';
import path from 'node:path';
export default defineConfig({esbuild:{jsx:'automatic'},test:{environment:'jsdom',setupFiles:['./vitest.banner.setup.ts'],maxWorkers:1,include:['src/components/Banner/*.test.tsx']},resolve:{alias:{'@':path.resolve(__dirname,'src')}}});
