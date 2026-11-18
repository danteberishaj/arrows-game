import { createBackStack } from '../sheetBack';

// MOTION-AUDIT M3: Back undoes the newest open sub-page first, one level per press.
test('pop runs the newest step, and a removed step never runs', () => {
  const stack = createBackStack();
  const ran: string[] = [];
  const offTab = stack.register(() => ran.push('book tab -> styles'));
  const offConfirm = stack.register(() => ran.push('confirm -> grid'));
  expect(stack.pop()).toBe(true);
  expect(ran).toEqual(['confirm -> grid']);
  offConfirm(); // the confirm closed, so its step unregisters
  expect(stack.pop()).toBe(true);
  expect(ran).toEqual(['confirm -> grid', 'book tab -> styles']);
  offTab();
  expect(stack.pop()).toBe(false); // nothing open: the sheet itself closes
  offTab(); // a second unregister is harmless
  expect(stack.pop()).toBe(false);
});
