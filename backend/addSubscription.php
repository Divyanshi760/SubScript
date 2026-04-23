<?php
include __DIR__ . '/helpers.php';

$input = read_json();
$student = require_student_user();
$studentId = (int) $student['id'];
$serviceName = trim((string) ($input['service_name'] ?? ''));
$amount = (float) ($input['amount'] ?? 0);
$billingCycle = trim((string) ($input['billing_cycle'] ?? 'monthly'));
$renewalDate = trim((string) ($input['renewal_date'] ?? date('Y-m-d')));

if ($serviceName === '' || $amount <= 0) {
    respond(['ok' => false, 'error' => 'Subscription name and amount are required.'], 422);
}

$safeService = esc($serviceName);
$safeCycle = esc($billingCycle ?: 'monthly');
$safeRenewal = esc($renewalDate);

$conn->query("
    INSERT INTO subscriptions (user_id, service_name, amount, billing_cycle, renewal_date)
    VALUES ($studentId, '$safeService', $amount, '$safeCycle', '$safeRenewal')
");

respond([
    'ok' => true,
    'data' => get_shared_data_for_user(find_user_by_id($studentId)),
]);
?>
