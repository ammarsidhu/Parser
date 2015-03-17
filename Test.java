import java.io.FileWriter;
import java.sql.*;
import java.io.PrintWriter;
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
	
	// JDBC driver name and database URL
	   static final String JDBC_DRIVER = "com.mysql.jdbc.Driver";  
	   static final String DB_URL = "jdbc:mysql://localhost/thesis";

	   //  Database credentials
	   static final String USER = "root";
	   static final String PASS = "Sr20de-t";

	/**
	 * @param args
	 */
	public static void main(String[] args) throws Exception{
		// TODO Auto-generated method stub
		String serializedClassifier = "classifiers/english.all.3class.distsim.crf.ser.gz";
	    PrintWriter writer = new PrintWriter("sampleoutput.txt", "UTF-8");
	    FileWriter file = new FileWriter("data1.json");

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
	      double latitude = 0;
	      double longitude = 0;
	      String sql;
	      ResultSet rs= null;
	      boolean foundRows = false; 
	      
	      JSONArray list = new JSONArray();
	      
	      for (List<CoreLabel> sentence : out) {
	        for (CoreLabel word : sentence) {
	        	if (word.get(CoreAnnotations.AnswerAnnotation.class).contentEquals("LOCATION") /*||word.get(CoreAnnotations.AnswerAnnotation.class).contentEquals("PERSON")*/){
	        		if (compound == null){
	        			compound = word.word();
	        			wordclass = word.get(CoreAnnotations.AnswerAnnotation.class);
	        		}
	        		else{
	        			compound = compound + " " + word.word();
	        		}
	        	}
	        	else{
	        		if(compound != null){
	        			String sentence1 = StringUtils.join(sentence, " ");
	        			//StringBuilder myName = new StringBuilder(sentence1);
	        			String sentence2 = sentence1.replaceAll("\\s+(?=\\p{Punct})", "");
			        	System.out.print('<' + wordclass + '>' + compound + "</" + wordclass + ">\n");
			        	System.out.print("sentence: " + sentence2 + "\n");
			        	writer.print('<' + wordclass + '>' + compound + "</" + wordclass + ">\n");
			        	writer.print("sentence: " + sentence2 + "\n");
	        			
			        	sql = "select name,latitude,longitude from thesis.geonames where name = '" + compound + "' limit 5";
			  	      	rs = stmt.executeQuery(sql);
			  	      	
				  	    if(rs.next()){
				  	    	 String name = rs.getString("name");
				  	    	foundRows = true;
				  	    	latitude  = rs.getDouble("latitude");
				  	        longitude = rs.getDouble("longitude");
				  	        System.out.print("Latitude: " + latitude + "\nLongitude: " + longitude + "\n\n");
				  	        writer.print("Latitude: " + latitude + "\nLongitude: " + longitude + "\n\n");
				  	    }
				  	    else{
				  	    	foundRows = false;
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
	      writer.close();
	      file.write(list.toJSONString());
	      file.flush();
	      file.close();
	      
	      rs.close();
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

	    } else {
	      String[] example = {"This is a test file, that has names such as Mark and Jon.?",
	                          "It also allows for place names like Chicago and Detroit to be parsed." };
	      
	      System.out.println("--- 1: Inline with class---\n");
	      for (String str : example) {
	        System.out.println(classifier.classifyToString(str));
	      }
	      System.out.println("--- 2: Inline with class, prints newlines and space---\n");

	      for (String str : example) {
	        System.out.print(classifier.classifyToString(str, "slashTags", false));
	      }
	      System.out.println("--- 3: Inline with xml tags for classes---\n");

	      for (String str : example) {
	        System.out.println(classifier.classifyWithInlineXML(str));
	      }
	      System.out.println("--- 4: weird xml with word number and class as entity---\n");

	      for (String str : example) {
	        System.out.println(classifier.classifyToString(str, "xml", true));
	      }
	      System.out.println("--- 5 List many attributes associated with word:---\n");

	      int i=0;
	      for (String str : example) {
	        for (List<CoreLabel> lcl : classifier.classify(str)) {
	          for (CoreLabel cl : lcl) {
	            System.out.print(i++ + ": ");
	            System.out.println(cl.toShorterString());
	          }
	        }
	      }
	    }
	  }

	

}
