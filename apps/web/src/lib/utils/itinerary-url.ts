import type { Itinerary } from '$lib/types/weather';

const PREFIX = 'i=';
const RECENT_KEY = 'trip-weather-recent';
const RECENT_MAX = 5;

export function encodeItinerary(itinerary: Itinerary): string {
	const json = JSON.stringify(itinerary);
	return PREFIX + btoa(encodeURIComponent(json));
}

export function decodeItinerary(encoded: string): Itinerary | null {
	if (!encoded.startsWith(PREFIX)) return null;
	try {
		const json = decodeURIComponent(atob(encoded.slice(PREFIX.length)));
		const parsed = JSON.parse(json);
		if (parsed?.entries && Array.isArray(parsed.entries)) {
			return parsed as Itinerary;
		}
		return null;
	} catch {
		return null;
	}
}

export function getItineraryFromUrl(): Itinerary | null {
	if (typeof window === 'undefined') return null;
	const hash = window.location.hash.slice(1);
	if (!hash.startsWith(PREFIX)) return null;
	return decodeItinerary(hash);
}

export function buildShareUrl(itinerary: Itinerary): string {
	const encoded = encodeItinerary(itinerary);
	const base = window.location.origin + window.location.pathname;
	return `${base}#${encoded}`;
}

export function getRecentItineraries(): Itinerary[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(RECENT_KEY);
		if (!raw) return [];
		const arr = JSON.parse(raw) as Itinerary[];
		return Array.isArray(arr) ? arr.slice(0, RECENT_MAX) : [];
	} catch {
		return [];
	}
}

export function saveRecentItinerary(itinerary: Itinerary): void {
	if (typeof window === 'undefined' || itinerary.entries.length === 0) return;
	try {
		const recent = getRecentItineraries();
		const filtered = recent.filter(
			(r) =>
				!(
					r.entries.length === itinerary.entries.length &&
					r.entries.every(
						(e, i) =>
							e.location.lat === itinerary.entries[i].location.lat &&
							e.location.lon === itinerary.entries[i].location.lon &&
							e.startDate === itinerary.entries[i].startDate &&
							e.endDate === itinerary.entries[i].endDate
					)
				)
		);
		const updated = [itinerary, ...filtered].slice(0, RECENT_MAX);
		localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
	} catch {
		// ignore
	}
}

export function clearRecentItineraries(): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.removeItem(RECENT_KEY);
	} catch {
		// ignore
	}
}
