<?php
include __DIR__ . '/helpers.php';

$data = read_json();

$name = trim($data['student_name'] ?? '');
$email = trim($data['student_email'] ?? '');
$password = $data['student_password'] ?? '';

$parent = trim($data['parent_name'] ?? '');
$pemail = trim($data['parent_email'] ?? '');
$ppass = $data['parent_password'] ?? '';

if (!$name || !$email || !$password || !$parent || !$pemail || !$ppass) {
    respond(["ok"=>false,"error"=>"Missing fields"], 422);
}

// Check if student already exists
if (find_user_by_email($email)) {
    respond(["ok"=>false,"error"=>"Student already exists"], 409);
}

// Insert student
$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $conn->prepare(
    "INSERT INTO users (name,email,password,role,student_name,parent_name,preferences_json) VALUES (?,?,?,?,?,?,?)"
);
$role = "student";
$prefs = preferences_json();
$stmt->bind_param("sssssss", $name, $email, $hash, $role, $name, $parent, $prefs);
$stmt->execute();

$student_id = $stmt->insert_id;

// Insert parent
$hash2 = password_hash($ppass, PASSWORD_DEFAULT);

$stmt = $conn->prepare(
    "INSERT INTO users (name,email,password,role,linked_student_id,preferences_json) VALUES (?,?,?,?,?,?)"
);
$role2 = "parent";
$stmt->bind_param("ssssis", $parent, $pemail, $hash2, $role2, $student_id, $prefs);
$stmt->execute();

// Auto login student
$user = find_user_by_email($email);
login_user($user);

respond([
  "ok"=>true,
  "data"=> get_shared_data_for_user($user)
]);
?>