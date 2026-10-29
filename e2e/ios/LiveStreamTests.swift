import XCTest

final class LiveStreamTests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "com.jtatar.fishjamcamera")

  func testBroadcastWithCameraControls() {
    continueAfterFailure = false
    app.launch()
    tap("Open studio")
    let live = app.buttons["Go live"]
    XCTAssertTrue(live.waitForExistence(timeout: 20), "Configure .env.local before building.")
    wait(for: NSPredicate(format: "enabled == true"), on: live)
    live.tap()
    wait(for: NSPredicate(format: "label == 'LIVE'"), on: app.staticTexts["stream-status"])
    let viewer = app.staticTexts.matching(NSPredicate(format: "label CONTAINS '1 participant connected'")).firstMatch
    XCTAssertTrue(viewer.waitForExistence(timeout: 60), "Join the same room on the second device.")

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
