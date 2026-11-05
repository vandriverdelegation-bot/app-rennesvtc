import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { registerPushToken, fetchAppSettings, theme, themedStyles, useThemeMode } from '@app-rennesvtc/shared';
import { supabase } from './lib/supabase';
import ClientHome from './screens/ClientHome';
import ClientMenu from './screens/ClientMenu';
import BottomNav from './screens/BottomNav';

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

// Retour de la connexion Google : le navigateur rouvre l'app sur ce lien (schema declare dans app.json).
const GOOGLE_REDIRECT = 'rennesvtc-client://auth';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

// Polices du design : Outfit (titres) et Inter (texte).
const FONT_FILES = {
  Outfit_600SemiBold: require('./assets/fonts/Outfit_600SemiBold.ttf'),
  Outfit_700Bold: require('./assets/fonts/Outfit_700Bold.ttf'),
  Inter_400Regular: require('./assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('./assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('./assets/fonts/Inter_600SemiBold.ttf'),
};

function AppContent() {
  const { pref: themePref, mode: themeMode, choose: setThemePref, loaded: themeLoaded } = useThemeMode();
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [appName, setAppName] = useState('RENNES VTC');
  const [logoUrl, setLogoUrl] = useState(null);
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('home'); // home | account
  const [menuView, setMenuView] = useState('menu');
  const [focus, setFocus] = useState(null); // zone de l'accueil a afficher (barre du bas)
  const [booking, setBooking] = useState(false); // formulaire de commande ouvert : pas de barre du bas
  const [needPhone, setNeedPhone] = useState(false);

  useEffect(() => {
    fetchAppSettings(supabase).then((settings) => {
      if (settings?.app_name) setAppName(settings.app_name);
      if (settings?.logo_url) setLogoUrl(settings.logo_url);
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
    async function finishGoogle(url) {
      if (!url?.startsWith(GOOGLE_REDIRECT)) return;
      const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '');
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
      else setErrorMsg(params.get('error_description') || 'Connexion Google impossible.');
    }
    Linking.getInitialURL().then(finishGoogle);
    const sub = Linking.addEventListener('url', (e) => finishGoogle(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!session) return;
    registerPushToken(supabase, session.user.id);
    // Reporte le nom et le telephone saisis a l'inscription dans le profil (une seule fois).
    const meta = session.user.user_metadata ?? {};
    supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        const patch = {};
        if (!data?.full_name && (meta.full_name || meta.name)) patch.full_name = meta.full_name || meta.name;
        if (!data?.phone && meta.phone) patch.phone = meta.phone;
        if (Object.keys(patch).length) supabase.from('profiles').update(patch).eq('id', session.user.id).then(() => {});
        // Un compte cree avec Google n'a pas de telephone : on le demande avant d'aller plus loin.
        setNeedPhone(!(data?.phone || patch.phone));
      });
  }, [session?.user.id]);

  async function handleGoogle() {
    setErrorMsg('');
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: GOOGLE_REDIRECT, skipBrowserRedirect: true } });
    if (error) setErrorMsg(error.message);
    else Linking.openURL(data.url);
  }

  async function savePhone() {
    if (phone.trim().length < 6) return setErrorMsg('Indiquez un numero de telephone valide.');
    const { error } = await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', session.user.id);
    if (error) setErrorMsg(error.message);
    else {
      setErrorMsg('');
      setNeedPhone(false);
    }
  }

  async function handleSubmit() {
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Email et mot de passe requis.');
      return;
    }
    if (mode === 'signup' && (!fullName.trim() || !phone.trim())) {
      setErrorMsg('Nom et telephone requis : votre chauffeur en aura besoin pour vous joindre.');
      return;
    }
    setSubmitting(true);
    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim(), phone: phone.trim() } } });
    setSubmitting(false);
    if (error) setErrorMsg(error.message);
  }

  function openAccount(view = 'menu') {
    setMenuView(view);
    setTab('account');
  }

  function navigate(key) {
    if (key === 'account') return openAccount();
    setTab('home');
    setFocus({ to: key === 'bookings' ? 'bookings' : 'top', n: Date.now() });
  }

  if (checkingSession || !themeLoaded || (!fontsLoaded && !fontError)) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  if (session && needPhone) {
    return (
      <SafeAreaView key={themeMode} style={styles.loginSafe}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Derniere etape</Text>
          <Text style={styles.link}>Votre chauffeur a besoin de votre numero pour vous joindre.</Text>
          <TextInput style={styles.input} placeholder="Telephone" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={savePhone}>
            <Text style={styles.buttonText}>Continuer</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaView key={themeMode} style={styles.sessionContainer}>
        {tab === 'account' ? (
          <ClientMenu session={session} initialView={menuView} onClose={() => setTab('home')} themePref={themePref} onThemePref={setThemePref} />
        ) : (
          <ClientHome session={session} appName={appName} onViewChange={(v) => setBooking(v === 'book')} onOpenAccount={() => openAccount('account')} onOpenNotifications={() => openAccount('notifications')} focus={focus} />
        )}
        {tab === 'account' || !booking ? <BottomNav active={tab === 'account' ? 'account' : focus?.to === 'bookings' ? 'bookings' : 'home'} onPress={navigate} /> : null}
        <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView key={themeMode} style={styles.loginSafe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoRow}>
            <Text style={styles.logo}>{renderAppName(appName)}</Text>
          </View>
          <Text style={styles.title}>{mode === 'login' ? 'Connexion' : 'Creer un compte'}</Text>
          {mode === 'signup' ? (
            <>
              <TextInput style={styles.input} placeholder="Prénom et nom" placeholderTextColor={theme.colors.textMuted} value={fullName} onChangeText={setFullName} />
              <TextInput style={styles.input} placeholder="Telephone" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            </>
          ) : null}
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
          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogle}>
            <Text style={styles.googleText}>Continuer avec Google</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.link}>
              {mode === 'login' ? 'Pas encore de compte ? Inscrivez-vous' : 'Deja un compte ? Connectez-vous'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  googleButton: { width: '100%', borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: theme.radius, padding: 14, alignItems: 'center', marginTop: 10 },
  googleText: { color: theme.colors.text, fontWeight: '600' },
  loginSafe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flexGrow: 1,
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
  logoRow: { marginBottom: 24, alignItems: 'center' },
  logo: { fontFamily: theme.fonts.title, fontSize: 28, color: theme.colors.text, letterSpacing: 1 },
  title: { fontFamily: theme.fonts.title, fontSize: 22, marginBottom: 12, color: theme.colors.text },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: 14,
    padding: 14,
    color: theme.colors.text,
  },
  button: {
    width: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: theme.colors.accentText, fontWeight: '800', fontSize: 16 },
  link: { marginTop: 14, color: theme.colors.accent },
  error: { color: theme.colors.error, textAlign: 'center' },
}));
