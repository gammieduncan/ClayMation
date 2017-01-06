import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Image;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.image.BufferedImage;
import java.util.ArrayList;

import javax.swing.ImageIcon;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;
import javax.swing.border.LineBorder;
import javax.swing.JLayeredPane;

public class picturesPanel extends JScrollPane
{
	private JPanel panel; //this is the panel in the scrollPane where all pics are displayed
	private ArrayList<BufferedImage> currImages;
	private JLayeredPane layers;
	private onionSkinManager onions; //included in case a picture that is in onions gets deleted and thus the ghost imgs have to be redrawn
	
	public picturesPanel(ArrayList<BufferedImage> curr, JLayeredPane layers, onionSkinManager onions)
	{
		panel = new JPanel();	
		currImages = curr;
		this.layers = layers;
		this.onions = onions;
		setViewportView(panel);
		setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
		setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_NEVER);
		setViewportBorder(new LineBorder(Color.GREEN));
		setPreferredSize(new Dimension(680, 150));
		setVisible(true);
	}
	
	/*returns a JLabel (of an image) set to a specified size*/
	public JLabel getSizedJLabel(BufferedImage img, int x, int y)
	{
		ImageIcon imgIcon = new ImageIcon(new ImageIcon(img).getImage().getScaledInstance(x, y, Image.SCALE_SMOOTH));
		return new JLabel(imgIcon);
	}
	
	public void addPicture(BufferedImage img)
	{
		//first we resizee the image so it is a smaller, square size
		JLabel picLabel = getSizedJLabel(img, 130, 130);
		panel.add(picLabel);
		panel.repaint();
		panel.revalidate();
		repaint();
		revalidate();
		
		setPicListener(picLabel, img);
		
	}
	
	/*actually adds it to layer*/
	public void addToLayer(JLabel showPic, int layerNum)
	{		
		/*there will be one layer for all pics to display*/
		layers.add(showPic, new Integer(layerNum));
		layers.repaint();
		layers.revalidate();
		System.out.println(showPic.isShowing());
	}
	
	/*determines whether to add img to layer, and adds it as well*/
	public void whichLayer(JLabel showPic)
	{
		/*meaning the highest layer is current webcam image*/
		if(layers.highestLayer() < 10) addToLayer(showPic, 10);
		else if(layers.highestLayer() == 10) //if a pic is already showing
		{
			Component[] comps = layers.getComponentsInLayer(10); //this should only be of size 1 at any given time
			layers.remove(comps[0]);
		}
	}

	/*attaches a mouseListener to the thumbnail-sized pic JLabel to allow for deleting/displaying of that pic*/
	public void setPicListener(JLabel picLabel, BufferedImage img)
	{
		picLabel.addMouseListener(new MouseListener()
		{
			public void mouseClicked(MouseEvent e)
			{
				if(SwingUtilities.isLeftMouseButton(e))
				{
					JLabel showPic = getSizedJLabel(img, img.getWidth(), img.getHeight());
					showPic.setSize(layers.getSize());
					showPic.setBounds(layers.getX() + 18, layers.getY(), img.getWidth(), img.getHeight());
					whichLayer(showPic); //determine which layer to add it to, from there add it to layer
				}
				else if(SwingUtilities.isRightMouseButton(e))
				{
					currImages.remove(img);
					onions.removePic(img, currImages); //remove it from the onion skin drawings
					panel.remove(picLabel);
					panel.repaint();
					panel.revalidate();
				}
			}

			/*the following are unused functions*/
			public void mouseEntered(MouseEvent arg0) {			}
			public void mouseExited(MouseEvent arg0) {			}
			public void mousePressed(MouseEvent arg0) {			}
			public void mouseReleased(MouseEvent arg0) {		}
		});
	}
	
}


/* 
 * 1) I would much rather be able to click on another thumbnail-sized image from picturesPanel,
 * and - if there's another picture already showing, and the one I clicked on is NOT the one showing -
 * then for me to replace the one showing with the one I just clicked on, rather than return it to the
 * live webcam feed and force me to click on the image again for it appear
 * BUT: for some reason, it says that that JLabel isn't showing. Even though SOMETHING's in that layer.  Huh.
 * 
 * 2) If IMAGE is being displayed, and it's deleted, then remove it from being displayed
 * 
 * 3) if an image is being displayed, I should disable the camera function
 */
 