import XCTest

final class LaunchSmokeTests: XCTestCase {
  func testSetupViewerAndCameraFallback() {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.jtatar.fishjamcamera")
    app.launch()
    XCTAssertTrue(app.buttons["Open studio"].waitForExistence(timeout: 30))

    let configured = app.staticTexts["Stream connection ready"].exists
    app.buttons["Join as a viewer"].tap()
    XCTAssertTrue(app.staticTexts["Watch the stream."].waitForExistence(timeout: 10))
    XCTAssertEqual(app.buttons["Watch livestream"].isEnabled, configured)
    XCTAssertFalse(app.otherElements["camera-preview"].exists)
    capture("ios-viewer")
    app.buttons["Back"].tap()

    app.buttons["Open studio"].tap()
    let allowCamera = app.buttons["Allow camera"]
    if allowCamera.waitForExistence(timeout: 5) {
      allowCamera.tap()
      let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
      let allow = springboard.alerts.buttons["Allow"]
      let ok = springboard.alerts.buttons["OK"]
      if allow.waitForExistence(timeout: 3) { allow.tap() }
      else if ok.exists { ok.tap() }
    }
    XCTAssertTrue(app.staticTexts["No back camera available"].waitForExistence(timeout: 10))
    capture("ios-no-camera")
    app.buttons["Back"].tap()

    app.buttons["Room settings"].tap()
    if configured { app.buttons["Show stream details"].tap() }
    app.scrollViews.firstMatch.swipeUp()
    XCTAssertTrue(app.textFields["Fishjam ID"].waitForExistence(timeout: 10))
    XCTAssertTrue(app.textFields["Sandbox API URL"].exists)
    capture("ios-settings")
  }

  private func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
