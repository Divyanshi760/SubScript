<?php
include __DIR__ . '/helpers.php';

$input = read_json();
$student = require_student_user();
$studentId = (int) $student['id'];
$subscriptionId = (int) ($input['id'] ?? 0);
$conn->query("DELETE FROM subscriptions WHERE id = $subscriptionId AND user_id = $studentId");

respond([
    'ok' => true,
    'data' => get_shared_data_for_user(find_user_by_id($studentId)),
]);
?>
