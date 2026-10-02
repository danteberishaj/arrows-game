package com.arrows.art;

import com.android.uiautomator.testrunner.UiAutomatorTestCase;
import java.io.File;

/** Shell-only live hierarchy capture: the caller checks stable bounds, not global idle. */
public final class ArrowsHierarchy extends UiAutomatorTestCase {
  public void testDump() {
    // Allow a newly connected accessibility service to observe the active dialog.
    // This is not a global-idle wait and occurs only outside timed openings.
    sleep(1000);
    getUiDevice().dumpWindowHierarchy("art08-live-ui.xml");
    // The legacy shell runner makes Environment's data root /data/local/tmp;
    // UiDevice itself appends local/tmp. Record its actual API31 output path.
    assertTrue("No fresh hierarchy", new File("/data/local/tmp/local/tmp/art08-live-ui.xml").exists());
  }
}
