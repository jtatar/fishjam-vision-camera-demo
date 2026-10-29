import AppKit

// Keep these slots in sync with compose-demo.mjs.
// Coordinates in this file use a top-left origin, like FFmpeg.
let width = 1920
let height = 1080
let outputPath = CommandLine.arguments.dropFirst().first ?? "docs/recording/scene.png"
let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
    isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)

func color(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255,
            green: CGFloat((hex >> 8) & 255) / 255,
            blue: CGFloat(hex & 255) / 255, alpha: 1)
}
func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect {
    NSRect(x: x, y: CGFloat(height) - y - h, width: w, height: h)
}
func label(_ text: String, x: CGFloat, y: CGFloat, w: CGFloat,
           size: CGFloat, weight: NSFont.Weight, tint: UInt32,
           alignment: NSTextAlignment = .left) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    (text as NSString).draw(in: rect(x, y, w, size * 1.5), withAttributes: [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color(tint), .paragraphStyle: paragraph
    ])
}

color(0x0B1219).setFill()
rect(0, 0, CGFloat(width), CGFloat(height)).fill()
label("Zoom. Light. Live.", x: 480, y: 36, w: 960,
      size: 46, weight: .semibold, tint: 0xF1F8F6)
label("VisionCamera controls streamed with Fishjam", x: 480, y: 96, w: 960,
      size: 24, weight: .regular, tint: 0x9BACB4)

for (x, title) in [(CGFloat(480), "iPhone · Publisher"), (CGFloat(1048), "Android · Viewer")] {
    label(title, x: x, y: 150, w: 392, size: 23,
          weight: .medium, tint: 0xA5F2D5, alignment: .center)
    let panel = NSBezierPath(roundedRect: rect(x - 10, 186, 412, 868), xRadius: 26, yRadius: 26)
    color(0x1C2B32).setFill()
    panel.fill()
    color(0x000000).setFill()
    rect(x, 196, 392, 848).fill()
}
label("Fishjam", x: 884, y: 580, w: 152, size: 20,
      weight: .medium, tint: 0x9BACB4, alignment: .center)
label("→", x: 884, y: 607, w: 152, size: 36,
      weight: .regular, tint: 0xA5F2D5, alignment: .center)
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: outputPath))
print(outputPath)
