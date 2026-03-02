<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { scaleUtc } from 'd3-scale';
	import { Area, AreaChart } from 'layerchart';
	import { curveNatural } from 'd3-shape';

	export type ChartSeries = {
		key: string;
		label: string;
		color: string;
	};

	export type ChartDataPoint = {
		date: Date;
		[key: string]: Date | number;
	};

	type TimeFormat = '12h' | '24h';
	type XAxisMode = 'date' | 'time';

	const chartUid = `chart-${crypto.randomUUID?.()?.slice(0, 8) ?? Date.now()}`;

	let {
		data,
		series,
		valueFormatter = (v: number) => `${Math.round(v)}°`,
		height = 220,
		timeFormat = '12h',
		xAxisMode = 'date'
	}: {
		data: ChartDataPoint[];
		series: ChartSeries[];
		valueFormatter?: (v: number) => string;
		height?: number;
		timeFormat?: TimeFormat;
		xAxisMode?: XAxisMode;
	} = $props();

	const chartConfig = $derived(
		Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]))
	);

	/* eslint-disable svelte/prefer-svelte-reactivity -- local Date computation, not reactive state */
	const dayTicks = $derived.by(() => {
		if (!data.length) return [];
		const first = data[0].date;
		const last = data[data.length - 1].date;
		const ticks: Date[] = [];
		const d = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 12, 0, 0);
		const end = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 12, 0, 0);
		while (d.getTime() <= end.getTime()) {
			ticks.push(new Date(d.getTime()));
			d.setDate(d.getDate() + 1);
		}
		return ticks;
	});
	/* eslint-enable svelte/prefer-svelte-reactivity */

	const timeTicks = $derived.by(() => {
		if (!data.length) return [];
		const first = data[0].date;
		const base = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0);
		const hours = [6, 12, 18];
		return hours.map((h) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 0, 0));
	});

	const chartSeries = $derived(
		series.map((s) => ({
			key: s.key,
			label: s.label,
			color: s.color,
			value: (d: ChartDataPoint) => d[s.key]
		}))
	);
</script>

<Chart.Container config={chartConfig} class="w-full" style={`height: ${height}px`}>
	<AreaChart
		{data}
		x="date"
		xScale={scaleUtc()}
		series={chartSeries}
		props={{
			tooltip: {
				context: { mode: 'bisect-x' }
			},
			area: {
				curve: curveNatural,
				'fill-opacity': 0.4,
				line: { class: 'stroke-1' },
				motion: 'tween'
			},
			xAxis: {
				ticks: xAxisMode === 'time' ? timeTicks : dayTicks,
				format: (v: Date) =>
					xAxisMode === 'time'
						? v.toLocaleTimeString('en-US', {
								hour: 'numeric',
								hour12: timeFormat === '12h'
							})
						: v.toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
			},
			yAxis: {
				format: valueFormatter
			}
		}}
	>
		{#snippet marks({ series: s, getAreaProps })}
			<defs>
				{#each s as ser (ser.key)}
					<linearGradient id="{chartUid}-fill-{ser.key}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stop-color={ser.color} stop-opacity={0.9} />
						<stop offset="95%" stop-color={ser.color} stop-opacity={0.1} />
					</linearGradient>
				{/each}
			</defs>
			{#each s as ser, i (ser.key)}
				<Area
					{...getAreaProps(ser, i)}
					defined={(d: ChartDataPoint) => d[ser.key] != null}
					fill="url(#{chartUid}-fill-{ser.key})"
				/>
			{/each}
		{/snippet}
		{#snippet tooltip()}
			<Chart.Tooltip
				labelFormatter={(v: Date) =>
					v.toLocaleString('en-US', {
						month: 'short',
						day: 'numeric',
						hour: 'numeric',
						hour12: timeFormat === '12h'
					})}
				indicator="line"
			>
				{#snippet formatter({ value, name, item })}
					{@const itemLabel = chartConfig[name]?.label ?? name}
					{@const indicatorColor = item.color}
					<div class="flex w-full items-center gap-2">
						<div
							style="--color-bg: {indicatorColor}; --color-border: {indicatorColor};"
							class="size-2.5 shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)"
						></div>
						<div class="flex flex-1 items-center justify-between gap-4 leading-none">
							<span class="text-muted-foreground">{itemLabel}</span>
							{#if value !== undefined && value !== null}
								<span class="font-mono font-medium text-foreground tabular-nums">
									{valueFormatter(Number(value))}
								</span>
							{/if}
						</div>
					</div>
				{/snippet}
			</Chart.Tooltip>
		{/snippet}
	</AreaChart>
</Chart.Container>
