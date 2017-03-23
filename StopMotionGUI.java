import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.io.File;
import java.io.IOException;

import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLayeredPane;
import javax.swing.JMenu;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.KeyStroke;

import com.github.sarxos.webcam.WebcamDiscoveryEvent;
import com.github.sarxos.webcam.WebcamDiscoveryListener;

import javax.swing.JPanel;

public class StopMotionGUI extends JFrame 
{
		private JMenuBar menu;
		private JMenu fileMenu, cameraMenu;
		private JMenuItem newItem, openItem, saveItem, closeItem, exportItem, cameraItem;
		private webcamPanel web; //where webcam feed and images you select are displayed
		private controlPanel control; //includes the buttons and picturesPanel
		private JPanel centerPanel;
		private JFileChooser export, save, open;
		
		public StopMotionGUI()
		{
			super("ClayMasterPro");
			setDefaultCloseOperation(EXIT_ON_CLOSE);
			setSize(400, 400);
			setLocation(100, 100);
			
			instantiateVariables();
			
			setSize(700, 750);
			setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
			setVisible(true);
			setResizable(true);
		}
		
		//instantiates GUI variables, and adds them to frame
		public void instantiateVariables()
		{
			createMenu();
			
			createCenterPanel();
			
			setActionListeners();
			
			pack();
			
		}
		
	/*the main panel will be the camera w/ buttons under it,
	 * the "Camera" and "Play" buttons, as well as buttons to set FPS,
	 * and a JLabel to look at the duration
	 */
	public void createCenterPanel()
	{		
		centerPanel = new JPanel();
		
		web = new webcamPanel();
		centerPanel.add(web);
		
		add(centerPanel, BorderLayout.CENTER);
		repaint();
		revalidate();
		pack();
		
		
	}
		
	/*instantiates the menu, sets mnemonics, and adds it to the frame*/
	public void createMenu()
	{
		menu = new JMenuBar();
		
		fileMenu = new JMenu("File");	
		fileMenu.setMnemonic('F');

		newItem = new JMenuItem("New");
		openItem = new JMenuItem("Open");
		saveItem = new JMenuItem("Save");
		closeItem = new JMenuItem("Close");
		exportItem = new JMenuItem("Export");
		
		newItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_N, ActionEvent.CTRL_MASK));
		openItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_O, ActionEvent.CTRL_MASK));
		saveItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_S, ActionEvent.CTRL_MASK));
		exportItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_E, ActionEvent.CTRL_MASK));
		
		newItem.setMnemonic('N');
		openItem.setMnemonic('O');
		saveItem.setMnemonic('S');
		closeItem.setMnemonic('C');
		exportItem.setMnemonic('E');
		
		fileMenu.add(newItem);
		fileMenu.add(openItem);
		fileMenu.add(saveItem);
		fileMenu.add(exportItem);
		fileMenu.add(closeItem);
		
		menu.add(fileMenu);
		
		cameraMenu = new JMenu("Camera");
		cameraMenu.setMnemonic('C');
		
		cameraItem = new JMenuItem("Select Camera");
		cameraItem.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_C, ActionEvent.CTRL_MASK));
		cameraItem.setMnemonic('S');
		
		cameraMenu.add(cameraItem);
		
		menu.add(cameraMenu);		
		
		setJMenuBar(menu);
	}
	
	public void setActionListeners()
	{
		cameraItem.addActionListener(new ActionListener()
				{
					public void actionPerformed(ActionEvent e)
					{
						web.chooseWebcam();
						repaint();
						revalidate();
					}
				});
		
		exportItem.addActionListener(new ActionListener()
				{
					public void actionPerformed(ActionEvent e)
					{
						exportDialog();
					}
				});
		
		saveItem.addActionListener(new ActionListener()
				{
					public void actionPerformed(ActionEvent e)
					{
						saveDialog();
					}
				});
		
		openItem.addActionListener(new ActionListener() 
				{
					public void actionPerformed(ActionEvent e)
					{
						openDialog();
					}
				});
	}
	
	/*set name of movie you'd like to export*/
	public void exportDialog()
	{
		export = new JFileChooser();
		export.setDialogTitle("Export As...");
		
		int returnVal = export.showSaveDialog(this);
		
		if(returnVal == JFileChooser.APPROVE_OPTION) //if user selects "save" basically
		{
			File toSave = new File(export.getSelectedFile().getName() + ".mp4"); //saving it as mp4
			//String filename = export.getSelectedFile().getName();
			createMovieFile(toSave);
		}
	}
	
	/*calls the controlPanel's createMovie method*/
	public void createMovieFile(File filename)
	{
		control = web.getControlPanel();
		control.createMovie(filename);
	}
	
	/*save your project - note, this is not the same as exporting your pictures into an mp4*/
	public void saveDialog()
	{
		save = new JFileChooser();
		save.setDialogTitle("Save as...");
		
		int returnVal = save.showSaveDialog(this);
		
		if(returnVal == JFileChooser.APPROVE_OPTION)
		{
			/*
			 * POSSIBLE NOT CORRECT PATH NAME
			 */
			//File directory = new File(save.getSelectedFile().getPath()); //I am creating a directory for all the image files
			//control.saveProject(directory); //call the method in controlPanel to save all pictures to this directory
		
				File toAdd = save.getSelectedFile();
				if(!toAdd.exists())
				{
					try 
					{
						toAdd.createNewFile();
					} 
						catch (IOException e) 
						{
							e.printStackTrace();
						}
				}
				control = web.getControlPanel();
				control.saveProject(toAdd);
		
		}
	}
	
	//save fps as well
	public void openDialog()
	{
		open = new JFileChooser();
		
		int returnVal = open.showOpenDialog(this);
		
		if(returnVal == JFileChooser.APPROVE_OPTION)
		{
			File toOpen = open.getSelectedFile();
			if(toOpen.exists())
			{
				control = web.getControlPanel();
				control.openProject(toOpen);
			}
		}
	}

	public static void main(String[] args) 
	{
		StopMotionGUI win = new StopMotionGUI();
		win.show();
	}

}
