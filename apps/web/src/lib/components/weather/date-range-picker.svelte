<script lang="ts">
	import { CalendarDate, getLocalTimeZone, today, type DateValue } from '@internationalized/date';
	import { RangeCalendar } from '$lib/components/ui/range-calendar/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { formatDateRange } from 'little-date';
	import type { DateRange } from 'bits-ui';

	let {
		startDate,
		endDate,
		minDate,
		onChange
	}: {
		startDate: string;
		endDate: string;
		minDate?: string;
		onChange: (start: string, end: string) => void;
	} = $props();

	let open = $state(false);

	function parseDate(s: string): CalendarDate {
		const [y, m, d] = s.split('-').map(Number);
		return new CalendarDate(y, m, d);
	}

	function toIso(d: CalendarDate): string {
		const m = String(d.month).padStart(2, '0');
		const day = String(d.day).padStart(2, '0');
		return `${d.year}-${m}-${day}`;
	}

	let rangeValue = $state<DateRange | undefined>(undefined);

	$effect(() => {
		if (!startDate || !endDate) {
			rangeValue = undefined;
			return;
		}
		rangeValue = { start: parseDate(startDate), end: parseDate(endDate) };
	});

	$effect(() => {
		if (!rangeValue?.start || !rangeValue?.end) return;
		const start = toIso(rangeValue.start as CalendarDate);
		const end = toIso(rangeValue.end as CalendarDate);
		if (start !== startDate || end !== endDate) {
			onChange(start, end);
			open = false;
		}
	});

	const minValue = $derived(minDate ? parseDate(minDate) : today(getLocalTimeZone()));

	function formatRangeDisplay(): string {
		if (!startDate || !endDate) return 'Select date(s)';
		const start: DateValue = parseDate(startDate);
		const end: DateValue = parseDate(endDate);
		return formatDateRange(start.toDate(getLocalTimeZone()), end.toDate(getLocalTimeZone()), {
			includeTime: false
		});
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" class="w-56 justify-between font-normal">
				{formatRangeDisplay()}
				<ChevronDownIcon class="ml-2 size-4 opacity-60" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto overflow-hidden p-0" align="start">
		<div class="flex min-w-0 flex-col gap-2">
			<RangeCalendar
				bind:value={rangeValue}
				{minValue}
				minDays={1}
				numberOfMonths={2}
				captionLayout="dropdown"
				class="rounded-lg border shadow-sm"
			/>
		</div>
	</Popover.Content>
</Popover.Root>
