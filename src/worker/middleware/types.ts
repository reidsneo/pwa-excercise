import type { Tenant, License } from './tenant';

export type Variables = {
	tenant: Tenant | null;
	tenantId: string | null;
	licenses: License[];
	licensedPlugins: Set<string>;
};
