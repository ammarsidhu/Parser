import java.io.FileWriter;
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

	/**
	 * @param args
	 */
	public static void main(String[] args) throws Exception{
		// TODO Auto-generated method stub
		String serializedClassifier = "classifiers/english.all.3class.distsim.crf.ser.gz";
	    PrintWriter writer = new PrintWriter("sampleoutput.txt", "UTF-8");
	    FileWriter file = new FileWriter("data1.json");

	    AbstractSequenceClassifier<CoreLabel> classifier = CRFClassifier.getClassifier(serializedClassifier);

	   
	    if (args.length > 0) {
	      String fileContents = IOUtils.slurpFile(args[0]);
	      List<List<CoreLabel>> out = classifier.classify(fileContents);
	      
	      out = classifier.classifyFile(args[0]);
	      String compound = null;
	      String wordclass = null;
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
			        	System.out.print('<' + wordclass + '>' + compound + "</" + wordclass + ">\n");
			        	System.out.print("sentence: " + StringUtils.join(sentence, " ") + "\n\n");
			        	writer.print('<' + wordclass + '>' + compound + "</" + wordclass + ">\n");
			        	writer.print("sentence: " + StringUtils.join(sentence, " ") + "\n\n");
	        			
	        			JSONObject obj = new JSONObject();
	        			obj.put("city", compound);
	        			obj.put("text", StringUtils.join(sentence, " "));
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
