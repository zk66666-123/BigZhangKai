// 可选浏览器集成检查：使用已安装的 Playwright，无须为项目安装依赖。
// PLAYWRIGHT_PATH 指向已有包；BROWSER_PATH 指向本机 Chromium / Edge。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:8765';
const output = process.env.PREVIEW_OUTPUT || join(tmpdir(), 'big-zhangkai-preview');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [], online = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('https://**/*', route => { online.push(route.request().url()); return route.abort(); });
const booted = async () => page.waitForFunction(() => window.zkDebug && document.querySelector('#game').width > 0);
const snap = () => page.evaluate(() => window.zkDebug());
const game = async expression => page.evaluate(async expression => {
  const module = await import('./js/game.js');
  const { state } = await import('./js/state.js');
  return new Function('game', 'state', expression)(module, state);
}, expression);
try {
  await page.goto(base + '/?mode=joy&debug');
  await booted();
  assert.equal((await snap()).joy.energy, 30);
  assert.equal(await page.locator('#joy-panel').isVisible(), true);
  assert.equal(await page.locator('#welcome').isVisible(), false);
  assert.equal(await page.locator('#btn-swap').isDisabled(), true, '开局能量不足，不能重抽');
  assert.equal(await page.locator('#btn-swap small').innerText(), '35 能量 · 重抽手中角色');
  assert.equal(await game("return game.useJoySkill('swap');"), false);
  await game('game.makeKai(190, 500, 0); game.makeKai(210, 500, 0);');
  await page.waitForFunction(() => !document.querySelector('#btn-swap').disabled);
  const before = await snap();
  assert.equal(before.joy.energy, 38);
  await page.click('#btn-swap');
  const after = await snap();
  assert.notEqual(after.current, before.current);
  assert.equal(after.next, before.next);
  assert.equal(after.joy.energy, 3);
  assert.equal(await page.locator('#btn-swap').isDisabled(), true);
  assert.equal(await game("game.startGame(); state.joy.energy = 50; state.joySkillReadyAt = 0; return game.useJoySkill('shake');"), false);
  assert.equal((await snap()).joy.energy, 50, '空场不扣能量');
  await game('game.startGame(); Math.random = () => 0.2; game.makeKai(180, 480, 3); game.makeKai(220, 480, 3);');
  await page.locator('#talent-picker').waitFor({ state: 'visible' });
  const offered = (await snap()).joy.offer;
  assert.equal(offered.milestone, 4);
  assert.equal((await snap()).paused, true);
  const stationary = (await snap()).bodies;
  await page.waitForTimeout(150);
  assert.deepEqual((await snap()).bodies, stationary, '天赋选择暂停物理');
  await page.screenshot({ path: join(output, 'joy-talents-mobile.png') });
  await page.reload();
  await booted();
  await page.locator('#talent-picker').waitFor({ state: 'visible' });
  assert.deepEqual((await snap()).joy.offer, offered, '刷新候选不变');
  await page.locator('#talent-choices button').first().click();
  assert.deepEqual((await snap()).joy.talents, [offered.options[0]]);
  await game('state.joy.energy = 80; state.joySkillReadyAt = 0;');
  await page.waitForFunction(() => !document.querySelector('#btn-shake').disabled);
  const shakeBodies = (await snap()).bodies;
  await page.click('#btn-shake');
  assert.equal((await snap()).joy.shakes, 1);
  assert.ok((await snap()).joy.energy >= 40);
  assert.equal(await game("return game.useJoySkill('shake');"), false, '冷却中不能再用');
  await page.waitForTimeout(200);
  assert.notDeepEqual((await snap()).bodies, shakeBodies, '摇一摇确实改变物理位置');
  // 连跨后续里程碑依然依次选择，各天赋不重复。
  await game('state.topLevel = 11; game.updateHud();');
  for (const milestone of [8, 11]) {
    await page.locator('#talent-picker').waitFor({ state: 'visible' });
    assert.equal((await snap()).joy.offer.milestone, milestone);
    await page.locator('#talent-choices button').first().click();
  }
  assert.equal(new Set((await snap()).joy.talents).size, 3);
  await page.screenshot({ path: join(output, 'joy-game-mobile.png') });
  assert.ok(await page.evaluate(() => document.querySelector('.ladder').getBoundingClientRect().bottom <= innerHeight + 1), '获得天赋后自动适配画布');
  const savedJoy = await snap();
  await page.click('#btn-mode');
  await page.screenshot({ path: join(output, 'mode-picker-mobile.png') });
  await page.click('#choose-classic');
  await page.waitForURL(url => !url.searchParams.has('mode'));
  await page.locator('#welcome').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#joy-panel').isVisible(), false);
  assert.equal(await page.locator('#mode-label').innerText(), '经典模式');
  // 使用现有测试入口跳过昵称注册，不向线上占用昵称。
  await page.goto(base + '/?debug&test=play');
  await booted();
  assert.equal((await snap()).joy, null);
  await game('game.makeKai(180, 480, 3); game.makeKai(220, 480, 3);');
  await page.waitForFunction(() => window.zkDebug().score > 0);
  assert.equal(await page.locator('#talent-picker').isVisible(), false);
  assert.equal(await game("return game.useJoySkill('swap');"), false);
  const classic = await snap();
  await game('game.saveNow();');
  const classicSave = await page.evaluate(() => localStorage.getItem('dazhangkai-save-v1'));
  const classicBest = await page.evaluate(() => localStorage.getItem('dazhangkai-best-v1'));
  await page.screenshot({ path: join(output, 'classic-mobile.png') });
  await page.click('#btn-mode');
  await page.click('#choose-joy');
  await page.waitForURL(url => url.searchParams.get('mode') === 'joy');
  await page.goto(base + '/?mode=joy&debug');
  await booted();
  assert.equal((await snap()).score, savedJoy.score);
  assert.deepEqual((await snap()).joy.talents, savedJoy.joy.talents);
  assert.equal((await snap()).joy.shakes, savedJoy.joy.shakes);
  // 有经典昵称、待上传成绩和徽章时，欢乐模式依然不访问线上。
  const networkBefore = online.length;
  await page.evaluate(() => {
    localStorage.setItem('dazhangkai-name', '本地测试昵称');
    localStorage.setItem('dazhangkai-achievements-joy-v1', JSON.stringify({mute: Date.now()}));
  });
  await page.reload(); await booted();
  await page.evaluate(async () => { const report = await import('./js/report.js'); report.gameOver(); });
  await page.locator('#over').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#upload').isVisible(), false);
  assert.equal(await page.locator('#board-heading').innerText(), '欢乐模式 · 本机最好 5 局');
  assert.equal(await page.evaluate(() => localStorage.getItem('dazhangkai-best-v1')), classicBest);
  // 切换离开经典可能再次保存位置，但经典局分数不会被欢乐覆盖。
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dazhangkai-save-v1')).state.score), classic.score);
  await page.waitForTimeout(1600);
  assert.equal(online.length, networkBefore, '欢乐结算/成就不发线上请求');
  await page.screenshot({ path: join(output, 'joy-report-mobile.png') });
  await page.click('#btn-again');
  assert.equal((await snap()).joy.energy, 30);
  assert.deepEqual((await snap()).joy.talents, []);
  assert.equal((await snap()).joy.rescueUsed, false);
  // 一次性救场在真实物理循环中只触发一次。
  await game("state.joy.talents = ['rescue']; const b = game.makeKai(200, 80, 0); Matter.Body.setStatic(b, true); b.bornAt = -10000; state.dangerSince = performance.now() - 3000;");
  await page.waitForFunction(() => window.zkDebug().joy.rescueUsed);
  assert.equal((await snap()).over, false);
  assert.equal((await snap()).bodies.length, 0);
  await game("const b = game.makeKai(200, 80, 0); Matter.Body.setStatic(b, true); b.bornAt = -10000; state.dangerSince = performance.now() - 3000;");
  await page.waitForFunction(() => window.zkDebug().over);
  assert.equal((await snap()).joy.rescueUsed, true);
  // 验证窄屏与桌面的画布、工具条和弹窗均落在视口内。
  await page.click('#btn-again');
  for (const viewport of [{width: 320, height: 568}, {width: 1280, height: 800}]) {
    await page.setViewportSize(viewport);
    await game('game.fit();');
    const bounds = await page.evaluate(() => {
      const ids = ['#game', '#joy-panel', '.top', '.score', '.ladder'];
      return ids.map(id => { const r = document.querySelector(id).getBoundingClientRect(); return {id, x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; });
    });
    for (const r of bounds) {
      assert.ok(r.x >= -1 && r.y >= -1 && r.right <= viewport.width + 1 && r.bottom <= viewport.height + 1, JSON.stringify(r));
      if (r.id === '#game') assert.ok(r.height > 100, JSON.stringify(r));
      if (r.id === '.score') assert.ok(r.width >= 30, JSON.stringify(r));
    }
    await page.screenshot({ path: join(output, `joy-${viewport.width}.png`) });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({status:'passed', checks:['skills and cooldown','talent thresholds/pause/reload','mode switching and old saves','classic without skills','isolated report/best','zero joy network requests','single-use rescue','320px and desktop layout'], screenshots: output, onlineRequests: online.length}, null, 2));
} finally {
  await browser.close();
}
