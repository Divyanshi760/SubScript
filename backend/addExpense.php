<?php
include __DIR__ . '/helpers.php';

$input = read_json();
$student = require_student_user();
$studentId = (int) $student['id'];
$amount = (float) ($input['amount'] ?? 0);
$category = trim((string) ($input['category'] ?? 'Other'));
$description = trim((string) ($input['description'] ?? ''));
$spentAt = trim((string) ($input['spent_at'] ?? date('Y-m-d')));

if ($amount <= 0) {
    respond(['ok' => false, 'error' => 'Expense amount must be greater than zero.'], 422);
}

$safeCategory = esc($category ?: 'Other');
$safeDescription = esc($description);
$safeSpentAt = esc($spentAt);

$conn->query("
    INSERT INTO expenses (user_id, category, description, amount, spent_at)
    VALUES ($studentId, '$safeCategory', '$safeDescription', $amount, '$safeSpentAt')
");

respond([
    'ok' => true,
    'data' => get_shared_data_for_user(find_user_by_id($studentId)),
]);
?>
