<?php
include 'db.php';

$user_id = 1;
$category_id = 1;
$title = "Groceries";
$amount = 1200.50;
$date = "2026-03-30";

$sql = "INSERT INTO expenses
(user_id, category_id, title, amount, date)
VALUES
('$user_id', '$category_id', '$title', '$amount', '$date')";

if ($conn->query($sql) === TRUE) {
    echo "Expense added";
} else {
    echo "Error: " . $conn->error;
}
?>