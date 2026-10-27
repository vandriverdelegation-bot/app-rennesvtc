import { Component } from 'react';
import { ScrollView, Text } from 'react-native';
import { registerRootComponent } from 'expo';

// Affiche l'erreur a l'ecran au lieu de fermer l'app (diagnostic des plantages au demarrage en version installee).
function ErrorScreen({ error }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#000' }} contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
      <Text style={{ color: '#FF6B6B', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Erreur de demarrage</Text>
      <Text style={{ color: '#FFF' }} selectable>{String(error?.stack || error)}</Text>
    </ScrollView>
  );
}

class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} />;
    return this.props.children;
  }
}

let Root;
try {
  const App = require('./App').default;
  Root = () => (
    <Boundary>
      <App />
    </Boundary>
  );
} catch (e) {
  Root = () => <ErrorScreen error={e} />;
}

registerRootComponent(Root);
