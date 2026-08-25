'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError, unwrap } from '@/lib/api';
import { reverseGeocode } from '@/lib/nominatim';
import { Button } from '@/components/ui/button';

const OsmMapPicker = dynamic(
  () => import('./osm-map-picker').then((m) => m.OsmMapPicker),
  { ssr: false },
);

interface LocationData {
  hasLocation: boolean;
  lat: number | null;
  lng: number | null;
  locationLabel?: string;
  discoveryRadiusKm: number;
}

interface Props {
  compact?: boolean;
  onSaved?: () => void;
}

/** Set / update the user's location via GPS or OpenStreetMap picker. */
export function LocationSetup({ compact, onSaved }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['my-location'],
    queryFn: () => unwrap<LocationData>(api.get('/users/me/location')),
  });

  const [lat, setLat] = useState(28.6139);
  const [lng, setLng] = useState(77.209);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void import('./osm-map-picker');
  }, []);

  useEffect(() => {
    if (data?.hasLocation && data.lat != null && data.lng != null) {
      setLat(data.lat);
      setLng(data.lng);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      let label: string | undefined;
      let city: string | undefined;
      let country: string | undefined;
      try {
        const geo = await reverseGeocode(lat, lng);
        label = geo.displayName;
        city = geo.city;
        country = geo.country;
      } catch {
        label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
      return api.post('/users/me/location', { lat, lng, locationLabel: label, city, country });
    },
    onSuccess: () => {
      toast.success('Location saved! You can now discover nearby users.');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['my-location'] });
      qc.invalidateQueries({ queryKey: ['discover'] });
      onSaved?.();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const useGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsLoading(false);
        toast.success('GPS location detected — save to apply.');
      },
      () => {
        setGpsLoading(false);
        toast.error('Could not access GPS. Allow location permission or pick on the map.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  if (isLoading) {
    return <div className="skeleton h-32 rounded-2xl" />;
  }

  // Compact mode with saved location: show summary only (no Leaflet until edit).
  if (compact && data?.hasLocation && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/50 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 shrink-0 text-brand-pink" />
            Your location
          </p>
          {data.locationLabel && (
            <p className="mt-0.5 truncate text-xs text-white/45">{data.locationLabel}</p>
          )}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div
      className={
        compact ? 'space-y-4' : 'space-y-4 rounded-2xl border border-white/10 bg-card/70 p-6'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <MapPin className="h-5 w-5 text-brand-pink" />
            {data?.hasLocation ? 'Your location' : 'Set your location'}
          </h3>
          <p className="mt-1 text-sm text-white/50">
            Powered by{' '}
            <a
              href="https://www.openstreetmap.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-pink hover:underline"
            >
              OpenStreetMap
            </a>
            . Share your location to discover people and hosts who are a great match for you.
          </p>
          {data?.locationLabel && (
            <p className="mt-2 line-clamp-2 text-xs text-white/40">{data.locationLabel}</p>
          )}
        </div>
        <div className="flex gap-2">
          {compact && data?.hasLocation && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={useGps} disabled={gpsLoading}>
            {gpsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Use GPS
          </Button>
        </div>
      </div>

      <OsmMapPicker
        lat={lat}
        lng={lng}
        onChange={(a, b) => {
          setLat(a);
          setLng(b);
        }}
      />

      <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
        Save location
      </Button>
    </div>
  );
}
