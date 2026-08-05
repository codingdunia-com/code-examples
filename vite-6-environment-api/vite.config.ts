// From: https://codingdunia.com/blog/vite-6-environment-api-guide/
// Verified against Vite 6.4.3 / Node 22.23.2 with npx vite build --app
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    environments: {
          client: {
                  build: {
                            outDir: 'dist/client',
                            rollupOptions: { input: './src/entry-client.tsx' },
                  },
          },
          ssr: {
                  build: {
                            outDir: 'dist/server',
                            rollupOptions: { input: './src/entry-server.tsx' },
                            ssr: true,
                  },
                  resolve: {
                            conditions: ['node'],
                  },
          },
          edge: {
                  build: {
                            outDir: 'dist/edge',
                            rollupOptions: { input: './src/entry-edge.tsx' },
                  },
                  resolve: {
                            conditions: ['worker', 'browser'],
                            noExternal: true,
                  },
          },
    },
    plugins: [react()],
});
