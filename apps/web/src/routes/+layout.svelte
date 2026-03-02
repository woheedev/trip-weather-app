<script lang="ts">
	import { Toaster } from '$lib/components/ui/sonner';
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<!-- Default meta tags -->
	<meta
		name="description"
		content="Trip Weather App helps you plan trips around the weather with destination-focused forecasts."
	/>
	<meta
		name="keywords"
		content="trip weather, travel planning, weather forecasts, itinerary, trip planner"
	/>
	<meta name="robots" content="index, follow" />
</svelte:head>

<!-- Page content -->
<main class="flex-1">
	<ModeWatcher defaultMode="dark" />
	<Toaster position="top-center" />
	{@render children()}
</main>
