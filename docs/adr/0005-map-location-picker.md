# ADR 0005 — Interactive Map Location Picker

**Status:** Accepted  
**Date:** 2026-09-26  
**Author:** Shahzad Ahmad

## Context

The original complaint form used a plain text input for location. This led to ambiguous or
misspelled addresses that made it harder for operators to dispatch field teams. A structured
location selection mechanism was needed.

## Decision

Replace the free-text location field with an interactive map picker backed by:

- **Leaflet + react-leaflet** — open-source, no API key, MIT licensed.
- **OpenStreetMap tiles** — free, community-maintained, no quota.
- **Nominatim reverse geocoding** — OSM's free geocoding service; converts lat/lng to a
  human-readable address string on each map click.
- **Browser Geolocation API** — optional "Use my location" button for GPS-based auto-fill.

The resolved address string is written into the existing `location` text field, which remains
editable. The backend schema is unchanged — it still receives a plain `str`.

## Alternatives Considered

| Option | Reason rejected |
|---|---|
| Google Maps + Places API | Requires billing account; adds vendor lock-in |
| Mapbox | Free tier has monthly limits; API key required |
| Manual text only | Poor UX — typos, ambiguous locations, no coordinates |
| Store raw lat/lng | Would require backend schema + DB migration |

## Consequences

- **Positive:** Users select a verified address; operators get actionable location strings.
- **Positive:** No API keys or paid quotas needed for the assignment demo.
- **Neutral:** Nominatim has a 1 req/s fair-use limit; fine for interactive use, not for batch.
- **Negative:** Adds ~200 KB (gzipped) to the frontend bundle (leaflet CSS + JS).
- **Negative:** Map tiles require internet access; offline mode not supported.
