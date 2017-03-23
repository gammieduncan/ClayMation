import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.util.ArrayList;

import javax.swing.ImageIcon;
import javax.swing.JLabel;
import javax.swing.JLayeredPane;
import javax.swing.JPanel;

public class onionSkinManager {
	
	private JLayeredPane layers;
	private ArrayList<BufferedImage> onionedImgs;

	public onionSkinManager(JLayeredPane layers)
	{
		this.layers = layers;
		onionedImgs = new ArrayList<BufferedImage>();
	}

	/*returns a JLabel (of an image) set to a specified size*/
	public JLabel getSizedJLabel(BufferedImage img, int x, int y)
	{
		ImageIcon imgIcon = new ImageIcon(new ImageIcon(img).getImage().getScaledInstance(x, y, Image.SCALE_SMOOTH));
		JLabel showPic = new JLabel(imgIcon);
		
		showPic.setSize(layers.getSize());
		showPic.setBounds(layers.getX() + 18, layers.getY(), img.getWidth(), img.getHeight());
		
		return showPic;
	}
	
	/*does the actual work of making transparent layers and drawing them on the screen*/
	public void redoGraphics()
	{
		BufferedImage img2 = new BufferedImage(onionedImgs.get(0).getWidth(), onionedImgs.get(0).getHeight(), BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = img2.createGraphics();
		
		float opacity = 0.5f;
		
		//I start from the most recent picture being the most vivid, and gradually they get less vivid the farther back I took the picture
		for(int i = onionedImgs.size() - 1; i >= 0; i--) 
		{
			g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, opacity)); 
			
			g.drawImage(onionedImgs.get(i), 0, 0, null);
			
			opacity = opacity * .5f;
		}
		
		g.dispose();
			
		JLabel showPic = getSizedJLabel(img2, img2.getWidth(), img2.getHeight());
		showPic.setSize(layers.getSize());
		showPic.setBounds(layers.getX() + 18, layers.getY(), img2.getWidth(), img2.getHeight());
		showPic.setOpaque(false);
			
		layers.add(showPic, new Integer(1));
	}
	
	public void addPic(BufferedImage img)
	{
		if(onionedImgs.size() == 6) //I don't want any more than 6 "ghost" images at a time
		{
			onionedImgs.remove(0); //so I'll remove the earliest image I added to the arraylist
		}
		
		onionedImgs.add(img);
		
		/*
		 * I want to remove whatever image was in this layer before so I can add something new
		 */
		Component[] comps = layers.getComponentsInLayer(1); //this should only be of size 1 at any given time
		if(comps.length > 0) layers.remove(comps[0]); 
		
		redoGraphics();

	}
		
	/*if an image is removed, then of course we want to make sure it's not being displayed as a ghost image anymore
	 * also, I pass the currImages I've taken to determine if - even though the image I just deleted wasn't in onionedImgs,
	 * whether there are now fewer onionedImgs than there are remaining
	 */
	public void removePic(BufferedImage img, ArrayList<BufferedImage> currImages)
	{
		//we'll only remove it if it's in the arraylist
		if(onionedImgs.contains(img)) 
		{
			onionedImgs.remove(img);
			
			Component[] comps = layers.getComponentsInLayer(1); //this should only be of size 1 at any given time
			if(comps.length > 0) layers.remove(comps[0]); 
			
			if(onionedImgs.size() > 0 && currImages.size() > 0) //I'm only going to redraw the onionedImgs if there *are* imgs left to redraw
			{
				redoGraphics();				
			}
			//if there aren't any onionedImgs, but there are others, redraw a ghost image only of the most recent available picture taken
			else if(onionedImgs.size() == 0 && currImages.size() != 0) 
			{	
				onionedImgs.add(currImages.get(currImages.size() - 1));
				redoGraphics();
			}
			
		}

	}

}
