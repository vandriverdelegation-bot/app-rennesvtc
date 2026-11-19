// Ecran d'ouverture des deux applis : image plein ecran + barre de chargement animee.
// `source` = require('./assets/splash-ouverture.jpg') de l'appli ; `minMs` = duree minimale d'affichage (voir useLaunchDelay).
function LaunchScreen({ source }) {
  const React = require('react');
  const { View, Text, Image, Animated, Easing, StatusBar, StyleSheet } = require('react-native');
  const h = React.createElement;
  const progress = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress]);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['6%', '100%'] });
  return h(View, { style: { flex: 1, backgroundColor: '#05080F' } },
    h(StatusBar, { barStyle: 'light-content', translucent: true, backgroundColor: 'transparent' }),
    h(Image, { source, style: StyleSheet.absoluteFill, resizeMode: 'cover' }),
    h(View, { style: { position: 'absolute', left: 0, right: 0, bottom: '9%', alignItems: 'center' } },
      h(View, { style: { width: '34%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' } },
        h(Animated.View, { style: { width, height: 4, borderRadius: 2, backgroundColor: '#47C415' } })),
      h(Text, { style: { color: '#F4F6F2', fontSize: 15, letterSpacing: 3, marginTop: 18 } }, 'Rennes VTC')));
}

// true une fois la duree minimale ecoulee : l'ecran d'ouverture reste visible au moins `ms`, meme si l'appli est deja prete.
function useLaunchDelay(ms = 1600) {
  const React = require('react');
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return done;
}

module.exports = { LaunchScreen, useLaunchDelay };
