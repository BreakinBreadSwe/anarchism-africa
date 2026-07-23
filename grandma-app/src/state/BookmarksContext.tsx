/**
 * Bookmarks live in AsyncStorage as a plain array of remedy ids —
 * fully local, no account required.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const BOOKMARKS_STORAGE_KEY = '@grandma/bookmarks';

interface BookmarksContextValue {
  bookmarkIds: string[];
  isBookmarked: (remedyId: string) => boolean;
  toggleBookmark: (remedyId: string) => void;
}

const BookmarksContext = createContext<BookmarksContextValue | undefined>(
  undefined
);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setBookmarkIds(parsed.filter((id) => typeof id === 'string'));
        }
      })
      .catch(() => {
        // Corrupt or unreadable store — start fresh.
      });
  }, []);

  const persist = useCallback((ids: string[]) => {
    AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(ids)).catch(
      () => {
        // Non-fatal: bookmarks just won't survive a restart.
      }
    );
  }, []);

  const toggleBookmark = useCallback(
    (remedyId: string) => {
      setBookmarkIds((current) => {
        const next = current.includes(remedyId)
          ? current.filter((id) => id !== remedyId)
          : [...current, remedyId];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      bookmarkIds,
      isBookmarked: (remedyId: string) => bookmarkIds.includes(remedyId),
      toggleBookmark,
    }),
    [bookmarkIds, toggleBookmark]
  );

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks(): BookmarksContextValue {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return context;
}
