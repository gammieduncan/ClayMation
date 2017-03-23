import javax.swing.JPanel;

import java.awt.AlphaComposite;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.Toolkit;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.image.BufferedImage;
import java.awt.image.ColorModel;
import java.io.BufferedWriter;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.NotActiveException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.concurrent.TimeUnit;

import javax.imageio.ImageIO;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JLayeredPane;
import javax.swing.JTextField;

import com.xuggle.mediatool.ToolFactory;
import com.xuggle.mediatool.IMediaWriter;
import com.xuggle.xuggler.ICodec;
import com.xuggle.mediatool.IMediaViewer;
import com.xuggle.mediatool.IMediaReader;


public class controlPanel extends JPanel implements Serializable
{
	private webcamPanel web;
	private JButton setFPS, takePic, playMovie;
	private JLabel timeLength;
	private int fps = 24; //default is 24 frames per second
	private JTextField input;
	private picturesPanel pix;
	transient private ArrayList<BufferedImage> currImages;
	private IMediaWriter writer;
	private Dimension screenBounds;
	private int hours = 00, minutes = 00, seconds = 00;
	private JLayeredPane layers;
	private onionSkinManager onions;
	private File currentMovie = null; //this is the movie file for the current movie, only created when user hits play button
	
	public controlPanel(webcamPanel web, JLayeredPane layers)
	{
		this.web = web;
		this.layers = layers;
		
		instantiateVariables();
		format();
		
		addActionListeners();
		
		setVisible(true);
	}
	
	public void instantiateVariables()
	{
		setFPS = new JButton("Set frames/sec");
		input = new JTextField("24");
		takePic = new JButton("Camera");
		playMovie = new JButton("Play");
		timeLength = new JLabel(hours + " hours " + minutes + " minutes " + seconds + " seconds");	
		currImages = new ArrayList<BufferedImage>();
		onions = new onionSkinManager(layers);
		pix = new picturesPanel(currImages, layers, onions);
	}
	
	/*does layout business in here*/
	public void format()
	{
		/* there is a "main" JPanel which has a BorderLayout
		 * the "main" will have the button group in CENTER, and 
		 * the picturesPanel in SOUTH
		 */
		
		setLayout(new BorderLayout());
		
			JPanel buttonGroup = new JPanel();
			buttonGroup.setLayout(new BorderLayout());
		
			JPanel leftSide = new JPanel();
			leftSide.add(input);
			leftSide.add(setFPS);
		
			JPanel centerPart = new JPanel();
			centerPart.add(takePic);
			centerPart.add(playMovie);
		
			buttonGroup.add(leftSide, BorderLayout.WEST);
			buttonGroup.add(centerPart, BorderLayout.CENTER);
			buttonGroup.add(timeLength, BorderLayout.EAST);
			
		add(buttonGroup, BorderLayout.NORTH);
		add(pix, BorderLayout.CENTER);
		
		
		repaint();
		revalidate();

	}
	
	public void addActionListeners()
	{
		/*action to be taken when you click the camera button*/
		takePic.addActionListener(new ActionListener() 
		{
				public void actionPerformed(ActionEvent e) 
				{
					BufferedImage img = web.getPicture();
					currImages.add(img);
					pix.addPicture(img);
					updateClock();
					onions.addPic(img);	
				}
		});
		
		setFPS.addActionListener(new ActionListener()
		{
				public void actionPerformed(ActionEvent e)
				{
					fps = Integer.valueOf(input.getText()); //set the fps to whatever's in the input
					updateClock(); //have to update timelength of video since fps has changed
				}
		});
		
		playMovie.addActionListener(new ActionListener()
		{
				public void actionPerformed(ActionEvent e)
				{
					if(currentMovie != null && currentMovie.exists()) currentMovie.delete(); //if it already exists, make a new one
					currentMovie = new File("currMov.mp4"); //saving it as mp4 -> POSSIBLE that the name is a duplicate? what then?
					controlPanel.this.createMovie(currentMovie); //create the movie file of current images
					controlPanel.this.playIt();
				};
		});
						
		/*
		 * 
		 * playMovie - add later
		 */
	}
	
	/*plays the currentMovie onscreen*/
	public void playIt()
	{
		IMediaReader reader = ToolFactory.makeReader(currentMovie.getName());
		reader.addListener(ToolFactory.makeViewer(IMediaViewer.Mode.VIDEO_ONLY)); //plays video only
		
		reader.open();
		
		//reads media file, we watch
		while(reader.readPacket() == null)
		{
			//do {} while(false);
		} 
		
		reader.close();
	}
	
	/*updates the clock based on how many pictures have been taken & framerate*/
	public void updateClock()
	{
		if(((currImages.size())/fps) > 0) //if #pix/fps > 0
		{
			int secondsIs = currImages.size()/fps;
			
			if(secondsIs < 60) seconds = secondsIs;
			else //if the movie's longer than a minute
			{
				
				int temp = secondsIs;
				secondsIs = secondsIs%60;
				seconds = secondsIs;
				
				temp -= secondsIs;
				int minutesIs = temp/60;
				
				if(minutesIs < 60) minutes = minutesIs;
				else
				{
					int temp2 = minutesIs;
					minutesIs = minutesIs%60;
					minutes = minutesIs;
				}
			}
			
			timeLength.setText(hours + " hours " + minutes + " minutes " + seconds + " seconds");
			timeLength.repaint();
			timeLength.revalidate();
		}
	}
	
	/*creates and saves a movie file from the sequence of images*/
	public void createMovie(File filename)
	{
		//I add one extra second to runtime to account for possibility of a rounded-down result 
		int secondsToRun = (1/fps)*currImages.size() + 1;  
		writer = ToolFactory.makeWriter(filename.getAbsolutePath()); 
		screenBounds = web.getWebcamDimensions(); //gets the dimensions of webcam view
		
		writer.addVideoStream(0, 0, ICodec.ID.CODEC_ID_MPEG4, screenBounds.width, screenBounds.height);
		long startTime = System.nanoTime();
		
		for(int i = 0; i < currImages.size(); i++)
		{
			BufferedImage bgrScreen = convertToType(currImages.get(i), BufferedImage.TYPE_3BYTE_BGR);
			writer.encodeVideo(0, bgrScreen, System.nanoTime() - startTime, TimeUnit.NANOSECONDS);
			
			try
			{
				Thread.sleep((long) (1000/fps));
			} 
			catch(InterruptedException e)
			{
				//ignore this
			}
		
		} //end for loop
		
		writer.flush();
		writer.close(); //writer closes and successfully writes the file
	}
	
	/*simply converts a BufferedImage to a specified image type (if necessary)*/
	public BufferedImage convertToType(BufferedImage sourceImage, int targetType)
	{
		BufferedImage img;
		
		if(sourceImage.getType() == targetType) img = sourceImage; //i.e. source is fine
		else
		{
			img = new BufferedImage(sourceImage.getWidth(), sourceImage.getHeight(), targetType);
			img.getGraphics().drawImage(sourceImage, 0, 0, null);
		}
		
		return img;
	}
	
	/*a custom method meant for reading the bufferedimages from a file*/
	private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException
	{
		fps = in.readInt(); //first get fps
		input.setText(Integer.toString(fps));

		int imageCount = in.readInt(); //then get number of images

		currImages = new ArrayList<BufferedImage>(imageCount);
		for(int i = 0; i < imageCount; i++)
		{
			System.out.println("in loop");
				int size = in.readInt();
				
				byte [] buffer = new byte[size];
				in.readFully(buffer);
				
				currImages.add(ImageIO.read(new ByteArrayInputStream(buffer)));
		}
				
	}
	
	/*after reading the contents of a file, this will update the picture icons on the bottom panel and recreate the
	 * onion skinning effect
	 */
	private void updateOnOpen()
	{
		for(int i = 0; i < currImages.size(); i++)
		{
			pix.addPicture(currImages.get(i)); //add images to bottom panel
			onions.addPic(currImages.get(i)); //recreate onion skinning
		}
		
		updateClock(); //update clock count as well

	}
	
	/*another custom method meant for writing bufferedimages object to a file*/
	private void writeObject(ObjectOutputStream out) throws IOException
	{
		out.writeInt(fps); //take note of fps
		out.writeInt(currImages.size()); //take note of number of pictures as well
		
		for(BufferedImage eachImage : currImages)
		{
			ByteArrayOutputStream buffer = new ByteArrayOutputStream();
			ImageIO.write(eachImage, "jpg", buffer);
			
			out.writeInt(buffer.size());
			buffer.writeTo(out);
		}
	}
	
	/*save current project, saves all image files to a specified filename*/
	public void saveProject(File filename)
	{
		
		try 
		{
			FileOutputStream fos = new FileOutputStream(filename);
			ObjectOutputStream oos = new ObjectOutputStream(fos);
			writeObject(oos);
			oos.close();
			
		} catch (IOException e) 
			{
				e.printStackTrace();
			}
	
	}
	
	public void openProject(File filename)
	{
		FileInputStream fis; 
		ObjectInputStream ois;
		try {
			fis = new FileInputStream(filename);
			ois = new ObjectInputStream(fis);
			readObject(ois);

		} catch (IOException | ClassNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
		updateOnOpen();

	}
	
	/*PROBLEM:
	 * 1) Dimension of image size: What if webcam is changed midway and therefore
	 * dimensions of the pictures change?
	 * 
	 * 2) CHECK IF input is a integer or not - if it's not, simply do nothing to change it
	 * 
	 * 3) IDEALLY, I'd like the name of my currentMovie to be something unlikely to be replicated by anyone else - delete it after
	 * finished
	 */
}
