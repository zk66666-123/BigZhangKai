import { isJoy, modeName } from './mode.js?v=06a4bc39';
import { state } from './state.js?v=ba9e26bd';
import { $ } from './dom.js?v=5b57db68';

export function bindModePicker({ save }) {
  let modeWasPaused = false;
  let modeFocus = null;
  let modeOpenedAt = 0;
  const open = () => {
    modeWasPaused = state.paused;
    modeFocus = document.activeElement;
    modeOpenedAt = performance.now();
    state.paused = true;
    $('mode-picker').hidden = false;
    $('mode-close').focus();
  };
  const close = () => {
    $('mode-picker').hidden = true;
    state.paused = modeWasPaused;
    if (!modeWasPaused) state.startedAt += performance.now() - modeOpenedAt;
    state.dangerSince = 0;
    modeFocus?.focus();
  };
  $('btn-mode').addEventListener('click', open);
  $('welcome-mode').addEventListener('click', open);
  $('mode-close').addEventListener('click', close);
  $('mode-current').textContent = `当前：${modeName} · 切换时自动保存本局`;
  for (const mode of ['classic', 'joy']) {
    const link = $('choose-' + mode);
    const url = new URL(location.href);
    url.search = mode === 'joy' ? '?mode=joy' : '';
    url.hash = '';
    link.href = url.href;
    const selected = (mode === 'joy') === isJoy;
    if (selected) link.setAttribute('aria-current', 'true');
    link.addEventListener('click', e => {
      if (selected) { e.preventDefault(); close(); }
      else save();
    });
  }
  document.addEventListener('keydown', e => {
    const dialog = !$('mode-picker').hidden ? $('mode-picker') : !$('talent-picker').hidden ? $('talent-picker') : null;
    if (!dialog) return;
    if (e.key === 'Escape' && dialog.id === 'mode-picker') { e.preventDefault(); close(); }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button:not(:disabled), a[href]')];
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
