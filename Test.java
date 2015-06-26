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
//	   static final String JDBC_DRIVER = "com.mysql.jdbc.Driver";  
//	   static final String DB_URL = "jdbc:mysql://localhost/geonarrative"; //change
//
//	   //  Database credentials
//	   static final String USER = "vialab";
//	   static final String PASS = "Oshawa;Collins!"; ////change
	
	// JDBC driver name and database URL
	   static final String JDBC_DRIVER = "com.mysql.jdbc.Driver";  
	   static final String DB_URL = "jdbc:mysql://localhost/thesis"; //change

	   //  Database credentials
	   static final String USER = "test";
	   static final String PASS = "test"; ////change

	/**
	 * @param args
	 */
	public static void main(String[] args) throws Exception{
		// TODO Auto-generated method stub
		String serializedClassifier = "classifiers/english.all.3class.distsim.crf.ser.gz";
	    FileWriter file = new FileWriter("data1.json");
	    PrintWriter writer = new PrintWriter("output.txt");
	    PrintWriter testwriter = new PrintWriter("testwriter.txt");

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
	      String compound = null;
	      String wordclass = null;
	      String wordclass2 = null;
	      double latitude = 0;
	      double longitude = 0;
	      String sql;
	      ResultSet rs= null;
	      boolean foundRows = false;
	      boolean lastApostrohy = true;
	      
	      JSONArray list = new JSONArray();
	      int counter = 0;
	      String test;
      	
	      
	      for (List<CoreLabel> sentence : out) {
	        for (CoreLabel word : sentence) {
	        	test = "(word: " + word + " class: " + word.get(CoreAnnotations.AnswerAnnotation.class) + ")"; 
	        	testwriter.println(test);
	        	wordclass = word.get(CoreAnnotations.AnswerAnnotation.class);
	        	if (wordclass.equals("LOCATION") || word.word().equals(",") || wordclass.equals("PERSON")){
	        		if (compound == null && (wordclass.equals("LOCATION"))){
	        			compound = word.word();
	        			wordclass2 = word.get(CoreAnnotations.AnswerAnnotation.class);
	        			lastApostrohy = false;
	        		}
	        		else if(compound != null && word.word().equals(",")){
	        				compound = compound + word.word();
	        				lastApostrohy = true;
	        		}
	        		else if(compound != null && wordclass.equals("LOCATION")){
	        				compound = compound + " " + word.word();
	        				lastApostrohy = false;
	        				wordclass2 = word.get(CoreAnnotations.AnswerAnnotation.class);
	        		}
	        	}
	        	else{
	        		if(compound != null){
	        			if (lastApostrohy)
	        				compound = compound.substring(0, compound.length()-1);
	        			
	        			String sentence1 = StringUtils.join(sentence, " ");
	        			String sentence2 = sentence1.replaceAll("\\s+(?=\\p{Punct})", "");
			        	System.out.print('<' + wordclass2 + '>' + compound + "</" + wordclass2 + ">\n");
			        	System.out.print("sentence: " + sentence2 + "\n");
			        	System.out.print("ID# : " + counter + "\n\n");
			        	
			        	writer.println('<' + wordclass2 + '>' + compound + "</" + wordclass2 + ">\n");
			        	writer.println("sentence: " + sentence2 + "\n");
			        	writer.println("ID# : " + counter + "\n\n");
			        	counter++;
			        	
			        	
			        	//sql = "select name,asciiname,latitude,longitude from thesis.geonames where name = '" + compound + "' or asciiname = '" + compound + "' limit 1";
			        	sql = "select name,asciiname,latitude,longitude,population from thesis.geonames where name = '" + compound + "' or asciiname = '" + compound + "'order by population desc limit 1;";
			        	
			        	//vialab
			        	//sql = "select name,asciiname,latitude,longitude,population from geonarrative.geonames where name = '" + compound + "' or asciiname = '" + compound + "'order by population desc limit 1;";
			  	      	//order by population desc limit 1; //for highest population
			        	rs = stmt.executeQuery(sql);
			  	      	
				  	    if(rs.next()){
				  	    	String name;
				  	    	if (!rs.getString("name").isEmpty())
				  	    		name = rs.getString("name");
				  	    	else
				  	    		name = rs.getString("asciiname");
				  	    	foundRows = true;
				  	    	latitude  = rs.getDouble("latitude");
				  	        longitude = rs.getDouble("longitude");
				  	        System.out.print("Latitude: " + latitude + "\nLongitude: " + longitude + "\n\n");
				  	        writer.println("Latitude: " + latitude + "\nLongitude: " + longitude + "\n\n");
				  	    }
				  	    else{
				  	    	foundRows = false;
				  	    	latitude = 0;
				  	    	longitude = 0;
				  	    }
				  	    
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
	      file.write(list.toJSONString());
	      file.flush();
	      file.close();
	      writer.close();
	      testwriter.close();
	      rs.close();
	      paragraphWriter(args);
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
		int counter = 0;
		PrintWriter filewriter = new PrintWriter("HTMLparagraph.txt");
		String replacedTxt = readFile(args[0]).replaceAll("\n\n", "<paragraph>");
		replacedTxt = "<paragraph>" + replacedTxt;
		replacedTxt = replacedTxt.replaceAll("\n", " ");
		while (replacedTxt.contains("<paragraph>")){
			if (counter == 0){
				replacedTxt = replacedTxt.replaceFirst("<paragraph>", "<p id=paragraph" + counter + ">");
			}
			else {
				replacedTxt = replacedTxt.replaceFirst("<paragraph>", "</p>\n<p id=paragraph" + counter + ">");
			}
			counter++;
		}
		if(replacedTxt.substring(replacedTxt.length()- 3, replacedTxt.length()- 1) != "<p>")
			replacedTxt = replacedTxt + "<p>";
		
		
		filewriter.print(replacedTxt);
		filewriter.close();
	}
	
	public static String readFile(String path) throws IOException {
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
