import { useEffect, useRef } from 'react'
import L from 'leaflet'

interface DeliveryRadiusMapProps {
  latitude: number
  longitude: number
  radiusKm: number
  showRadiusCircle?: boolean
  className?: string
  restaurantName?: string
}

export function DeliveryRadiusMap({
  latitude,
  longitude,
  radiusKm,
  showRadiusCircle = true,
  className = '',
  restaurantName = 'Restaurante',
}: DeliveryRadiusMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    const lat = latitude || -23.55052
    const lng = longitude || -46.633308

    if (!mapInstance.current) {
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      })

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map)

      // Clean Google Maps Roadmap Tiles
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }).addTo(map)

      // Custom Butter Yellow Modern Marker (Fixo)
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background-color: #F5DC55;
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2.5px solid #141416;
            box-shadow: 0 6px 16px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 8px;
              height: 8px;
              background-color: #141416;
              border-radius: 50%;
            "></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      })

      const marker = L.marker([lat, lng], {
        draggable: false,
        icon: customIcon,
      }).addTo(map)

      if (restaurantName) {
        marker.bindTooltip(restaurantName, { direction: 'top', className: 'font-mono text-xs' })
      }

      // Delivery Radius Circle
      const circle = L.circle([lat, lng], {
        radius: (radiusKm || 5) * 1000,
        color: '#C7A310',
        fillColor: '#F5DC55',
        fillOpacity: 0.18,
        weight: 2,
        dashArray: '5, 5',
      }).addTo(map)

      if (!showRadiusCircle) {
        circle.setStyle({ opacity: 0, fillOpacity: 0 })
      }

      mapInstance.current = map
      markerRef.current = marker
      circleRef.current = circle
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // Update center & marker if lat/lng change
  useEffect(() => {
    if (!mapInstance.current || !markerRef.current || !circleRef.current) return
    const lat = latitude || -23.55052
    const lng = longitude || -46.633308

    markerRef.current.setLatLng([lat, lng])
    circleRef.current.setLatLng([lat, lng])
  }, [latitude, longitude])

  // Update circle radius when radiusKm or showRadiusCircle changes
  useEffect(() => {
    if (!circleRef.current || !mapInstance.current) return
    if (showRadiusCircle) {
      const rMeters = (radiusKm || 1) * 1000
      circleRef.current.setRadius(rMeters)
      circleRef.current.setStyle({ opacity: 1, fillOpacity: 0.18 })

      if (markerRef.current) {
        const bounds = circleRef.current.getBounds()
        mapInstance.current.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 })
      }
    } else {
      circleRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
      if (markerRef.current) {
        mapInstance.current.setView(markerRef.current.getLatLng(), 13)
      }
    }
  }, [radiusKm, showRadiusCircle])

  return (
    <div className={`relative w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 ${className}`}>
      <div ref={mapRef} className="w-full h-full min-h-[320px]" />
    </div>
  )
}
