import java.awt.Dimension;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.github.sarxos.webcam.WebcamDevice;

import org.openpnp.capture.CaptureDevice;
import org.openpnp.capture.CaptureFormat;
import org.openpnp.capture.CaptureStream;
import org.openpnp.capture.library.CapFormatInfo;

/**
 * Wraps one OpenPnP {@link CaptureDevice} as a sarxos {@link WebcamDevice}.
 * Resolutions are derived from the device's reported capture formats; opening the
 * device starts a stream at the format best matching the selected resolution.
 */
public class OpenPnpDevice implements WebcamDevice {

	private final CaptureDevice device;
	private Dimension resolution = new Dimension(640, 480); // app default (VGA)
	private CaptureStream stream = null;
	private BufferedImage lastImage = null;

	public OpenPnpDevice(CaptureDevice device) {
		this.device = device;
	}

	@Override
	public String getName() {
		return device.getName();
	}

	@Override
	public Dimension[] getResolutions() {
		// Preserve insertion order, drop duplicate w x h pairs.
		Set<Dimension> dims = new LinkedHashSet<Dimension>();
		for (CaptureFormat format : device.getFormats()) {
			CapFormatInfo info = format.getFormatInfo();
			dims.add(new Dimension(info.width, info.height));
		}
		return dims.toArray(new Dimension[0]);
	}

	@Override
	public Dimension getResolution() {
		return resolution;
	}

	@Override
	public void setResolution(Dimension size) {
		this.resolution = size;
	}

	@Override
	public void open() {
		if (stream != null) {
			return;
		}
		CaptureFormat format = bestFormatFor(resolution);
		if (format == null) {
			throw new RuntimeException("No capture format available for " + getName());
		}
		try {
			stream = device.openStream(format);
		} catch (Exception e) {
			throw new RuntimeException("Failed to open camera stream for " + getName(), e);
		}
	}

	@Override
	public BufferedImage getImage() {
		if (stream == null) {
			return lastImage;
		}
		try {
			BufferedImage img = stream.capture();
			if (img != null) {
				lastImage = img;
			}
		} catch (Exception e) {
			// Transient capture hiccup — hand back the previous frame rather than crash.
		}
		return lastImage;
	}

	@Override
	public void close() {
		if (stream != null) {
			stream.close();
			stream = null;
		}
	}

	@Override
	public void dispose() {
		close();
	}

	@Override
	public boolean isOpen() {
		return stream != null;
	}

	/** Pick the format matching the requested size with the highest fps, falling back
	 *  to the largest available format if there's no exact match. */
	private CaptureFormat bestFormatFor(Dimension size) {
		CaptureFormat exact = null;
		int exactFps = -1;
		CaptureFormat largest = null;
		long largestArea = -1;

		List<CaptureFormat> formats = new ArrayList<CaptureFormat>(device.getFormats());
		for (CaptureFormat format : formats) {
			CapFormatInfo info = format.getFormatInfo();
			long area = (long) info.width * info.height;
			if (area > largestArea) {
				largestArea = area;
				largest = format;
			}
			if (info.width == size.width && info.height == size.height && info.fps > exactFps) {
				exactFps = info.fps;
				exact = format;
			}
		}
		return exact != null ? exact : largest;
	}
}
