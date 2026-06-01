import type { ProgressState } from './types';

type ProgressListener = (state: ProgressState) => void;
type ProgressArrayKey = 'favorites' | 'recentSports';
type ProgressRecordKey = 'tutorialSeen' | 'missions';

const storageKeys = {
  favorites: 'hsa_favorites',
  recentSports: 'hsa_recent_sports',
  tutorialSeen: 'hsa_tutorial_seen',
  missions: 'hsa_missions',
} as const satisfies Record<keyof ProgressState, string>;

const maxRecentSports = 6;
const listeners = new Set<ProgressListener>();

function defaultProgressState(): ProgressState {
  return {
    favorites: [],
    recentSports: [],
    tutorialSeen: {},
    missions: {},
  };
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeId(value: string): string {
  return value.trim();
}

function readJson(key: string): unknown {
  const storage = getLocalStorage();

  if (!storage) {
    return undefined;
  }

  const stored = storage.getItem(key);

  if (stored === null) {
    return undefined;
  }

  try {
    return JSON.parse(stored) as unknown;
  } catch {
    storage.removeItem(key);
    return undefined;
  }
}

function readStringArray(key: string): string[] {
  const parsed = readJson(key);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((value): value is string => typeof value === 'string').map(normalizeId).filter(Boolean);
}

function readBooleanRecord(key: string): Record<string, boolean> {
  const parsed = readJson(key);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return {};
  }

  return Object.entries(parsed).reduce<Record<string, boolean>>((record, [id, value]) => {
    const normalizedId = normalizeId(id);

    if (normalizedId && typeof value === 'boolean') {
      record[normalizedId] = value;
    }

    return record;
  }, {});
}

function writeJson(key: string, value: unknown): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or privacy-mode write failures; runtime state still updates.
  }
}

function removeProgressKeys(): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  Object.values(storageKeys).forEach((key) => storage.removeItem(key));
}

function loadProgressState(): ProgressState {
  return {
    favorites: readStringArray(storageKeys.favorites),
    recentSports: readStringArray(storageKeys.recentSports),
    tutorialSeen: readBooleanRecord(storageKeys.tutorialSeen),
    missions: readBooleanRecord(storageKeys.missions),
  };
}

let state = loadProgressState();

function cloneState(): ProgressState {
  return {
    favorites: [...state.favorites],
    recentSports: [...state.recentSports],
    tutorialSeen: { ...state.tutorialSeen },
    missions: { ...state.missions },
  };
}

function persistArray(key: ProgressArrayKey): void {
  writeJson(storageKeys[key], state[key]);
}

function persistRecord(key: ProgressRecordKey): void {
  writeJson(storageKeys[key], state[key]);
}

function notify(): void {
  const snapshot = cloneState();
  listeners.forEach((listener) => listener(snapshot));
}

export function getProgressState(): ProgressState {
  return cloneState();
}

export function subscribe(listener: ProgressListener): () => void {
  listeners.add(listener);
  listener(cloneState());

  return () => {
    listeners.delete(listener);
  };
}

export function toggleFavorite(sportId: string): boolean {
  const normalizedId = normalizeId(sportId);

  if (!normalizedId) {
    return false;
  }

  const wasFavorite = state.favorites.includes(normalizedId);
  state.favorites = wasFavorite
    ? state.favorites.filter((favoriteId) => favoriteId !== normalizedId)
    : [...state.favorites, normalizedId];
  persistArray('favorites');
  notify();

  return !wasFavorite;
}

export function isFavorite(sportId: string): boolean {
  return state.favorites.includes(normalizeId(sportId));
}

export function markSportPlayed(sportId: string): void {
  const normalizedId = normalizeId(sportId);

  if (!normalizedId) {
    return;
  }

  state.recentSports = [
    normalizedId,
    ...state.recentSports.filter((recentSportId) => recentSportId !== normalizedId),
  ].slice(0, maxRecentSports);
  persistArray('recentSports');
  notify();
}

export function markTutorialSeen(sportId: string): void {
  const normalizedId = normalizeId(sportId);

  if (!normalizedId || state.tutorialSeen[normalizedId]) {
    return;
  }

  state.tutorialSeen = { ...state.tutorialSeen, [normalizedId]: true };
  persistRecord('tutorialSeen');
  notify();
}

export function isTutorialSeen(sportId: string): boolean {
  return Boolean(state.tutorialSeen[normalizeId(sportId)]);
}

export function completeMission(missionId: string): void {
  const normalizedId = normalizeId(missionId);

  if (!normalizedId || state.missions[normalizedId]) {
    return;
  }

  state.missions = { ...state.missions, [normalizedId]: true };
  persistRecord('missions');
  notify();
}

export function isMissionComplete(missionId: string): boolean {
  return Boolean(state.missions[normalizeId(missionId)]);
}

export function resetProgress(): void {
  state = defaultProgressState();
  removeProgressKeys();
  notify();
}
