import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AppRouter from "./AppRouter";
import { ThemeProvider } from "./contexts/ThemeProvider";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
			<AppRouter />
		</ThemeProvider>
	</StrictMode>,
);
