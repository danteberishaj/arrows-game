/**
 * TF-02 C: the accessibility sweep's test instrument (a helper, not a test file). It walks a rendered host tree and
 * lists every PRESSABLE host element (one carrying a press handler: Pressable / PressScale / HeaderButton render a host
 * View with `onClick` and the responder handlers) that a screen reader can reach but that lacks a role, a spoken label,
 * or, for a toggle (switch / radio / checkbox / tab), its state. A pressable hidden from accessibility
 * (`accessible={false}`, or under `importantForAccessibility="no-hide-descendants"` / `accessibilityElementsHidden`)
 * is not reachable and is skipped. The device check is the uiautomator dump (artifacts/TF-02/a11y-*.xml).
 */
import type { ReactTestInstance } from 'react-test-renderer';

const TOGGLE_ROLES = new Set(['switch', 'radio', 'checkbox', 'tab']);

const isPressable = (n: ReactTestInstance) =>
  typeof n.type === 'string' &&
  (typeof n.props.onClick === 'function' || typeof n.props.onResponderRelease === 'function' || typeof n.props.onPress === 'function');

const hidesDescendants = (n: ReactTestInstance) =>
  n.props.importantForAccessibility === 'no-hide-descendants' || n.props.accessibilityElementsHidden === true;

const textOf = (n: ReactTestInstance): string =>
  n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

export interface A11yGap {
  what: string;
  missing: string[];
}

/** Every reachable pressable host element missing a role, a label, or (a toggle) its state. */
export function a11yGaps(root: ReactTestInstance): A11yGap[] {
  const gaps: A11yGap[] = [];
  const visit = (n: ReactTestInstance) => {
    if (typeof n.type === 'string' && hidesDescendants(n)) return;
    if (isPressable(n) && n.props.accessible !== false) {
      const role: string | undefined = n.props.accessibilityRole ?? n.props.role;
      const label: string | undefined = n.props.accessibilityLabel ?? n.props['aria-label'];
      const state = n.props.accessibilityState ?? {};
      const missing: string[] = [];
      if (!role || role === 'none') missing.push('role');
      if (typeof label !== 'string' || label.trim() === '') missing.push('label');
      if (role && TOGGLE_ROLES.has(role) && state.checked === undefined && state.selected === undefined) missing.push('state');
      if (missing.length > 0) gaps.push({ what: n.props.testID ?? (textOf(n).trim() || `<${String(n.type)}>`), missing });
    }
    for (const c of n.children) if (typeof c !== 'string') visit(c);
  };
  visit(root);
  return gaps;
}

/** How many reachable pressables the walk saw (so a sweep that finds nothing to check fails loudly). */
export function pressableCount(root: ReactTestInstance): number {
  let count = 0;
  const visit = (n: ReactTestInstance) => {
    if (typeof n.type === 'string' && hidesDescendants(n)) return;
    if (isPressable(n) && n.props.accessible !== false) count++;
    for (const c of n.children) if (typeof c !== 'string') visit(c);
  };
  visit(root);
  return count;
}
