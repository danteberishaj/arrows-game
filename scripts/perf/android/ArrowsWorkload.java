package com.arrows.perf;

import android.graphics.Point;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.MotionEvent;
import java.lang.reflect.Method;

/** Shell-side, frame-paced gesture injector used by the release benchmark. */
public final class ArrowsWorkload {
  private static final int INJECT_INPUT_EVENT_MODE_WAIT_FOR_RESULT = 1;

  public static void main(String[] args) throws Exception {
    if (args.length == 0) {
      throw new IllegalArgumentException("expected pinch, pan, tap, or tap-sequence");
    }

    GestureResult result;
    if ("pinch".equals(args[0])) {
      if (args.length != 11) {
        throw new IllegalArgumentException(
            "pinch expects start1X start1Y start2X start2Y end1X end1Y end2X end2Y steps durationMs");
      }
      result = pinch(
          point(args, 1),
          point(args, 3),
          point(args, 5),
          point(args, 7),
          integer(args[9]),
          integer(args[10]));
    } else if ("pan".equals(args[0])) {
      if (args.length != 7) {
        throw new IllegalArgumentException("pan expects startX startY endX endY steps durationMs");
      }
      result = pan(point(args, 1), point(args, 3), integer(args[5]), integer(args[6]));
    } else if ("tap".equals(args[0])) {
      if (args.length != 3) throw new IllegalArgumentException("tap expects x y");
      result = tap(point(args, 1));
    } else if ("tap-sequence".equals(args[0])) {
      if (args.length < 4 || args.length % 2 != 0) {
        throw new IllegalArgumentException("tap-sequence expects intervalMs followed by x y pairs");
      }
      Point[] points = new Point[(args.length - 2) / 2];
      for (int index = 0; index < points.length; index++) {
        points[index] = point(args, 2 + index * 2);
      }
      result = tapSequence(points, integer(args[1]));
    } else {
      throw new IllegalArgumentException("unknown gesture: " + args[0]);
    }

    System.out.println(
        "{\"startNs\":\"" + result.startNs
            + "\",\"endNs\":\"" + result.endNs
            + "\",\"acceptedMoves\":" + result.acceptedMoves
            + ",\"acceptedTaps\":" + result.acceptedTaps
            + ",\"durationMs\":" + result.durationMs + "}");
  }

  private static GestureResult pinch(
      Point start1,
      Point start2,
      Point end1,
      Point end2,
      int steps,
      int durationMs) throws Exception {
    validateTiming(steps, durationMs);
    long downTime = SystemClock.uptimeMillis();
    long startedNs = System.nanoTime();
    inject(event(downTime, downTime, MotionEvent.ACTION_DOWN, start1, null));
    inject(event(
        downTime,
        downTime,
        MotionEvent.ACTION_POINTER_DOWN | (1 << MotionEvent.ACTION_POINTER_INDEX_SHIFT),
        start1,
        start2));

    int acceptedMoves = 0;
    for (int step = 1; step <= steps; step++) {
      long due = downTime + Math.round(step * durationMs / (double) steps);
      sleepUntil(due);
      float progress = step / (float) steps;
      if (inject(event(
          downTime,
          due,
          MotionEvent.ACTION_MOVE,
          interpolate(start1, end1, progress),
          interpolate(start2, end2, progress)))) {
        acceptedMoves++;
      }
    }

    long upTime = SystemClock.uptimeMillis();
    inject(event(
        downTime,
        upTime,
        MotionEvent.ACTION_POINTER_UP | (1 << MotionEvent.ACTION_POINTER_INDEX_SHIFT),
        end1,
        end2));
    inject(event(downTime, upTime, MotionEvent.ACTION_UP, end1, null));
    long endedNs = System.nanoTime();
    return new GestureResult(startedNs, endedNs, acceptedMoves, 0);
  }

  private static GestureResult pan(Point start, Point end, int steps, int durationMs)
      throws Exception {
    validateTiming(steps, durationMs);
    long downTime = SystemClock.uptimeMillis();
    long startedNs = System.nanoTime();
    inject(event(downTime, downTime, MotionEvent.ACTION_DOWN, start, null));

    int acceptedMoves = 0;
    for (int step = 1; step <= steps; step++) {
      long due = downTime + Math.round(step * durationMs / (double) steps);
      sleepUntil(due);
      float progress = step / (float) steps;
      if (inject(event(
          downTime,
          due,
          MotionEvent.ACTION_MOVE,
          interpolate(start, end, progress),
          null))) {
        acceptedMoves++;
      }
    }

    long upTime = SystemClock.uptimeMillis();
    inject(event(downTime, upTime, MotionEvent.ACTION_UP, end, null));
    long endedNs = System.nanoTime();
    return new GestureResult(startedNs, endedNs, acceptedMoves, 0);
  }

  private static GestureResult tap(Point point) throws Exception {
    long downTime = SystemClock.uptimeMillis();
    long startedNs = System.nanoTime();
    inject(event(downTime, downTime, MotionEvent.ACTION_DOWN, point, null));
    SystemClock.sleep(32);
    inject(event(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point, null));
    return new GestureResult(startedNs, System.nanoTime(), 0, 1);
  }

  private static GestureResult tapSequence(Point[] points, int intervalMs) throws Exception {
    if (points.length < 1 || intervalMs < 40) {
      throw new IllegalArgumentException("tap-sequence requires points and an interval of at least 40 ms");
    }
    long sequenceStartMs = SystemClock.uptimeMillis();
    long startedNs = System.nanoTime();
    int acceptedTaps = 0;
    for (int index = 0; index < points.length; index++) {
      sleepUntil(sequenceStartMs + (long) index * intervalMs);
      injectTap(points[index]);
      acceptedTaps++;
    }
    return new GestureResult(startedNs, System.nanoTime(), 0, acceptedTaps);
  }

  private static void injectTap(Point point) throws Exception {
    long downTime = SystemClock.uptimeMillis();
    inject(event(downTime, downTime, MotionEvent.ACTION_DOWN, point, null));
    SystemClock.sleep(32);
    inject(event(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point, null));
  }

  private static void validateTiming(int steps, int durationMs) {
    if (steps < 1 || durationMs < 1) {
      throw new IllegalArgumentException("steps and durationMs must be positive");
    }
  }

  private static void sleepUntil(long dueUptimeMs) {
    while (true) {
      long remaining = dueUptimeMs - SystemClock.uptimeMillis();
      if (remaining <= 0) return;
      SystemClock.sleep(remaining);
    }
  }

  private static Point point(String[] args, int index) {
    return new Point(integer(args[index]), integer(args[index + 1]));
  }

  private static int integer(String value) {
    return Integer.parseInt(value);
  }

  private static Point interpolate(Point start, Point end, float progress) {
    return new Point(
        Math.round(start.x + (end.x - start.x) * progress),
        Math.round(start.y + (end.y - start.y) * progress));
  }

  private static MotionEvent event(
      long downTime,
      long eventTime,
      int action,
      Point first,
      Point second) {
    int count = second == null ? 1 : 2;
    MotionEvent.PointerProperties[] properties = new MotionEvent.PointerProperties[count];
    MotionEvent.PointerCoords[] coordinates = new MotionEvent.PointerCoords[count];
    for (int index = 0; index < count; index++) {
      MotionEvent.PointerProperties pointer = new MotionEvent.PointerProperties();
      pointer.id = index;
      pointer.toolType = MotionEvent.TOOL_TYPE_FINGER;
      properties[index] = pointer;

      Point point = index == 0 ? first : second;
      MotionEvent.PointerCoords coords = new MotionEvent.PointerCoords();
      coords.x = point.x;
      coords.y = point.y;
      coords.pressure = 1;
      coords.size = 1;
      coordinates[index] = coords;
    }
    return MotionEvent.obtain(
        downTime,
        eventTime,
        action,
        count,
        properties,
        coordinates,
        0,
        0,
        1,
        1,
        0,
        0,
        InputDevice.SOURCE_TOUCHSCREEN,
        0);
  }

  private static boolean inject(MotionEvent event) throws Exception {
    try {
      Class<?> managerClass = Class.forName("android.hardware.input.InputManager");
      Method getInstance = managerClass.getDeclaredMethod("getInstance");
      Object manager = getInstance.invoke(null);
      Method inject = managerClass.getDeclaredMethod("injectInputEvent", InputEvent.class, int.class);
      boolean accepted = (Boolean) inject.invoke(
          manager,
          event,
          INJECT_INPUT_EVENT_MODE_WAIT_FOR_RESULT);
      if (!accepted) throw new IllegalStateException("input event was rejected");
      return true;
    } finally {
      event.recycle();
    }
  }

  private static final class GestureResult {
    final long startNs;
    final long endNs;
    final int acceptedMoves;
    final int acceptedTaps;
    final double durationMs;

    GestureResult(long startNs, long endNs, int acceptedMoves, int acceptedTaps) {
      this.startNs = startNs;
      this.endNs = endNs;
      this.acceptedMoves = acceptedMoves;
      this.acceptedTaps = acceptedTaps;
      this.durationMs = (endNs - startNs) / 1_000_000.0;
    }
  }
}
