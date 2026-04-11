<?php

use AltUU\Domains\Discuss\Actions\ListNodes;
use App\Services\UUDiscussClient;
use App\Services\UUProxyClient;
use Mockery as MockeryManager;
use Tests\TestCase;

uses(TestCase::class);

it('maps node read state from discuss API response', function () {
    $proxyClient = MockeryManager::mock(UUProxyClient::class);
    $proxyClient->shouldReceive('request')
        ->once()
        ->with('get-board-node-list', 'GET', ['offset' => 0, 'size' => 50, 'bid' => 'B-1', 'keyword' => ''])
        ->andReturn([
            'payload' => [
                'data' => [
                    'list' => [
                        [
                            'node' => 'N-1',
                            'subject' => 'Test 1',
                            'read' => false,
                            'realname' => 'Tester',
                            'reply' => 3,
                            'push' => 10,
                        ],
                        [
                            'node' => 'N-2',
                            'subject' => 'Test 2',
                            'read' => true,
                            'realname' => 'Tester',
                            'reply' => 1,
                            'push' => 0,
                        ],
                    ],
                ],
            ],
        ]);

    $discussClient = new UUDiscussClient($proxyClient);
    $action = new ListNodes($discussClient);
    $result = $action('1001', 'B-1', '');

    $nodes = $result->nodes;
    expect($nodes)->toHaveCount(2);
    expect($nodes[0]->isRead)->toBeFalse();
    expect($nodes[1]->isRead)->toBeTrue();
});
