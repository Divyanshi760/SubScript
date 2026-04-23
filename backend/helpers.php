<?php
include __DIR__ . '/db.php';

// Allow local frontend to call the API (works on any localhost port)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = (strpos($origin, 'http://localhost') === 0 || strpos($origin, 'http://127.0.0.1') === 0);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ($allowed ? $origin : 'http://localhost'));
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    // keep defaults but enforce SameSite for modern browsers
    $cookieParams = session_get_cookie_params();
    session_set_cookie_params([
        'lifetime' => $cookieParams['lifetime'],
        'path' => $cookieParams['path'],
        'domain' => $cookieParams['domain'],
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ---------- UTIL ----------
function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    if ($status !== 200) error_log(json_encode(['status'=>$status,'payload'=>$data]));
    exit;
}

function read_json() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function esc(string $value): string {
    global $conn;
    return $conn->real_escape_string($value);
}

// ---------- SCHEMA MANAGEMENT ----------
function column_exists(string $table, string $column): bool {
    global $conn;
    $table = esc($table);
    $column = esc($column);
    $result = $conn->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
    return $result && $result->num_rows > 0;
}

function ensure_schema(): void {
    global $conn;

    $conn->query("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'student',
        monthly_allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
        month_start_date INT NOT NULL DEFAULT 1,
        student_name VARCHAR(100) NULL,
        parent_name VARCHAR(100) NULL,
        linked_student_id INT NULL,
        preferences_json TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $conn->query("CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE
    )");

    $conn->query("CREATE TABLE IF NOT EXISTS subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        service_name VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
        renewal_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");

    $conn->query("CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        category_id INT NULL,
        category VARCHAR(50) NULL,
        description VARCHAR(150) NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        spent_at DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )");

    $conn->query("CREATE TABLE IF NOT EXISTS trials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        service_name VARCHAR(100) NOT NULL,
        trial_end_date DATE NOT NULL,
        expected_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");

    ensure_default_categories();
}

function ensure_default_categories(): void {
    global $conn;
    foreach (['Food', 'Transport', 'Fun', 'Other'] as $category) {
        $safeCategory = esc($category);
        $conn->query("INSERT IGNORE INTO categories (name) VALUES ('$safeCategory')");
    }
}

function default_preferences(): array {
    return [
        'renewAlert1d' => true,
        'trialAlert1d' => true,
        'burnWarning' => true,
    ];
}

function preferences_json(): string {
    return esc(json_encode(default_preferences()));
}

// ---------- USER HELPERS ----------
function find_first_student(): ?array {
    global $conn;
    $result = $conn->query("SELECT * FROM users WHERE role = 'student' ORDER BY id ASC LIMIT 1");
    if ($result && $result->num_rows > 0) return $result->fetch_assoc();
    return null;
}

function find_user_by_id(int $id): ?array {
    global $conn;
    $stmt = $conn->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    return ($res && $res->num_rows) ? $res->fetch_assoc() : null;
}

function find_user_by_email(string $email): ?array {
    global $conn;
    $val = strtolower(trim($email));
    $stmt = $conn->prepare("SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1");
    $stmt->bind_param('s', $val);
    $stmt->execute();
    $res = $stmt->get_result();
    return ($res && $res->num_rows) ? $res->fetch_assoc() : null;
}

function user_to_payload(array $viewer, array $student): array {
    $prefs = json_decode($student['preferences_json'] ?? '', true);
    if (!is_array($prefs)) $prefs = default_preferences();

    return [
        'id' => (string) $viewer['id'],
        'role' => $viewer['role'],
        'name' => $viewer['name'],
        'email' => $viewer['email'],
        'monthly_allowance' => (float) $student['monthly_allowance'],
        'month_start_date' => (int) $student['month_start_date'],
        'student_name' => $student['name'],
        'parent_name' => $student['parent_name'] ?: ($viewer['role'] === 'parent' ? $viewer['name'] : 'Parent'),
        'preferences' => $prefs,
    ];
}

function get_user_payload(array $user): array {
    // For compatibility with older endpoints
    return [
        'id' => (string)$user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'monthly_allowance' => (float)($user['monthly_allowance'] ?? 0),
        'month_start_date' => (int)($user['month_start_date'] ?? 1),
        'student_name' => $user['student_name'] ?? $user['name'],
        'parent_name' => $user['parent_name'] ?? 'Parent',
        'preferences' => json_decode($user['preferences_json'] ?? json_encode(default_preferences()), true),
    ];
}

function login_user(array $user): void {
    $_SESSION['user_id'] = (int)$user['id'];
}

function logout_user(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function current_user(): ?array {
    $id = (int)($_SESSION['user_id'] ?? 0);
    if ($id <= 0) return null;
    return find_user_by_id($id);
}

function require_auth_user(): array {
    $user = current_user();
    if (!$user) respond(['ok' => false, 'error' => 'Not authenticated.'], 401);
    return $user;
}

function require_student_user(): array {
    $user = require_auth_user();
    if (($user['role'] ?? '') !== 'student') respond(['ok' => false, 'error' => 'This action is only available for student accounts.'], 403);
    return $user;
}

function student_owner_for_user(array $viewer): array {
    if (($viewer['role'] ?? '') === 'parent') {
        $studentId = (int) ($viewer['linked_student_id'] ?? 0);
        $student = $studentId > 0 ? find_user_by_id($studentId) : null;
        if ($student && ($student['role'] ?? '') === 'student') return $student;
        respond(['ok' => false, 'error' => 'Linked student account not found.'], 500);
    }
    return $viewer;
}

function get_shared_data_for_user(array $viewer): array {
    global $conn;
    ensure_schema();

    $student = student_owner_for_user($viewer);
    $studentId = (int)$student['id'];

    $subscriptions = [];
    $res = $conn->query("SELECT id, service_name, amount, billing_cycle, renewal_date FROM subscriptions WHERE user_id = $studentId ORDER BY renewal_date ASC, id ASC");
    if ($res) while ($row = $res->fetch_assoc()) {
        $subscriptions[] = [
            'id' => (string)$row['id'],
            'service_name' => $row['service_name'],
            'amount' => (float)$row['amount'],
            'billing_cycle' => $row['billing_cycle'],
            'renewal_date' => $row['renewal_date'],
        ];
    }

    $expenses = [];
    $res = $conn->query("SELECT id, category, description, amount, spent_at FROM expenses WHERE user_id = $studentId ORDER BY spent_at DESC, id DESC");
    if ($res) while ($row = $res->fetch_assoc()) {
        $expenses[] = [
            'id' => (string)$row['id'],
            'category' => $row['category'] ?: 'Other',
            'description' => $row['description'],
            'amount' => (float)$row['amount'],
            'spent_at' => $row['spent_at'],
        ];
    }

    $trials = [];
    $res = $conn->query("SELECT id, service_name, trial_end_date, expected_price, status FROM trials WHERE user_id = $studentId ORDER BY trial_end_date ASC, id ASC");
    if ($res) while ($row = $res->fetch_assoc()) {
        $trials[] = [
            'id' => (string)$row['id'],
            'service_name' => $row['service_name'],
            'trial_end_date' => $row['trial_end_date'],
            'expected_price' => (float)$row['expected_price'],
            'status' => $row['status'],
        ];
    }

    return [
        'user' => user_to_payload($viewer, $student),
        'subscriptions' => $subscriptions,
        'expenses' => $expenses,
        'trials' => $trials,
    ];
}

?>