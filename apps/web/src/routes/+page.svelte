<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity -- Date/Map/Set used in local computations, not as reactive state */
	/* eslint-disable svelte/no-navigation-without-resolve -- replaceState used for hash-based state, not page navigation */
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import SeoHead from '$lib/components/seo-head.svelte';
	import LocationSearch from '$lib/components/weather/location-search.svelte';
	import TripOverviewChart from '$lib/components/weather/trip-overview-chart.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import DateRangePicker from '$lib/components/weather/date-range-picker.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { toggleMode } from 'mode-watcher';
	import {
		encodeItinerary,
		getItineraryFromUrl,
		buildShareUrl,
		getRecentItineraries,
		saveRecentItinerary,
		clearRecentItineraries
	} from '$lib/utils/itinerary-url';
	import { showToast } from '$lib/utils/toast';
	import { fetchForecast } from '$lib/api/open-meteo';
	import type {
		Itinerary,
		ItineraryEntry,
		ItineraryLocation,
		OpenMeteoForecast
	} from '$lib/types/weather';
	import {
		Trash2,
		Share2,
		Sun,
		Moon,
		MapPin,
		Thermometer,
		Wind,
		CloudRain,
		Loader2,
		Calendar,
		Droplets,
		History
	} from '@lucide/svelte/icons';

	const canonicalUrl = `${page.url.origin}${page.url.pathname}`;

	const TODAY = new Date().toISOString().slice(0, 10);
	const MAX_FORECAST_DAYS = 16;

	function daysFromToday(dateStr: string): number {
		const d = new Date(dateStr);
		const t = new Date(TODAY);
		return Math.floor((d.getTime() - t.getTime()) / 86400000);
	}

	function isWithinForecast(dateStr: string): boolean {
		const days = daysFromToday(dateStr);
		return days >= 0 && days < MAX_FORECAST_DAYS;
	}

	function getDatesInRange(start: string, end: string): string[] {
		const dates: string[] = [];
		const d = new Date(start);
		const endD = new Date(end);
		while (d <= endD) {
			dates.push(d.toISOString().slice(0, 10));
			d.setDate(d.getDate() + 1);
		}
		return dates;
	}

	function formatDateLabel(dateStr: string): string {
		const d = new Date(`${dateStr}T00:00:00`);
		if (Number.isNaN(d.getTime())) return dateStr;
		return d.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function clampToForecastRange(start: string, end: string): { start: string; end: string } | null {
		const min = TODAY;
		const maxDate = new Date(TODAY);
		maxDate.setDate(maxDate.getDate() + MAX_FORECAST_DAYS - 1);
		const max = maxDate.toISOString().slice(0, 10);

		let s = start < min ? min : start;
		let e = end > max ? max : end;

		if (e < min || s > max || s > e) return null;
		return { start: s, end: e };
	}

	type UnitsMode = 'imperial' | 'metric';
	type TimeFormat = '12h' | '24h';

	let itinerary = $state<Itinerary>({ entries: [] });
	let loading = $state<Record<string, boolean>>({});
	let forecasts = $state<Record<string, OpenMeteoForecast>>({});
	let filterTemp = $state(true);
	let filterFeelsLike = $state(true);
	let filterPrecip = $state(true);
	let filterWind = $state(true);
	let filterHumidity = $state(true);
	let tempUnits = $state<UnitsMode>('imperial');
	let windUnits = $state<UnitsMode>('imperial');
	let precipUnits = $state<UnitsMode>('imperial');
	let timeFormat = $state<TimeFormat>('12h');
	let recentItineraries = $state<Itinerary[]>([]);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const fromUrl = getItineraryFromUrl();
		if (fromUrl && fromUrl.entries.length > 0) {
			itinerary = fromUrl;
		}
		recentItineraries = getRecentItineraries();
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (itinerary.entries.length === 0) return;
		saveRecentItinerary(itinerary);
		const encoded = encodeItinerary(itinerary);
		const hash = `#${encoded}`;
		if (window.location.hash !== hash) {
			replaceState(hash, {});
		}
	});

	$effect(() => {
		const byKey: Record<string, { loc: ItineraryLocation; start: string; end: string }> = {};
		for (const entry of itinerary.entries) {
			if (!entry.startDate || !entry.endDate) continue;
			const key = `${entry.location.lat.toFixed(4)},${entry.location.lon.toFixed(4)}`;
			const existing = byKey[key];
			if (!existing) {
				byKey[key] = { loc: entry.location, start: entry.startDate, end: entry.endDate };
			} else {
				const start = entry.startDate < existing.start ? entry.startDate : existing.start;
				const end = entry.endDate > existing.end ? entry.endDate : existing.end;
				byKey[key] = { ...existing, start, end };
			}
		}
		for (const [key, { loc, start, end }] of Object.entries(byKey)) {
			const clamped = clampToForecastRange(start, end);
			if (!clamped) continue;
			const { start: fetchStart, end: fetchEnd } = clamped;
			const fc = forecasts[key];
			const rangeMatch =
				fc &&
				(fc as OpenMeteoForecast & { _start?: string; _end?: string })._start === fetchStart &&
				(fc as OpenMeteoForecast & { _start?: string; _end?: string })._end === fetchEnd;
			if (rangeMatch) continue;
			loading[key] = true;
			const days =
				Math.ceil((new Date(fetchEnd).getTime() - new Date(fetchStart).getTime()) / 86400000) + 1;
			fetchForecast(loc.lat, loc.lon, {
				timezone: loc.timezone ?? 'auto',
				forecastDays: Math.min(days, 16),
				startDate: fetchStart,
				endDate: fetchEnd
			})
				.then((r) => r.json())
				.then((data) => {
					(data as OpenMeteoForecast & { _start?: string; _end?: string })._start = fetchStart;
					(data as OpenMeteoForecast & { _start?: string; _end?: string })._end = fetchEnd;
					forecasts = { ...forecasts, [key]: data };
				})
				.catch(() => {})
				.finally(() => {
					loading = { ...loading, [key]: false };
				});
		}
	});

	function addEntry(loc: ItineraryLocation) {
		itinerary = {
			entries: [...itinerary.entries, { location: loc, startDate: '', endDate: '' }]
		};
	}

	function removeEntry(entry: ItineraryEntry) {
		itinerary = { entries: itinerary.entries.filter((e) => e !== entry) };
	}

	function loadRecent(r: Itinerary) {
		itinerary = r;
	}

	function clearRecent() {
		clearRecentItineraries();
		recentItineraries = [];
	}

	function goHome() {
		itinerary = { entries: [] };
		recentItineraries = getRecentItineraries();
		replaceState(window.location.pathname, {});
	}

	async function share() {
		if (itinerary.entries.length === 0) {
			showToast.warning('Add locations and date ranges first');
			return;
		}
		const url = buildShareUrl(itinerary);
		await navigator.clipboard.writeText(url);
		showToast.success('Link copied to clipboard');
	}

	function getForecast(loc: ItineraryLocation): OpenMeteoForecast | null {
		const key = `${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}`;
		return forecasts[key] ?? null;
	}

	function getDailyForDate(fc: OpenMeteoForecast, dateStr: string) {
		if (!fc?.daily?.time) return null;
		const i = fc.daily.time.indexOf(dateStr);
		if (i < 0) return null;
		let humidity: number | undefined;
		if (fc.hourly?.relative_humidity_2m && fc.hourly?.time) {
			const start = `${dateStr}T00:00`;
			const end = `${dateStr}T23:00`;
			const vals: number[] = [];
			for (let j = 0; j < fc.hourly.time.length; j++) {
				const t = fc.hourly.time[j];
				if (t >= start && t <= end) vals.push(fc.hourly.relative_humidity_2m[j]);
			}
			if (vals.length) humidity = vals.reduce((a, b) => a + b, 0) / vals.length;
		}
		const sunrise = fc.daily.sunrise?.[i];
		const sunset = fc.daily.sunset?.[i];
		return {
			max: fc.daily.temperature_2m_max[i],
			min: fc.daily.temperature_2m_min[i],
			precip: fc.daily.precipitation_sum[i],
			precipChance: fc.daily.precipitation_probability_max?.[i],
			feelsMax: fc.daily.apparent_temperature_max?.[i],
			feelsMin: fc.daily.apparent_temperature_min?.[i],
			wind: fc.daily.wind_speed_10m_max?.[i],
			windDir: fc.daily.wind_direction_10m_dominant?.[i],
			gusts: fc.daily.wind_gusts_10m_max?.[i],
			sunrise,
			sunset,
			humidity
		};
	}

	function getHourlyForDate(fc: OpenMeteoForecast, dateStr: string) {
		if (!fc?.hourly?.time) return [];
		const start = `${dateStr}T00:00`;
		const end = `${dateStr}T23:00`;
		const result: {
			time: string;
			temp: number;
			feels?: number;
			humidity?: number;
			precip?: number;
			precipChance?: number;
			wind?: number;
			gusts?: number;
		}[] = [];
		for (let i = 0; i < fc.hourly.time.length; i++) {
			const t = fc.hourly.time[i];
			if (t >= start && t <= end) {
				result.push({
					time: t,
					temp: fc.hourly.temperature_2m[i],
					feels: fc.hourly.apparent_temperature?.[i],
					humidity: fc.hourly.relative_humidity_2m?.[i],
					precip: fc.hourly.precipitation?.[i],
					precipChance: fc.hourly.precipitation_probability?.[i],
					wind: fc.hourly.wind_speed_10m?.[i],
					gusts: fc.hourly.wind_gusts_10m?.[i]
				});
			}
		}
		return result;
	}

	type ChartMetric = 'temp' | 'feels' | 'humidity' | 'precip' | 'precipChance' | 'wind' | 'gusts';
	let tripOverviewMetric = $state<ChartMetric>('temp');
	let dailyChartMetric = $state<ChartMetric>('temp');

	const LOCATION_COLORS = [
		'var(--chart-1)',
		'var(--chart-2)',
		'var(--chart-3)',
		'var(--chart-4)',
		'var(--chart-5)'
	];

	const sortedEntries = $derived.by(() =>
		[...itinerary.entries].sort((a, b) => {
			const aStart = a.startDate || '9999-12-31';
			const bStart = b.startDate || '9999-12-31';
			if (aStart !== bStart) return aStart.localeCompare(bStart);
			const aEnd = a.endDate || aStart;
			const bEnd = b.endDate || bStart;
			return aEnd.localeCompare(bEnd);
		})
	);

	function getMetricValue(
		h: {
			temp: number;
			feels?: number;
			humidity?: number;
			precip?: number;
			precipChance?: number;
			wind?: number;
			gusts?: number;
		},
		metric: ChartMetric,
		units: { temp: UnitsMode; wind: UnitsMode; precip: UnitsMode }
	): number | null {
		switch (metric) {
			case 'temp':
				return toDisplayTemp(h.temp, units.temp) ?? h.temp;
			case 'feels':
				return h.feels != null ? (toDisplayTemp(h.feels, units.temp) ?? h.feels) : null;
			case 'humidity':
				return h.humidity ?? null;
			case 'precip':
				return h.precip != null ? formatPrecip(h.precip, units.precip).value : null;
			case 'precipChance':
				return h.precipChance ?? null;
			case 'wind':
				return h.wind != null ? (toDisplayWind(h.wind, units.wind) ?? h.wind) : null;
			case 'gusts':
				return h.gusts != null ? (toDisplayWind(h.gusts, units.wind) ?? h.gusts) : null;
			default:
				return null;
		}
	}

	function getMetricFormatter(metric: ChartMetric): (v: number) => string {
		switch (metric) {
			case 'temp':
			case 'feels':
				return (v) => `${Math.round(v)}°`;
			case 'humidity':
			case 'precipChance':
				return (v) => `${Math.round(v)}%`;
			case 'precip':
				return (v) => `${v.toFixed(2)} ${precipUnits === 'imperial' ? 'in' : 'cm'}`;
			case 'wind':
			case 'gusts':
				return (v) => `${Math.round(v)} ${windUnits === 'imperial' ? 'mph' : 'km/h'}`;
			default:
				return (v) => `${Math.round(v)}`;
		}
	}

	function toDisplayTemp(c: number | null | undefined, mode: UnitsMode): number | null {
		if (c == null) return null;
		return mode === 'imperial' ? (c * 9) / 5 + 32 : c;
	}

	function toDisplayWind(kmh: number | null | undefined, mode: UnitsMode): number | null {
		if (kmh == null) return null;
		return mode === 'imperial' ? kmh * 0.621371 : kmh;
	}

	function formatPrecip(mm: number, mode: UnitsMode): { value: number; unit: string } {
		if (mode === 'imperial') {
			return { value: mm / 25.4, unit: 'in' };
		}
		return { value: mm / 10, unit: 'cm' };
	}

	function formatWindDirection(deg: number | null | undefined): string {
		if (deg == null) return '—';
		const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
		const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
		return cardinals[i];
	}

	function formatTimeOfDay(time: string | undefined, hour12: boolean): string {
		if (!time) return '—';
		const d = new Date(time);
		return d.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12
		});
	}

	let tripOverviewData = $derived.by(() => {
		const entries = itinerary.entries.filter((e) => e.startDate && e.endDate);
		if (entries.length === 0) return [];

		const byLoc = new Map<
			string,
			{ points: { time: string; value: number }[]; minTime: string; maxTime: string }
		>();
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const fc = getForecast(entry.location);
			if (!fc?.hourly?.time) continue;
			const locKey = `loc_${i}`;
			const points: { time: string; value: number }[] = [];
			const dates = getDatesInRange(entry.startDate, entry.endDate);
			for (const dateStr of dates) {
				if (!isWithinForecast(dateStr)) continue;
				const hourly = getHourlyForDate(fc, dateStr);
				for (const h of hourly) {
					const v = getMetricValue(h, tripOverviewMetric, {
						temp: tempUnits,
						wind: windUnits,
						precip: precipUnits
					});
					if (v != null) points.push({ time: h.time, value: v });
				}
			}
			if (points.length) {
				const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
				byLoc.set(locKey, {
					points: sorted,
					minTime: sorted[0].time,
					maxTime: sorted[sorted.length - 1].time
				});
			}
		}

		if (byLoc.size === 0) return [];

		const allTimes = new Set<string>();
		for (const { points } of byLoc.values()) {
			for (const p of points) allTimes.add(p.time);
		}
		const sortedTimes = [...allTimes].sort();

		return sortedTimes.map((time) => {
			const out = { date: new Date(time) } as { date: Date } & Record<string, number>;
			const t = new Date(time).getTime();
			for (const [locKey, { points, minTime, maxTime }] of byLoc) {
				if (time < minTime || time > maxTime) continue;
				const exact = points.find((p) => p.time === time);
				if (exact) {
					out[locKey] = exact.value;
				} else {
					const closest = points.reduce((a, b) =>
						Math.abs(new Date(a.time).getTime() - t) < Math.abs(new Date(b.time).getTime() - t)
							? a
							: b
					);
					out[locKey] = closest.value;
				}
			}
			return out;
		});
	});

	let tripOverviewSeries = $derived.by(() => {
		const entries = itinerary.entries.filter((e) => e.startDate && e.endDate);
		const series: { key: string; label: string; color: string }[] = [];
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const fc = getForecast(entry.location);
			if (!fc?.hourly?.time) continue;
			const locKey = `loc_${i}`;
			const locName =
				entry.location.name ?? `${entry.location.lat.toFixed(1)},${entry.location.lon.toFixed(1)}`;
			series.push({
				key: locKey,
				label: locName,
				color: LOCATION_COLORS[series.length % LOCATION_COLORS.length]
			});
		}
		return series;
	});
</script>

<SeoHead
	title="Trip Weather App"
	description="Plan your trip with weather forecasts"
	{canonicalUrl}
/>

<div class="min-h-screen bg-background">
	<header
		class="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60"
	>
		<a href="/" class="text-lg font-semibold" onclick={goHome}>Trip Weather App</a>
		<div class="flex items-center gap-2">
			<div class="flex items-center gap-1">
				<Button
					onclick={() => (tempUnits = tempUnits === 'imperial' ? 'metric' : 'imperial')}
					variant="outline"
					size="icon-sm"
					class="px-2 text-[11px]"
					title="Toggle temperature units"
				>
					{tempUnits === 'imperial' ? '°F' : '°C'}
				</Button>
				<Button
					onclick={() => (windUnits = windUnits === 'imperial' ? 'metric' : 'imperial')}
					variant="outline"
					size="icon-sm"
					class="px-2 text-[11px]"
					title="Toggle wind units"
				>
					{windUnits === 'imperial' ? 'mph' : 'km/h'}
				</Button>
				<Button
					onclick={() => (precipUnits = precipUnits === 'imperial' ? 'metric' : 'imperial')}
					variant="outline"
					size="icon-sm"
					class="px-2 text-[11px]"
					title="Toggle precipitation units"
				>
					{precipUnits === 'imperial' ? 'in' : 'cm'}
				</Button>
				<Button
					onclick={() => (timeFormat = timeFormat === '12h' ? '24h' : '12h')}
					variant="outline"
					size="icon-sm"
					class="px-2 text-[11px]"
					title="Toggle time format"
				>
					{timeFormat === '12h' ? '12h' : '24h'}
				</Button>
			</div>
			<Button onclick={toggleMode} variant="outline" size="icon-sm">
				<Sun class="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<Moon
					class="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
				/>
				<span class="sr-only">Toggle theme</span>
			</Button>
			<Button onclick={share} variant="outline" size="icon-sm" title="Copy share link">
				<Share2 class="size-4" />
			</Button>
		</div>
	</header>

	<main class="mx-auto max-w-7xl space-y-8 p-4">
		<section>
			<h2 class="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
				<MapPin class="size-4" />
				Add location, then set date range
			</h2>
			<div class="space-y-4">
				<div class="flex items-center justify-between gap-2">
					<div class="max-w-md flex-1">
						<LocationSearch placeholder="Search location" onSelect={addEntry} />
					</div>
					{#if itinerary.entries.length > 0}
						<Button variant="ghost" size="sm" class="text-xs" onclick={goHome}>Back</Button>
					{/if}
				</div>
				{#each itinerary.entries as entry (entry.location.lat + entry.location.lon + entry.startDate + entry.endDate)}
					<Card.Root class="p-3">
						<div class="flex items-center gap-3">
							<div class="flex min-w-0 flex-1 items-center gap-2">
								<MapPin class="size-4 shrink-0" />
								<span class="truncate font-medium">
									{entry.location.name ??
										`${entry.location.lat.toFixed(2)}, ${entry.location.lon.toFixed(2)}`}
								</span>
							</div>
							<div class="ml-auto flex items-center gap-2">
								<DateRangePicker
									startDate={entry.startDate}
									endDate={entry.endDate}
									minDate={TODAY}
									onChange={(start, end) => {
										itinerary = {
											entries: itinerary.entries.map((e) =>
												e === entry ? { ...e, startDate: start, endDate: end } : e
											)
										};
									}}
								/>
								<Button
									variant="outline"
									size="icon-sm"
									onclick={() => removeEntry(entry)}
									aria-label="Remove"
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						</div>
					</Card.Root>
				{/each}
			</div>

			{#if recentItineraries.length > 0 && itinerary.entries.length === 0}
				<div class="mt-6 space-y-2">
					<div class="flex items-center justify-between gap-2">
						<p class="flex items-center gap-1 text-xs font-medium text-muted-foreground">
							<History class="size-3" />
							Recent
						</p>
						<Button
							variant="ghost"
							size="sm"
							class="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
							onclick={clearRecent}
						>
							Clear all
						</Button>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each recentItineraries as r, i (i)}
							<Button variant="outline" size="sm" onclick={() => loadRecent(r)}>
								{r.entries.map((e) => e.location.name ?? 'Location').join(' → ')}
							</Button>
						{/each}
					</div>
				</div>
			{/if}
		</section>

		{#if itinerary.entries.length > 0}
			<section>
				<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-sm font-medium text-muted-foreground">Weather</h2>
					<div class="flex flex-wrap items-center gap-4 text-xs">
						<label class="flex items-center gap-2">
							<Checkbox bind:checked={filterTemp} />
							Temp
						</label>
						<label class="flex items-center gap-2">
							<Checkbox bind:checked={filterFeelsLike} />
							Feels like
						</label>
						<label class="flex items-center gap-2">
							<Checkbox bind:checked={filterPrecip} />
							Precip
						</label>
						<label class="flex items-center gap-2">
							<Checkbox bind:checked={filterWind} />
							Wind
						</label>
						<label class="flex items-center gap-2">
							<Checkbox bind:checked={filterHumidity} />
							Humidity
						</label>
					</div>
				</div>

				{#if tripOverviewData.length > 0 && tripOverviewSeries.length > 0}
					<Card.Root class="mb-6 p-4">
						<Card.Header class="flex flex-row items-start justify-between gap-2 pb-2">
							<div>
								<Card.Title class="text-base">Trip overview</Card.Title>
								<Card.Description class="text-xs">
									{tripOverviewMetric === 'temp'
										? 'Temperature'
										: tripOverviewMetric === 'feels'
											? 'Feels like'
											: tripOverviewMetric === 'humidity'
												? 'Humidity'
												: tripOverviewMetric === 'precip'
													? 'Precipitation'
													: tripOverviewMetric === 'precipChance'
														? 'Precipitation chance'
														: tripOverviewMetric === 'wind'
															? 'Wind speed'
															: 'Wind gust'}
									across all locations
								</Card.Description>
							</div>
							<div class="flex flex-wrap gap-1">
								{#each [['temp', 'Temp'], ['feels', 'Feels'], ['humidity', 'Humidity'], ['precip', 'Precip'], ['precipChance', '%'], ['wind', 'Wind'], ['gusts', 'Gust']] as [m, label] (m)}
									<Button
										variant={tripOverviewMetric === m ? 'default' : 'outline'}
										size="sm"
										class="px-2 text-[11px]"
										onclick={() => (tripOverviewMetric = m as ChartMetric)}
										title={m === 'temp'
											? 'Temperature'
											: m === 'feels'
												? 'Feels like'
												: m === 'humidity'
													? 'Humidity'
													: m === 'precip'
														? 'Precipitation'
														: m === 'precipChance'
															? 'Precip chance'
															: m === 'wind'
																? 'Wind'
																: 'Wind gust'}
									>
										{label}
									</Button>
								{/each}
							</div>
						</Card.Header>
						<Card.Content>
							<TripOverviewChart
								data={tripOverviewData}
								series={tripOverviewSeries}
								valueFormatter={getMetricFormatter(tripOverviewMetric)}
								height={220}
								{timeFormat}
								xAxisMode="date"
							/>
						</Card.Content>
					</Card.Root>
				{/if}

				<div class="space-y-6">
					{#each sortedEntries.filter((e) => e.startDate && e.endDate) as entry (entry.location.lat + entry.location.lon + entry.startDate + entry.endDate)}
						{@const key = `${entry.location.lat.toFixed(4)},${entry.location.lon.toFixed(4)}`}
						{@const fc = getForecast(entry.location)}
						{@const dates = getDatesInRange(entry.startDate, entry.endDate)}
						{@const lastDaily =
							fc?.daily?.time && fc.daily.time.length > 0
								? fc.daily.time[fc.daily.time.length - 1]
								: null}
						{@const inRangeDates = lastDaily
							? dates.filter((d) => d <= lastDaily && isWithinForecast(d))
							: []}
						{@const futureOutOfRange = lastDaily ? dates.filter((d) => d > lastDaily) : dates}
						{@const hasAnyForecastDates = dates.some((d) => isWithinForecast(d))}
						<div>
							<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
								<MapPin class="size-4" />
								{entry.location.name ??
									`${entry.location.lat.toFixed(2)}, ${entry.location.lon.toFixed(2)}`}
								<span class="font-normal text-muted-foreground">
									({entry.startDate} – {entry.endDate})
								</span>
							</h3>
							{#if loading[key]}
								<div class="flex items-center justify-center py-12">
									<Loader2 class="size-8 animate-spin text-muted-foreground" />
								</div>
							{:else if !hasAnyForecastDates}
								<Card.Root class="border-amber-500/20 bg-amber-500/5 p-4">
									<p class="text-sm text-amber-600 dark:text-amber-400">
										Forecast not available yet for this date range. Forecasts are only available
										{MAX_FORECAST_DAYS} days ahead.
									</p>
								</Card.Root>
							{:else if fc}
								<div class="space-y-4">
									{#if inRangeDates.length > 0}
										<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
											{#each inRangeDates as dateStr, i (`${dateStr}-${i}`)}
												{@const daily = getDailyForDate(fc, dateStr)}
												{@const hourly = getHourlyForDate(fc, dateStr)}
												<Card.Root class="overflow-hidden">
													<Card.Header class="pb-2">
														<Card.Title class="text-sm font-medium">
															<Badge
																variant="outline"
																class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-normal"
															>
																<Calendar class="size-3 text-muted-foreground" />
																<span class="font-mono tabular-nums">
																	{formatDateLabel(dateStr)}
																</span>
															</Badge>
														</Card.Title>
													</Card.Header>
													<Card.Content class="space-y-4">
														{#if daily}
															<div class="grid grid-cols-3 gap-3 text-sm">
																{#if filterTemp}
																	<button
																		type="button"
																		class="flex cursor-pointer items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50 {dailyChartMetric ===
																		'temp'
																			? 'ring-1 ring-primary/30'
																			: ''}"
																		onclick={() => (dailyChartMetric = 'temp')}
																	>
																		<Thermometer
																			class="mt-0.5 size-4 shrink-0 text-muted-foreground"
																		/>
																		<div class="min-w-0 flex-1">
																			<span class="block text-[11px] text-muted-foreground"
																				>Temperature</span
																			>
																			<span class="text-xs tabular-nums">
																				{Math.round(
																					toDisplayTemp(daily.min, tempUnits) ?? daily.min
																				)}° – {Math.round(
																					toDisplayTemp(daily.max, tempUnits) ?? daily.max
																				)}°
																			</span>
																		</div>
																	</button>
																{/if}
																{#if filterFeelsLike && (daily.feelsMax != null || daily.feelsMin != null)}
																	<button
																		type="button"
																		class="flex cursor-pointer items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50 {dailyChartMetric ===
																		'feels'
																			? 'ring-1 ring-primary/30'
																			: ''}"
																		onclick={() => (dailyChartMetric = 'feels')}
																	>
																		<Thermometer
																			class="mt-0.5 size-4 shrink-0 text-muted-foreground"
																		/>
																		<div class="min-w-0 flex-1">
																			<span class="block text-[11px] text-muted-foreground"
																				>Feels like</span
																			>
																			<span class="text-xs tabular-nums">
																				{Math.round(
																					toDisplayTemp(daily.feelsMin ?? daily.min, tempUnits) ??
																						daily.feelsMin ??
																						daily.min
																				)}° – {Math.round(
																					toDisplayTemp(daily.feelsMax ?? daily.max, tempUnits) ??
																						daily.feelsMax ??
																						daily.max
																				)}°
																			</span>
																		</div>
																	</button>
																{/if}
																{#if filterWind && daily.wind != null}
																	<button
																		type="button"
																		class="flex cursor-pointer items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50 {dailyChartMetric ===
																		'wind'
																			? 'ring-1 ring-primary/30'
																			: ''}"
																		onclick={() => (dailyChartMetric = 'wind')}
																	>
																		<Wind class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
																		<div class="min-w-0 flex-1">
																			<span class="block text-[11px] text-muted-foreground"
																				>Wind</span
																			>
																			<span class="text-xs tabular-nums">
																				{Math.round(
																					toDisplayWind(daily.wind, windUnits) ?? daily.wind
																				)}
																				{windUnits === 'imperial' ? ' mph' : ' km/h'}
																				{#if daily.windDir != null}
																					({formatWindDirection(daily.windDir)})
																				{/if}
																			</span>
																		</div>
																	</button>
																{/if}
																{#if filterPrecip}
																	<button
																		type="button"
																		class="flex cursor-pointer items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50 {dailyChartMetric ===
																		'precipChance'
																			? 'ring-1 ring-primary/30'
																			: ''}"
																		onclick={() => (dailyChartMetric = 'precipChance')}
																	>
																		<CloudRain
																			class="mt-0.5 size-4 shrink-0 text-muted-foreground"
																		/>
																		<div class="min-w-0 flex-1">
																			<span class="block text-[11px] text-muted-foreground"
																				>Precip chance</span
																			>
																			<span class="text-xs tabular-nums">
																				{daily.precipChance != null
																					? `${daily.precipChance}%`
																					: '—'}
																			</span>
																		</div>
																	</button>
																{/if}
																{#if filterPrecip}
																	<button
																		type="button"
																		class="flex cursor-pointer items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50 {dailyChartMetric ===
																		'precip'
																			? 'ring-1 ring-primary/30'
																			: ''}"
																		onclick={() => (dailyChartMetric = 'precip')}
																	>
																		<CloudRain
																			class="mt-0.5 size-4 shrink-0 text-muted-foreground"
																		/>
																		<div class="min-w-0 flex-1">
																			<span class="block text-[11px] text-muted-foreground"
																				>Precipitation</span
																			>
																			<span class="text-xs tabular-nums">
																				{formatPrecip(daily.precip, precipUnits).value.toFixed(2)}
																				{` ${formatPrecip(daily.precip, precipUnits).unit}`}
																			</span>
																		</div>
																	</button>
																{/if}
																{#if filterWind && daily.gusts != null}
																	<button
																		type="button"
																		class="flex cursor-pointer items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50 {dailyChartMetric ===
																		'gusts'
																			? 'ring-1 ring-primary/30'
																			: ''}"
																		onclick={() => (dailyChartMetric = 'gusts')}
																	>
																		<Wind class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
																		<div class="min-w-0 flex-1">
																			<span class="block text-[11px] text-muted-foreground"
																				>Wind gust</span
																			>
																			<span class="text-xs tabular-nums">
																				{Math.round(
																					toDisplayWind(daily.gusts, windUnits) ?? daily.gusts
																				)}
																				{windUnits === 'imperial' ? ' mph' : ' km/h'}
																			</span>
																		</div>
																	</button>
																{/if}
																{#if filterHumidity && daily.humidity != null}
																	<button
																		type="button"
																		class="flex cursor-pointer items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50 {dailyChartMetric ===
																		'humidity'
																			? 'ring-1 ring-primary/30'
																			: ''}"
																		onclick={() => (dailyChartMetric = 'humidity')}
																	>
																		<Droplets
																			class="mt-0.5 size-4 shrink-0 text-muted-foreground"
																		/>
																		<div class="min-w-0 flex-1">
																			<span class="block text-[11px] text-muted-foreground"
																				>Humidity</span
																			>
																			<span class="text-xs tabular-nums"
																				>{Math.round(daily.humidity)}%</span
																			>
																		</div>
																	</button>
																{/if}
																<div class="flex items-start gap-2 p-2">
																	<Sun class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
																	<div class="min-w-0 flex-1">
																		<span class="block text-[11px] text-muted-foreground"
																			>Sunrise</span
																		>
																		<span class="text-xs tabular-nums">
																			{formatTimeOfDay(daily.sunrise, timeFormat === '12h')}
																		</span>
																	</div>
																</div>
																<div class="flex items-start gap-2 p-2">
																	<Moon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
																	<div class="min-w-0 flex-1">
																		<span class="block text-[11px] text-muted-foreground"
																			>Sunset</span
																		>
																		<span class="text-xs tabular-nums">
																			{formatTimeOfDay(daily.sunset, timeFormat === '12h')}
																		</span>
																	</div>
																</div>
															</div>
															{#if hourly.length > 0}
																<div class="space-y-1 px-2">
																	<p class="text-xs font-medium text-muted-foreground">
																		Hourly {dailyChartMetric === 'temp'
																			? 'Temperature'
																			: dailyChartMetric === 'feels'
																				? 'Feels like'
																				: dailyChartMetric === 'humidity'
																					? 'Humidity'
																					: dailyChartMetric === 'precip'
																						? 'Precipitation'
																						: dailyChartMetric === 'precipChance'
																							? 'Precipitation chance'
																							: dailyChartMetric === 'wind'
																								? 'Wind speed'
																								: 'Wind gust'}
																	</p>
																	<TripOverviewChart
																		data={hourly
																			.map((h) => {
																				const v = getMetricValue(h, dailyChartMetric, {
																					temp: tempUnits,
																					wind: windUnits,
																					precip: precipUnits
																				});
																				return v != null
																					? { date: new Date(h.time), value: v }
																					: null;
																			})
																			.filter((d): d is { date: Date; value: number } => d != null)}
																		series={[
																			{
																				key: 'value',
																				label:
																					dailyChartMetric === 'temp'
																						? 'Temperature'
																						: dailyChartMetric === 'feels'
																							? 'Feels like'
																							: dailyChartMetric === 'humidity'
																								? 'Humidity'
																								: dailyChartMetric === 'precip'
																									? 'Precipitation'
																									: dailyChartMetric === 'precipChance'
																										? 'Precip chance'
																										: dailyChartMetric === 'wind'
																											? 'Wind speed'
																											: 'Wind gust',
																				color: 'var(--primary)'
																			}
																		]}
																		valueFormatter={getMetricFormatter(dailyChartMetric)}
																		height={140}
																		{timeFormat}
																		xAxisMode="time"
																	/>
																</div>
															{/if}
														{:else}
															<p class="text-sm text-muted-foreground">No data for this date</p>
														{/if}
													</Card.Content>
												</Card.Root>
											{/each}
										</div>
									{/if}

									{#if futureOutOfRange.length > 0}
										<Card.Root class="border-amber-500/20 bg-amber-500/5 p-4">
											<p class="text-sm text-amber-600 dark:text-amber-400">
												Forecast not available yet beyond {MAX_FORECAST_DAYS} days ahead for
												{#if futureOutOfRange.length === 1}
													{futureOutOfRange[0]}
												{:else}
													{futureOutOfRange[0]} – {futureOutOfRange[futureOutOfRange.length - 1]}
												{/if}
											</p>
										</Card.Root>
									{/if}
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">Loading...</p>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</main>
</div>
