const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1';
const FORECAST_BASE = 'https://api.open-meteo.com/v1';

export interface GeocodingResult {
	id: number;
	name: string;
	latitude: number;
	longitude: number;
	country_code: string;
	country: string;
	admin1?: string;
	timezone: string;
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
	if (!query || query.length < 2) return [];
	const res = await fetch(
		`${GEOCODING_BASE}/search?name=${encodeURIComponent(query)}&count=10&language=en`
	);
	const data = await res.json();
	return data.results ?? [];
}

const HOURLY_VARS =
	'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
const DAILY_VARS =
	'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max';
export async function fetchForecast(
	lat: number,
	lon: number,
	options?: { timezone?: string; forecastDays?: number; startDate?: string; endDate?: string }
): Promise<Response> {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: HOURLY_VARS,
		daily: DAILY_VARS,
		wind_speed_unit: 'kmh',
		temperature_unit: 'celsius',
		precipitation_unit: 'mm',
		timezone: options?.timezone ?? 'auto'
	});
	if (options?.startDate) params.set('start_date', options.startDate);
	if (options?.endDate) params.set('end_date', options.endDate);
	if (!options?.startDate && !options?.endDate) {
		params.set('forecast_days', String(options?.forecastDays ?? 16));
	}
	return fetch(`${FORECAST_BASE}/forecast?${params}`);
}
