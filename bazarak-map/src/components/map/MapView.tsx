
 'use client';
 
import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
 import 'leaflet/dist/leaflet.css';
 import L from 'leaflet';
 
 // Fix for default marker icons in React-Leaflet
 delete (L.Icon.Default.prototype as any)._getIconUrl;
 L.Icon.Default.mergeOptions({
   iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
   iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
   shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
 });
 
type StoredCustomer = { id: number; name: string; mobile?: string; phone?: string; group?: string; address?: string; location?: { lat?: number; lng?: number }; lat?: number; lng?: number };
const locationOf = (customer: StoredCustomer): [number, number] | null => {
  const lat = Number(customer.location?.lat ?? customer.lat);
  const lng = Number(customer.location?.lng ?? customer.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

const MapClickHandler = ({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
   
  return null;
};
   
const MapView = () => {
  const [position] = useState<[number, number]>([36.2133, 57.6819]); // Sabzevar
  const [customers, setCustomers] = useState<StoredCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<StoredCustomer | null>(null);
  const [newMarker, setNewMarker] = useState<L.LatLng | null>(null);

  const handleMapClick = useCallback((latlng: L.LatLng) => {
    setNewMarker(latlng);
    console.log('Map clicked at:', latlng);
  }, []);
  useEffect(() => {
    fetch('/api/map-data', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setCustomers(Array.isArray(data.customers) ? data.customers : []))
      .catch(() => setCustomers([]));
  }, []);
 
  return (
    <MapContainer 
      center={position} 
      zoom={13} 
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      
      <MapClickHandler onMapClick={handleMapClick} />
      
      {customers.map((customer) => {
        const location = locationOf(customer);
        return location ? (
          <Marker key={customer.id} position={location} eventHandlers={{ click: () => setSelectedCustomer(customer) }}>
            <Popup><div><h3 className="font-bold">{customer.name}</h3><p>{customer.mobile || customer.phone}</p><p>{customer.group || 'مشتری'}</p></div></Popup>
          </Marker>
        ) : null;
      })}
      
      {selectedCustomer && locationOf(selectedCustomer) && (
        <Marker position={locationOf(selectedCustomer)!}>
          <Popup>
            <div>
              <h3 className="font-bold">{selectedCustomer.name}</h3>
              <p>{selectedCustomer.mobile || selectedCustomer.phone}</p>
              <p>{selectedCustomer.group || 'مشتری'}</p>
            </div>
          </Popup>
        </Marker>
      )}
      
      {newMarker && (
        <Marker position={[newMarker.lat, newMarker.lng]}>
          <Popup>
            <div>
              <h3 className="font-bold">موقعیت جدید</h3>
              <p>-lat: {newMarker.lat.toFixed(4)}</p>
              <p>-lng: {newMarker.lng.toFixed(4)}</p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
};
 
export default MapView;
