const FIELD =
  'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]), textarea, select, [contenteditable=true]';

function isField(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.matches(FIELD);
}

function keyboardHeight(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

function revealFocusedField() {
  const el = document.activeElement;
  if (!isField(el)) return;
  const vv = window.visualViewport;
  const viewTop = vv?.offsetTop ?? 0;
  const viewBottom = viewTop + (vv?.height ?? window.innerHeight);

  const scope = el.closest('.fullscreen-sheet') ?? document;
  const header = scope.querySelector('.topbar');
  const actionBar = scope.querySelector('.action-bar');
  const top = Math.max(viewTop, header?.getBoundingClientRect().bottom ?? 0) + 8;
  const bottom = viewBottom - (actionBar?.getBoundingClientRect().height ?? 0) - 8;

  const rect = el.getBoundingClientRect();
  if (rect.top >= top && rect.bottom <= bottom) return;

  const scroller = (el.closest('.fullscreen-sheet') as HTMLElement | null) ?? document.scrollingElement ?? document.documentElement;
  const delta = rect.top < top ? rect.top - top : rect.bottom - bottom;
  scroller.scrollBy({ top: delta, behavior: 'smooth' });
}

export function initKeyboardAvoidance() {
  const root = document.documentElement;
  let wasOpen = false;

  const update = () => {
    const kb = keyboardHeight();
    root.style.setProperty('--kb', `${kb}px`);
    const open = kb > 80 || (isField(document.activeElement) && window.visualViewport != null && window.visualViewport.height < window.screen.height * 0.6);
    root.classList.toggle('keyboard-open', open);
    if (open && !wasOpen) requestAnimationFrame(revealFocusedField);
    wasOpen = open;
  };

  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);

  document.addEventListener('focusin', (e) => {
    if (!isField(e.target as Element)) return;
    requestAnimationFrame(revealFocusedField);
    setTimeout(() => {
      update();
      revealFocusedField();
    }, 350);
  });
  document.addEventListener('focusout', () => setTimeout(update, 100));

  update();
}
