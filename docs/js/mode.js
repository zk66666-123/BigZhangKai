// 模式在页面加载时确定，切换时重新加载，避免局内状态互相串用。
import { STORAGE_KEYS } from './config.js?v=21648a52';

export function modeFromSearch(search = '') {
  return new URLSearchParams(search).get('mode') === 'joy' ? 'joy' : 'classic';
}
export const ACTIVE_MODE = modeFromSearch(globalThis.location?.search);
export const isJoy = ACTIVE_MODE === 'joy';
export const modeName = isJoy ? '欢乐模式' : '经典模式';
const MODE_KEYS = new Set(['best', 'board', 'save', 'dex', 'achievements', 'gamesPlayed'].map(k => STORAGE_KEYS[k]));

export function modeStorageKey(key, mode = ACTIVE_MODE) {
  return mode === 'joy' && MODE_KEYS.has(key) ? key + '-joy-v1' : key;
}
