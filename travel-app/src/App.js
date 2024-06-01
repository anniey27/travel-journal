import React, { useState, useEffect, useCallback } from 'react';
import { apiKey } from "./key";
import { db, storage, serverTimestamp } from './firebase'; // Importing db, storage, and serverTimestamp from firebase.js
import { collection, addDoc, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';

function App() {
  const [map, setMap] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    window.initMap = () => {
      const mapInstance = new window.google.maps.Map(document.getElementById('map'), {
        center: { lat: -34.397, lng: 150.644 },
        zoom: 8
      });

      mapInstance.addListener('click', (e) => {
        placeMarker(e.latLng);
      });

      setMap(mapInstance);
      loadEntries();
    };

    return () => {
      delete window.initMap;
    };
  }, []);

  const placeMarker = (location) => {
    new window.google.maps.Marker({
      position: location,
      map: map,
    });
    setSelectedLocation(location);
  };

  const displayEntriesOnMap = (entries) => {
    entries.forEach(entry => {
      new window.google.maps.Marker({
        position: entry.location,
        map: map,
        title: entry.description
      });
    });
  };

  const loadEntries = () => {
    const entriesCollection = collection(db, 'entries');
    const entriesQuery = query(entriesCollection, orderBy('timestamp', 'desc'));
    onSnapshot(entriesQuery, (snapshot) => {
      const entryList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      displayEntriesOnMap(entryList);
    });
  };

  const addTravelEntry = async () => {
    const fileInput = document.getElementById('imageUpload');
    const description = document.getElementById('description').value;
    const file = fileInput.files[0];

    if (file && description && selectedLocation) {
      const storageRef = storage.ref();
      const fileRef = storageRef.child(`images/${file.name}`);
      await fileRef.put(file);
      const fileURL = await fileRef.getDownloadURL();

      const entry = {
        description: description,
        imageUrl: fileURL,
        location: {
          lat: selectedLocation.lat(),
          lng: selectedLocation.lng()
        },
        timestamp: serverTimestamp()
      };

      addDoc(collection(db, 'entries'), entry).then(() => {
        console.log('Entry added');
        loadEntries();
      }).catch(error => {
        console.error('Error adding entry:', error);
      });
    } else {
      alert('Please provide a description, an image, and select a location on the map.');
    }
  };

  return (
    <div>
      <div id="map" style={{ height: '80vh', width: '100vw' }}></div>
      <div id="controls">
        <input type="file" id="imageUpload" />
        <input type="text" id="description" placeholder="Describe your trip" />
        <button onClick={addTravelEntry}>Add Entry</button>
      </div>
    </div>
  );
}

export default App;