<?php 
session_start();
$var_value =  $_SESSION['sessionVar'];
if (!copy($var_value, "sample.txt")) {
    echo "failed to copy $file...\n";
}
exec("java -jar Parser.jar " . $var_value . "", $output);
echo '<script type="text/javascript">
	window.location = "test5.html"
	</script>';
?>
