<?php
// Usage: php sanitize-discuss-html.php <cases.json>  -> prints JSON [{name, html, output}]
// Runs the real HTMLPurifier `default` profile (Purifier::clean($html)) as legacy ListPosts did.
putenv('APP_KEY=base64:'.base64_encode(str_repeat('a', 32)));
putenv('APP_ENV=testing');
putenv('DB_CONNECTION=sqlite');
putenv('DB_DATABASE=:memory:');
putenv('CACHE_STORE=array');
putenv('SESSION_DRIVER=array');
$root = '/Users/binota/Developer/alt-uu-legacy';
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$cases = json_decode(file_get_contents($argv[1]), true);
$out = [];
foreach ($cases as $c) {
    $out[] = ['name' => $c['name'], 'html' => $c['html'], 'output' => Mews\Purifier\Facades\Purifier::clean($c['html'])];
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
