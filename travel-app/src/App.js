import React, { useState, useEffect } from 'react';
import { apiKey } from "./key";
import { db, storage, serverTimestamp, auth } from './firebase'; 
import { collection, addDoc, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import './App.css';

function App() {
  return (
    <Router>
        <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Home/>}/>
        </Routes>
        </div>
    </Router>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (e) {
      console.error('Login error: ', e);
      setError(e.message);
    }
  };

  return (
    <div className="LoginSignup">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <p>Email: </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-fields"
        />
        <p>Password: </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input-fields"
        />
        <button type="submit" className="submit">
          Login
        </button>
        {error && <p className="login-error">{error}</p>}
      </form>
      <p>New user? Sign up <Link to="/signup" className="signup">here</Link></p>
    </div>
  );
}

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (e) {
      console.error('Error during sign up: ', e);
      setError(e.message);
    }
  };

  return (
    <div className="LoginSignup">
      <h2>Sign Up</h2>
      <form onSubmit={handleSignUp}>
        <p>Email: </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-fields"
        />
        <p>Password: </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input-fields"
        />
        <button type="submit" className="submit">
          Sign Up
        </button>
        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
}

function Home() {
  const [entries, setEntries] = useState([]);
  const [user, setUser] = useState(null);
  const [map, setMap] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
        navigate('/login');
      }
    });
  }, [navigate]);

  useEffect(() => {
    const fetchUserEntries = async () => {
      if (user) {
        try {
          const userId = user.uid;
          const userEntriesSnapshot = await getDocs(collection(db, `users/${userId}/entries`));
          let userEntriesData = userEntriesSnapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
          userEntriesData = userEntriesData.sort((a, b) => b.date - a.date);
          
          setEntries(userEntriesData);
        } catch (error) {
          console.error('Error fetching user entries:', error);
        }
      }
    };

    fetchUserEntries();
  }, [user]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    window.initMap = () => {
      const mapInstance = new window.google.maps.Map(document.getElementById('map'), {
        center: { lat: 47.6062, lng: -122.3321 },
        zoom: 8,
      });

      mapInstance.addListener('click', (e) => {
        placeMarker(e.latLng);
        mapInstance.setOptions({ draggableCursor: 'crosshair' });

        setTimeout(() => {
          mapInstance.setOptions({ draggableCursor: null });
    }, 1000);
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
    entries.forEach((entry) => {
      new window.google.maps.Marker({
        position: entry.location,
        map: map,
        title: entry.description,
      });
    });
  };

  const loadEntries = () => {
    const entriesCollection = collection(db, 'entries');
    const entriesQuery = query(entriesCollection, orderBy('timestamp', 'desc'));
    onSnapshot(entriesQuery, (snapshot) => {
      const entryList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      displayEntriesOnMap(entryList);
    });
  };

  const addTravelEntry = async () => {
    const fileInput = document.getElementById('imageUpload');
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const file = fileInput.files[0];
    let entryDate = document.getElementById('entryDate').value;

    if (entryDate) {
      const dateObj = new Date(entryDate);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0'); 
      const day = String(dateObj.getDate()).padStart(2, '0'); 
      entryDate = `${month}/${day}/${year}`;
    }
  
    if (file && title && description && selectedLocation) {
      const storageRef = ref(storage, `images/${file.name}`);
      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);
  
      const entry = {
        title: title,
        description: description,
        imageUrl: fileURL,
        location: {
          lat: selectedLocation.lat(),
          lng: selectedLocation.lng(),
        },
        date: entryDate, 
        timestamp: serverTimestamp(),
      };
  
      try {
        const userId = auth.currentUser.uid;
        const entryRef = await addDoc(collection(db, `users/${userId}/entries`), entry);
        const newEntry = { id: entryRef.id, ...entry };
        setEntries((prevEntries) => [...prevEntries, newEntry]);
        loadEntries();
        console.log('Entry added');
      } catch (error) {
        console.error('Error adding entry:', error);
      }
    } else {
      alert('Please provide a title, description, an image, and select a location on the map.');
    }
  };

  const signOutUser = () => {
    signOut(auth)
      .then(() => {
        navigate('/login');
      })
      .catch((error) => {
        console.error('Error signing out: ', error);
      });
  };

  const handleEntryDoubleClick = (entry) => {
    if (map) {
      map.setCenter(entry.location);
      map.setZoom(12);
    }
  };

  if (!user) {
    return (
      <p>
        Please <Link to="/login">log in</Link>
      </p>
    );
  }

  return (
    <div>
      <header className="App-header">
        <h1>Travel Journal</h1>
        <button className="header-button" onClick={signOutUser}>
          Sign out
        </button>
      </header>
      <div id="map" style={{ height: '80vh', width: '100vw' }}></div>
      <div className="library-title"><h2>Add a Journal Entry</h2></div>
      <div className="input-container">
        <div><input type="date" id="entryDate" /></div>
        <div><input type="file" id="imageUpload" /></div>
        <div><input type="text" id="title" placeholder="Enter title of entry" /></div>
        <div><textarea id="description" placeholder="Describe your trip!"></textarea></div>
        <div><button onClick={addTravelEntry}>Add Entry</button></div>
      </div>
      <div className="library-title"><h2>My Travel Library</h2></div>
      <div className="entries-container">
        {entries.map((entry) => (
          <div key={entry.id} className="entry" onDoubleClick={() => handleEntryDoubleClick(entry)}>
            <p>{entry.date}</p>
            <h2>{entry.title}</h2>
            <p>{entry.description}</p>
            <img
              src={entry.imageUrl}
              alt={entry.description}
              style={{ maxHeight: '100%', objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;