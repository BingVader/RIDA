import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCover } from '../../components/BookCover';
import { deleteBook, importEpub, listBooks } from '../../lib/storage';
import { useTheme } from '../../lib/theme';
import type { BookMeta } from '../../lib/types';

type Filter = 'all' | 'unread' | 'reading' | 'finished';
const FILTERS: Filter[] = ['all', 'unread', 'reading', 'finished'];

const isFinished = (b: BookMeta) => b.progress >= 99;
const isStarted = (b: BookMeta) => b.startedReading || b.progress > 0;

function matches(b: BookMeta, f: Filter) {
  if (f === 'unread') return !isStarted(b);
  if (f === 'reading') return isStarted(b) && !isFinished(b);
  if (f === 'finished') return isFinished(b);
  return true;
}

export default function LibraryScreen() {
  const { colors, isDark, toggle } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => setBooks(await listBooks()), []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const columns = width >= 900 ? 5 : width >= 600 ? 4 : width >= 400 ? 3 : 2;
  const gap = 12;
  const cardWidth = (width - 16 * 2 - gap * (columns - 1)) / columns;

  const q = query.trim().toLowerCase();
  const visible = books.filter(
    (b) => matches(b, filter) && (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)),
  );

  const importFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      if (!asset.name.toLowerCase().endsWith('.epub')) {
        Alert.alert('Unsupported file', 'Please choose a valid .epub file.');
        return;
      }
      setImporting(true);
      const picked = new File(asset.uri);
      const id = `epub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await importEpub(id, picked, asset.name.replace(/\.epub$/i, ''));
      try {
        picked.delete(); // remove the cache copy
      } catch {
        // ignore
      }
      await refresh();
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : 'Could not import that file.');
    } finally {
      setImporting(false);
    }
  };

  const confirmDelete = (b: BookMeta) =>
    Alert.alert('Delete book', `Delete "${b.title}" from this device? Your bookmarks and highlights will be lost.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBook(b.id);
          refresh();
        },
      },
    ]);

  const count = (f: Filter) => books.filter((b) => matches(b, f)).length;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={[styles.brand, { color: colors.text }]}>RIDA</Text>
          <Text style={{ color: colors.muted }}>Your local-first reading space</Text>
        </View>
        <Pressable onPress={toggle} hitSlop={12} accessibilityLabel="Toggle dark mode">
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.search, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search books or authors..."
          placeholderTextColor={colors.muted}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
        />
      </View>

      {books.length > 0 && (
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accentBg : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '600', fontSize: 13 }}>
                  {f[0].toUpperCase() + f.slice(1)} {count(f)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <FlatList
        key={columns}
        data={visible}
        numColumns={columns}
        keyExtractor={(b) => b.id}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        contentContainerStyle={[styles.list, { gap }]}
        ListEmptyComponent={
          importing ? undefined : (
            <View style={styles.empty}>
              <Ionicons name="library-outline" size={56} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {books.length ? 'No matching books' : 'Your library is empty'}
              </Text>
              <Text style={{ color: colors.muted, textAlign: 'center' }}>
                {books.length
                  ? 'Try a different search or filter.'
                  : 'Import an EPUB from your device, or browse free books online.'}
              </Text>
              {!books.length && (
                <Pressable
                  onPress={() => router.navigate('/browse')}
                  style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
                >
                  <Ionicons name="compass-outline" size={18} color={colors.onAccent} />
                  <Text style={{ color: colors.onAccent, fontWeight: '700' }}>Browse Online Books</Text>
                </Pressable>
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={{ width: cardWidth }}
            onPress={() => router.push({ pathname: '/reader/[id]', params: { id: item.id } })}
            onLongPress={() => confirmDelete(item)}
            accessibilityHint="Long press to delete"
          >
            <BookCover uri={item.cover} title={item.title} />
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, item.progress)}%`, backgroundColor: isFinished(item) ? colors.success : colors.accent },
                ]}
              />
            </View>
            <Text numberOfLines={2} style={[styles.bookTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
              {item.author}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              {isFinished(item) ? 'Finished' : isStarted(item) ? `${Math.round(item.progress)}% read` : 'Unread'}
            </Text>
          </Pressable>
        )}
      />

      {importing && (
        <View style={[styles.importing, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.text }}>Importing book...</Text>
        </View>
      )}

      <Pressable
        onPress={importFile}
        disabled={importing}
        accessibilityLabel="Import EPUB"
        style={[styles.fab, { backgroundColor: colors.accent, opacity: importing ? 0.6 : 1 }]}
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  brand: { fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1 },
  list: { padding: 16, paddingBottom: 100 },
  bookTitle: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  progressTrack: { height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 3 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginTop: 8,
  },
  importing: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
