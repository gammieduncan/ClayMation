import java.util.ArrayList;
import java.util.List;

import com.github.sarxos.webcam.WebcamDevice;
import com.github.sarxos.webcam.WebcamDriver;

import org.openpnp.capture.CaptureDevice;
import org.openpnp.capture.OpenPnpCapture;

/**
 * A sarxos {@link WebcamDriver} backed by OpenPnP's capture library.
 *
 * The webcam-capture default driver bundles an x86_64-only {@code libbridj.dylib},
 * which throws UnsatisfiedLinkError on Apple Silicon. OpenPnP's capture lib ships
 * native binaries for darwin-aarch64 (and x86-64, linux, win32), so this driver
 * gives us real webcam access across platforms — including arm64 Macs.
 *
 * Activate it once, before any webcam call:
 *     Webcam.setDriver(new OpenPnpDriver());
 */
public class OpenPnpDriver implements WebcamDriver {

	private final OpenPnpCapture capture = new OpenPnpCapture();

	@Override
	public List<WebcamDevice> getDevices() {
		List<WebcamDevice> devices = new ArrayList<WebcamDevice>();
		for (CaptureDevice device : capture.getDevices()) {
			devices.add(new OpenPnpDevice(device));
		}
		return devices;
	}

	@Override
	public boolean isThreadSafe() {
		return false;
	}
}
