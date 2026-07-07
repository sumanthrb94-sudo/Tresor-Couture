import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { defineConfig } from 'vite';

const sentryPlugin =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      })
    : null;

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(sentryPlugin ? [sentryPlugin] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify — file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  build: {
    target: 'es2020',
    sourcemap: Boolean(sentryPlugin),
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Pin large vendor libs into their own long-cached chunks so app
        // updates don't bust the runtime cache for unchanged dependencies.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/motion/') || id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase';
          return 'vendor';
        },
      },
    },
  },
});
