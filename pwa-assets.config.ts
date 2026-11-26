import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.1, resizeOptions: { background: '#0f766e' } },
    apple: { ...preset.apple, padding: 0.05, resizeOptions: { background: '#0f766e' } },
  },
  images: ['public/favicon.svg'],
});
