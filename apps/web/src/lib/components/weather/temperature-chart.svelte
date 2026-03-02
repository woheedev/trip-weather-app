<script lang="ts">
	interface Point {
		time: string;
		temp: number;
		label?: string;
	}

	let {
		data,
		height = 120
	}: {
		data: Point[];
		height?: number;
	} = $props();

	const padding = { top: 8, right: 8, bottom: 24, left: 32 };
	const width = 280;
	const chartWidth = width - padding.left - padding.right;
	const chartHeight = $derived.by(() => height - padding.top - padding.bottom);

	const temps = $derived(data.map((d) => d.temp));
	const minTemp = $derived(Math.min(...temps, Infinity) || 0);
	const maxTemp = $derived(Math.max(...temps, -Infinity) || 100);
	const range = $derived(maxTemp - minTemp || 1);
	const yScale = $derived(
		(v: number) => padding.top + chartHeight - ((v - minTemp) / range) * chartHeight
	);

	const points = $derived(
		data.map((d, i) => {
			const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
			return `${x},${yScale(d.temp)}`;
		})
	);
	const pathD = $derived(points.length > 1 ? `M ${points.join(' L ')}` : '');
</script>

<div class="w-full" style="height: {height}px">
	<svg {width} {height} class="overflow-visible">
		<path
			d={pathD}
			fill="none"
			stroke="var(--chart-1)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		{#each data.filter((_, i) => i % 4 === 0) as d, idx (d.time)}
			{@const origIdx = idx * 4}
			<g>
				<line
					x1={padding.left + (origIdx / Math.max(data.length - 1, 1)) * chartWidth}
					y1={yScale(d.temp)}
					x2={padding.left + (origIdx / Math.max(data.length - 1, 1)) * chartWidth}
					y2={chartHeight + padding.top}
					stroke="var(--border)"
					stroke-dasharray="2 2"
					opacity="0.5"
				/>
				<text
					x={padding.left + (origIdx / Math.max(data.length - 1, 1)) * chartWidth}
					y={height - 4}
					text-anchor="middle"
					class="fill-muted-foreground text-[10px]"
				>
					{d.time.slice(11, 13)}
				</text>
			</g>
		{/each}
	</svg>
</div>
