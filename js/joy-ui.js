// 欢乐模式面板与天赋弹窗；通过回调调用游戏，保持模块依赖无环。
import { isJoy, modeName } from './mode.js';
import { state } from './state.js';
import { JOY_RULES, JOY_MILESTONES, TALENTS, offerJoyTalents, chooseJoyTalent } from './joy.js';
import { $ } from './dom.js';

let joySave = () => {};
let joyResize = () => {};
let joyChoiceStartedAt = 0;
let joyFeedbackUntil = 0;
let joyChoicesSignature = '';
let joyTalentsSignature = '';

export function joyFeedback(message) {
  if (!isJoy) return;
  $('joy-hint').textContent = message;
  joyFeedbackUntil = performance.now() + 3200;
}

export function resetJoyUI() {
  $('talent-picker').hidden = true;
  joyChoiceStartedAt = 0;
  joyChoicesSignature = '';
  joyTalentsSignature = '';
  joyFeedbackUntil = 0;
}

function showJoyChoices(offer) {
  if (!$('talent-picker').hidden) return;
  if (document.querySelector('.overlay:not([hidden])')) return;
  state.paused = true;
  state.dangerSince = 0;
  joyChoiceStartedAt = performance.now();
  $('talent-picker').hidden = false;
  $('talent-title').textContent = `合到第 ${offer.milestone + 1} 级 · 选一个天赋`;
  const signature = offer.options.join(',');
  if (signature !== joyChoicesSignature) {
    joyChoicesSignature = signature;
    $('talent-choices').replaceChildren(...offer.options.map(id => {
      const talent = TALENTS.find(t => t.id === id);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'talent-option'; button.dataset.talent = id;
      const icon = document.createElement('span'); icon.className = 'talent-icon'; icon.textContent = talent.icon;
      const text = document.createElement('span');
      const name = document.createElement('b'); name.textContent = talent.name;
      const desc = document.createElement('small'); desc.textContent = talent.desc;
      text.append(name, desc); button.append(icon, text);
      button.addEventListener('click', () => {
        if (!chooseJoyTalent(state.joy, id)) return;
        const pausedFor = performance.now() - joyChoiceStartedAt;
        state.startedAt += pausedFor;
        if (state.lastMergeAt) state.lastMergeAt += pausedFor;
        $('talent-picker').hidden = true;
        state.paused = false;
        state.dangerSince = 0;
        joyFeedback(`已获得「${talent.name}」`);
        syncJoyUI();
        joySave();
        if ($('talent-picker').hidden) $('btn-swap').focus();
      });
      return button;
    }));
  }
  $('talent-choices').querySelector('button')?.focus();
  joySave();
}

export function syncJoyUI() {
  if (!isJoy || !state.joy) return;
  const run = state.joy;
  $('joy-energy').textContent = `${run.energy} / ${JOY_RULES.energyMax}`;
  $('joy-meter').value = run.energy;
  const blocked = state.over || state.paused || !state.canDrop || performance.now() < (state.joySkillReadyAt || 0)
    || Boolean(document.querySelector('.overlay:not([hidden])'));
  $('btn-swap').disabled = blocked || run.energy < JOY_RULES.swapCost;
  $('btn-shake').disabled = blocked || run.energy < JOY_RULES.shakeCost;
  const signature = run.talents.join(',') + run.rescueUsed;
  if (signature !== joyTalentsSignature) {
    joyTalentsSignature = signature;
    $('joy-talents').replaceChildren(...run.talents.map(id => {
      const talent = TALENTS.find(t => t.id === id);
      const tag = document.createElement('span');
      tag.textContent = talent.icon + ' ' + talent.name + (id === 'rescue' && run.rescueUsed ? ' · 已用' : '');
      tag.title = talent.desc;
      return tag;
    }));
    joyResize();
  }
  if (performance.now() > joyFeedbackUntil) {
    const next = JOY_MILESTONES[run.talents.length];
    $('joy-hint').textContent = next === undefined ? '天赋已集齐，试试技能与连击的配合！'
      : `每次合成 +${run.talents.includes('charge') ? 12 : 8} 能量 · 第 ${next + 1} 级选天赋`;
  }
  if (!state.over) {
    const offer = offerJoyTalents(run, state.topLevel);
    if (offer) showJoyChoices(offer);
  }
}

export function bindJoyUI({ useSkill, save, resize }) {
  joySave = save;
  joyResize = resize;
  $('joy-panel').hidden = !isJoy;
  $('mode-label').textContent = modeName;
  document.body.classList.toggle('joy-mode', isJoy);
  $('btn-swap').addEventListener('click', () => useSkill('swap'));
  $('btn-shake').addEventListener('click', () => useSkill('shake'));
}
