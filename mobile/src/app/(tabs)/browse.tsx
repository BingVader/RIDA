import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCover } from '../../components/BookCover';
import { GENRE_CATEGORIES, downloadAndSaveBook, libraryIdFor, searchCatalog } from '../../lib/catalog';
import { listBooks, markStarted } from '../../lib/storage';
import { useTheme } from '../../lib/theme';
import type { CatalogBook, CatalogSource } from '../../lib/types';

const SOURCES: { id: CatalogSource; label: string }[] = [
  { id: 'all', label: 'All Sources' },
  { id: 'gutenberg', label: 'Gutenberg' },
  { id: 'openlibrary', label: 'Open Library' },
];

export default function BrowseScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [source, setSource] = useState<CatalogSource>('all');
  const [categoryId, setCategoryId] = useState(GENRE_CATEGORIES[0].id);
  const [input, setInput] = useState('');
  const [applied, setApplied] = useState('');

  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyText, setBusyText] = useState('');
  const [selected, setSelected] = useState<CatalogBook | null>(null);

  // Ignore responses from superseded requests (fast filter switching).
  const requestSeq = useRef(0);

  const refreshOwned = useCallback(async () => {
    const list = await listBooks();
    setOwned(new Set(list.map((b) => b.id)));
  }, []);
  useFocusEffect(
    useCallback(() => {
      refreshOwned();
    }, [refreshOwned]),
  );

  const load = useCallback(
    async (pageNum: number, append: boolean) => {
      const seq = ++requestSeq.current;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const cat = GENRE_CATEGORIES.find((c) => c.id === categoryId);
        const result = await searchCatalog({
          query: applied,
          topic: applied ? '' : cat?.topic ?? '',
          source,
          page: pageNum,
        });
        if (seq !== requestSeq.current) return;
        setBooks((prev) => {
          if (!append) return result.books;
          const seen = new Set(prev.map((b) => b.id));
          return [...prev, ...result.books.filter((b) => !seen.has(b.id))];
        });
        setTotal(result.totalCount);
        setHasNext(result.hasNext);
        setPage(pageNum);
      } catch {
        if (seq !== requestSeq.current) return;
        setError('Unable to load books from the catalog. Check your internet connection and try again.');
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [applied, categoryId, source],
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  const submitSearch = () => setApplied(input.trim());
  const clearSearch = () => {
    setInput('');
    setApplied('');
  };

  const addToLibrary = async (book: CatalogBook): Promise<string | null> => {
    setBusyId(book.id);
    setBusyText('Starting download...');
    try {
      const meta = await downloadAndSaveBook(book, setBusyText);
      await refreshOwned();
      return meta.id;
    } catch (err) {
      Alert.alert('Could not download book', err instanceof Error ? err.message : 'Network error');
      return null;
    } finally {
      setBusyId(null);
      setBusyText('');
    }
  };

  const readNow = async (book: CatalogBook) => {
    let id: string | null = libraryIdFor(book);
    if (!owned.has(id)) id = await addToLibrary(book);
    if (!id) return;
    await markStarted(id);
    router.push({ pathname: '/reader/[id]', params: { id } });
  };

  const renderItem = ({ item }: { item: CatalogBook }) => {
    const inLibrary = owned.has(libraryIdFor(item));
    const busy = busyId === item.id;
    return (
      <Pressable
        onPress={() => setSelected(item)}
        style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}
      >
        <BookCover uri={item.cover} title={item.title} style={styles.cardCover} />
        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13 }}>
            {item.author}
          </Text>
          <View style={styles.tags}>
            <Text style={[styles.tag, { color: colors.accent, backgroundColor: colors.accentBg }]}>
              {item.source === 'gutenberg' ? 'Gutenberg' : 'Open Library'}
            </Text>
            {inLibrary && (
              <Text style={[styles.tag, { color: colors.success, backgroundColor: colors.accentBg }]}>In Library</Text>
            )}
          </View>

          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                {busyText}
              </Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={() => readNow(item)}
                disabled={busyId !== null}
                style={[styles.actionBtn, { backgroundColor: colors.accent, opacity: busyId ? 0.5 : 1 }]}
              >
                <Ionicons name="book" size={14} color={colors.onAccent} />
                <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 13 }}>
                  {inLibrary ? 'Open' : 'Read Now'}
                </Text>
              </Pressable>
              {!inLibrary && (
                <Pressable
                  onPress={() => addToLibrary(item)}
                  disabled={busyId !== null}
                  style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1, opacity: busyId ? 0.5 : 1 }]}
                >
                  <Ionicons name="download-outline" size={14} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>Add</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Browse &amp; Discover</Text>
        <Text style={{ color: colors.muted }}>Free classics from Project Gutenberg and Open Library</Text>
      </View>

      <View style={[styles.search, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
          placeholder="Title, author, or keyword..."
          placeholderTextColor={colors.muted}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
        />
        {!!input && (
          <Pressable onPress={clearSearch} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <View style={styles.pills}>
        {SOURCES.map((s) => {
          const active = source === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSource(s.id)}
              style={[
                styles.pill,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accentBg : 'transparent',
                },
              ]}
            >
              <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '600', fontSize: 13 }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
          {GENRE_CATEGORIES.map((c) => {
            const active = categoryId === c.id && !applied;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCategoryId(c.id);
                  clearSearch();
                }}
                style={[
                  styles.pill,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accent : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: active ? colors.onAccent : colors.text, fontSize: 13 }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, marginTop: 10 }}>Fetching books...</Text>
        </View>
      ) : error ? (
        <View style={styles.state}>
          <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
          <Text style={{ color: colors.text, textAlign: 'center', marginVertical: 10 }}>{error}</Text>
          <Pressable
            onPress={() => load(1, false)}
            style={[styles.actionBtn, { backgroundColor: colors.accent, paddingHorizontal: 20 }]}
          >
            <Text style={{ color: colors.onAccent, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNext && !loadingMore && !loading) load(page + 1, true);
          }}
          ListHeaderComponent={
            total > 0 ? (
              <Text style={{ color: colors.muted, marginBottom: 8, fontSize: 12 }}>
                {applied ? `Results for “${applied}”` : GENRE_CATEGORIES.find((c) => c.id === categoryId)?.label} ·{' '}
                {total.toLocaleString()} books
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.state}>
              <Ionicons name="book-outline" size={44} color={colors.muted} />
              <Text style={{ color: colors.text, fontWeight: '700', marginTop: 8 }}>No books found</Text>
              <Text style={{ color: colors.muted, textAlign: 'center' }}>Try a different keyword or category.</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.accent} /> : undefined}
        />
      )}

      <DetailsModal
        book={selected}
        inLibrary={!!selected && owned.has(libraryIdFor(selected))}
        busy={!!selected && busyId === selected.id}
        onClose={() => setSelected(null)}
        onRead={(b) => {
          setSelected(null);
          readNow(b);
        }}
        onAdd={(b) => {
          setSelected(null);
          addToLibrary(b);
        }}
      />
    </SafeAreaView>
  );
}

function DetailsModal(props: {
  book: CatalogBook | null;
  inLibrary: boolean;
  busy: boolean;
  onClose: () => void;
  onRead: (b: CatalogBook) => void;
  onAdd: (b: CatalogBook) => void;
}) {
  const { book, inLibrary, busy, onClose, onRead, onAdd } = props;
  const { colors } = useTheme();
  if (!book) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close details" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.panel }]}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.sheetTop}>
            <BookCover uri={book.cover} title={book.title} style={{ width: 100 }} />
            <View style={styles.flex}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{book.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>by {book.author}</Text>
              <Text style={{ color: colors.accent, marginTop: 6, fontSize: 12, fontWeight: '700' }}>
                {book.sourceName}
              </Text>
              {!!book.copyright && <Text style={{ color: colors.success, fontSize: 12 }}>{book.copyright}</Text>}
              {!!book.firstPublishYear && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>First published {book.firstPublishYear}</Text>
              )}
              {!!book.downloadCount && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {book.downloadCount.toLocaleString()} downloads
                </Text>
              )}
            </View>
          </View>

          {book.subjects.length > 0 && (
            <View style={styles.subjects}>
              {book.subjects.map((s) => (
                <Text key={s} style={[styles.tag, { color: colors.muted, backgroundColor: colors.accentBg }]}>
                  {s}
                </Text>
              ))}
            </View>
          )}

          <Text style={{ color: colors.muted, marginTop: 14, lineHeight: 20 }}>
            {book.source === 'gutenberg'
              ? 'Part of the Project Gutenberg public-domain collection. Free to read and keep in your offline library.'
              : 'Cataloged on Open Library. A readable edition is used when one is available from the Internet Archive.'}
          </Text>

          <View style={styles.sheetActions}>
            <Pressable
              onPress={() => onRead(book)}
              disabled={busy}
              style={[styles.actionBtn, styles.sheetBtn, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="book" size={16} color={colors.onAccent} />
              <Text style={{ color: colors.onAccent, fontWeight: '700' }}>{inLibrary ? 'Open in Reader' : 'Read Now'}</Text>
            </Pressable>
            {!inLibrary && (
              <Pressable
                onPress={() => onAdd(book)}
                disabled={busy}
                style={[styles.actionBtn, styles.sheetBtn, { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Ionicons name="download-outline" size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>Add to Library</Text>
              </Pressable>
            )}
          </View>

          <Pressable onPress={() => Linking.openURL(book.detailsUrl)} style={styles.link}>
            <Ionicons name="open-outline" size={16} color={colors.accent} />
            <Text style={{ color: colors.accent }}>View on {book.sourceName}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800' },
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
  pills: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1 },
  cats: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  state: { alignItems: 'center', padding: 32 },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  cardCover: { width: 84 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  tag: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 'auto', paddingTop: 6 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  sheetTop: { flexDirection: 'row', gap: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  sheetBtn: { flex: 1, paddingVertical: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, alignSelf: 'center' },
});
