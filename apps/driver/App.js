import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
  useWindowDimensions,
} from 'react-native';
import { registerPushToken, fetchAppSettings, theme, themedStyles, useThemeMode, LaunchScreen, useLaunchDelay } from '@app-rennesvtc/shared';
import { supabase } from './lib/supabase';
import DriverHome from './screens/DriverHome';
import DriverMenu from './screens/DriverMenu';
import DriverTabs from './screens/DriverTabs';
import CompactHeader from './screens/CompactHeader';
import { HEADER_IMAGE, Icon } from './icons';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Accentue le dernier mot du nom de l'app (ex: "Rennes VTC" -> "Rennes" + "VTC" en accent).
function renderAppName(appName) {
  const words = appName.trim().split(' ');
  const last = words.pop();
  return (
    <>
      {words.length ? words.join(' ') + ' ' : ''}
      <Text style={{ color: theme.colors.accent }}>{last}</Text>
    </>
  );
}

const TAB_TITLES = { map: 'Carte', calendar: 'Mes réservations', messages: 'Messages' };

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { pref: themePref, mode, choose: setThemePref, loaded: themeLoaded } = useThemeMode();
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [appName, setAppName] = useState('RENNES VTC');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('courses'); // courses | map | calendar | messages | profile
  const [online, setOnline] = useState(false);
  const [fullName, setFullName] = useState('');
  const [headerInfo, setHeaderInfo] = useState({ compact: false, title: '' }); // en-tete de l'onglet Courses : reduit quand une reservation est affichee
  const insets = useSafeAreaInsets();
  const { width: heroW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0); // barre d'etat, meme quand Android ne la declare pas
  const heroH = Math.min(440, Math.max(352, Math.round(winH * 0.42))); // meme en-tete que l'appli client
  const launchDone = useLaunchDelay();

  useEffect(() => {
    fetchAppSettings(supabase).then((settings) => {
      if (settings?.app_name) setAppName(settings.app_name);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) registerPushToken(supabase, session.user.id, { courseChannel: true });
  }, [session?.user.id]);

  // Pastille « En ligne » du bandeau : relue regulierement (le statut se change dans Profil > Gamme, statut...).
  useEffect(() => {
    if (!session) return undefined;
    const load = () => supabase.from('profiles').select('online_status, full_name').eq('id', session.user.id).single().then(({ data }) => { setOnline(!!data?.online_status); setFullName(data?.full_name ?? ''); });
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [session?.user.id, tab]);

  async function handleLogin() {
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Email et mot de passe requis.');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      setErrorMsg(error.message);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    setSubmitting(false);

    if (profileError || profile?.role !== 'chauffeur') {
      await supabase.auth.signOut();
      setErrorMsg(profile?.role === 'candidat' ? "Votre dossier est en cours de validation. Vous recevrez un email dès l'activation de votre profil." : "Ce compte n'est pas un compte chauffeur.");
    }
  }

  if (checkingSession || !themeLoaded || !launchDone) {
    return <LaunchScreen source={require('./assets/splash-ouverture.jpg')} />;
  }

  if (session) {
    return (
      <SafeAreaView key={mode} style={styles.sessionContainer} edges={tab === 'profile' ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}>
        {tab !== 'profile' && (tab !== 'courses' || headerInfo.compact) ? (
          <CompactHeader title={tab === 'courses' ? headerInfo.title : TAB_TITLES[tab]} onBack={tab === 'courses' ? undefined : () => setTab('courses')} />
        ) : null}
        {tab === 'courses' && !headerInfo.compact ? (
          <View style={[styles.hero, { height: heroH }]}>
            <Image source={require('./assets/hero-rennes.jpg')} style={{ position: 'absolute', top: 0, left: 0, width: heroW, height: heroH, resizeMode: 'cover' }} resizeMode="cover" />
            <View pointerEvents="none" style={[styles.heroFade, { height: Math.round(heroH * 0.3) }]}>
              {Array.from({ length: 16 }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: `rgba(${theme.mode === 'light' ? '245,245,240' : '5,6,6'},${((i + 1) / 16) ** 1.9})` }} />)}
            </View>
            <View style={[styles.heroTop, { top: topPad + 12 }]}>
              <TouchableOpacity onPress={() => setTab('profile')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Ouvrir le profil">
                <Icon name="menu" color="white" size={28} />
              </TouchableOpacity>
              <View style={styles.onlineChip}>
                <View style={[styles.onlineDot, !online && { backgroundColor: '#8A8F8A' }]} />
                <Text style={styles.onlineText}>{online ? 'En ligne' : 'Hors ligne'}</Text>
              </View>
            </View>
            <Image source={require('./assets/logo-rennesvtc.png')} style={[styles.heroLogo, { top: topPad + 66 }]} resizeMode="contain" accessibilityLabel="Rennes VTC" />
            <View style={styles.greeting}>
              <Text style={styles.hello}>Bonjour,</Text>
              <Text style={styles.name} numberOfLines={1}>{fullName || 'et bienvenue'}</Text>
              <View style={styles.underline} />
            </View>
          </View>
        ) : null}
        <View style={{ flex: 1, width: '100%', display: tab === 'profile' ? 'none' : 'flex' }}>
          <DriverHome session={session} view={tab === 'profile' ? 'courses' : tab} onHeader={setHeaderInfo} />
        </View>
        {tab === 'profile' ? <DriverMenu session={session} onClose={() => setTab('courses')} themePref={themePref} onThemePref={setThemePref} /> : null}
        <DriverTabs active={tab} onPress={setTab} />
        <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView key={mode} style={styles.container}>
      <Text style={styles.logo}>{renderAppName(appName)}</Text>
      <Text style={styles.title}>Connexion chauffeur</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? '...' : 'Se connecter'}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        Pas encore de compte ? Contactez votre administrateur.
      </Text>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  sessionContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  hero: { width: '100%', overflow: 'hidden', backgroundColor: '#050606' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  heroTop: { position: 'absolute', top: 16, left: 22, right: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  onlineChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(10,12,10,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38D159' },
  onlineText: { color: '#F2F2EE', fontSize: 14, fontWeight: '600' },
  heroLogo: { position: 'absolute', top: 54, alignSelf: 'center', width: 168, height: 126 },
  greeting: { position: 'absolute', left: 24, right: 24, bottom: 22 },
  hello: { color: '#E8EAE6', fontSize: 20, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 8 },
  name: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 8 },
  underline: { width: 44, height: 4, borderRadius: 2, backgroundColor: theme.colors.accent, marginTop: 8 },
  headerImage: { flex: 1, aspectRatio: 760 / 166, borderRadius: 4 },
  menuButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginLeft: 8,
    borderWidth: 3,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { fontSize: 24, fontWeight: '800', color: theme.colors.text, letterSpacing: 1, marginBottom: 24 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 4, color: theme.colors.text },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    padding: 14,
    color: theme.colors.text,
  },
  button: {
    width: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: theme.colors.accentText, fontWeight: '700', fontSize: 16 },
  hint: { marginTop: 12, color: theme.colors.textMuted, fontSize: 12 },
  error: { color: theme.colors.error },
}));
