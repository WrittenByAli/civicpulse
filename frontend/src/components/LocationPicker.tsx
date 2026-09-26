import { useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom SVG pin — avoids Vite asset path issues with leaflet's default icons
const PIN_ICON = L.divIcon({
  html: `<svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 40 14 40C14 40 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#2563eb"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
    <circle cx="14" cy="14" r="3.5" fill="#2563eb"/>
  </svg>`,
  className: '',
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
})

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error('Nominatim error')
  const data = await res.json() as { display_name?: string }
  return (data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`).slice(0, 200)
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

interface LocationPickerProps {
  onAddressSelect: (address: string) => void
  disabled?: boolean
}

export function LocationPicker({ onAddressSelect, disabled = false }: LocationPickerProps) {
  const [marker, setMarker] = useState<[number, number] | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const resolveAddress = useCallback(async (lat: number, lng: number) => {
    setMarker([lat, lng])
    setGeocoding(true)
    setGeoError(null)
    try {
      const address = await reverseGeocode(lat, lng)
      onAddressSelect(address)
    } catch {
      setGeoError('Could not resolve address — coordinates used instead.')
      onAddressSelect(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } finally {
      setGeocoding(false)
    }
  }, [onAddressSelect])

  function handleGPS() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }
    setGeocoding(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => { void resolveAddress(pos.coords.latitude, pos.coords.longitude) },
      () => {
        setGeocoding(false)
        setGeoError('Location access was denied.')
      },
    )
  }

  return (
    <div className="card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-900">Pick Location on Map</p>
          <p className="text-xs text-slate-500 mt-0.5">Click anywhere to set the issue location</p>
        </div>
        <button
          type="button"
          onClick={handleGPS}
          disabled={disabled || geocoding}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          Use my location
        </button>
      </div>

      {/* Map */}
      <div className="relative" style={{ height: 300 }}>
        <MapContainer
          center={[33.6844, 73.0479]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          className={disabled ? 'pointer-events-none opacity-60' : ''}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={(lat, lng) => { void resolveAddress(lat, lng) }} />
          {marker && <Marker position={marker} icon={PIN_ICON} />}
        </MapContainer>

        {geocoding && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-[1000]">
            <div className="flex items-center gap-2 rounded-full bg-white shadow-md px-4 py-2 text-xs font-medium text-slate-700 border border-slate-100">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-civic-600 flex-shrink-0" />
              Resolving address…
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 border-t border-slate-100 min-h-[32px] flex items-center">
        {geoError ? (
          <p className="text-xs text-red-600">{geoError}</p>
        ) : marker ? (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Location set — you can still edit the address above
          </p>
        ) : (
          <p className="text-xs text-slate-400">Click the map or use GPS to pin the location</p>
        )}
      </div>
    </div>
  )
}
