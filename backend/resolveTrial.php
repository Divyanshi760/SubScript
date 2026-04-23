<?php
include __DIR__ . '/helpers.php';

$input = read_json();
$student = require_student_user();
$studentId = (int) $student['id'];
$trialId = (int) ($input['id'] ?? 0);
$action = ($input['action'] ?? '') === 'keep' ? 'kept' : 'cancelled';
$safeAction = esc($action);

$conn->query("UPDATE trials SET status = '$safeAction' WHERE id = $trialId AND user_id = $studentId");

respond([
    'ok' => true,
    'data' => get_shared_data_for_user(find_user_by_id($studentId)),
]);
?>
