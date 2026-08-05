<script lang="ts">
	import StatusBoard from '$lib/components/StatusBoard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<StatusBoard {data} />
