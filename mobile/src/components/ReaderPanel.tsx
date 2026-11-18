import { Ionicons } from '@expo/vector-icons';
import { useReader, type Annotation, type Bookmark, type Section } from '@epubjs-react-native/core';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

type Tab = 'toc' | 'search' | 'bookmarks' | 'highlights';

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'toc', label: 'Contents', icon: 'list' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmark-outline' },
  { id: 'highlights', label: 'Highlights', icon: 'color-wand-outline' },
];

interface FlatSection {
  section: Section;
  depth: number;
}

function flattenToc(items: Section[], depth = 0): FlatSection[] {
  return items.flatMap((s) => [
    { section: s, depth },
    ...flattenToc((s.subitems ?? []) as Section[], depth + 1),
  ]);
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ReaderPanel({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('toc');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderColor: colors.border }]}>
          <View style={styles.tabs}>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  accessibilityLabel={t.label}
                  style={[styles.tab, active && { backgroundColor: colors.accentBg }]}
                >
                  <Ionicons name={t.icon} size={20} color={active ? colors.accent : colors.muted} />
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close panel">
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <Text style={[styles.tabTitle, { color: colors.text }]}>{TABS.find((t) => t.id === tab)?.label}</Text>

        {tab === 'toc' && <TocTab onDone={onClose} />}
        {tab === 'search' && <SearchTab onDone={onClose} />}
        {tab === 'bookmarks' && <BookmarksTab onDone={onClose} />}
        {tab === 'highlights' && <HighlightsTab onDone={onClose} />}
      </SafeAreaView>
    </Modal>
  );
}

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.empty, { color: colors.muted }]}>{text}</Text>;
}

function TocTab({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const { toc, goToLocation } = useReader();
  const items = useMemo(() => flattenToc(toc), [toc]);

  if (!items.length) return <Empty text="No table of contents found." />;
  return (
    <FlatList
      data={items}
      keyExtractor={(it, i) => `${it.section.id}-${i}`}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.row, { borderColor: colors.border, paddingLeft: 16 + item.depth * 16 }]}
          onPress={() => {
            goToLocation(item.section.href);
            onDone();
          }}
        >
          <Text style={{ color: colors.text, fontSize: 15 }}>{item.section.label.trim()}</Text>
        </Pressable>
      )}
    />
  );
}

function SearchTab({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const { search, searchResults, isSearching, clearSearchResults, goToLocation } = useReader();
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');

  const submit = () => {
    const q = term.trim();
    if (!q) return;
    setSubmitted(q);
    search(q);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.searchBox, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={term}
          onChangeText={(t) => {
            setTerm(t);
            if (!t) {
              setSubmitted('');
              clearSearchResults();
            }
          }}
          onSubmitEditing={submit}
          returnKeyType="search"
          placeholder="Search inside book..."
          placeholderTextColor={colors.muted}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
        />
      </View>

      {isSearching ? (
        <ActivityIndicator style={styles.spinner} color={colors.accent} />
      ) : searchResults.results.length === 0 ? (
        <Empty text={submitted ? 'No results found.' : 'Enter a query and press search.'} />
      ) : (
        <FlatList
          data={searchResults.results}
          keyExtractor={(r, i) => `${r.cfi}-${i}`}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { borderColor: colors.border }]}
              onPress={() => {
                goToLocation(item.cfi);
                onDone();
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                {item.section?.label?.trim()}
              </Text>
              <Text style={{ color: colors.text, fontSize: 14, marginTop: 2 }} numberOfLines={3}>
                {item.excerpt.trim()}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function BookmarksTab({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const { bookmarks, removeBookmark, goToLocation } = useReader();

  if (!bookmarks.length) return <Empty text="No bookmarks set yet." />;
  return (
    <FlatList
      data={bookmarks}
      keyExtractor={(b: Bookmark) => String(b.id)}
      renderItem={({ item }) => (
        <View style={[styles.row, styles.rowSplit, { borderColor: colors.border }]}>
          <Pressable
            style={styles.flex}
            onPress={() => {
              goToLocation(item.location.start.cfi);
              onDone();
            }}
          >
            <Text style={{ color: colors.text, fontSize: 15 }} numberOfLines={2}>
              {(item.data as { label?: string } | undefined)?.label || item.section?.label?.trim() || 'Bookmark'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {Math.round(item.location.start.percentage * 100)}% into the book
            </Text>
          </Pressable>
          <Pressable onPress={() => removeBookmark(item)} hitSlop={12} accessibilityLabel="Remove bookmark">
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      )}
    />
  );
}

interface HighlightData {
  text?: string;
  note?: string;
}

function HighlightsTab({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const { annotations, removeAnnotation, updateAnnotation, goToLocation } = useReader();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const highlights = annotations.filter((a) => a.type === 'highlight');
  if (!highlights.length) return <Empty text="No text highlighted yet. Long-press text in the book to highlight it." />;

  const saveNote = (a: Annotation<HighlightData>) => {
    updateAnnotation(a, { ...(a.data ?? {}), note: draft });
    setEditingId(null);
  };

  return (
    <FlatList
      data={highlights as Annotation<HighlightData>[]}
      keyExtractor={(a) => a.cfiRange}
      renderItem={({ item }) => {
        const editing = editingId === item.cfiRange;
        return (
          <View style={[styles.row, { borderColor: colors.border }]}>
            <View style={styles.rowSplit}>
              <View style={[styles.dot, { backgroundColor: item.styles?.color ?? '#FFEB3B' }]} />
              <Pressable
                style={styles.flex}
                onPress={() => {
                  goToLocation(item.cfiRange);
                  onDone();
                }}
              >
                <Text style={{ color: colors.text, fontStyle: 'italic' }} numberOfLines={4}>
                  “{item.data?.text ?? item.cfiRangeText}”
                </Text>
              </Pressable>
              <Pressable onPress={() => removeAnnotation(item)} hitSlop={12} accessibilityLabel="Delete highlight">
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>

            {editing ? (
              <View style={styles.noteEditor}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Add a note..."
                  placeholderTextColor={colors.muted}
                  multiline
                  style={[styles.noteInput, { color: colors.text, borderColor: colors.border }]}
                />
                <View style={styles.noteActions}>
                  <Pressable onPress={() => setEditingId(null)}>
                    <Text style={{ color: colors.muted }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={() => saveNote(item)}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setEditingId(item.cfiRange);
                  setDraft(item.data?.note ?? '');
                }}
              >
                <Text style={{ color: item.data?.note ? colors.text : colors.muted, marginTop: 6, fontSize: 13 }}>
                  {item.data?.note ? `Note: ${item.data.note}` : 'Add a note'}
                </Text>
              </Pressable>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { padding: 10, borderRadius: 10 },
  tabTitle: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowSplit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { textAlign: 'center', marginTop: 40, paddingHorizontal: 24, fontSize: 15 },
  spinner: { marginTop: 40 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  noteEditor: { marginTop: 8 },
  noteInput: { borderWidth: 1, borderRadius: 8, padding: 8, minHeight: 60, textAlignVertical: 'top' },
  noteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
});
