/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: `${__dirname}/.env` });

const ASSET_URL = (process.env.ASSET_URL && process.env.APP_ENV === 'local') ? process.env.ASSET_URL : '/J4a-website/';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
  },
  base: `${ASSET_URL}`,
});
