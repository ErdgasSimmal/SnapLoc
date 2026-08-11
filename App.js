import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

// Trag hier deinen API-Key ein:
const API_KEY = 'AIzaSyCrQK44Lj4stRsL-UO9XDTNFmmwlu6-3wY';

export default function App() {
  const [bild, setBild] = useState(null);
  const [ergebnisName, setErgebnisName] = useState('');
  const [koordinaten, setKoordinaten] = useState(null); // { lat, lng } oder null
  const [aehnlicheBilder, setAehnlicheBilder] = useState([]);
  const [ladt, setLadt] = useState(false);
  const [fehlerText, setFehlerText] = useState('');

  const fotoAufnehmen = async () => {
    const berechtigung = await ImagePicker.requestCameraPermissionsAsync();
    if (!berechtigung.granted) {
      setFehlerText('Camera permission denied!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      setBild(result.assets[0].uri);
      erkenneOrt(result.assets[0].base64);
    }
  };

  const ausGalerieWaehlen = async () => {
    const berechtigung = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!berechtigung.granted) {
      setFehlerText('Photo library access denied!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      setBild(result.assets[0].uri);
      erkenneOrt(result.assets[0].base64);
    }
  };

  const erkenneOrt = async (base64Bild) => {
    setLadt(true);
    setFehlerText('');
    setErgebnisName('');
    setKoordinaten(null);
    setAehnlicheBilder([]);

    if (!base64Bild) {
      setFehlerText('Debug: image data is empty/undefined!');
      setLadt(false);
      return;
    }

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64Bild },
                features: [
                  { type: 'LANDMARK_DETECTION', maxResults: 1 },
                  { type: 'WEB_DETECTION', maxResults: 5 },
                ],
              },
            ],
          }),
        }
      );

      const daten = await response.json();

      if (daten.error) {
        setFehlerText('API error: ' + JSON.stringify(daten.error));
        setLadt(false);
        return;
      }

      if (!daten.responses || !daten.responses[0]) {
        setFehlerText('Unexpected response: ' + JSON.stringify(daten));
        setLadt(false);
        return;
      }

      const antwort = daten.responses[0];
      const landmark = antwort.landmarkAnnotations?.[0];
      const webErkennung = antwort.webDetection;

      // 1. Namen bestimmen: erst Landmark (genauer), sonst bestes Web-Entity
      let name = null;
      if (landmark) {
        name = landmark.description;
        const lat = landmark.locations?.[0]?.latLng?.latitude;
        const lng = landmark.locations?.[0]?.latLng?.longitude;
        if (lat != null && lng != null) {
          setKoordinaten({ lat, lng });
        }
      } else if (webErkennung?.webEntities?.length > 0) {
        // Bestes Web-Entity mit einem echten Namen nehmen
        const besteEntity = webErkennung.webEntities.find((e) => e.description);
        if (besteEntity) {
          name = besteEntity.description;
        }
      }

      if (name) {
        setErgebnisName(name);
      } else {
        setErgebnisName('Nothing recognizable found.');
      }

      // 2. Ähnliche Bilder aus dem Internet sammeln
      const bilder = webErkennung?.visuallySimilarImages
        ?.slice(0, 3)
        .map((img) => img.url)
        .filter(Boolean);
      if (bilder && bilder.length > 0) {
        setAehnlicheBilder(bilder);
      }
    } catch (fehler) {
      setFehlerText('Error: ' + fehler.message);
    }

    setLadt(false);
  };

  const inMapsOeffnen = () => {
    let url;
    if (koordinaten) {
      url = `https://www.google.com/maps?q=${koordinaten.lat},${koordinaten.lng}`;
    } else if (ergebnisName) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        ergebnisName
      )}`;
    }
    if (url) {
      Linking.openURL(url);
    }
  };

  return (
    <LinearGradient
      colors={['#1e3c72', '#2a5298', '#7db9e8']}
      style={styles.hintergrund}
    >
      <ScrollView contentContainerStyle={styles.scrollInhalt}>
        <View style={styles.karte}>
          <Text style={styles.titel}>📍 Snap & Locate</Text>
          <Text style={styles.untertitel}>
            Photograph a landmark and I'll tell you where it is
          </Text>

          <View style={styles.bildBereich}>
            {bild ? (
              <Image source={{ uri: bild }} style={styles.bild} />
            ) : (
              <View style={styles.platzhalter}>
                <Text style={styles.platzhalterText}>📷</Text>
              </View>
            )}
          </View>

          {ladt && (
            <View style={styles.ladeBereich}>
              <ActivityIndicator size="small" color="#2a5298" />
              <Text style={styles.ladt}>Analyzing photo...</Text>
            </View>
          )}

          {fehlerText !== '' && !ladt && (
            <Text style={styles.fehler}>{fehlerText}</Text>
          )}

          {ergebnisName !== '' && !ladt && (
            <>
              <Text style={styles.ergebnis}>{ergebnisName}</Text>

              {koordinaten && (
                <Text style={styles.koordinatenText}>
                  Lat: {koordinaten.lat.toFixed(5)}, Lng:{' '}
                  {koordinaten.lng.toFixed(5)}
                </Text>
              )}

              <TouchableOpacity
                style={styles.mapsButton}
                onPress={inMapsOeffnen}
              >
                <Text style={styles.mapsButtonText}>Open in Google Maps</Text>
              </TouchableOpacity>

              {aehnlicheBilder.length > 0 && (
                <View style={styles.aehnlicheBereich}>
                  <Text style={styles.aehnlicheTitel}>Similar images</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {aehnlicheBilder.map((url, i) => (
                      <Image
                        key={i}
                        source={{ uri: url }}
                        style={styles.aehnlichesBild}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={styles.button} onPress={fotoAufnehmen}>
            <Text style={styles.buttonText}>
              {bild ? 'New Photo' : 'Take Photo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonSekundaer}
            onPress={ausGalerieWaehlen}
          >
            <Text style={styles.buttonSekundaerText}>
              Choose from Gallery
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hintergrund: {
    flex: 1,
  },
  scrollInhalt: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  karte: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  titel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3c72',
    marginBottom: 4,
  },
  untertitel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  bildBereich: {
    marginBottom: 16,
  },
  bild: {
    width: 240,
    height: 240,
    borderRadius: 14,
  },
  platzhalter: {
    width: 240,
    height: 240,
    borderRadius: 14,
    backgroundColor: '#eef2f7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dde4ee',
    borderStyle: 'dashed',
  },
  platzhalterText: {
    fontSize: 48,
  },
  ladeBereich: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ladt: {
    fontStyle: 'italic',
    color: '#666',
    marginLeft: 8,
  },
  fehler: {
    fontSize: 14,
    textAlign: 'center',
    color: '#b00020',
    marginBottom: 16,
  },
  ergebnis: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1e3c72',
    marginBottom: 4,
  },
  koordinatenText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  mapsButton: {
    backgroundColor: '#34a853',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 16,
  },
  mapsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  aehnlicheBereich: {
    width: '100%',
    marginBottom: 16,
  },
  aehnlicheTitel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  aehnlichesBild: {
    width: 90,
    height: 90,
    borderRadius: 10,
    marginRight: 8,
  },
  button: {
    backgroundColor: '#2a5298',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSekundaer: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  buttonSekundaerText: {
    color: '#2a5298',
    fontSize: 15,
    fontWeight: '500',
  },
});
