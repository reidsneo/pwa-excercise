import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  images: ['public/vite.svg'],
  preset: {
    transparent: {
      sizes: [192, 512],
      favicons: [[32, 'favicon-32x32.png'], [16, 'favicon-16x16.png']],
    },
    maskable: {
      sizes: [512],
    },
    apple: {
      sizes: [180],
    },
  },
})
