<?php 
session_start();
$var_value =  $_SESSION['sessionVar'];
exec("java -jar Parser.jar " . $var_value . "", $output);
echo '<script type="text/javascript">
	window.location = "Mapper.html"
	</script>';
?>
