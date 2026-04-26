import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './PropertyMap.css';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const PropertyMap = ({ property, onLocationChange, editable = false }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [coordinates, setCoordinates] = useState({
    lat: property?.latitude || 9.5,
    lng: property?.longitude || 40.5,
  });
  const [address, setAddress] = useState(property?.location || '');
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView(
      [coordinates.lat, coordinates.lng],
      13
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 2,
    }).addTo(map);

    // Add marker
    const marker = L.marker([coordinates.lat, coordinates.lng], {
      draggable: editable,
      title: address || 'Property Location',
    })
      .addTo(map)
      .bindPopup(
        `<div class="map-popup">
          <strong>${property?.title || 'Property'}</strong><br/>
          ${address || 'Location not set'}<br/>
          <small>Lat: ${coordinates.lat.toFixed(4)}, Lng: ${coordinates.lng.toFixed(4)}</small>
        </div>`
      )
      .openPopup();

    markerRef.current = marker;
    mapInstanceRef.current = map;
    setMapReady(true);

    // Handle marker drag
    if (editable) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCoordinates({ lat: pos.lat, lng: pos.lng });
        if (onLocationChange) {
          onLocationChange({ lat: pos.lat, lng: pos.lng });
        }
      });

      // Handle map click
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setCoordinates({ lat, lng });
        if (onLocationChange) {
          onLocationChange({ lat, lng });
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker when coordinates change
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([coordinates.lat, coordinates.lng]);
      markerRef.current.setPopupContent(
        `<div class="map-popup">
          <strong>${property?.title || 'Property'}</strong><br/>
          ${address || 'Location not set'}<br/>
          <small>Lat: ${coordinates.lat.toFixed(4)}, Lng: ${coordinates.lng.toFixed(4)}</small>
        </div>`
      );
      mapInstanceRef.current.setView([coordinates.lat, coordinates.lng], 13);
    }
  }, [coordinates, address, property?.title]);

  // Reverse geocoding (get address from coordinates)
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      if (data.address) {
        const addressParts = [];
        if (data.address.road) addressParts.push(data.address.road);
        if (data.address.suburb) addressParts.push(data.address.suburb);
        if (data.address.city) addressParts.push(data.address.city);
        if (data.address.state) addressParts.push(data.address.state);
        const fullAddress = addressParts.join(', ');
        setAddress(fullAddress);
        return fullAddress;
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
    return null;
  };

  // Forward geocoding (search for address)
  const searchAddress = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    setCoordinates({ lat, lng });
    setAddress(suggestion.display_name);
    setSuggestions([]);
    setSearchInput('');

    if (onLocationChange) {
      onLocationChange({ lat, lng });
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (value.length > 2) {
      searchAddress(value);
    } else {
      setSuggestions([]);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoordinates({ lat: latitude, lng: longitude });
          reverseGeocode(latitude, longitude);
          if (onLocationChange) {
            onLocationChange({ lat: latitude, lng: longitude });
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to get your current location');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  return (
    <div className="property-map-container">
      <div className="map-header">
        <h3>📍 Property Location</h3>
        {editable && (
          <button
            className="btn-current-location"
            onClick={handleGetCurrentLocation}
            type="button"
            title="Use current location"
          >
            📍 Current Location
          </button>
        )}
      </div>

      {editable && (
        <div className="map-search-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search for address or location..."
              value={searchInput}
              onChange={handleSearchChange}
              className="search-input"
            />
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="suggestion-name">{suggestion.name}</div>
                    <div className="suggestion-address">
                      {suggestion.display_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={mapRef} className="map-container" />

      <div className="map-info">
        <div className="info-row">
          <label>Address:</label>
          <span>{address || 'Not set'}</span>
        </div>
        <div className="info-row">
          <label>Latitude:</label>
          <span>{coordinates.lat.toFixed(6)}</span>
        </div>
        <div className="info-row">
          <label>Longitude:</label>
          <span>{coordinates.lng.toFixed(6)}</span>
        </div>
        {editable && (
          <div className="info-hint">
            💡 Drag the marker or click on the map to set location. Search for
            address above.
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyMap;
