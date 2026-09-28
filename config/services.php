<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'nou_tools' => [
        'base_url' => env('NOU_TOOLS_BASE_URL', 'https://nou-tools.binota.org'),
        'timeout' => (int) env('NOU_TOOLS_TIMEOUT', 10),
    ],

    'iap' => [
        'base_url' => env('IAP_BASE_URL', 'https://alt-uu.binota.org'),
        'timeout' => (int) env('IAP_TIMEOUT', 10),
        // Google Play product IDs must start with a digit or lowercase letter, so Android
        // can't reuse the App Store Connect IDs (already live, uppercase) as-is.
        'product_ids' => [
            'ios' => ['ALT_UU_PLUS.MONTHLY', 'ALT_UU_PLUS.YEARLY'],
            'android' => ['alt_uu_plus.monthly', 'alt_uu_plus.yearly'],
        ],
    ],

    'statics' => [
        'base_url' => env('ALT_UU_STATICS_BASE_URL', 'https://alt-uu-statics.wcsvdzeimhwq.workers.dev'),
    ],

    'google' => [
        'base_url' => env('GOOGLE_CONNECTIVITY_URL', 'https://www.google.com/generate_204'),
    ],

    'cloudflare' => [
        'base_url' => env('CLOUDFLARE_CONNECTIVITY_URL', 'https://1.1.1.1/cdn-cgi/trace'),
    ],

    'apple' => [
        'base_url' => env('APPLE_CONNECTIVITY_URL', 'https://captive.apple.com/hotspot-detect.html'),
    ],

];
