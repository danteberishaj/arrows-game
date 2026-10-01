package com.arrows.art;
import android.os.SystemClock;
/** Shell-only clock anchor for matching recorded SurfaceFlinger frames to a JS Date.now tap. */
public final class SkinPickerClock {
  public static void main(String[] args) {
    long before = SystemClock.elapsedRealtimeNanos();
    long epochMs = System.currentTimeMillis();
    long after = SystemClock.elapsedRealtimeNanos();
    System.out.println("{\"elapsedBeforeNs\":" + before + ",\"epochMs\":" + epochMs + ",\"elapsedAfterNs\":" + after + "}");
  }
}
