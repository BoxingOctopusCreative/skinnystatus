<script lang="ts">
	import { untrack } from 'svelte';
	import { HTTP_AUTH_MODES, httpAuthModeLabel, type PublicCheckSettings } from '$lib/checks';

	let {
		checkTypes,
		dnsRecordTypes,
		initialType,
		settings,
		checkUrl = null,
		expectedStatus = 200
	}: {
		checkTypes: Array<{ type: string; label: string }>;
		dnsRecordTypes: readonly string[];
		initialType: string;
		settings: PublicCheckSettings | null;
		/** HTTP check URL (stored on the service, not in settings). */
		checkUrl?: string | null;
		/** HTTP expected status (stored on the service, not in settings). */
		expectedStatus?: number | null;
	} = $props();

	// Seed local form state once from props (intentional snapshot).
	let checkType = $state(untrack(() => initialType));

	function initialAuthenticated(): boolean {
		if (!settings || settings.type !== initialType) return false;
		if (settings.type === 'postgres' || settings.type === 'mysql' || settings.type === 'redis') {
			return settings.authenticated;
		}
		return false;
	}

	let authenticated = $state(untrack(() => initialAuthenticated()));

	function initialHttpAuth(): string {
		if (!settings || settings.type !== 'http' || initialType !== 'http') return 'none';
		return settings.auth;
	}

	let httpAuthMode = $state(untrack(() => initialHttpAuth()));

	function onCheckTypeChange(event: Event) {
		const next = (event.currentTarget as HTMLSelectElement).value;
		checkType = next;
		if (
			settings &&
			settings.type === next &&
			(settings.type === 'postgres' || settings.type === 'mysql' || settings.type === 'redis')
		) {
			authenticated = settings.authenticated;
		} else {
			authenticated = false;
		}
		httpAuthMode = settings?.type === 'http' && next === 'http' ? settings.auth : 'none';
	}

	const tcp = $derived(settings?.type === 'tcp' && checkType === 'tcp' ? settings : null);
	const dns = $derived(settings?.type === 'dns' && checkType === 'dns' ? settings : null);
	const ssl = $derived(settings?.type === 'ssl' && checkType === 'ssl' ? settings : null);
	const db = $derived(
		settings &&
			(settings.type === 'postgres' || settings.type === 'mysql') &&
			checkType === settings.type
			? settings
			: null
	);
	const redis = $derived(settings?.type === 'redis' && checkType === 'redis' ? settings : null);
	const http = $derived(settings?.type === 'http' && checkType === 'http' ? settings : null);
	/** Only offer to keep the stored secret when it belongs to the selected method. */
	const keepsCredential = $derived(Boolean(http?.hasCredential) && http?.auth === httpAuthMode);
</script>

<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
	<label class="label">
		<span class="label-text">Check type</span>
		<select class="select" name="checkType" value={checkType} onchange={onCheckTypeChange}>
			<option value="">None</option>
			{#each checkTypes as ct (ct.type)}
				<option value={ct.type}>{ct.label}</option>
			{/each}
		</select>
	</label>

	{#if checkType === 'http'}
		<label class="label">
			<span class="label-text">Check URL</span>
			<input
				class="input"
				name="checkUrl"
				type="url"
				placeholder="https://example.com/health"
				value={checkUrl ?? ''}
			/>
		</label>
		<label class="label">
			<span class="label-text">Expected status</span>
			<input class="input" name="expectedStatus" type="number" value={expectedStatus ?? 200} />
		</label>
		<label class="label">
			<span class="label-text">Authentication</span>
			<select class="select" name="httpAuthMode" bind:value={httpAuthMode}>
				{#each HTTP_AUTH_MODES as mode (mode)}
					<option value={mode}>{httpAuthModeLabel(mode)}</option>
				{/each}
			</select>
		</label>
		{#if httpAuthMode === 'bearer'}
			<label class="label">
				<span class="label-text">Token</span>
				<input
					class="input"
					name="httpAuthToken"
					type="password"
					value=""
					placeholder={keepsCredential ? 'Leave blank to keep existing' : ''}
					required={!keepsCredential}
					autocomplete="new-password"
				/>
				<span class="text-surface-500 text-xs">Sent as <code>Authorization: Bearer ...</code></span>
			</label>
		{:else if httpAuthMode === 'basic'}
			<label class="label">
				<span class="label-text">Username</span>
				<input class="input" name="httpAuthUsername" value={http?.username ?? ''} required />
			</label>
			<label class="label">
				<span class="label-text">Password</span>
				<input
					class="input"
					name="httpAuthPassword"
					type="password"
					value=""
					placeholder={keepsCredential ? 'Leave blank to keep existing' : ''}
					required={!keepsCredential}
					autocomplete="new-password"
				/>
			</label>
		{:else if httpAuthMode === 'header'}
			<label class="label">
				<span class="label-text">Header name</span>
				<input
					class="input"
					name="httpAuthHeaderName"
					value={http?.headerName ?? ''}
					placeholder="X-API-Key"
					required
				/>
			</label>
			<label class="label">
				<span class="label-text">Header value</span>
				<input
					class="input"
					name="httpAuthHeaderValue"
					type="password"
					value=""
					placeholder={keepsCredential ? 'Leave blank to keep existing' : ''}
					required={!keepsCredential}
					autocomplete="new-password"
				/>
			</label>
		{/if}
	{:else if checkType === 'tcp'}
		<label class="label">
			<span class="label-text">Host</span>
			<input class="input" name="host" value={tcp?.host ?? ''} required />
		</label>
		<label class="label">
			<span class="label-text">Port</span>
			<input class="input" name="port" type="number" value={tcp?.port ?? 80} />
		</label>
	{:else if checkType === 'dns'}
		<label class="label">
			<span class="label-text">Hostname</span>
			<input class="input" name="hostname" value={dns?.hostname ?? ''} required />
		</label>
		<label class="label">
			<span class="label-text">Record type</span>
			<select class="select" name="recordType">
				{#each dnsRecordTypes as rt (rt)}
					<option value={rt} selected={dns ? dns.recordType === rt : rt === 'A'}>{rt}</option>
				{/each}
			</select>
		</label>
		<label class="label">
			<span class="label-text">Expected</span>
			<input
				class="input"
				name="expected"
				placeholder="optional comma-separated"
				value={dns?.expected ?? ''}
			/>
		</label>
	{:else if checkType === 'ssl'}
		<label class="label">
			<span class="label-text">Host</span>
			<input class="input" name="host" value={ssl?.host ?? ''} required />
		</label>
		<label class="label">
			<span class="label-text">Port</span>
			<input class="input" name="port" type="number" value={ssl?.port ?? 443} />
		</label>
		<label class="label">
			<span class="label-text">Min days remaining</span>
			<input
				class="input"
				name="minDaysRemaining"
				type="number"
				value={ssl?.minDaysRemaining ?? 14}
			/>
		</label>
	{:else if checkType === 'postgres' || checkType === 'mysql'}
		<label class="label">
			<span class="label-text">Host</span>
			<input class="input" name="host" value={db?.host ?? ''} required />
		</label>
		<label class="label">
			<span class="label-text">Port</span>
			<input
				class="input"
				name="port"
				type="number"
				value={db?.port ?? (checkType === 'postgres' ? 5432 : 3306)}
			/>
		</label>
		<label class="label flex flex-row items-center gap-2 self-end pb-2">
			<input class="checkbox" type="checkbox" name="authenticated" bind:checked={authenticated} />
			<span class="label-text">Authenticated</span>
		</label>
		{#if authenticated}
			<label class="label">
				<span class="label-text">Database</span>
				<input class="input" name="database" value={db?.database ?? ''} />
			</label>
			<label class="label">
				<span class="label-text">User</span>
				<input class="input" name="user" value={db?.user ?? ''} required />
			</label>
			<label class="label">
				<span class="label-text">Password</span>
				<input
					class="input"
					name="password"
					type="password"
					value=""
					placeholder={db?.hasPassword ? 'Leave blank to keep existing' : ''}
					required={!db?.hasPassword}
					autocomplete="new-password"
				/>
			</label>
			<label class="label flex flex-row items-center gap-2 self-end pb-2">
				<input class="checkbox" type="checkbox" name="ssl" checked={db?.ssl ?? false} />
				<span class="label-text">SSL</span>
			</label>
		{/if}
	{:else if checkType === 'redis'}
		<label class="label">
			<span class="label-text">Host</span>
			<input class="input" name="host" value={redis?.host ?? ''} required />
		</label>
		<label class="label">
			<span class="label-text">Port</span>
			<input class="input" name="port" type="number" value={redis?.port ?? 6379} />
		</label>
		<label class="label flex flex-row items-center gap-2 self-end pb-2">
			<input class="checkbox" type="checkbox" name="authenticated" bind:checked={authenticated} />
			<span class="label-text">Authenticated</span>
		</label>
		{#if authenticated}
			<label class="label">
				<span class="label-text">Username</span>
				<input class="input" name="username" value={redis?.username ?? ''} />
			</label>
			<label class="label">
				<span class="label-text">Password</span>
				<input
					class="input"
					name="password"
					type="password"
					value=""
					placeholder={redis?.hasPassword ? 'Leave blank to keep existing' : ''}
					required={!redis?.hasPassword}
					autocomplete="new-password"
				/>
			</label>
		{/if}
	{/if}
</div>
