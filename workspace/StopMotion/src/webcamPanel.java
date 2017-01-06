import com.github.sarxos.webcam.Webcam;
import com.github.sarxos.webcam.WebcamPanel;
import com.github.sarxos.webcam.WebcamResolution;
import com.github.sarxos.webcam.WebcamDiscoveryListener;
import com.github.sarxos.webcam.WebcamDiscoveryEvent;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Toolkit;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.image.BufferedImage;
import java.util.ArrayList;

import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JLayeredPane;
import javax.swing.JComboBox;

public class webcamPanel extends JPanel implements WebcamDiscoveryListener 
{ 
		
	private Webcam webcam = null;
	private WebcamPanel panel = null;
	private JComboBox camBox;
	private controlPanel control;
	private JLayeredPane layers;	
	private onionSkinManager onions;
	
	public webcamPanel()
	{		
		webcam = Webcam.getDefault(); //default camera upon instantiation
		webcam.addDiscoveryListener(this);
		setOpaque(false);
		
		setVisible(true);
		setLayout(new BorderLayout());
		
		chooseWebcam();
	}
	
	//sets the camera display on screen
	public void setDisplay()
	{		
		layers = new JLayeredPane();
		
		layers.setPreferredSize(WebcamResolution.VGA.getSize());
		layers.setVisible(true);
		layers.setLocation(18, 0);
		
		webcam.setViewSize(WebcamResolution.VGA.getSize());
		
		panel = new WebcamPanel(webcam);
		panel.setFPSDisplayed(false);
		panel.setDisplayDebugInfo(false);
		panel.setImageSizeDisplayed(true);
		panel.setMirrored(false);
		panel.setOpaque(true);
		panel.setBounds(layers.getX(), layers.getY(), WebcamResolution.VGA.getSize().width, WebcamResolution.VGA.getSize().height);
		
		/*
		 * I set depth=9 for WebcamPanel, so as to set depth = 10 on pictures
		 * you want to display, or to play a movie on the screen on TOP of the
		 * WebcamPanel
		 */
	
		layers.add(panel, new Integer(0));
		//layers.setLayer(panel, new Integer(1)); 
		add(layers);

		control = new controlPanel(this, layers);
		add(control, BorderLayout.SOUTH);
		
		repaint();
		revalidate();
		
		onions = new onionSkinManager(layers);
	}
	
	//opens a drop down menu from which to choose your camera
	public void chooseWebcam()
	{
		if(layers != null && layers.isShowing())
		{
			webcam.close();
			remove(layers);
			repaint();
			revalidate();
		}
		
		if(control != null && control.isShowing())
		{
			remove(control);
			repaint();
			revalidate();
		}
				
		String [] cams = new String[Webcam.getWebcams().size()]; //loads all available webcams into list
		for(int i = 0; i < Webcam.getWebcams().size(); i++)
			cams[i] = Webcam.getWebcams().get(i).getName();

		camBox = new JComboBox(cams);
		camBox.setSelectedIndex(0);
		
		add(camBox, BorderLayout.NORTH);
		camBox.setVisible(true);
		repaint();
		revalidate();
				
		camBox.addActionListener(new ActionListener() 
		{			
			public void actionPerformed(ActionEvent e) 
			{
				int num = camBox.getSelectedIndex();
				webcam = Webcam.getWebcams().get(num);
				remove(camBox);
				setDisplay();
				repaint();
				revalidate();
			}
		});
		

	}
		
	@Override
	public void webcamFound(WebcamDiscoveryEvent e)
	{
		/*if we are in the midst of choosing a camera - i.e. the camBox
		 * is still showing on the screen - and a new device is added,
		 * we would like the list of cameras to be updated, otherwise not
		 */
		if(camBox.isShowing()) 
		{
			webcam.close();
			remove(camBox);
			chooseWebcam();
		}
	}
	
	@Override
	public void webcamGone(WebcamDiscoveryEvent e)
	{
		//only do if the webcam that is gone is the one currently in use
		if(e.getWebcam().equals(webcam)) 
		{
			webcam.close();
			remove(camBox);
			remove(layers);
			//remove(control);
			repaint();
			revalidate();
			chooseWebcam();
		}
	}
	
	/*takes a picture and returns the BufferedImage, called from controlPanel*/
	public BufferedImage getPicture()
	{
		BufferedImage img = webcam.getImage();
		return img;
	}
	
	public controlPanel getControlPanel()
	{
		return control;
	}
	
	public Dimension getWebcamDimensions()
	{
		return webcam.getViewSize();
	}
}


/*NOTES:
 * 
 * (1)
 *  
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 *  */
