import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { LocateFixed } from 'lucide-react'

interface LocationPickerMapProps {
  latitude: number | null
  longitude: number | null
  devicePosition?: { lat: number; lng: number } | null
  isInteractive?: boolean
  onLocationChange: (lat: number, lng: number) => void
  onCenterOnDevice?: () => void
  className?: string
}

export function LocationPickerMap({
  latitude,
  longitude,
  devicePosition,
  isInteractive = false,
  onLocationChange,
  onCenterOnDevice,
  className = 'h-72 sm:h-80 w-full rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-800 relative',
}: LocationPickerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const deviceMarkerRef = useRef<L.Marker | null>(null)
  const isInteractiveRef = useRef<boolean>(isInteractive)

  isInteractiveRef.current = isInteractive

  const defaultLat = latitude ?? devicePosition?.lat ?? -23.55052
  const defaultLng = longitude ?? devicePosition?.lng ?? -46.633308

  useEffect(() => {
    if (!mapRef.current) return

    if (!mapInstance.current) {
      const map = L.map(mapRef.current, {
        center: [defaultLat, defaultLng],
        zoom: latitude && longitude ? 17 : 14,
        zoomControl: false,
        attributionControl: false,
      })

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Google Maps Roadmap Tiles
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }).addTo(map)

      // Custom Yellow Pin
      const customIcon = L.divIcon({
        className: 'custom-restaurant-pin',
        html: `
          <div style="
            background-color: #F5DC55;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2.5px solid #141416;
            box-shadow: 0 8px 20px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <div style="
              width: 9px;
              height: 9px;
              background-color: #141416;
              border-radius: 50%;
            "></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })

      const marker = L.marker([defaultLat, defaultLng], {
        draggable: isInteractiveRef.current,
        icon: customIcon,
      }).addTo(map)

      marker.on('dragend', () => {
        if (!isInteractiveRef.current) return
        const position = marker.getLatLng()
        onLocationChange(position.lat, position.lng)
      })

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (!isInteractiveRef.current) return
        marker.setLatLng(e.latlng)
        onLocationChange(e.latlng.lat, e.latlng.lng)
      })

      mapInstance.current = map
      markerRef.current = marker

      setTimeout(() => {
        map.invalidateSize()
      }, 200)
    }
  }, [])

  // Sync Draggable state
  useEffect(() => {
    if (!markerRef.current) return
    if (isInteractive) {
      markerRef.current.dragging?.enable()
    } else {
      markerRef.current.dragging?.disable()
    }
  }, [isInteractive])

  // Device Position (Pulsing Blue Dot)
  useEffect(() => {
    if (!mapInstance.current) return

    if (devicePosition) {
      const deviceIcon = L.divIcon({
        className: 'device-location-marker',
        html: `
          <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
            <div style="
              position: absolute;
              width: 14px;
              height: 14px;
              background-color: #2563EB;
              border-radius: 50%;
              border: 2.5px solid #FFFFFF;
              box-shadow: 0 0 10px rgba(37, 99, 235, 0.7);
              z-index: 2;
            "></div>
            <div style="
              position: absolute;
              width: 28px;
              height: 28px;
              background-color: rgba(37, 99, 235, 0.25);
              border-radius: 50%;
              border: 1px solid rgba(37, 99, 235, 0.4);
            "></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })

      if (!deviceMarkerRef.current) {
        deviceMarkerRef.current = L.marker([devicePosition.lat, devicePosition.lng], {
          icon: deviceIcon,
          interactive: false,
        }).addTo(mapInstance.current)
      } else {
        deviceMarkerRef.current.setLatLng([devicePosition.lat, devicePosition.lng])
      }
    }
  }, [devicePosition])

  // Sync external coordinates
  useEffect(() => {
    if (!mapInstance.current || !markerRef.current) return
    if (latitude === null || longitude === null) return

    const currentLatLng = markerRef.current.getLatLng()
    if (
      Math.abs(currentLatLng.lat - latitude) > 0.00001 ||
      Math.abs(currentLatLng.lng - longitude) > 0.00001
    ) {
      markerRef.current.setLatLng([latitude, longitude])
      mapInstance.current.flyTo([latitude, longitude], 17, { duration: 1 })
    }
  }, [latitude, longitude])

  // Invalidate map size
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstance.current?.invalidateSize()
    }, 150)
    return () => clearTimeout(timer)
  })

  return (
    <div className={className}>
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Banner de Status do Ajuste Fino */}
      <div className="absolute top-3 left-3 right-12 z-400 pointer-events-none">
        {isInteractive ? (
          <div className="bg-zinc-900/90 dark:bg-zinc-950/90 backdrop-blur-xs text-white border border-[#F5DC55]/50 px-3 py-1.5 rounded-md shadow-md text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F5DC55] animate-pulse shrink-0" />
            <span>Ajuste fino liberado: arraste o pino amarelo para a entrada/fachada exata da loja.</span>
          </div>
        ) : (
          <div className="bg-zinc-900/80 dark:bg-zinc-950/80 backdrop-blur-xs text-zinc-300 border border-zinc-700 px-3 py-1.5 rounded-md shadow-md text-xs font-mono">
            Preencha o endereço e clique em "Adquirir Geolocalização" para liberar o ajuste fino.
          </div>
        )}
      </div>

      {onCenterOnDevice && devicePosition && (
        <button
          type="button"
          onClick={onCenterOnDevice}
          title="Centralizar na minha localização atual"
          className="absolute top-3 right-3 z-400 p-2 bg-white dark:bg-[#1C1D22] border border-zinc-300 dark:border-zinc-700 rounded-md shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
        >
          <LocateFixed className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </button>
      )}
    </div>
  )
}
