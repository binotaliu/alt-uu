<?php
// Regenerate: php generate-uu-crypto-vectors.php /path/to/legacy-checkout > uu-crypto.vectors.json
require ($argv[1] ?? "../alt-uu-legacy")."/vendor/autoload.php";
use App\Services\UUCrypto;
$crypto = new UUCrypto();
$raw = new ReflectionMethod(UUCrypto::class, 'encryptRaw');
$raw->setAccessible(true);
$inputs = ['s1234567', 'P@ssw0rd!', '', '   ', "\t\n", 'a', '0123456789abcdef', '  reviewer  ', '密碼測試🙂', "中文帳號\0x", str_repeat('長', 40).'tail', "\x00", 'abc' . chr(11)];
$codes = [8, 9, 13, 20, 26, 27];
$out = [];
foreach ($inputs as $input) {
    foreach ($codes as $code) {
        $first = $raw->invoke($crypto, $input, $code);
        $merged = $first.'@!!@'.$code;
        $out[] = [
            'inputBase64' => base64_encode($input),
            'code' => $code,
            'raw' => $first,
            'immediate' => $raw->invoke($crypto, $merged, 27),
        ];
    }
}
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
