import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import { GameScreen } from '../GameScreen';
import { Daylight } from '../theme';
import { createMemorySink, noopSink, Telemetry } from '../../telemetry/telemetry';

let mockBoardViewProps: BoardViewProps;

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../ads', () => ({
  Ads: {
    rewardedReady: false,
    subscribeRewardedReady: () => () => {},
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: jest.fn(),
    showRewarded: jest.fn(),
  },
}));

describe('GameScreen telemetry', () => {
  afterEach(() => Telemetry.useSink(noopSink));

  test('emits one cleared level with every exit tap counted', () => {
    const sink = createMemorySink(Number.MAX_SAFE_INTEGER);
    Telemetry.configure({ validate: true, disabled: false });
    Telemetry.useSink(sink);

    render(
      <GameScreen
        palette={Daylight}
        onHome={jest.fn()}
        initialLevelIndex={0}
        benchmarkMode
        feedbackEnabled={false}
      />,
    );

    const arrowCount = mockBoardViewProps.board.count();
    expect(arrowCount).toBeGreaterThan(0);

    act(() => {
      for (let index = 0; index < arrowCount - 1; index += 1) {
        mockBoardViewProps.onTapOutcome?.('exit');
        mockBoardViewProps.onRemoved(false);
      }
      mockBoardViewProps.onTapOutcome?.('exit');
      mockBoardViewProps.onRemoved(true);
    });

    const starts = sink.events.filter((event) => event.name === 'level_start');
    const ends = sink.events.filter((event) => event.name === 'level_end');

    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toEqual(expect.objectContaining({
      outcome: 'cleared',
      tapsExit: arrowCount,
    }));
  });
});
