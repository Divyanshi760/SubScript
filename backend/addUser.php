<?php
include 'db.php';

$name = "Tiyasa";
$email = "tiyasap@example.com";
$password = password_hash("1234", PASSWORD_DEFAULT);

$sql = "INSERT INTO users (name, email, password)
VALUES ('$name', '$email', '$password')";

if ($conn->query($sql) === TRUE) {
    echo "User added successfully";
} else {
    echo "Error: " . $conn->error;
}
?>