import { useEffect } from 'react';

export type HotkeyHandler = (event: KeyboardEvent) => void;
export type HotkeyMap = Record<string, HotkeyHandler>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Register single-key shortcuts ("/", "n", "Escape", "mod+k"). Plain letter keys are ignored while
 * the user is typing in a field so they never fire mid-sentence.
 */
export function useHotkeys(map: HotkeyMap, options: { enabled?: boolean } = {}): void {
  const enabled = options.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key;
      const combo = `${event.metaKey || event.ctrlKey ? 'mod+' : ''}${key.length === 1 ? key.toLowerCase() : key}`;
      const handler = map[combo] ?? map[key];
      if (!handler) return;
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
      if (plain && key !== 'Escape' && isTypingTarget(event.target)) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map, enabled]);
}
