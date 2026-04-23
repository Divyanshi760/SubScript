<?php
include __DIR__ . '/helpers.php';

$data = read_json();

$user = current_user();

if (!$user) {
    respond(['ok' => false, 'error' => 'Not logged in'], 401);
}

$userId = (int)$user['id'];

$allowance  = isset($data['monthly_allowance'])  ? (float)$data['monthly_allowance']  : (float)$user['monthly_allowance'];
$monthStart = isset($data['month_start_date'])   ? (int)$data['month_start_date']     : (int)$user['month_start_date'];

// Save preferences if provided
$existingPrefs = json_decode($user['preferences_json'] ?? '', true);
if (!is_array($existingPrefs)) $existingPrefs = default_preferences();

if (isset($data['preferences']) && is_array($data['preferences'])) {
    $existingPrefs = array_merge($existingPrefs, $data['preferences']);
}
$prefsJson = esc(json_encode($existingPrefs));

$stmt = $conn->prepare("UPDATE users SET monthly_allowance = ?, month_start_date = ?, preferences_json = ? WHERE id = ?");
$stmt->bind_param("disi", $allowance, $monthStart, $prefsJson, $userId);
$stmt->execute();

// Return full shared data so the JS store is not wiped
$updated = find_user_by_id($userId);

respond([
    'ok'   => true,
    'data' => get_shared_data_for_user($updated),
]);