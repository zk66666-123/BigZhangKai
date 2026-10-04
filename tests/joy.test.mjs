import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJoyRun, offerJoyTalents, chooseJoyTalent, restoreJoyRun, gainJoyEnergy, spendJoyEnergy, joyComboWindow, joyShinyChance, JOY_MILESTONES } from '../js/joy.js';
import { RULES, SHINY } from '../js/config.js';
import { rollShiny } from '../js/variant.js';

test('天赋只在第 5、9、12 级出现，候选唯一且不会重复领取', () => {
  const run = createJoyRun();
  assert.equal(offerJoyTalents(run, 3), null);
  for (const level of JOY_MILESTONES) {
    const offer = offerJoyTalents(run, level, () => 0.2);
    assert.equal(offer.milestone, level);
    assert.equal(new Set(offer.options).size, 3);
    assert.ok(offer.options.every(id => !run.talents.includes(id)));
    assert.strictEqual(offerJoyTalents(run, 13), offer, '等待选择期间不能重抽');
    assert.equal(chooseJoyTalent(run, 'invalid'), false);
    assert.equal(chooseJoyTalent(run, offer.options[0]), true);
    assert.equal(chooseJoyTalent(run, offer.options[0]), false);
  }
  assert.equal(offerJoyTalents(run, 13), null);
  assert.equal(run.talents.length, 3);
});

test('跨越多个里程碑也逐次选取，存档保留原候选', () => {
  const run = createJoyRun();
  offerJoyTalents(run, 11, () => 0.4);
  const restored = restoreJoyRun(JSON.parse(JSON.stringify(run)));
  assert.deepEqual(restored, run);
  const first = restored.offer.options[0];
  chooseJoyTalent(restored, first);
  assert.equal(offerJoyTalents(restored, 11).milestone, 8);
});

test('技能共用能量，余额不足与未知技能都不扣费', () => {
  const run = createJoyRun();
  assert.equal(run.energy, 30);
  assert.equal(spendJoyEnergy(run, 'shake'), false);
  assert.equal(spendJoyEnergy(run, 'swap'), false, '开局 30 能量不足以重抽');
  gainJoyEnergy(run);
  assert.equal(run.energy, 38);
  assert.equal(spendJoyEnergy(run, 'swap'), true);
  assert.equal(run.energy, 3);
  assert.equal(run.swaps, 1);
  assert.equal(spendJoyEnergy(run, 'swap'), false);
  assert.equal(spendJoyEnergy(run, 'unknown'), false);
  gainJoyEnergy(run);
  assert.equal(run.energy, 11);
  gainJoyEnergy(run, 1000);
  assert.equal(run.energy, 100);
  assert.equal(spendJoyEnergy(run, 'shake'), true);
  assert.equal(run.energy, 60);
  assert.equal(run.shakes, 1);
  run.energy = 34;
  assert.equal(spendJoyEnergy(run, 'swap'), false);
  assert.equal(run.energy, 34);
  run.energy = 35;
  assert.equal(spendJoyEnergy(run, 'swap'), true);
  assert.equal(run.energy, 0);
});

test('加成仅来自所选天赋，新一局清空天赋与救场次数', () => {
  const run = createJoyRun();
  assert.equal(joyComboWindow(run), RULES.comboWindowMs);
  assert.equal(joyShinyChance(run), SHINY.chance);
  run.offer = { milestone: 4, options: ['charge', 'chain', 'gold'] };
  chooseJoyTalent(run, 'charge');
  assert.equal(run.energy, 50);
  gainJoyEnergy(run);
  assert.equal(run.energy, 62);
  run.talents.push('chain', 'gold');
  assert.equal(joyComboWindow(run), 2400);
  assert.equal(joyShinyChance(run), 0.04);
  assert.deepEqual(createJoyRun(), { energy: 30, talents: [], offer: null, rescueUsed: false, swaps: 0, shakes: 0 });
});

test('存档清理越界能量、未知天赋和错误候选，保留一次性救场状态', () => {
  const restored = restoreJoyRun({ energy: 999, talents: ['gold', 'gold', 'fake'], rescueUsed: true, swaps: -1, shakes: 2, offer: { milestone: 8, options: ['gold', 'aim', 'chain'] } });
  assert.equal(restored.energy, 100);
  assert.deepEqual(restored.talents, ['gold']);
  assert.equal(restored.rescueUsed, true);
  assert.equal(restored.swaps, 0);
  assert.equal(restored.shakes, 2);
  assert.equal(restored.offer, null);
  assert.equal(restoreJoyRun({ energy: -3 }).energy, 0);
});

test('经典黄金概率及随机抽取次数不变，欢乐可单独提高新生概率', () => {
  assert.equal(rollShiny(false, () => 0.02), false);
  assert.equal(rollShiny(false, () => 0.02, 0.04), true);
  let calls = 0;
  assert.equal(rollShiny(true, () => { calls++; return 0.1; }, 0.04), true);
  assert.equal(calls, 1);
});
