import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.sql.*;
import java.io.PrintWriter;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.Charset;
import java.util.List;

import edu.stanford.nlp.ie.AbstractSequenceClassifier;
import edu.stanford.nlp.ie.crf.CRFClassifier;
import edu.stanford.nlp.io.IOUtils;
import edu.stanford.nlp.ling.CoreAnnotations;
import edu.stanford.nlp.ling.CoreLabel;
import edu.stanford.nlp.util.StringUtils;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;


public class Test {
	
		//JDBC driver name and database URL
	   static final String JDBC_DRIVER = "com.mysql.jdbc.Driver";  
	   static final String DB_URL = "jdbc:mysql://localhost/geonarrative"; //change
//
//	   //  Database credentials
	   static final String USER = "vialab";
	   static final String PASS = "Oshawa;Collins!"; ////change
	
//	// JDBC driver name and database URL
//	   static final String JDBC_DRIVER = "com.mysql.jdbc.Driver";  
//	   static final String DB_URL = "jdbc:mysql://localhost/thesis"; //change
//
//	   //  Database credentials
//	   static final String USER = "test";
//	   static final String PASS = "test"; ////change

	/**
	 * @param args
	 */
	public static void main(String[] args) throws Exception{
		// TODO Auto-generated method stub
		String serializedClassifier = "classifiers/english.all.3class.distsim.crf.ser.gz";
	    FileWriter file = new FileWriter("AllCityData.json"); //used to pass information to the javascript code
	    PrintWriter writer = new PrintWriter("output.txt"); //gives an output of the possible placenames and any coordinates found in the geonames database
	    PrintWriter testwriter = new PrintWriter("testwriter.txt"); //gives an output of each word classification

	    AbstractSequenceClassifier<CoreLabel> classifier = CRFClassifier.getClassifier(serializedClassifier);
	    
	    Connection conn = null;
	    Statement stmt = null;
	    
	    
	    
	    try{
	        // Register JDBC driver
	        Class.forName("com.mysql.jdbc.Driver");
	    }catch(Exception e){
	        //Handle errors for Class.forName
	        e.printStackTrace();
	     }
	    
	  //STEP 3: Open a connection
	      conn = DriverManager.getConnection(DB_URL,USER,PASS);

	      //STEP 4: Execute a query
	      stmt = conn.createStatement();
	      
	   
	    if (args.length > 0) {
	      String fileContents = IOUtils.slurpFile(args[0]);
	      List<List<CoreLabel>> out = classifier.classify(fileContents);
	      
	      out = classifier.classifyFile(args[0]);
	      String compound = null; // compund is used for placenames that have more than one word (e.g. New York City)
	      String wordclass = null; //the class of word, either person, place, organization, or nothing
	      String wordclass2 = null;
	      double latitude = 0;
	      double longitude = 0;
	      String sql; // sql string
	      ResultSet rs= null; // the result of a sql call
	      boolean foundRows = false; // if a city is found in the geonames database
	      boolean lastApostrohy = true; // used to remove any trailing apostrophies
	      
	      JSONArray list = new JSONArray();
	      int counter = 0; // counter for the number of possible places
	      String test;
      	
	      
	      for (List<CoreLabel> sentence : out) { //for each sentence in the inputted novel text
	        for (CoreLabel word : sentence) { // for each word in a sentence
	        	test = "(word: " + word + " class: " + word.get(CoreAnnotations.AnswerAnnotation.class) + ")"; 
	        	testwriter.println(test);
	        	wordclass = word.get(CoreAnnotations.AnswerAnnotation.class); // find the classification of the word
	        	if (wordclass.equals("LOCATION") || word.word().equals(",") ){ // if the word is a location or an apostrophy
	        		if (compound == null && (wordclass.equals("LOCATION"))){ // add the word to compound
	        			compound = word.word();
	        			wordclass2 = word.get(CoreAnnotations.AnswerAnnotation.class);
	        			lastApostrohy = false;
	        		}
	        		else if(compound != null && word.word().equals(",")){ // used for place names with a comma (e.g. Toronto, Ontario)
	        				compound = compound + word.word();
	        				lastApostrohy = true;
	        		}
	        		else if(compound != null && wordclass.equals("LOCATION")){
	        				compound = compound + " " + word.word();
	        				lastApostrohy = false;
	        				wordclass2 = word.get(CoreAnnotations.AnswerAnnotation.class);
	        		}
	        	}
	        	else{ // otherwise the placename is finished
	        		if(compound != null){ // check if there is anything in compund
	        			if (lastApostrohy) // if the last word was an apostrophy, strip it from the place name
	        				compound = compound.substring(0, compound.length()-1);
	        			
	        			String sentence1 = StringUtils.join(sentence, " "); // a sentence is an array of words, combine them into a sentence using spaces between them
	        			String sentence2 = sentence1.replaceAll("\\s+(?=\\p{Punct})", ""); //remove the spaces between punctuation marks (e.g. he went home . --> he went home.)
			        	System.out.print('<' + wordclass2 + '>' + compound + "</" + wordclass2 + ">\n"); //used for trouble shooting
			        	System.out.print("sentence: " + sentence2 + "\n");
			        	System.out.print("ID# : " + counter + "\n\n");
			        	
			        	writer.println('<' + wordclass2 + '>' + compound + "</" + wordclass2 + ">\n"); //keep a log of all the placenames
			        	writer.println("sentence: " + sentence2 + "\n");
			        	writer.println("ID# : " + counter + "\n\n");
			        	counter++;
			        	
			        	// use this sql call with the placename to see if there are any matches in the geonames database
			        	//ammar computer
			        	//sql = "select name,asciiname,latitude,longitude,population from thesis.geonames where name = '" + compound + "' or asciiname = '" + compound + "'order by population desc limit 1;";
			        	
			        	//vialab
			        	sql = "select name,asciiname,latitude,longitude,population from geonarrative.geonames where name = '" + compound + "' or asciiname = '" + compound + "'order by population desc limit 1;";
			  	      	
			        	rs = stmt.executeQuery(sql);
			  	      	
				  	    if(rs.next()){ // if there was a match in the database
				  	    	String name;
				  	    	if (!rs.getString("name").isEmpty()) //check for both official names and other spellings
				  	    		name = rs.getString("name");
				  	    	else
				  	    		name = rs.getString("asciiname");
				  	    	foundRows = true;
				  	    	latitude  = rs.getDouble("latitude");
				  	        longitude = rs.getDouble("longitude");
				  	        System.out.print("Latitude: " + latitude + "\nLongitude: " + longitude + "\n\n");
				  	        writer.println("Latitude: " + latitude + "\nLongitude: " + longitude + "\n\n");
				  	    }
				  	    else{ // no match
				  	    	foundRows = false;
				  	    	latitude = 0;
				  	    	longitude = 0;
				  	    }
				  	    
				  	    // put all the information into a json file
	        			JSONObject obj = new JSONObject();
	        			obj.put("city", compound);
	        			obj.put("text", sentence2);
	        			obj.put("geocode", foundRows);
	        			obj.put("latitude", latitude);
	        			obj.put("longitude", longitude);
	        			
	        			list.add(obj);
	        			compound = null;
			  	      	wordclass = null;
	        		}
	        	}
	        }
	      }
	      file.write(list.toJSONString()); // write the json file for the javascript to use
	      file.flush();
	      file.close();
	      writer.close();
	      testwriter.close();
	      rs.close();
	      paragraphWriter(args); // split the novel text into paragraph html dom elements
	      try{
	          if(stmt!=null)
	             stmt.close();
	       }catch(SQLException se2){
	       }// nothing we can do
	       try{
	          if(conn!=null)
	             conn.close();
	       }catch(SQLException se){
	          se.printStackTrace();
	       }

	    } 
	  }
	
	public static void paragraphWriter(String[] args) throws IOException {
		// TODO Auto-generated method stub
		// This function is used to clean up the novel text and split it into html paragraph dom elements
		int counter = 0; // used for the html id name
		PrintWriter filewriter = new PrintWriter("HTMLparagraph.txt");
		String replacedTxt = readFile(args[0]).replaceAll("\n\n", "<paragraph>"); // replace all double new lines
		replacedTxt = "<paragraph>" + replacedTxt; // insert a paragraph placeholder at the beginning of the text
		replacedTxt = replacedTxt.replaceAll("\n", " "); // replace all newlines with a space
		while (replacedTxt.contains("<paragraph>")){ // change <paragraph> to html tags
			if (counter == 0){// start the html tag code for the begginning
				replacedTxt = replacedTxt.replaceFirst("<paragraph>", "<p id=paragraph" + counter + ">");
			}
			else {// start and end the html tags
				replacedTxt = replacedTxt.replaceFirst("<paragraph>", "</p>\n<p id=paragraph" + counter + ">");
			}
			counter++;
		}
		if(replacedTxt.substring(replacedTxt.length()- 3, replacedTxt.length()- 1) != "</p>") //close the html tag if its missing
			replacedTxt = replacedTxt + "</p>";
		
		
		filewriter.print(replacedTxt); //write the file
		filewriter.close();
	}
	
	public static String readFile(String path) throws IOException { // read a file
		  FileInputStream stream = new FileInputStream(new File(path));
		  try {
		    FileChannel fc = stream.getChannel();
		    MappedByteBuffer bb = fc.map(FileChannel.MapMode.READ_ONLY, 0, fc.size());
		    /* Instead of using default, pass in a decoder. */
		    return Charset.defaultCharset().decode(bb).toString();
		  }
		  finally {
		    stream.close();
		  }
	}

	

}
