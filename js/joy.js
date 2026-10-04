// 欢乐模式的纯规则；经典模式不使用这些加成。
import { RULES, SHINY } from './config.js';

export const JOY_RULES = { energyMax: 100, startingEnergy: 30, mergeEnergy: 8, swapCost: 35, shakeCost: 40, skillCooldownMs: 1200 };
export const JOY_MILESTONES = [4, 8, 11]; // 展示等级 5、9、12，从 0 开始计数
export const TALENTS = [
  { id: 'gold', icon: '✦', name: '黄金时代', desc: '新生黄金概率从 1% 提升到 4%，遗传概率不变。' },
  { id: 'chain', icon: '∞', name: '连锁反应', desc: '连击窗口从 1.2 秒延长到 2.4 秒。' },
  { id: 'aim', icon: '◎', name: '精准投放', desc: '显示落点参考圈，帮你瞄准堆叠位置。' },
  { id: 'rescue', icon: '♥', name: '绝处逢生', desc: '首次判负前清除越线区最小的一个张楷，本局限一次。' },
  { id: 'charge', icon: 'ϟ', name: '蓄势待发', desc: '每次合成获得 12 点能量，立即补充 20 点能量。' }
];

export function createJoyRun() {
  return { energy: JOY_RULES.startingEnergy, talents: [], offer: null, rescueUsed: false, swaps: 0, shakes: 0 };
}
export const hasTalent = (run, id) => Boolean(run?.talents.includes(id));
export const joyComboWindow = run => RULES.comboWindowMs * (hasTalent(run, 'chain') ? 2 : 1);
export const joyShinyChance = run => hasTalent(run, 'gold') ? 0.04 : SHINY.chance;

export function gainJoyEnergy(run, amount = hasTalent(run, 'charge') ? 12 : JOY_RULES.mergeEnergy) {
  run.energy = Math.min(JOY_RULES.energyMax, run.energy + amount);
}
export function spendJoyEnergy(run, skill) {
  const cost = skill === 'swap' ? JOY_RULES.swapCost : skill === 'shake' ? JOY_RULES.shakeCost : Infinity;
  if (run.energy < cost) return false;
  run.energy -= cost;
  if (skill === 'swap') run.swaps += 1;
  else run.shakes += 1;
  return true;
}

// 候选一旦出现就保存，刷新不会重抽；一次只处理一个里程碑。
export function offerJoyTalents(run, topLevel, random = Math.random) {
  if (run.offer) return run.offer;
  const milestone = JOY_MILESTONES[run.talents.length];
  if (milestone === undefined || topLevel < milestone) return null;
  const pool = TALENTS.filter(t => !hasTalent(run, t.id)).map(t => t.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  run.offer = { milestone, options: pool.slice(0, 3) };
  return run.offer;
}
export function chooseJoyTalent(run, id) {
  if (!run.offer?.options.includes(id) || hasTalent(run, id)) return false;
  run.talents.push(id);
  run.offer = null;
  if (id === 'charge') gainJoyEnergy(run, 20);
  return true;
}

export function restoreJoyRun(saved) {
  const run = createJoyRun();
  if (!saved || typeof saved !== 'object') return run;
  const ids = new Set(TALENTS.map(t => t.id));
  run.talents = Array.isArray(saved.talents) ? [...new Set(saved.talents.filter(id => ids.has(id)))].slice(0, 3) : [];
  run.energy = Number.isFinite(saved.energy) ? Math.max(0, Math.min(JOY_RULES.energyMax, saved.energy)) : run.energy;
  run.rescueUsed = saved.rescueUsed === true;
  for (const key of ['swaps', 'shakes']) run[key] = Number.isInteger(saved[key]) && saved[key] >= 0 ? saved[key] : 0;
  const offer = saved.offer;
  if (offer && run.talents.length < 3 && offer.milestone === JOY_MILESTONES[run.talents.length]
      && Array.isArray(offer.options) && offer.options.length === 3 && new Set(offer.options).size === 3
      && offer.options.every(id => ids.has(id) && !run.talents.includes(id))) {
    run.offer = { milestone: offer.milestone, options: [...offer.options] };
  }
  return run;
}
