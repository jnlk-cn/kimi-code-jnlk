import AppKit
import ApplicationServices
import Foundation
import ScreenCaptureKit

struct Request: Decodable {
    let id: String
    let method: String
    let x: Double?
    let y: Double?
    let text: String?
    let keyCode: Int?
    let deltaX: Int?
    let deltaY: Int?
}

struct Response: Encodable {
    let id: String
    let ok: Bool
    let result: EncodableValue?
    let error: String?
}

enum EncodableValue: Encodable {
    case string(String)
    case bool(Bool)
    case object([String: EncodableValue])
    case array([EncodableValue])

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        }
    }
}

let encoder = JSONEncoder()
let decoder = JSONDecoder()

func send(_ response: Response) {
    guard let data = try? encoder.encode(response),
          let line = String(data: data, encoding: .utf8) else { return }
    FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

func permissions(prompt: Bool) -> EncodableValue {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary
    let accessibility = AXIsProcessTrustedWithOptions(options)
    let screen = CGPreflightScreenCaptureAccess() || (prompt && CGRequestScreenCaptureAccess())
    return .object([
        "accessibility": .bool(accessibility),
        "screenRecording": .bool(screen),
    ])
}

func screenshot() throws -> EncodableValue {
    guard CGPreflightScreenCaptureAccess() else {
        throw NSError(domain: "GanymedeComputerUse", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Screen Recording permission is required."
        ])
    }
    let semaphore = DispatchSemaphore(value: 0)
    var output: EncodableValue?
    var captureError: Error?
    Task {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = content.displays.first else {
                throw NSError(domain: "GanymedeComputerUse", code: 2, userInfo: [
                    NSLocalizedDescriptionKey: "No display available for capture."
                ])
            }
            let filter = SCContentFilter(display: display, excludingWindows: [])
            let config = SCStreamConfiguration()
            config.width = Int(display.width)
            config.height = Int(display.height)
            config.pixelFormat = kCVPixelFormatType_32BGRA
            config.showsCursor = true
            let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
            let bitmap = NSBitmapImageRep(cgImage: image)
            guard let png = bitmap.representation(using: .png, properties: [:]) else {
                throw NSError(domain: "GanymedeComputerUse", code: 3, userInfo: [
                    NSLocalizedDescriptionKey: "Unable to encode the screenshot."
                ])
            }
            output = .string("data:image/png;base64," + png.base64EncodedString())
        } catch {
            captureError = error
        }
        semaphore.signal()
    }
    semaphore.wait()
    if let captureError {
        throw captureError
    }
    guard let output else {
        throw NSError(domain: "GanymedeComputerUse", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "Unable to capture the screen."
        ])
    }
    return output
}

func postMouse(_ type: CGEventType, x: Double, y: Double) {
    let point = CGPoint(x: x, y: y)
    CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left)?
        .post(tap: .cghidEventTap)
}

func click(x: Double, y: Double) {
    postMouse(.leftMouseDown, x: x, y: y)
    usleep(35_000)
    postMouse(.leftMouseUp, x: x, y: y)
}

func typeText(_ text: String) {
    let source = CGEventSource(stateID: .combinedSessionState)
    let utf16 = Array(text.utf16)
    utf16.withUnsafeBufferPointer { pointer in
        guard let event = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true) else { return }
        event.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: pointer.baseAddress)
        event.post(tap: .cghidEventTap)
    }
}

func pressKey(_ keyCode: Int) {
    let source = CGEventSource(stateID: .combinedSessionState)
    CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: true)?
        .post(tap: .cghidEventTap)
    CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: false)?
        .post(tap: .cghidEventTap)
}

func scroll(deltaX: Int, deltaY: Int) {
    CGEvent(
        scrollWheelEvent2Source: nil,
        units: .pixel,
        wheelCount: 2,
        wheel1: Int32(deltaY),
        wheel2: Int32(deltaX),
        wheel3: 0
    )?.post(tap: .cghidEventTap)
}

func windows() -> EncodableValue {
    let raw = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
    let rows = raw as? [[String: Any]] ?? []
    return .array(rows.prefix(100).map { row in
        let owner = row[kCGWindowOwnerName as String] as? String ?? ""
        let title = row[kCGWindowName as String] as? String ?? ""
        let number = row[kCGWindowNumber as String] as? NSNumber
        return .object([
            "owner": .string(owner),
            "title": .string(title),
            "windowId": .string(number?.stringValue ?? ""),
        ])
    })
}

func frontmostApplication() -> EncodableValue {
    guard let application = NSWorkspace.shared.frontmostApplication else {
        return .object(["name": .string(""), "bundleId": .string("")])
    }
    return .object([
        "name": .string(application.localizedName ?? ""),
        "bundleId": .string(application.bundleIdentifier ?? ""),
    ])
}

func handle(_ request: Request) throws -> EncodableValue {
    switch request.method {
    case "permissions":
        return permissions(prompt: true)
    case "screenshot":
        return try screenshot()
    case "windows":
        return windows()
    case "frontmost":
        return frontmostApplication()
    case "click":
        click(x: request.x ?? 0, y: request.y ?? 0)
        return .bool(true)
    case "type":
        typeText(request.text ?? "")
        return .bool(true)
    case "key":
        pressKey(request.keyCode ?? 36)
        return .bool(true)
    case "scroll":
        scroll(deltaX: request.deltaX ?? 0, deltaY: request.deltaY ?? 0)
        return .bool(true)
    default:
        throw NSError(domain: "GanymedeComputerUse", code: 4, userInfo: [
            NSLocalizedDescriptionKey: "Unknown method \(request.method)"
        ])
    }
}

while let line = readLine() {
    do {
        let request = try decoder.decode(Request.self, from: Data(line.utf8))
        let result = try handle(request)
        send(Response(id: request.id, ok: true, result: result, error: nil))
    } catch {
        let requestId = (try? decoder.decode(Request.self, from: Data(line.utf8)).id) ?? "unknown"
        send(Response(id: requestId, ok: false, result: nil, error: error.localizedDescription))
    }
}
