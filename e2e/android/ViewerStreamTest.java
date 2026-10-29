package com.jtatar.fishjamcamera;

import android.content.Intent;
import android.graphics.Rect;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.Configurator;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import java.io.File;
import java.util.regex.Pattern;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Requires a publisher already streaming to this app's configured Fishjam room. */
@RunWith(AndroidJUnit4.class)
public class ViewerStreamTest {
  private final UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());

  private UiObject2 button(String label) {
    UiObject2 button = device.wait(Until.findObject(By.desc(label)), 15000);
    assertNotNull("Missing button: " + label, button);
    return button;
  }

  private UiObject2 fullscreenButton() {
    UiObject2 button = device.wait(Until.findObject(By.desc(Pattern.compile("View .+ fullscreen"))), 60000);
    assertNotNull("Start the publisher in the same room before running this test", button);
    return button;
  }

  private void screenshot(String name) {
    File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "e2e");
    directory.mkdirs();
    assertTrue(device.takeScreenshot(new File(directory, name + ".png")));
  }

  @Test public void fullscreenPreservesRoomConnection() {
    Configurator.getInstance().setWaitForIdleTimeout(250);
    Intent launch = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager()
        .getLaunchIntentForPackage("com.jtatar.fishjamcamera");
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
    InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(launch);
    button("Join as a viewer").click();
    button("Join as viewer").click();
    button("Leave room");
    fullscreenButton().click();
    button("Exit fullscreen");

    UiObject2 video = device.wait(Until.findObject(By.res("fullscreen-video")), 15000);
    assertNotNull("Fullscreen video must mount", video);
    Rect bounds = video.getVisibleBounds();
    assertTrue("Video surface must span the screen width", bounds.width() >= device.getDisplayWidth() * 0.95);
    assertTrue("Video surface must span the screen height", bounds.height() >= device.getDisplayHeight() * 0.90);
    SystemClock.sleep(2500);
    screenshot("android-cloud-fullscreen");

    device.pressBack();
    assertTrue(device.wait(Until.gone(By.desc("Exit fullscreen")), 5000));
    button("Leave room");
    fullscreenButton().click();
    button("Exit fullscreen").click();
    assertTrue(device.wait(Until.gone(By.desc("Exit fullscreen")), 5000));
    button("Leave room");
    screenshot("android-cloud-inline");

    // Leave the viewer expanded for the manual recording and orientation check.
    fullscreenButton().click();
    button("Exit fullscreen");
  }
}
