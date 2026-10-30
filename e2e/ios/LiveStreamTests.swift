import XCTest

final class LiveStreamTests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "com.jtatar.fishjamcamera")

  func testBroadcastWithCameraControls() {
    continueAfterFailure = false
    app.launch()
    tap("Open studio")
    allowMediaIfNeeded()
    let live = app.buttons["Go live"]
    XCTAssertTrue(live.waitForExistence(timeout: 20), "Configure .env.local before building.")
    wait(for: NSPredicate(format: "enabled == true"), on: live)
    live.tap()
    allowMediaIfNeeded()
    wait(for: NSPredicate(format: "label == 'LIVE'"), on: app.staticTexts["stream-status"])
    // WHIP has no conference peer list. Verify reception on the viewer device.
    XCTAssertTrue(app.staticTexts["Broadcasting live · You control your mic"].exists)

    stage("cloud-1x-torch-off")
    tap("2×")
    XCTAssertEqual(app.descendants(matching: .any)["zoom-value"].firstMatch.value as? String, "2.0×")
    stage("cloud-2x-torch-off")
    app.otherElements["camera-preview"].pinch(withScale: 1.5, velocity: 1)
    XCTAssertNotEqual(app.descendants(matching: .any)["zoom-value"].firstMatch.value as? String, "2.0×")
    stage("cloud-pinch-zoom")
    tap("1×")
    tap("Lighting")
    for level in ["25%", "50%", "75%", "100%"] {
      let button = app.buttons["torch-level-\(level)"]
      button.tap()
      wait(for: NSPredicate(format: "selected == true"), on: button)
      stage("cloud-torch-\(level)")
    }
    tap("Torch on")
    XCTAssertTrue(app.buttons["Torch off"].waitForExistence(timeout: 10))
    tap("Lighting")
    stage("cloud-final-1x-torch-off")

    tap("Enable microphone")
    XCTAssertTrue(app.buttons["Mute microphone"].exists)
    stage("cloud-microphone-enabled")
    tap("Mute microphone")
    XCTAssertTrue(app.buttons["Enable microphone"].exists)

    tap("Switch camera")
    XCTAssertTrue(app.buttons["Torch unavailable"].waitForExistence(timeout: 10))
    wait(for: NSPredicate(format: "enabled == true"), on: app.buttons["1×"])
    stage("cloud-front-camera")
    tap("Switch camera")
    wait(for: NSPredicate(format: "enabled == true"), on: app.buttons["1×"])
    stage("cloud-rear-camera")

    tap("Enable microphone")
    XCUIDevice.shared.press(.home)
    RunLoop.current.run(until: Date().addingTimeInterval(2))
    app.activate()
    wait(for: NSPredicate(format: "enabled == true"), on: app.buttons["1×"])
    XCTAssertTrue(app.buttons["Enable microphone"].exists, "Returning from the background must leave audio muted")
    stage("cloud-resumed")

    tap("End live")
    tap("End stream")
    wait(for: NSPredicate(format: "label == 'PREVIEW'"), on: app.staticTexts["stream-status"])
  }

  private func allowMediaIfNeeded() {
    let alert = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.firstMatch
    if alert.waitForExistence(timeout: 3) {
      let allow = alert.buttons.matching(NSPredicate(format: "label IN {'Allow', 'OK'}")).firstMatch
      if allow.exists { allow.tap() }
    }
  }

  private func stage(_ name: String) {
    XCTAssertEqual(app.staticTexts["stream-status"].label, "LIVE")
    print("CLOUD_STAGE \(name) \(Date().timeIntervalSince1970)")
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    RunLoop.current.run(until: Date().addingTimeInterval(8))
    XCTAssertEqual(app.staticTexts["stream-status"].label, "LIVE")
  }

  private func tap(_ label: String) {
    let button = app.buttons[label]
    XCTAssertTrue(button.waitForExistence(timeout: 30))
    button.tap()
  }

  private func wait(for predicate: NSPredicate, on element: XCUIElement) {
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
    XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 30), .completed)
  }
}
