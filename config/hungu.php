<?php

return [
    'base_url' => env('HUNGU_BASE_URL', 'https://uu.nou.edu.tw'),
    'reviewer_username' => env('HUNGU_REVIEWER_USERNAME', 'reviewer'),
    'reviewer_base_url' => env('HUNGU_REVIEWER_BASE_URL', 'https://alt-uu-staging.binota.org/xmlapi/index.php'),
    'user_agent' => env('HUNGU_USER_AGENT', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'),
    'cookie_name' => 'hungu_session',
    'remember_credentials_key' => 'hungu_remembered_credentials',
    'app_boot_cookie_name' => env('HUNGU_APP_BOOT_COOKIE_NAME', 'hungu_app_boot'),
    'cookie_minutes' => 720,
    'check_session_on_boot' => env('HUNGU_CHECK_SESSION_ON_BOOT', true),
];
