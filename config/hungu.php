<?php

return [
    'base_url' => env('HUNGU_BASE_URL', 'https://uu.nou.edu.tw'),
    'reviewer_username' => env('HUNGU_REVIEWER_USERNAME', 'reviewer'),
    'reviewer_base_url' => env('HUNGU_REVIEWER_BASE_URL', 'https://alt-uu-staging.binota.org/xmlapi/index.php'),
    'user_agent' => env('HUNGU_USER_AGENT', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'),
    'cookie_name' => 'hungu_session',
    'cookie_minutes' => 720,
];
