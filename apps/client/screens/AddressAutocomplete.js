import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '@app-rennesvtc/shared';
import { autocompleteAddress, getPlaceLocation } from '../lib/places';

export default function AddressAutocomplete({ placeholder, value, onSelect }) {
  const [input, setInput] = useState(value ?? '');
  const [suggestions, setSuggestions] = useState([]);

  function handleChangeText(text) {
    setInput(text);
    autocompleteAddress(text).then(setSuggestions);
  }

  async function handlePick(suggestion) {
    setInput(suggestion.text);
    setSuggestions([]);
    const location = await getPlaceLocation(suggestion.placeId);
    onSelect(location);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        value={input}
        onChangeText={handleChangeText}
      />
      {suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((s) => (
            <TouchableOpacity key={s.placeId} style={styles.suggestion} onPress={() => handlePick(s)}>
              <Text style={styles.suggestionText}>{s.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    borderRadius: theme.radius,
    padding: 12,
    color: theme.colors.text,
  },
  suggestionsBox: {
    marginTop: 4,
    borderRadius: theme.radius,
    overflow: 'hidden',
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
  },
  suggestion: {
    width: '100%',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  suggestionText: { color: theme.colors.text },
});
