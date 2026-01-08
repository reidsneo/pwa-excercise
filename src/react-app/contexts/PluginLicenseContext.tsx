// =============================================================================
// PLUGIN LICENSE CONTEXT
// =============================================================================

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";

interface Tenant {
	id: string;
	name: string;
	slug: string;
	plan: string;
	status: string;
}

interface License {
	id: string;
	tenant_id: string;
	plugin_id: string;
	plan: string;
	status: string;
	features: string[];
	expires_at: number | null;
}

interface PluginLicenseContextType {
	tenant: Tenant | null;
	licenses: License[];
	isLoading: boolean;
	hasPluginLicense: (pluginId: string) => boolean;
	getPluginLicense: (pluginId: string) => License | null;
	hasPluginFeature: (pluginId: string, feature: string) => boolean;
	reloadLicenses: () => Promise<void>;
}

const PluginLicenseContext = createContext<PluginLicenseContextType | undefined>(undefined);

export function PluginLicenseProvider({ children }: { children: ReactNode }) {
	const [tenant, setTenant] = useState<Tenant | null>(null);
	const [licenses, setLicenses] = useState<License[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const hasFetchedRef = useRef(false);

	useEffect(() => {
		let isMounted = true;

		async function fetchLicenses() {
			const token = localStorage.getItem("auth_token");
			if (!token) {
				setTenant(null);
				setLicenses([]);
				setIsLoading(false);
				hasFetchedRef.current = false;
				return;
			}

			// Prevent double-fetch in React StrictMode
			if (hasFetchedRef.current) {
				return;
			}

			hasFetchedRef.current = true;

			try {
				const response = await fetch("/api/plugins/licenses", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (response.ok) {
					const data = await response.json();
					if (isMounted) {
						setTenant(data.tenant);
						setLicenses(data.licenses || []);
					}
				} else {
					// Token might be invalid, clear data
					if (isMounted) {
						setTenant(null);
						setLicenses([]);
					}
				}
			} catch (error) {
				console.error("Failed to fetch plugin licenses:", error);
				if (isMounted) {
					setTenant(null);
					setLicenses([]);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		fetchLicenses();

		return () => {
			isMounted = false;
		};
	}, []);

	const reloadLicenses = async () => {
		const token = localStorage.getItem("auth_token");
		if (!token) return;

		setIsLoading(true);
		try {
			const response = await fetch("/api/plugins/licenses", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setTenant(data.tenant);
				setLicenses(data.licenses || []);
			}
		} catch (error) {
			console.error("Failed to reload plugin licenses:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const hasPluginLicense = (pluginId: string): boolean => {
		const license = licenses.find((l) => l.plugin_id === pluginId);
		if (!license) return false;

		// Check if license is active
		if (license.status !== "active") return false;

		// Check if license has expired
		if (license.expires_at && license.expires_at < Date.now() / 1000) {
			return false;
		}

		return true;
	};

	const getPluginLicense = (pluginId: string): License | null => {
		return licenses.find((l) => l.plugin_id === pluginId) || null;
	};

	const hasPluginFeature = (pluginId: string, feature: string): boolean => {
		const license = getPluginLicense(pluginId);
		if (!license) return false;

		// Check if license is active and not expired
		if (license.status !== "active") return false;
		if (license.expires_at && license.expires_at < Date.now() / 1000) {
			return false;
		}

		// Check if feature is in the license's features array
		return license.features.includes(feature);
	};

	return (
		<PluginLicenseContext.Provider
			value={{
				tenant,
				licenses,
				isLoading,
				hasPluginLicense,
				getPluginLicense,
				hasPluginFeature,
				reloadLicenses,
			}}
		>
			{children}
		</PluginLicenseContext.Provider>
	);
}

export function usePluginLicenses() {
	const context = useContext(PluginLicenseContext);
	if (context === undefined) {
		throw new Error("usePluginLicenses must be used within a PluginLicenseProvider");
	}
	return context;
}
