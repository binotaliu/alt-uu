<?php

use App\Jobs\DownloadAttachmentJob;
use Tests\TestCase;

uses(TestCase::class);

it('preserves unicode characters in resolved safe file names', function () {
    $job = new DownloadAttachmentJob(1);

    $reflection = new ReflectionClass($job);
    $method = $reflection->getMethod('resolveSafeFileName');
    $method->setAccessible(true);

    expect($method->invoke($job, 'https://example.com/learn/attachment/附件.pdf', '測試文件.pdf'))
        ->toBe('測試文件.pdf');

    expect($method->invoke($job, 'https://example.com/learn/attachment/附件.pdf', '測試 文件.pdf'))
        ->toBe('測試_文件.pdf');
});
