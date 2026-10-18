import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { registerPushToken, fetchAppSettings, theme } from '@app-rennesvtc/shared';
import { supabase } from './lib/supabase';
import ClientHome from './screens/ClientHome';

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
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [appName, setAppName] = useState('RENNES VTC');
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    if (session) registerPushToken(supabase, session.user.id);
  }, [session?.user.id]);

  async function handleSubmit() {
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Email et mot de passe requis.');
      return;
    }
    setSubmitting(true);
    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
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
        <ClientHome session={session} />
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.link}>Se deconnecter</Text>
        </TouchableOpacity>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoRow}>
        <Text style={styles.logo}>{renderAppName(appName)}</Text>
      </View>
      <Text style={styles.title}>{mode === 'login' ? 'Connexion' : 'Creer un compte'}</Text>
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
        <Text style={styles.buttonText}>
          {submitting ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.link}>
          {mode === 'login' ? 'Pas encore de compte ? Inscrivez-vous' : 'Deja un compte ? Connectez-vous'}
        </Text>
      </TouchableOpacity>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  logoRow: { marginBottom: 24, alignItems: 'center' },
  logo: { fontSize: 26, fontWeight: '800', color: theme.colors.text, letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: theme.colors.text },
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
  link: { marginTop: 14, color: theme.colors.accent },
  error: { color: theme.colors.error },
});
