import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
} from 'react-native';
import { registerPushToken, fetchAppSettings, theme, themedStyles, useThemeMode } from '@app-rennesvtc/shared';
import { supabase } from './lib/supabase';
import DriverHome from './screens/DriverHome';
import DriverMenu from './screens/DriverMenu';
import { HEADER_IMAGE, Icon } from './icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

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
  const [showMenu, setShowMenu] = useState(false);

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

  if (checkingSession || !themeLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaView key={mode} style={styles.sessionContainer}>
        <View style={styles.header}>
          <Image source={HEADER_IMAGE} style={styles.headerImage} resizeMode="cover" />
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu((v) => !v)} accessibilityLabel={showMenu ? 'Fermer le menu' : 'Ouvrir le menu'}>
            <Icon name={showMenu ? 'close' : 'menu'} color="w" size={30} />
          </TouchableOpacity>
        </View>
        {showMenu ? <DriverMenu session={session} onClose={() => setShowMenu(false)} themePref={themePref} onThemePref={setThemePref} /> : <DriverHome session={session} />}
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
