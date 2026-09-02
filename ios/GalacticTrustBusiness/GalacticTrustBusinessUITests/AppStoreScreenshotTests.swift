import XCTest

final class AppStoreScreenshotTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAppStoreScreenshot() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-AppleLanguages", "(en)",
            "-AppleLocale", "en_US"
        ]
        app.launch()

        let deadline = Date().addingTimeInterval(30)
        while app.state != .runningForeground && Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        }

        XCTAssertEqual(app.state, .runningForeground, "Galactic Trust Business did not reach the foreground")

        // Allow SwiftUI, charts, and demo financial data to settle before capture.
        RunLoop.current.run(until: Date().addingTimeInterval(5))

        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "Galactic-Trust-Business-App-Store"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
