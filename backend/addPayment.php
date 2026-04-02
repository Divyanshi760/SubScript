<?php
include 'db.php';

$subscription_id = 1;
$amount = 499.00;
$payment_date = "2026-03-30";
$status = "paid";

$sql = "INSERT INTO payments
(subscription_id, amount, payment_date, status)
VALUES
('$subscription_id', '$amount', '$payment_date', '$status')";

if ($conn->query($sql) === TRUE) {
    echo "Payment recorded";
} else {
    echo "Error: " . $conn->error;
}
?>