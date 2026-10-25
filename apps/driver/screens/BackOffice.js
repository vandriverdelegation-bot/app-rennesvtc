import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '@app-rennesvtc/shared';
import { supabase } from '../lib/supabase';

// Back-office (administration) affiche dans l'app, reserve au proprietaire. La session du proprietaire est
// transmise a la page sans refresh_token : la page ne peut pas la renouveler (donc pas de conflit avec
// la session de l'app) et elle expire au bout d'une heure ; il suffit alors de rouvrir l'ecran.
export default function BackOffice() {
  const backend = process.env.EXPO_PUBLIC_BACKEND_URL;
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
  }, []);

  if (session === undefined) return <ActivityIndicator style={styles.center} color={theme.colors.accent} />;
  if (!session) return <Text style={styles.error}>Session expiree : reconnectez-vous a l'app.</Text>;

  const projectRef = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const stored = JSON.stringify({ ...session, refresh_token: '' });
  const injected = `
    window.__IN_APP = true;
    try { localStorage.setItem(${JSON.stringify(`sb-${projectRef}-auth-token`)}, ${JSON.stringify(stored)}); } catch (e) {}
    true;
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: `${backend}/admin/` }}
        injectedJavaScriptBeforeContentLoaded={injected}
        originWhitelist={[backend]}
        // Toute navigation hors du serveur Rennes VTC s'ouvre dans le navigateur, jamais dans cet ecran.
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith(backend) || req.url.startsWith('about:') || req.url.startsWith('blob:') || req.url.startsWith('data:')) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => <ActivityIndicator style={styles.center} color={theme.colors.accent} />}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', backgroundColor: theme.colors.background },
  web: { flex: 1, backgroundColor: theme.colors.background },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  error: { color: theme.colors.error, padding: 16 },
});
