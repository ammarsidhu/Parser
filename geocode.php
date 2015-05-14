<?php
$params = "address=" . urlencode($_GET{'addr'});
$url = 'http://maps.googleapis.com/maps/api/geocode/json?sensor=false&' . $params;
$json = file_get_contents($url);
$status = json_decode($json)->status;

// check for over_query_limit status
while ($status=="OVER_QUERY_LIMIT") {
    sleep(0.2); // seconds
    $json = file_get_contents($url);
    $status = json_decode($json)->status;
}

header('application/json');
echo $json;
?>
