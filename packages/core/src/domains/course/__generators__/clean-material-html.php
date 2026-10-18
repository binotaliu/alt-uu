<?php
// Usage: php clean-material-html.php <cases.json>  -> prints JSON [{name, input, baseUrl, output}]
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
$ref = new ReflectionClass(AltUU\Domains\Course\Actions\ParseMaterialContent::class);
$obj = $ref->newInstanceWithoutConstructor();
$m = $ref->getMethod('cleanHtml');
$out = [];
foreach ($cases as $c) {
    $html = $c['html'];
    $url = $c['url'] ?? 'https://uu.nou.edu.tw/base/1/content/2/page.html';
    $host = parse_url($url, PHP_URL_HOST);
    $out[] = ['name' => $c['name'], 'url' => $url, 'html' => $html, 'output' => $m->invoke($obj, $html, $url, $host)];
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
