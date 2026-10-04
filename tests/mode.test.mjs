import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { modeFromSearch, modeStorageKey } from '../js/mode.js';
import { STORAGE_KEYS } from '../js/config.js';

test('默认经典，只有显式 mode=joy 开启欢乐', () => {
  for (const search of ['', '?mode=classic', '?mode=unknown', '?test=win']) assert.equal(modeFromSearch(search), 'classic');
  assert.equal(modeFromSearch('?debug&mode=joy'), 'joy');
});

test('经典使用全部旧键，欢乐的六类游戏数据隔离，昵称和音量共享', () => {
  for (const key of Object.values(STORAGE_KEYS)) assert.equal(modeStorageKey(key, 'classic'), key);
  for (const name of ['best', 'board', 'save', 'dex', 'achievements', 'gamesPlayed']) {
    assert.notEqual(modeStorageKey(STORAGE_KEYS[name], 'joy'), STORAGE_KEYS[name]);
  }
  for (const name of ['playerName', 'muted']) assert.equal(modeStorageKey(STORAGE_KEYS[name], 'joy'), STORAGE_KEYS[name]);
});

for (const mode of ['classic', 'joy']) {
  test(`${mode}：实际存储、旧存档兼容和线上调用边界`, () => {
    const script = `
      import assert from 'node:assert/strict';
      globalThis.location = { search: '${mode === 'joy' ? '?mode=joy' : ''}' };
      const memory = new Map();
      globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v) };
      const { STORAGE_KEYS } = await import('./js/config.js');
      const { store } = await import('./js/skin.js');
      const { writeSave, readSave, clearSave } = await import('./js/save.js');
      const { createJoyRun } = await import('./js/joy.js');
      const { modeStorageKey } = await import('./js/mode.js');
      const snapshot = { bodies: [{lv: 0, x: 200, y: 500, angle: 0}], state: { score: 12, topLevel: 2, current: 0, next: 1, mergeCount: 3, maxCombo: 1, playedMs: 1000 } };
      memory.set(STORAGE_KEYS.save, JSON.stringify({v: 1, ...snapshot}));
      memory.set(STORAGE_KEYS.best, '123');
      store.set(STORAGE_KEYS.best, '456');
      if ('${mode}' === 'joy') {
        assert.equal(memory.get(STORAGE_KEYS.best), '123');
        assert.equal(readSave(), null);
        snapshot.state.joy = createJoyRun();
        snapshot.state.joy.energy = 75;
      } else assert.equal(readSave().state.score, 12);
      writeSave(snapshot);
      assert.equal(readSave().state.score, 12);
      if ('${mode}' === 'joy') assert.equal(readSave().state.joy.energy, 75);
      const original = memory.get(STORAGE_KEYS.save);
      clearSave();
      assert.equal(readSave(), null);
      if ('${mode}' === 'joy') assert.equal(memory.get(STORAGE_KEYS.save), original);
      const api = await import('./js/leaderboard.js');
      let requests = 0;
      globalThis.fetch = async () => { requests++; return { ok: true, text: async () => '1' }; };
      assert.equal(api.leaderboardEnabled(), '${mode}' === 'classic');
      await api.submitScore({score: 12, topLevel: 2, merges: 3, durationS: 10});
      await api.setBadges(4);
      await api.fetchTop();
      assert.equal(requests, '${mode}' === 'classic' ? 3 : 0);
    `;
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'pipe' });
  });
}
