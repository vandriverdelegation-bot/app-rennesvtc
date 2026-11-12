import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

// Tablette d'accueil du client (image « WELCOME » avec son nom), a montrer a l'arrivee.
// Mode normal : image en largeur ; mode « tablette » : image tournee a 90 degres pour remplir l'ecran tenu a la verticale.
export default function WelcomeTablet({ rideId, token, onClose }) {
  const { width, height } = useWindowDimensions();
  const [rotated, setRotated] = useState(false);
  const [loading, setLoading] = useState(true);
  const uri = `${process.env.EXPO_PUBLIC_BACKEND_URL}/driver/accueil/${rideId}?token=${encodeURIComponent(token)}`;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <StatusBar hidden />
        <View style={styles.stage}>
          {loading ? <ActivityIndicator color="#5BD42A" style={StyleSheet.absoluteFill} /> : null}
          <Image
            source={{ uri }}
            onLoadEnd={() => setLoading(false)}
            resizeMode="contain"
            style={rotated ? { width: height, height: width, transform: [{ rotate: '90deg' }] } : { width, height: (width * 941) / 1672 }}
          />
        </View>
        <View style={styles.bar}>
          <TouchableOpacity style={styles.btn} onPress={() => setRotated((r) => !r)}>
            <Text style={styles.btnText}>{rotated ? 'Vue normale' : 'Plein écran (tablette)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(uri)}>
            <Text style={styles.btnText}>Ouvrir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.close]} onPress={onClose}>
            <Text style={styles.btnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', gap: 8, padding: 12, justifyContent: 'center' },
  btn: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#5BD42A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  close: { backgroundColor: '#1A1D1A' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
