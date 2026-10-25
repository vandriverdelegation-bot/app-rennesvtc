import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { registerPushToken, fetchAppSettings, theme } from '@app-rennesvtc/shared';
import { supabase } from './lib/supabase';
import ClientHome from './screens/ClientHome';
import ClientMenu from './screens/ClientMenu';

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
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [appName, setAppName] = useState('RENNES VTC');
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
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
    if (!session) return;
    registerPushToken(supabase, session.user.id);
    // Reporte le nom et le telephone saisis a l'inscription dans le profil (une seule fois).
    const meta = session.user.user_metadata ?? {};
    if (meta.full_name || meta.phone) {
      supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          const patch = {};
          if (!data?.full_name && meta.full_name) patch.full_name = meta.full_name;
          if (!data?.phone && meta.phone) patch.phone = meta.phone;
          if (Object.keys(patch).length) supabase.from('profiles').update(patch).eq('id', session.user.id).then(() => {});
        });
    }
  }, [session?.user.id]);

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

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaView style={styles.sessionContainer}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>{appName}</Text>
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu((v) => !v)}>
            <Text style={styles.menuButtonText}>{showMenu ? 'Fermer' : 'Mon compte'}</Text>
          </TouchableOpacity>
        </View>
        {showMenu ? <ClientMenu session={session} onClose={() => setShowMenu(false)} /> : <ClientHome session={session} />}
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.loginSafe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoRow}>
            <Text style={styles.logo}>{renderAppName(appName)}</Text>
          </View>
          <Text style={styles.title}>{mode === 'login' ? 'Connexion' : 'Creer un compte'}</Text>
          {mode === 'signup' ? (
            <>
              <TextInput style={styles.input} placeholder="Nom et prenom" placeholderTextColor={theme.colors.textMuted} value={fullName} onChangeText={setFullName} />
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
          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.link}>
              {mode === 'login' ? 'Pas encore de compte ? Inscrivez-vous' : 'Deja un compte ? Connectez-vous'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  headerLogo: { fontSize: 18, fontWeight: '800', color: theme.colors.text, letterSpacing: 1 },
  menuButton: {
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.radius,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  menuButtonText: { color: theme.colors.text, fontWeight: '700' },
  logoRow: { marginBottom: 24, alignItems: 'center' },
  logo: { fontSize: 28, fontWeight: '800', color: theme.colors.text, letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12, color: theme.colors.text },
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
});
