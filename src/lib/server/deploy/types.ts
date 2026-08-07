import type { HostProvider, PageTheme, PublishMode, StatusPageInfo } from '$lib/publishing';
import type { HostCredentials } from '$lib/server/host-credentials';

export type DeployFile = {
	path: string;
	content: Uint8Array | string;
	contentType?: string;
};

export type DeployInput = {
	files: DeployFile[];
	project: StatusPageInfo;
	mode: PublishMode;
	/** URL path base for path-mode deploys, e.g. /s/acme */
	basePath: string;
	/** Existing provider site/project id if known */
	providerId: string | null;
	/** Decrypted per-user host credentials */
	credentials: HostCredentials;
};

export type CustomDomainResult = {
	hostname: string;
	registered: boolean;
	verified: boolean;
	cnameTarget: string;
	/** Soft failure after a successful file deploy */
	warning?: string;
};

export type DeployResult = {
	url: string;
	providerId: string;
	customDomain?: CustomDomainResult;
};

export type DeployAdapter = {
	provider: HostProvider;
	deploy(input: DeployInput): Promise<DeployResult>;
};

export function textEncoder(content: string | Uint8Array): Uint8Array {
	if (typeof content === 'string') return new TextEncoder().encode(content);
	return content;
}

export function asString(content: string | Uint8Array): string {
	if (typeof content === 'string') return content;
	return new TextDecoder().decode(content);
}

export type { PageTheme };
