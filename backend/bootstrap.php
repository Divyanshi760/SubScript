<?php
include __DIR__ . '/helpers.php';

respond([
    'ok' => true,
    'data' => get_shared_data_for_user(require_auth_user()),
]);
?>
