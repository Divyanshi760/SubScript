<?php
$host = "localhost";
$user = "root";
$password = "";
$db = "SubScript";

$conn = new mysqli($host, $user, $password, $db);

if ($conn->connect_error) {
    die("DB failed");
}
?>