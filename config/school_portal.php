<?php

return [
    'base_url' => env('SCHOOL_PORTAL_BASE_URL', 'https://nouapp.nou.edu.tw'),
    'reviewer_username' => env('SCHOOL_PORTAL_REVIEWER_USERNAME', env('HUNGU_REVIEWER_USERNAME', 'reviewer')),
    'reviewer_base_url' => env('SCHOOL_PORTAL_REVIEWER_BASE_URL', 'https://alt-uu-staging.binota.org'),
    'user_agent' => env('SCHOOL_PORTAL_USER_AGENT', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'),
];
