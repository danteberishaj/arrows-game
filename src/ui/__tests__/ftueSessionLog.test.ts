import { formatFtueSessionLog } from '../ftueSessionLog';

describe('formatFtueSessionLog', () => {
  it('formats board_mount for tutorial ids and campaign level indexes, tagged with the generator version (W3-06)', () => {
    expect(formatFtueSessionLog(
      { type: 'board_mount', board: 'T1', gen: 1, arrows: 12, shape: 'Circle' },
      12.9,
    )).toBe('[ftue] board_mount T1 12 gen=1 arrows=12 shape=Circle');
    expect(formatFtueSessionLog(
      { type: 'board_mount', board: 0, gen: 1, arrows: 20, shape: 'Plus' },
      13.9,
    )).toBe('[ftue] board_mount 0 13 gen=1 arrows=20 shape=Plus');
  });

  it('pins the W3-06 acceptance example, and formats gen=2', () => {
    expect(formatFtueSessionLog(
      { type: 'board_mount', board: 11, gen: 1, arrows: 54, shape: 'Bolt' },
      0,
    )).toBe('[ftue] board_mount 11 0 gen=1 arrows=54 shape=Bolt');
    expect(formatFtueSessionLog(
      { type: 'board_mount', board: 41, gen: 2, arrows: 80, shape: 'Diamond' },
      0,
    )).toBe('[ftue] board_mount 41 0 gen=2 arrows=80 shape=Diamond');
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
