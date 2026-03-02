export interface ItineraryLocation {
	lat: number;
	lon: number;
	name?: string;
	timezone?: string;
}

export interface ItineraryEntry {
	location: ItineraryLocation;
	startDate: string;
	endDate: string;
}

export interface Itinerary {
	entries: ItineraryEntry[];
}

export interface OpenMeteoDaily {
	time: string[];
	temperature_2m_max: number[];
	temperature_2m_min: number[];
	apparent_temperature_max?: number[];
	apparent_temperature_min?: number[];
	precipitation_sum: number[];
	precipitation_probability_max?: number[];
	sunrise?: string[];
	sunset?: string[];
	wind_speed_10m_max?: number[];
	wind_direction_10m_dominant?: number[];
	wind_gusts_10m_max?: number[];
}

export interface OpenMeteoHourly {
	time: string[];
	temperature_2m: number[];
	apparent_temperature?: number[];
	relative_humidity_2m?: number[];
	precipitation?: number[];
	precipitation_probability?: number[];
	rain?: number[];
	wind_speed_10m?: number[];
	wind_direction_10m?: number[];
	wind_gusts_10m?: number[];
}

export interface OpenMeteoForecast {
	latitude: number;
	longitude: number;
	timezone: string;
	timezone_abbreviation: string;
	daily?: OpenMeteoDaily;
	hourly?: OpenMeteoHourly;
}
