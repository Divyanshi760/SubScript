<?php
include __DIR__ . '/helpers.php';

$data = read_json();

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$role = ($data['role'] ?? 'student') === 'parent' ? 'parent' : 'student';

if (!$email || !$password) {
    respond(["ok"=>false,"error"=>"Missing credentials"], 422);
}

$user = find_user_by_email($email);

if (!$user || $user['role'] !== $role) {
    respond(["ok"=>false,"error"=>"Invalid email or role"], 401);
}

if (!password_verify($password, $user['password'])) {
    respond(["ok"=>false,"error"=>"Wrong password"], 401);
}

login_user($user);

respond([
    'ok' => true,
    'data' => get_shared_data_for_user($user),
]);
?>