package com.jtatar.fishjamcamera;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
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

  private File screenshot(String name) {
    File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "e2e");
    directory.mkdirs();
    File file = new File(directory, name + ".png");
    assertTrue(device.takeScreenshot(file));
    return file;
  }

  private void waitForPicture() {
    long deadline = SystemClock.elapsedRealtime() + 15000;
    do {
      Bitmap pixels = BitmapFactory.decodeFile(screenshot("android-cloud-first-frame").getAbsolutePath());
      int bright = 0;
      int samples = 0;
      for (int y = pixels.getHeight() / 4; y < pixels.getHeight() * 3 / 4; y += 16) {
        for (int x = pixels.getWidth() / 4; x < pixels.getWidth() * 3 / 4; x += 16) {
          int color = pixels.getPixel(x, y);
          if (Color.red(color) + Color.green(color) + Color.blue(color) > 45) bright++;
          samples++;
        }
      }
      pixels.recycle();
      if (bright > samples / 100) return;
      SystemClock.sleep(1000);
    } while (SystemClock.elapsedRealtime() < deadline);
    fail("No visible video within 15 seconds. Point the publisher at a lit scene.");
  }

  @Test public void fullscreenPreservesLivestreamConnection() {
    Configurator.getInstance().setWaitForIdleTimeout(250);
    Intent launch = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager()
        .getLaunchIntentForPackage("com.jtatar.fishjamcamera");
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
    InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(launch);
    button("Join as a viewer").click();
    button("Watch livestream").click();
    button("Stop watching");
    fullscreenButton().click();
    button("Exit fullscreen");

    UiObject2 video = device.wait(Until.findObject(By.res("fullscreen-video")), 15000);
    assertNotNull("Fullscreen video must mount", video);
    Rect bounds = video.getVisibleBounds();
    assertTrue("Video surface must span the screen width", bounds.width() >= device.getDisplayWidth() * 0.95);
    assertTrue("Video surface must span the screen height", bounds.height() >= device.getDisplayHeight() * 0.90);
    waitForPicture();
    screenshot("android-cloud-fullscreen");

    device.pressBack();
    assertTrue(device.wait(Until.gone(By.desc("Exit fullscreen")), 5000));
    button("Stop watching");
    fullscreenButton().click();
    button("Exit fullscreen").click();
    assertTrue(device.wait(Until.gone(By.desc("Exit fullscreen")), 5000));
    button("Stop watching");
    screenshot("android-cloud-inline");

    // Optional observation window for simultaneous publisher control tests.
    fullscreenButton().click();
    button("Exit fullscreen");
    int observeSeconds = Integer.parseInt(InstrumentationRegistry.getArguments().getString("observeSeconds", "0"));
    assertTrue("observeSeconds must be between 0 and 300", observeSeconds >= 0 && observeSeconds <= 300);
    for (int elapsed = 0; elapsed < observeSeconds; elapsed += 4) {
      SystemClock.sleep(4000);
      button("Exit fullscreen");
      screenshot("android-cloud-observe-" + elapsed);
    }
    button("Exit fullscreen").click();
    button("Stop watching").click();
    button("Watch livestream");
  }
}
