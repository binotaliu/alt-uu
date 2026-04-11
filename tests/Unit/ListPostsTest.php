<?php

use AltUU\Domains\Discuss\Actions\ListPosts;
use App\Services\UUDiscussClient;
use App\Services\UUProxyClient;
use Mockery as MockeryManager;
use Tests\TestCase;

uses(TestCase::class);

it('maps attachments from discuss API response into the view model', function () {
    $proxyClient = MockeryManager::mock(UUProxyClient::class);
    $proxyClient->shouldReceive('request')
        ->once()
        ->with('get-board-reply-list', 'GET', ['offset' => 0, 'size' => 50, 'bid' => 'B-1', 'nid' => 'N-9'])
        ->andReturn([
            'payload' => [
                'data' => [
                    'list' => [
                        [
                            'floor' => 1,
                            'subject' => 'Hello',
                            'content' => '<p>Body</p>',
                            'attachment' => [
                                ['filename' => 'file1.pdf', 'href' => 'https://example.com/file1.pdf'],
                                ['name' => 'file2.docx', 'url' => 'https://example.com/file2.docx'],
                            ],
                        ],
                    ],
                ],
            ],
        ]);

    $discussClient = new UUDiscussClient($proxyClient);
    $action = new ListPosts($discussClient);

    $result = $action('1001', 'B-1', 'N-9');

    $posts = $result->posts;
    expect($posts)->toHaveCount(1);

    $post = $posts[0];
    expect($post->attachments)->toHaveCount(2);
    expect($post->attachments[0]->filename)->toBe('file1.pdf');
    expect($post->attachments[0]->href)->toBe('https://example.com/file1.pdf');
    expect($post->attachments[1]->filename)->toBe('file2.docx');
    expect($post->attachments[1]->href)->toBe('https://example.com/file2.docx');
});
