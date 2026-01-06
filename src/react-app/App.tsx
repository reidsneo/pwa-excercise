// src/App.tsx

import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import cloudflareLogo from "./assets/Cloudflare_Logo.svg";
import honoLogo from "./assets/hono.svg";
import { useRegisterSW } from "virtual:pwa-register/react";
import "./App.css";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function App() {
	const [count, setCount] = useState(0);
	const [name, setName] = useState("unknown");
	const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	const [showInstallPrompt, setShowInstallPrompt] = useState(false);
	const [pwaDebugInfo, setPwaDebugInfo] = useState(() => {
		// Initialize state based on whether app is in standalone mode
		if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) {
			return "App is already installed and running in standalone mode.";
		}
		return "Waiting for install prompt event...";
	});

	// PWA install prompt handler
	useEffect(() => {
		// Don't set up listener if already in standalone mode
		if (window.matchMedia("(display-mode: standalone)").matches) {
			console.log("📱 App is running in standalone mode (already installed)");
			return;
		}

		const handler = (e: Event) => {
			console.log("🔔 beforeinstallprompt event fired!", e);
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
			setShowInstallPrompt(true);
			setPwaDebugInfo("Install prompt available! Event captured.");
		};

		window.addEventListener("beforeinstallprompt", handler);
		console.log("🎯 Listening for beforeinstallprompt event...");

		return () => {
			window.removeEventListener("beforeinstallprompt", handler);
		};
	}, []);

	// PWA registration
	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegistered(r: ServiceWorkerRegistration | undefined) {
			console.log("✅ SW Registered: " + r);
			if (r) {
				setPwaDebugInfo((prev) => prev + "\n✅ Service Worker registered!");
			}
		},
		onRegisterError(error: unknown) {
			console.log("❌ SW registration error", error);
			setPwaDebugInfo((prev) => prev + "\n❌ SW registration failed: " + error);
		},
	});

	const close = () => {
		setOfflineReady(false);
		setNeedRefresh(false);
		setShowInstallPrompt(false);
	};

	const handleInstallClick = async () => {
		if (!deferredPrompt) return;

		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		console.log(`User response: ${outcome}`);

		if (outcome === "accepted") {
			setDeferredPrompt(null);
			setShowInstallPrompt(false);
		}
	};

	return (
		<>
			{showInstallPrompt && (
				<div className="pwa-prompt">
					<div className="pwa-prompt-content">
						<span>Install this app on your device for a better experience.</span>
						<button
							className="pwa-prompt-button"
							onClick={handleInstallClick}
						>
							Install
						</button>
						<button className="pwa-prompt-button" onClick={close}>
							Dismiss
						</button>
					</div>
				</div>
			)}
			<div className="pwa-debug">
				<strong>PWA Debug Info:</strong>
				<pre style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>{pwaDebugInfo || "Loading PWA status..."}</pre>
				<div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
					<button
						className="pwa-prompt-button"
						onClick={() => {
							navigator.serviceWorker.getRegistration().then((reg) => {
								console.log("Service Worker registration:", reg);
								setPwaDebugInfo((prev) => prev + "\n🔍 SW Registration: " + JSON.stringify(reg, null, 2));
							}).catch((err) => {
								console.error("SW error:", err);
								setPwaDebugInfo((prev) => prev + "\n❌ SW Error: " + err);
							});
						}}
					>
						Check SW Status
					</button>
					<button
						className="pwa-prompt-button"
						onClick={() => {
							setShowInstallPrompt(true);
							setPwaDebugInfo((prev) => prev + "\n🎭 Simulated install prompt (for testing UI)");
						}}
					>
						Simulate Install Prompt
					</button>
				</div>
			</div>
			{needRefresh && (
				<div className="pwa-prompt">
					<div className="pwa-prompt-content">
						<span>New content available, click on reload button to update.</span>
						<button
							className="pwa-prompt-button"
							onClick={() => updateServiceWorker(true)}
						>
							Reload
						</button>
						<button className="pwa-prompt-button" onClick={close}>
							Close
						</button>
					</div>
				</div>
			)}
			{offlineReady && (
				<div className="pwa-prompt">
					<div className="pwa-prompt-content">
						<span>App ready to work offline</span>
						<button className="pwa-prompt-button" onClick={close}>
							Close
						</button>
					</div>
				</div>
			)}
			<div>
				<a href="https://vite.dev" target="_blank">
					<img src={viteLogo} className="logo" alt="Vite logo" />
				</a>
				<a href="https://react.dev" target="_blank">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
				<a href="https://hono.dev/" target="_blank">
					<img src={honoLogo} className="logo cloudflare" alt="Hono logo" />
				</a>
				<a href="https://workers.cloudflare.com/" target="_blank">
					<img
						src={cloudflareLogo}
						className="logo cloudflare"
						alt="Cloudflare logo"
					/>
				</a>
			</div>
			<h1>Vite + React + Hono + Cloudflare</h1>
			<div className="card">
				<button
					onClick={() => setCount((count) => count + 1)}
					aria-label="increment"
				>
					count is {count}
				</button>
				<p>
					Edit <code>src/App.tsx</code> and save to test HMR
				</p>
			</div>
			<div className="card">
				<button
					onClick={() => {
						fetch("/api/")
							.then((res) => res.json() as Promise<{ name: string }>)
							.then((data) => setName(data.name));
					}}
					aria-label="get name"
				>
					Name from API is: {name}
				</button>
				<p>
					Edit <code>worker/index.ts</code> to change the name
				</p>
			</div>
			<p className="read-the-docs">Click on the logos to learn more</p>
		</>
	);
}

export default App;
