import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/theme';

interface Props {
  uri: string | null;
  title: string;
  style?: StyleProp<ViewStyle>;
}

/** Cover image with a title placeholder when missing or failing to load. */
export function BookCover({ uri, title, style }: Props) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  return (
    <View style={[styles.box, { backgroundColor: colors.accentBg, borderColor: colors.border }, style]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={title}
        />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="book-outline" size={32} color={colors.accent} />
          <Text numberOfLines={4} style={[styles.placeholderText, { color: colors.muted }]}>
            {title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 6 },
  placeholderText: { fontSize: 12, textAlign: 'center', fontWeight: '600' },
});
