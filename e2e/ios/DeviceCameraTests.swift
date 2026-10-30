import XCTest

final class DeviceCameraTests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "com.jtatar.fishjamcamera")

  func testCameraControlsAndEncodedStream() {
    continueAfterFailure = false
    app.launch()
    XCTAssertTrue(app.buttons["Open studio"].waitForExistence(timeout: 30))
    XCTAssertTrue(app.buttons["Join as a viewer"].isHittable)
    let footer = app.staticTexts["POWERED BY FISHJAM"].firstMatch
    XCTAssertTrue(footer.exists)
    XCTAssertTrue(app.frame.contains(footer.frame))
    let headerY = app.buttons["Room settings"].frame.minY
    app.scrollViews.firstMatch.swipeUp()
    XCTAssertEqual(app.buttons["Room settings"].frame.minY, headerY, accuracy: 1)
    capture("iphone-studio-home")
    tap("Open studio")
    allowCameraIfNeeded()
    waitForCamera()
    XCTAssertEqual(app.staticTexts["stream-status"].label, "PREVIEW")
    let configured = app.buttons["Go live"].exists
    XCTAssertTrue(app.buttons[configured ? "Go live" : "Set up stream"].exists)
    capture("iphone-studio-preview")

    tap(configured ? "Stream details" : "Set up stream")
    if configured {
      XCTAssertTrue(app.buttons["Show stream details"].exists)
      XCTAssertFalse(app.textFields["Fishjam ID"].exists)
      XCTAssertFalse(app.textFields["Stream title"].exists)
      tap("Show stream details")
      XCTAssertTrue(app.textFields["Fishjam ID"].waitForExistence(timeout: 5))
      XCTAssertTrue(app.textFields["Stream title"].exists)
      tap("Hide stream details")
      XCTAssertFalse(app.textFields["Fishjam ID"].exists)
      XCTAssertFalse(app.textFields["Stream title"].exists)
    } else {
      XCTAssertTrue(app.buttons["Hide stream details"].exists)
    }
    capture("iphone-studio-details")
    tap("Close Stream details")
    waitForCamera()

    tap("2×")
    XCTAssertEqual(app.descendants(matching: .any)["zoom-value"].firstMatch.value as? String, "2.0×")
    app.otherElements["camera-preview"].pinch(withScale: 1.5, velocity: 1)
    XCTAssertNotEqual(app.descendants(matching: .any)["zoom-value"].firstMatch.value as? String, "2.0×")
    tap("1×")

    tap("Lighting")
    tap("Torch off")
    XCTAssertTrue(app.buttons["Torch on"].waitForExistence(timeout: 10))
    for level in ["25%", "50%", "75%", "100%"] {
      setTorchLevel(level)
      capture("iphone-studio-light-\(level)")
    }
    dragLight(from: 1, to: 0.25)
    waitForTorchLevel("25%")
    dragLight(from: 0.25, to: 0.75)
    waitForTorchLevel("75%")
    capture("iphone-inline-light-slider")
    dragLight(from: 0.75, to: 0)
    XCTAssertTrue(app.buttons["Torch off"].waitForExistence(timeout: 10))
    setTorchLevel("50%")
    tap("Torch on")
    XCTAssertTrue(app.buttons["Torch off"].waitForExistence(timeout: 10))
    XCTAssertFalse(app.buttons["torch-level-50%"].isSelected)
    tap("Torch off")
    XCTAssertTrue(app.buttons["torch-level-50%"].isSelected)
    tapCameraBackground()
    XCTAssertFalse(app.otherElements["inline-light-control"].exists)
    XCTAssertTrue(app.buttons["Lighting"].isSelected)

    tap("Check stream")
    verifyReceiver("iphone-studio-receiver-1x")
    app.otherElements["camera-preview"].pinch(withScale: 1.5, velocity: 1)
    XCTAssertTrue(app.otherElements["loopback-video"].exists)
    tap("2×")
    verifyReceiver("iphone-studio-receiver-2x")
    XCTAssertEqual(app.descendants(matching: .any)["zoom-value"].firstMatch.value as? String, "2.0×",
                   "Receiver updates must preserve the live zoom label")
    setTorchLevel("25%")
    verifyReceiver("iphone-studio-receiver-light-25")
    XCTAssertEqual(app.descendants(matching: .any)["torch-value"].firstMatch.value as? String, "25%",
                   "Receiver updates must preserve the live brightness label")
    setTorchLevel("100%")
    verifyReceiver("iphone-studio-receiver-light-100")
    XCTAssertEqual(app.descendants(matching: .any)["zoom-value"].firstMatch.value as? String, "2.0×",
                   "Lighting and receiver updates must preserve the live zoom label")
    XCTAssertEqual(app.descendants(matching: .any)["torch-value"].firstMatch.value as? String, "100%",
                   "The brightness label must match the selected stop after streaming updates")
    tapCameraBackground()
    XCTAssertFalse(app.otherElements["loopback-video"].exists)
    XCTAssertFalse(app.otherElements["inline-light-control"].exists)
    XCTAssertTrue(app.buttons["Lighting"].isSelected)

    tap("Switch camera")
    XCTAssertTrue(app.buttons["Torch unavailable"].waitForExistence(timeout: 10))
    XCTAssertFalse(app.buttons["Torch unavailable"].isEnabled)
    waitForCamera()
    XCTAssertEqual(app.descendants(matching: .any)["zoom-value"].firstMatch.value as? String, "1.0×")
    capture("iphone-studio-front-camera")
    tap("Switch camera")
    waitForCamera()

    tap("Lighting")
    tap("Torch off")
    XCTAssertTrue(app.buttons["Torch on"].waitForExistence(timeout: 10))
    tap("Lighting")
    XCUIDevice.shared.press(.home)
    app.activate()
    waitForCamera()
    XCTAssertFalse(app.buttons["Lighting"].isSelected)
    tap("Check stream")
    verifyReceiver("iphone-studio-resumed")
    tap("Close stream check")
    tap("Back")
    tap("Join as a viewer")
    XCTAssertEqual(app.buttons["Watch livestream"].isEnabled, configured)
    XCTAssertFalse(app.otherElements["camera-preview"].exists)
    capture("iphone-studio-viewer")
    tap("Back")
    tap("Open studio")
    waitForCamera()
    tap("Check stream")
    verifyReceiver("iphone-studio-reopened")
    tap("Close stream check")
    capture("iphone-studio-final")
  }

  private func tapCameraBackground() {
    app.otherElements["camera-preview"]
      .coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.65)).tap()
  }

  private func allowCameraIfNeeded() {
    let button = app.buttons["Allow camera"]
    guard button.waitForExistence(timeout: 3) else { return }
    button.tap()
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let allow = springboard.alerts.buttons["Allow"]
    if allow.waitForExistence(timeout: 3) { allow.tap() }
    else if springboard.alerts.buttons["OK"].exists { springboard.alerts.buttons["OK"].tap() }
  }

  private func waitForCamera() {
    XCTAssertTrue(app.otherElements["camera-preview"].waitForExistence(timeout: 20))
    let preset = app.buttons["1×"]
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: preset)
    XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
  }

  private func dragLight(from: Double, to: Double) {
    let slider = app.descendants(matching: .any)["torch-slider"].firstMatch
    XCTAssertTrue(slider.waitForExistence(timeout: 5))
    XCTAssertGreaterThan(slider.frame.height, slider.frame.width * 2)
    let inset = 13.0 / slider.frame.height
    let start = slider.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: inset + (1 - from) * (1 - 2 * inset)))
    let end = slider.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: inset + (1 - to) * (1 - 2 * inset)))
    start.press(forDuration: 0.1, thenDragTo: end)
  }

  private func setTorchLevel(_ level: String) {
    let button = app.buttons["torch-level-\(level)"]
    if !button.exists { tap("Lighting") }
    reveal(button)
    button.tap()
    waitForTorchLevel(level)
  }

  private func waitForTorchLevel(_ level: String) {
    let selected = XCTNSPredicateExpectation(predicate: NSPredicate(format: "selected == true"), object: app.buttons["torch-level-\(level)"])
    XCTAssertEqual(XCTWaiter.wait(for: [selected], timeout: 10), .completed)
    XCTAssertTrue(app.buttons["Torch on"].exists)
    let value = app.descendants(matching: .any)["torch-value"].firstMatch
    let displayed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", level), object: value)
    XCTAssertEqual(XCTWaiter.wait(for: [displayed], timeout: 5), .completed,
                   "The brightness label must match the confirmed selected stop")
  }

  private func verifyReceiver(_ name: String) {
    let stats = app.staticTexts["loopback-stats"]
    XCTAssertTrue(stats.waitForExistence(timeout: 20))
    let decoding = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      stats.label.contains("connected") && self.frameCount(stats.label) > 30
    }, object: nil)
    XCTAssertEqual(XCTWaiter.wait(for: [decoding], timeout: 30), .completed)
    let frames = frameCount(stats.label)
    let progressing = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.frameCount(stats.label) > frames + 20
    }, object: nil)
    XCTAssertEqual(XCTWaiter.wait(for: [progressing], timeout: 10), .completed)
    capture(name)
    let videoVisible = app.otherElements["loopback-video"].waitForExistence(timeout: 5)
    if !videoVisible {
      let hierarchy = XCTAttachment(string: app.debugDescription)
      hierarchy.name = "\(name)-hierarchy"
      hierarchy.lifetime = .keepAlways
      add(hierarchy)
    }
    XCTAssertTrue(videoVisible)
  }

  private func frameCount(_ label: String) -> Int {
    let parts = label.components(separatedBy: " · ")
    guard parts.count > 1 else { return 0 }
    return Int(parts[1].components(separatedBy: " ")[0]) ?? 0
  }

  private func reveal(_ element: XCUIElement) {
    XCTAssertTrue(element.waitForExistence(timeout: 10))
    for _ in 0..<5 {
      if element.isHittable { return }
      app.scrollViews.firstMatch.swipeUp()
    }
  }

  private func tap(_ label: String) {
    let button = app.buttons[label]
    reveal(button)
    button.tap()
  }

  private func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
