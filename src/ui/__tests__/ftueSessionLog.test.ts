import { formatFtueSessionLog } from '../ftueSessionLog';

describe('formatFtueSessionLog', () => {
  it('formats board_mount for tutorial ids and campaign level indexes', () => {
    expect(formatFtueSessionLog({ type: 'board_mount', board: 'T1' }, 12.9))
      .toBe('[ftue] board_mount T1 12');
    expect(formatFtueSessionLog({ type: 'board_mount', board: 0 }, 13.9))
      .toBe('[ftue] board_mount 0 13');
  });

  it('formats removal', () => {
    expect(formatFtueSessionLog({ type: 'removal' }, 23.9))
      .toBe('[ftue] removal 23');
  });

  it('formats blocked with its heart charge and grace-or-assist reason', () => {
    expect(formatFtueSessionLog({
      type: 'blocked',
      charged: false,
      graceOrAssist: 'grace',
    }, 34.9)).toBe('[ftue] blocked false grace 34');
  });

  it('formats stall_hint', () => {
    expect(formatFtueSessionLog({ type: 'stall_hint' }, 45.9))
      .toBe('[ftue] stall_hint 45');
  });

  it('formats clear with hearts left', () => {
    expect(formatFtueSessionLog({ type: 'clear', heartsLeft: 2 }, 56.9))
      .toBe('[ftue] clear 2 56');
  });

  it('formats restart', () => {
    expect(formatFtueSessionLog({ type: 'restart' }, 67.9))
      .toBe('[ftue] restart 67');
  });
});
