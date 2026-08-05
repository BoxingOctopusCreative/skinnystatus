<script lang="ts">
	import IncidentDetail from '$lib/components/IncidentDetail.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<IncidentDetail {data} />
