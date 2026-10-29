package com.jtatar.fishjamcamera;

import android.content.Intent;
import android.graphics.Rect;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.Configurator;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.UiSelector;
import androidx.test.uiautomator.Until;
import org.junit.Test;
import org.junit.After;
import org.junit.runner.RunWith;
import java.io.File;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class CameraSmokeTest {
  private final UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());

  private UiObject2 button(String label) {
    UiObject2 result = device.wait(Until.findObject(By.desc(label)), 15000);
    assertNotNull("Missing button: " + label, result);
    Rect previous = null;
    int stable = 0;
    long deadline = SystemClock.elapsedRealtime() + 5000;
    while (stable < 4 && SystemClock.elapsedRealtime() < deadline) {
      SystemClock.sleep(150);
      result = device.findObject(By.desc(label));
      assertNotNull("Button disappeared: " + label, result);
      Rect bounds = result.getVisibleBounds();
      stable = bounds.equals(previous) ? stable + 1 : 0;
      previous = bounds;
    }
    return result;
  }

  private void screenshot(String name) {
    File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "e2e");
    directory.mkdirs();
    assertTrue(device.takeScreenshot(new File(directory, name + ".png")));
  }

  @After public void captureFinalState() throws Exception {
    screenshot("android-final-state");
    device.dumpWindowHierarchy(new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "e2e/android-hierarchy.xml"));
  }

  private void assertVideoNotBlank() throws Exception {
    UiObject2 video = device.wait(Until.findObject(By.res("loopback-video")), 10000);
    assertNotNull("Decoded video view must exist", video);
    Rect bounds = video.getVisibleBounds();
    File file = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "e2e/decoded-pixels.png");
    assertTrue(device.takeScreenshot(file));
    Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
    int bright = 0;
    int samples = 0;
    for (int y = bounds.top + 10; y < bounds.bottom - 10; y += 10) {
      for (int x = bounds.left + 10; x < bounds.right - 10; x += 10) {
        int color = bitmap.getPixel(x, y);
        if (Math.max(Color.red(color), Math.max(Color.green(color), Color.blue(color))) > 40) bright++;
        samples++;
      }
    }
    bitmap.recycle();
    assertTrue("Decoded emulated-camera pixels must not be black", samples > 0 && bright > samples / 100);
  }

  private String decodedStats() throws Exception {
    long deadline = SystemClock.elapsedRealtime() + 25000;
    String text = "";
    while (SystemClock.elapsedRealtime() < deadline) {
      UiObject2 stats = device.findObject(By.res("loopback-stats"));
      if (stats != null) {
        text = stats.getText();
        if (text.matches("connected · [1-9][0-9]* decoded frames.*")) return text;
      }
      SystemClock.sleep(250);
    }
    fail("Receiver did not decode frames: " + text);
    return text;
  }

  @Test public void cameraControlsAndEncodedStream() throws Exception {
    Configurator.getInstance().setWaitForIdleTimeout(250);
    Intent initialLaunch = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager().getLaunchIntentForPackage("com.jtatar.fishjamcamera");
    initialLaunch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
    InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(initialLaunch);
    button("Open studio").click();
    assertTrue(device.wait(Until.hasObject(By.res("camera-preview")), 15000));
    assertTrue(device.wait(Until.hasObject(By.desc("2×").enabled(true)), 15000));

    UiObject preview = device.findObject(new UiSelector().resourceId("camera-preview"));
    assertTrue(preview.pinchOut(60, 40));
    SystemClock.sleep(750);
    assertNotEquals("Pinch must change capture zoom", "1.0×", device.findObject(By.res("zoom-value")).getText());
    screenshot("android-pinch");
    button("1×").click();
    assertTrue(device.wait(Until.hasObject(By.res("zoom-value").text("1.0×")), 3000));

    UiObject2 unsupported = device.findObject(By.desc("Torch unavailable"));
    if (unsupported != null) assertFalse(unsupported.isEnabled());
    else if (device.hasObject(By.res("torch-toggle"))) {
      UiObject2 toggle = device.findObject(By.res("torch-toggle"));
      assertFalse(toggle.isSelected());
      toggle.click();
      assertTrue(device.wait(Until.hasObject(By.res("torch-toggle").selected(true)), 5000));
      assertFalse(device.hasObject(By.res("inline-light-control")));
      assertFalse(device.hasObject(By.res("torch-slider")));
      screenshot("android-torch-toggle-on");
      device.findObject(By.res("torch-toggle")).click();
      assertTrue(device.wait(Until.hasObject(By.res("torch-toggle").selected(false)), 5000));
      screenshot("android-torch-toggle-off");
    }
    else {
      button("Lighting").click();
      button("Torch off").click();
      button("Torch on");
      assertTrue("Torch label must reflect the confirmed initial brightness",
          device.wait(Until.hasObject(By.res("torch-value").text(
              device.hasObject(By.res("torch-slider")) ? "100%" : "On")), 5000));
      screenshot("android-torch-on");
      UiObject2 slider = device.findObject(By.res("torch-slider"));
      if (slider != null) {
        Rect track = slider.getVisibleBounds();
        assertTrue(track.height() > track.width() * 2);
        device.swipe(track.centerX(), track.top + 20, track.centerX(), track.centerY(), 25);
        assertTrue(device.wait(Until.hasObject(By.res("torch-value").text("53%")), 10000));
        screenshot("android-inline-light-slider");
      }
      device.click(device.getDisplayWidth() / 6, device.getDisplayHeight() * 2 / 3);
      assertTrue(device.wait(Until.gone(By.res("inline-light-control")), 3000));
      assertTrue(button("Lighting").isSelected());
      button("Lighting").click();
      assertTrue("Reopening lighting must show its current brightness",
          device.wait(Until.hasObject(By.res("torch-value").text(slider != null ? "53%" : "On")), 5000));
      button("Torch on").click();
      button("Torch off");
      assertTrue("Torch label must reflect confirmed off state",
          device.wait(Until.hasObject(By.res("torch-value").text("Off")), 5000));
      button("Lighting").click();
    }

    if (Boolean.parseBoolean(InstrumentationRegistry.getArguments().getString("controlsOnly", "false"))) return;

    boolean configured = device.hasObject(By.desc("Go live"));
    button(configured ? "Stream details" : "Set up stream").click();
    button("Close Stream details");
    screenshot("android-stream-details");
    button("Close Stream details").click();

    button("Check stream").click();
    String atOne = decodedStats();
    assertVideoNotBlank();
    screenshot("android-loopback-1x");
    button("2×").click();
    SystemClock.sleep(1500);
    String atTwo = decodedStats();
    assertVideoNotBlank();
    screenshot("android-loopback-2x");
    assertNotEquals("Decoder must keep receiving during zoom", atOne, atTwo);
    assertEquals("Receiver updates must preserve the live zoom label", "2.0×",
        device.findObject(By.res("zoom-value")).getText());
    assertTrue(preview.pinchOut(60, 40));
    assertTrue(device.wait(Until.hasObject(By.res("loopback-video")), 3000));
    if (device.hasObject(By.desc("Lighting"))) button("Lighting").click();
    device.click(device.getDisplayWidth() / 6, device.getDisplayHeight() * 2 / 3);
    assertTrue(device.wait(Until.gone(By.res("loopback-video")), 3000));
    assertFalse(device.hasObject(By.res("inline-light-control")));

    button("Switch camera").click();
    assertTrue(device.wait(Until.hasObject(By.desc("2×").enabled(true)), 15000));
    assertTrue("Camera switch resets zoom", device.wait(Until.hasObject(By.res("zoom-value").text("1.0×")), 10000));
    button("Check stream").click();
    decodedStats();
    assertVideoNotBlank();
    button("Close stream check").click();
    screenshot("android-front-camera");
    button("Switch camera").click();
    assertTrue(device.wait(Until.hasObject(By.desc("2×").enabled(true)), 15000));

    device.pressHome();
    SystemClock.sleep(1500);
    Intent launch = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager().getLaunchIntentForPackage("com.jtatar.fishjamcamera");
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(launch);
    assertTrue(device.wait(Until.hasObject(By.desc("2×").enabled(true)), 15000));
    button("Check stream").click();
    decodedStats();
    assertVideoNotBlank();
    screenshot("android-resumed");
    button("Close stream check").click();

    button("Back").click();
    button("Join as a viewer").click();
    assertEquals(configured, button("Join as viewer").isEnabled());
    assertFalse(device.hasObject(By.res("camera-preview")));
    screenshot("android-viewer");
    button("Back").click();
    button("Open studio").click();
    assertTrue(device.wait(Until.hasObject(By.desc("2×").enabled(true)), 15000));
    button("Check stream").click();
    decodedStats();
    assertVideoNotBlank();
    screenshot("android-reopened");
    button("Close stream check").click();

    // Repeatedly retire the frame worklet runtime while native capture drains.
    // Setting zoom first makes the reset prove that the replacement capture is
    // mounted, instead of accepting the previous camera's ready accessibility node.
    for (int iteration = 0; iteration < 8; iteration++) {
      button("2×").click();
      assertTrue(device.wait(Until.hasObject(By.res("zoom-value").text("2.0×")), 10000));
      button("Switch camera").click();
      assertTrue(device.wait(Until.hasObject(By.res("zoom-value").text("1.0×")), 15000));
      assertTrue(device.wait(Until.hasObject(By.desc("2×").enabled(true)), 15000));
    }
    for (int iteration = 0; iteration < 3; iteration++) {
      button("Back").click();
      assertTrue(device.wait(Until.gone(By.res("camera-preview")), 10000));
      button("Open studio").click();
      assertTrue(device.wait(Until.hasObject(By.res("camera-preview")), 15000));
      assertTrue(device.wait(Until.hasObject(By.desc("2×").enabled(true)), 15000));
    }
    button("Check stream").click();
    decodedStats();
    assertVideoNotBlank();
    screenshot("android-lifecycle-stress");
    button("Close stream check").click();
    screenshot("android-studio-preview");
  }
}
