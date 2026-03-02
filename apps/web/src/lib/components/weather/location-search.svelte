<script lang="ts">
	import { searchLocations, type GeocodingResult } from '$lib/api/open-meteo';
	import type { ItineraryLocation } from '$lib/types/weather';
	import { MapPin, Loader2 } from '@lucide/svelte/icons';
	import { Input } from '$lib/components/ui/input/index.js';

	let {
		placeholder = 'Search location',
		onSelect
	}: {
		placeholder?: string;
		onSelect: (loc: ItineraryLocation) => void;
	} = $props();

	let query = $state('');
	let results = $state<GeocodingResult[]>([]);
	let loading = $state(false);
	let showDropdown = $state(false);
	let inputEl: HTMLInputElement | null = $state(null);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			showDropdown = false;
			return;
		}
		showDropdown = true;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			loading = true;
			try {
				results = await searchLocations(q);
			} catch {
				results = [];
			} finally {
				loading = false;
			}
		}, 300);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	function select(r: GeocodingResult) {
		onSelect({
			lat: r.latitude,
			lon: r.longitude,
			name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
			timezone: r.timezone
		});
		query = '';
		showDropdown = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showDropdown = false;
			inputEl?.blur();
		}
	}
</script>

<div class="relative w-full">
	<div class="relative">
		<MapPin
			class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Input
			ref={inputEl}
			bind:value={query}
			{placeholder}
			class="pl-9"
			onkeydown={handleKeydown}
			onfocus={() => query.length >= 2 && (showDropdown = true)}
			onblur={() => setTimeout(() => (showDropdown = false), 150)}
		/>
		{#if loading}
			<Loader2
				class="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
			/>
		{/if}
	</div>
	{#if showDropdown && query.length >= 2}
		<div
			class="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md"
		>
			{#if loading}
				<div class="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
					<Loader2 class="size-4 animate-spin" />
					Searching...
				</div>
			{:else if results.length === 0}
				<div class="px-3 py-2 text-sm text-muted-foreground">No locations found.</div>
			{:else}
				{#each results as r (r.id)}
					{@const displayParts = (() => {
						return [r.name, r.admin1, r.country].filter(Boolean);
					})()}
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
						onclick={() => select(r)}
						onmousedown={(e) => e.preventDefault()}
					>
						<MapPin class="size-4 shrink-0 text-muted-foreground" />
						<span class="truncate">{displayParts.join(', ')}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
