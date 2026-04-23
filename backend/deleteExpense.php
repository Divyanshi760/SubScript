<?php
include __DIR__ . '/helpers.php';

$input = read_json();
$student = require_student_user();
$studentId = (int) $student['id'];
$expenseId = (int) ($input['id'] ?? 0);
$conn->query("DELETE FROM expenses WHERE id = $expenseId AND user_id = $studentId");

respond([
    'ok' => true,
    'data' => get_shared_data_for_user(find_user_by_id($studentId)),
]);
?>
