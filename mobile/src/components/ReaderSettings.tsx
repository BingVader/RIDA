import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { READER_THEMES, useTheme } from '../lib/theme';

export interface ReaderSettingsState {
  theme: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettingsState = {
  theme: 'light',
  fontSize: 18,
  fontFamily: 'Georgia, serif',
  lineHeight: 1.5,
};

const FONTS = [
  { name: 'Serif', value: 'Georgia, serif' },
  { name: 'Sans', value: 'Helvetica, Arial, sans-serif' },
  { name: 'Mono', value: '"Courier New", monospace' },
];

interface Props {
  visible: boolean;
  settings: ReaderSettingsState;
  onChange: (next: ReaderSettingsState) => void;
  onClose: () => void;
}

export function ReaderSettings({ visible, settings, onChange, onClose }: Props) {
  const { colors } = useTheme();
  const set = <K extends keyof ReaderSettingsState>(key: K, value: ReaderSettingsState[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close settings" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.panel }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.label, { color: colors.muted }]}>Theme</Text>
          <View style={styles.row}>
            {READER_THEMES.map((t) => {
              const active = settings.theme === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => set('theme', t.id)}
                  accessibilityLabel={`${t.name} theme`}
                  style={[
                    styles.themeBtn,
                    { backgroundColor: t.bg, borderColor: active ? colors.accent : t.border },
                    active && styles.themeBtnActive,
                  ]}
                >
                  <Text style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>{t.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>Font</Text>
          <View style={styles.row}>
            {FONTS.map((f) => {
              const active = settings.fontFamily === f.value;
              return (
                <Pressable
                  key={f.name}
                  onPress={() => set('fontFamily', f.value)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.accentBg : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '600' }}>{f.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sliderHeader}>
            <Text style={[styles.label, { color: colors.muted }]}>Font size</Text>
            <Text style={{ color: colors.text }}>{settings.fontSize}px</Text>
          </View>
          <Slider
            minimumValue={12}
            maximumValue={32}
            step={1}
            value={settings.fontSize}
            onSlidingComplete={(v) => set('fontSize', Math.round(v))}
            minimumTrackTintColor={colors.accent}
            thumbTintColor={colors.accent}
          />

          <View style={styles.sliderHeader}>
            <Text style={[styles.label, { color: colors.muted }]}>Line height</Text>
            <Text style={{ color: colors.text }}>{settings.lineHeight.toFixed(1)}</Text>
          </View>
          <Slider
            minimumValue={1.2}
            maximumValue={2.2}
            step={0.1}
            value={settings.lineHeight}
            onSlidingComplete={(v) => set('lineHeight', Math.round(v * 10) / 10)}
            minimumTrackTintColor={colors.accent}
            thumbTintColor={colors.accent}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 64,
    alignItems: 'center',
  },
  themeBtnActive: { borderWidth: 2 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
