<?php
$json = file_get_contents('php://input');

$dataObject = json_decode($json);
$dataArray = json_decode($json, true);
 
 //for ammars computer
// $servername = "localhost";
// $username = "test";
// $password = "test";
// $dbname = "thesis";

//for the vialab server
$servername = "localhost";
$username = "vialab";
$password = "Oshawa;Collins!";
$dbname = "geonarrative";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
} 



$values = array();
foreach( $dataArray as $row ) {
    $values[] =  "('" . $row['name'] . "','" . $row['latitude'] . "','" . $row['longitude']. "','" . $row['country'] . "','" . $row['elevation'] . "')";
}

if( !empty($values) ) {
    $query = "INSERT INTO geonames (name,latitude,longitude, `country code`, elevation) VALUES " 
             . implode(',',$values);
	if ($conn->query($query) === TRUE) {
	    echo "New records created successfully";
	} else {
	    //echo "Error: " . $query . "<br>" . $conn->error;
	    header('application/json');
    	echo json_encode($conn->error);
	}        
}

$conn->close();

?>