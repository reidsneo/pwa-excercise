import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
	plugins: [
		react(),
		cloudflare(),
		VitePWA({
			registerType: "autoUpdate",
			// Enable in development for testing
			devOptions: {
				enabled: true,
				type: "module",
			},
			includeAssets: ["vite.svg", "react.svg"],
			manifest: {
				name: "Vite React PWA",
				short_name: "VitePWA",
				description: "Vite + React + Hono + Cloudflare PWA",
				theme_color: "#646cff",
				background_color: "#ffffff",
				display: "standalone",
				icons: [
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,jpg}"],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "google-fonts-cache",
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
						handler: "CacheFirst",
						options: {
							cacheName: "image-cache",
							expiration: {
								maxEntries: 60,
								maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
							},
						},
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			// Shared types must come first as they're used by both frontend and backend
			"@/shared": path.resolve(__dirname, "./src/shared"),
			"@/shared/*": path.resolve(__dirname, "./src/shared/*"),
			"@/plugins": path.resolve(__dirname, "./src/react-app/plugins"),
			"@/plugins/*": path.resolve(__dirname, "./src/react-app/plugins/*"),
			"@/components": path.resolve(__dirname, "./src/react-app/components"),
			"@/components/*": path.resolve(__dirname, "./src/react-app/components/*"),
			"@/pages": path.resolve(__dirname, "./src/react-app/pages"),
			"@/pages/*": path.resolve(__dirname, "./src/react-app/pages/*"),
			"@/contexts": path.resolve(__dirname, "./src/react-app/contexts"),
			"@/contexts/*": path.resolve(__dirname, "./src/react-app/contexts/*"),
			"@/lib": path.resolve(__dirname, "./src/react-app/lib"),
			"@/lib/*": path.resolve(__dirname, "./src/react-app/lib/*"),
			"@/apps": path.resolve(__dirname, "./src/react-app/apps"),
			"@/apps/*": path.resolve(__dirname, "./src/react-app/apps/*"),
			"@/hooks": path.resolve(__dirname, "./src/react-app/hooks"),
			"@/hooks/*": path.resolve(__dirname, "./src/react-app/hooks/*"),
		},
	},
});
