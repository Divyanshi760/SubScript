<?php
include 'db.php';

$user_id = 1;
$name = "Netflix";
$cost = 499.00;
$billing_cycle = "monthly";
$next_billing_date = "2026-04-10";

$sql = "INSERT INTO subscriptions
(user_id, name, cost, billing_cycle, next_billing_date)
VALUES
('$user_id', '$name', '$cost', '$billing_cycle', '$next_billing_date')";

if ($conn->query($sql) === TRUE) {
    echo "Subscription added";
} else {
    echo "Error: " . $conn->error;
}
?>