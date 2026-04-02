<?php
include 'db.php';

$name = "Food";

$sql = "INSERT INTO categories (name)
VALUES ('$name')";

if ($conn->query($sql) === TRUE) {
    echo "Category added";
} else {
    echo "Error: " . $conn->error;
}
?>