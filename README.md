# ClayMation

A desktop **stop-motion animation studio** in Java/Swing. Capture frames straight
from your webcam, line up each shot against translucent "ghosts" of the previous
frames (onion-skinning), then export the whole sequence to MP4.

Originally built in 2017; modernized in 2026 to build with Gradle, run on Apple
Silicon, and export video without the long-dead Xuggle library.

## Features

- **Live webcam capture** — pick any connected camera and shoot frames one click at a time.
- **Onion-skinning** — the last 6 frames are layered back over the live feed at fading
  opacity, so you can see how far your subject moved and keep motion smooth.
- **Thumbnail filmstrip** — every captured frame appears in a scrollable strip.
  Left-click to preview a frame on the canvas; right-click to delete it (it's removed
  from the onion-skin stack too).
- **Adjustable frame rate** — set frames-per-second; a live readout shows the resulting
  clip duration.
- **MP4 export** — encode the sequence to an `.mp4` (via pure-Java JCodec), or hit
  **Play** to render the current frames and open them in your system video player.

## Requirements

- A JDK (tested on JDK 24; builds target Java 17 bytecode).
- A webcam.
- macOS, Linux, or Windows. On Apple Silicon Macs, capture works out of the box —
  see [Webcam support](#webcam-support) below.

## Running

```bash
gradle run
```

That compiles and launches the app. To build a distributable instead:

```bash
gradle build          # jar + start scripts under build/
gradle installDist    # runnable tree under build/install/ClayMation/
```

## How to use it

1. Launch the app. Choose your camera from the dropdown at the top.
2. Click **Camera** to capture a frame. Move your subject a little, capture again —
   the faded onion-skin overlay helps you gauge each step.
3. Set your frame rate in the FPS box and click **Set frames/sec**.
4. Click **Play** to preview, or **File → Export** to save an MP4.

## Webcam support

The widely-used [webcam-capture](https://github.com/sarxos/webcam-capture) default
driver bundles an **x86_64-only** native library (`libbridj.dylib`), which throws
`UnsatisfiedLinkError` on Apple Silicon. ClayMation instead installs a small custom
driver ([`OpenPnpDriver`](src/main/java/OpenPnpDriver.java)) backed by
[OpenPnP's capture library](https://github.com/openpnp/openpnp-capture-java), which
ships true `darwin-aarch64` natives (plus x86-64, Linux, and Windows). The driver is
activated once at startup in `StopMotionGUI.main`.

## Project layout

```
src/main/java/
  StopMotionGUI.java     entry point, window, menus, file dialogs
  webcamPanel.java       camera selection + live feed + layered canvas
  controlPanel.java      capture/play/FPS controls + MP4 encoding
  picturesPanel.java     scrollable thumbnail filmstrip
  onionSkinManager.java  translucent ghost-frame compositing
samples/                 example clips exported from earlier versions
```

## Known limitations

- **Save Project** (`File → Save`) is stubbed — it creates a directory but does not
  yet write the frames out. Use **Export** to keep your work as an MP4.
- Capture resolution is fixed at VGA (640×480).
