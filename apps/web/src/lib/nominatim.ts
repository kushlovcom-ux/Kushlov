/**
 * OpenStreetMap Nominatim geocoding (https://nominatim.openstreetmap.org).
 * Used for reverse-geocoding GPS / map picks into city/country labels.
 * See OSM usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Kushlov/1.0 (https://kushlov.app; contact@kushlov.app)';

export interface ReverseGeocodeResult {
  displayName: string;
  city?: string;
  country?: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error('Could not resolve address');
  const data = await res.json();
  const addr = data.address ?? {};
  return {
    displayName: data.display_name as string,
    city: addr.city ?? addr.town ?? addr.village ?? addr.suburb,
    country: addr.country,
  };
}
