import { Ionicons } from '@expo/vector-icons';
import {
  ReaderProvider,
  Reader,
  useReader,
  type Annotation,
  type Bookmark,
  type Location,
  type Section,
} from '@epubjs-react-native/core';
import { useFileSystem } from '@epubjs-react-native/expo-file-system';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_READER_SETTINGS, ReaderSettings, type ReaderSettingsState } from '../../components/ReaderSettings';
import { ReaderPanel } from '../../components/ReaderPanel';
import { bookFile, getBook, markStarted, saveBookmarks, saveHighlights, saveProgress, updateBook } from '../../lib/storage';
import { READER_THEMES, buildEpubTheme, useTheme } from '../../lib/theme';
import type { BookMeta } from '../../lib/types';

const SETTINGS_KEY = 'rida:reader-settings';

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', color: '#FFEB3B' },
  { label: 'Green', color: '#8BC34A' },
  { label: 'Blue', color: '#2196F3' },
  { label: 'Pink', color: '#E91E63' },
];

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meta, setMeta] = useState<BookMeta | null>(null);
  const [settings, setSettings] = useState<ReaderSettingsState | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [book, raw] = await Promise.all([
        getBook(id),
        AsyncStorage.getItem(SETTINGS_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      if (!book || !bookFile(id).exists) {
        setMissing(true);
        return;
      }
      let saved: Partial<ReaderSettingsState> = {};
      try {
        saved = raw ? JSON.parse(raw) : {};
      } catch {
        // ignore corrupt settings
      }
      setSettings({ ...DEFAULT_READER_SETTINGS, ...saved });
      setMeta(book);
      markStarted(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {missing ? (
        <MissingBook />
      ) : meta && settings ? (
        <ReaderProvider>
          <ReaderBody meta={meta} initialSettings={settings} />
        </ReaderProvider>
      ) : (
        <Centered>
          <ActivityIndicator />
        </Centered>
      )}
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.centered, { backgroundColor: colors.bg }]}>{children}</View>;
}

function MissingBook() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Centered>
      <Text style={{ color: colors.text, fontSize: 16, marginBottom: 12 }}>This book&apos;s file could not be found.</Text>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Back to library</Text>
      </Pressable>
    </Centered>
  );
}

function ReaderBody({ meta, initialSettings }: { meta: BookMeta; initialSettings: ReaderSettingsState }) {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    goNext,
    goPrevious,
    changeTheme,
    changeFontSize,
    changeFontFamily,
    addAnnotation,
    addBookmark,
    removeBookmark,
    bookmarks,
    isBookmarked,
    currentLocation,
    locations,
    getMeta,
    goToLocation,
  } = useReader();

  const [settings, setSettings] = useState(initialSettings);
  const [chrome, setChrome] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [chapter, setChapter] = useState('');
  const [progress, setProgress] = useState(meta.progress);
  const [page, setPage] = useState<{ page: number; total: number } | null>(null);

  // Annotation/bookmark change callbacks can fire while the initial lists are
  // being restored; never persist until the book has finished its first render.
  const ready = useRef(false);
  const readerTheme = READER_THEMES.find((t) => t.id === settings.theme) ?? READER_THEMES[0];

  const theme = useMemo(() => buildEpubTheme(readerTheme, settings.lineHeight), [readerTheme, settings.lineHeight]);

  const applySettings = useCallback(
    (next: ReaderSettingsState) => {
      setSettings(next);
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
    },
    [],
  );

  // Push appearance changes into the already-rendered book.
  const firstApply = useRef(true);
  useEffect(() => {
    if (firstApply.current) {
      firstApply.current = false;
      return;
    }
    changeTheme(theme);
    changeFontSize(`${settings.fontSize}px`);
    changeFontFamily(settings.fontFamily);
  }, [theme, settings.fontSize, settings.fontFamily, changeTheme, changeFontSize, changeFontFamily]);

  const highlightMenu = useMemo(
    () =>
      HIGHLIGHT_COLORS.map(({ label, color }) => ({
        key: `hl-${color}`,
        label,
        action: (cfiRange: string, text: string) => {
          addAnnotation('highlight', cfiRange, { text, note: '', date: Date.now() }, { color, opacity: 0.4 });
          return false;
        },
      })),
    [addAnnotation],
  );

  const onReady = useCallback(() => {
    ready.current = true;
    if (meta.needsMetadata) {
      const m = getMeta();
      const patch: Partial<BookMeta> = { needsMetadata: false };
      if (m?.title) patch.title = m.title;
      if (m?.author) patch.author = m.author;
      if (typeof m?.cover === 'string' && m.cover.startsWith('data:')) patch.cover = m.cover;
      updateBook(meta.id, patch);
    }
  }, [getMeta, meta.id, meta.needsMetadata]);

  const onLocationChange = useCallback(
    (_total: number, loc: Location, pct: number, section: Section | null) => {
      const p = Math.max(0, Math.min(100, pct));
      setProgress(p);
      setChapter(section?.label?.trim() ?? '');
      setPage({ page: loc.start.displayed.page, total: loc.start.displayed.total });
      saveProgress(meta.id, p, loc.start.cfi);
    },
    [meta.id],
  );

  const toggleBookmark = () => {
    if (!currentLocation) return;
    if (isBookmarked) {
      const existing = bookmarks.find((b: Bookmark) => b.location.start.cfi === currentLocation.start.cfi);
      if (existing) removeBookmark(existing);
    } else {
      addBookmark(currentLocation, { label: chapter || `Position ${Math.round(progress)}%` });
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const seek = (value: number) => {
    if (!locations.length) return;
    const idx = Math.min(locations.length - 1, Math.floor((value / 100) * locations.length));
    goToLocation(locations[idx]);
  };

  const chromeBg = { backgroundColor: readerTheme.bg, borderColor: readerTheme.border };
  const chromeText = readerTheme.text;
  const barStyle = readerTheme.id === 'light' || readerTheme.id === 'sepia' ? 'dark' : 'light';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: readerTheme.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={barStyle} />

      {chrome && (
        <View style={[styles.topBar, chromeBg]}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back to library">
            <Ionicons name="arrow-back" size={24} color={chromeText} />
          </Pressable>
          <View style={styles.titleBox}>
            <Text numberOfLines={1} style={[styles.bookTitle, { color: chromeText }]}>
              {meta.title}
            </Text>
            {!!chapter && (
              <Text numberOfLines={1} style={[styles.chapter, { color: chromeText }]}>
                {chapter}
              </Text>
            )}
          </View>
          <Pressable onPress={toggleBookmark} hitSlop={12} accessibilityLabel="Toggle bookmark">
            <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={isBookmarked ? colors.accent : chromeText} />
          </Pressable>
          <Pressable onPress={() => setPanelOpen(true)} hitSlop={12} accessibilityLabel="Contents, search and notes">
            <Ionicons name="menu" size={24} color={chromeText} />
          </Pressable>
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={12} accessibilityLabel="Appearance settings">
            <Ionicons name="text" size={22} color={chromeText} />
          </Pressable>
        </View>
      )}

      <View style={styles.flex} onLayout={onLayout}>
        {size && (
          <Reader
            src={bookFile(meta.id).uri}
            fileSystem={useFileSystem}
            width={size.width}
            height={size.height}
            flow="paginated"
            spread="none"
            defaultTheme={theme}
            initialLocation={meta.location ?? undefined}
            initialBookmarks={meta.bookmarks}
            initialAnnotations={meta.highlights}
            menuItems={highlightMenu}
            onReady={onReady}
            onLocationChange={onLocationChange}
            onSingleTap={() => setChrome((c) => !c)}
            onChangeBookmarks={(b) => ready.current && saveBookmarks(meta.id, b)}
            onChangeAnnotations={(a: Annotation[]) =>
              ready.current && saveHighlights(meta.id, a.filter((x) => x.type === 'highlight'))
            }
            onPressAnnotation={() => setPanelOpen(true)}
            onDisplayError={(reason) => Alert.alert('Could not open book', reason, [{ text: 'OK', onPress: () => router.back() }])}
            renderOpeningBookComponent={() => (
              <View style={[styles.centered, { backgroundColor: readerTheme.bg }]}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: chromeText, marginTop: 12 }}>Opening book...</Text>
              </View>
            )}
          />
        )}
      </View>

      {chrome && (
        <View style={[styles.bottomBar, chromeBg]}>
          <Slider
            minimumValue={0}
            maximumValue={100}
            value={progress}
            onSlidingComplete={seek}
            disabled={!locations.length}
            minimumTrackTintColor={colors.accent}
            thumbTintColor={colors.accent}
          />
          <View style={styles.meta}>
            <Pressable onPress={() => goPrevious()} hitSlop={12} accessibilityLabel="Previous page">
              <Ionicons name="chevron-back" size={20} color={chromeText} />
            </Pressable>
            <Text style={{ color: chromeText, fontSize: 12 }}>
              {Math.round(progress)}% read{page ? `  ·  Page ${page.page} of ${page.total}` : ''}
            </Text>
            <Pressable onPress={() => goNext()} hitSlop={12} accessibilityLabel="Next page">
              <Ionicons name="chevron-forward" size={20} color={chromeText} />
            </Pressable>
          </View>
        </View>
      )}

      <ReaderPanel visible={panelOpen} onClose={() => setPanelOpen(false)} />
      <ReaderSettings
        visible={settingsOpen}
        settings={settings}
        onChange={applySettings}
        onClose={() => setSettingsOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleBox: { flex: 1 },
  bookTitle: { fontSize: 15, fontWeight: '700' },
  chapter: { fontSize: 12, opacity: 0.7 },
  bottomBar: { paddingHorizontal: 16, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 },
});
