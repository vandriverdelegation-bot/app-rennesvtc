import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme, themedStyles } from '@app-rennesvtc/shared';
import { autocompleteAddress, getPlaceLocation } from '../lib/places';
import { Icon } from '../icons';

export default function AddressAutocomplete({ placeholder, value, onSelect, icon }) {
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
      <View style={styles.field}>
        {icon ? <Icon name={icon} color="w" size={22} /> : null}
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          value={input}
          onChangeText={handleChangeText}
        />
      </View>
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

const styles = themedStyles(() => ({
  container: { width: '100%' },
  field: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.input, borderRadius: 18, paddingHorizontal: 16 },
  fieldInput: { flex: 1, color: theme.colors.text, fontSize: 16, paddingVertical: 12 },
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
}));
