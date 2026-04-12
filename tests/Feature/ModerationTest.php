<?php

use App\Models\BlockedContent;
use App\Models\BlockedUser;
use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Http;

// ──────────────────────────────────────────────────────
// SyncBlockedContents
// ──────────────────────────────────────────────────────

it('syncs blocked contents from remote API', function () {
    Http::fake([
        'alt-uu.binota.org/api/moderation/blocked-contents*' => Http::response([
            [
                'b' => hash('sha256', 'board-1'),
                'n' => hash('sha256', 'node-1'),
                'r' => 'c',
                't' => 1775980234,
            ],
            [
                'b' => hash('sha256', 'board-1'),
                'n' => hash('sha256', 'node-2'),
                'r' => 's',
                't' => 1775980300,
            ],
        ]),
    ]);

    $this->postJson('/api/moderation/sync')->assertSuccessful();

    expect(BlockedContent::count())->toBe(2);

    $first = BlockedContent::where('node_hash', hash('sha256', 'node-1'))->first();
    expect($first)->not->toBeNull();
    expect($first->board_hash)->toBe(hash('sha256', 'board-1'));
    expect($first->reason)->toBe('c');

    $synced = KeyValueStore::where('key', 'moderation:blocked_contents_synced_at')->first();
    expect($synced)->not->toBeNull();
});

it('skips sync gracefully when API returns error', function () {
    Http::fake([
        'alt-uu.binota.org/api/moderation/blocked-contents*' => Http::response(null, 500),
    ]);

    $this->postJson('/api/moderation/sync')->assertSuccessful();

    expect(BlockedContent::count())->toBe(0);
});

it('sends since parameter on subsequent syncs', function () {
    KeyValueStore::create([
        'key' => 'moderation:blocked_contents_synced_at',
        'value' => '2026-01-01T00:00:00+00:00',
    ]);

    Http::fake([
        'alt-uu.binota.org/api/moderation/blocked-contents*' => Http::response([]),
    ]);

    $this->postJson('/api/moderation/sync')->assertSuccessful();

    Http::assertSent(function ($request) {
        return str_contains($request->url(), 'since=');
    });
});

it('upserts existing blocked content on re-sync', function () {
    BlockedContent::create([
        'board_hash' => hash('sha256', 'board-1'),
        'node_hash' => hash('sha256', 'node-1'),
        'reason' => 's',
        'blocked_at' => now(),
    ]);

    Http::fake([
        'alt-uu.binota.org/api/moderation/blocked-contents*' => Http::response([
            [
                'b' => hash('sha256', 'board-1'),
                'n' => hash('sha256', 'node-1'),
                'r' => 'c',
                't' => 1775980234,
            ],
        ]),
    ]);

    $this->postJson('/api/moderation/sync')->assertSuccessful();

    expect(BlockedContent::count())->toBe(1);
    expect(BlockedContent::first()->reason)->toBe('c');
});

it('deletes blocked content when remote reason is null', function () {
    BlockedContent::create([
        'board_hash' => hash('sha256', 'board-1'),
        'node_hash' => hash('sha256', 'node-1'),
        'reason' => 's',
        'blocked_at' => now(),
    ]);

    Http::fake([
        'alt-uu.binota.org/api/moderation/blocked-contents*' => Http::response([
            [
                'b' => hash('sha256', 'board-1'),
                'n' => hash('sha256', 'node-1'),
                'r' => null,
                't' => 1775980234,
            ],
        ]),
    ]);

    $this->postJson('/api/moderation/sync')->assertSuccessful();

    expect(BlockedContent::count())->toBe(0);
});

// ──────────────────────────────────────────────────────
// ReportContent
// ──────────────────────────────────────────────────────

it('reports content to remote API', function () {
    Http::fake([
        'alt-uu.binota.org/api/moderation/reports' => Http::response(['ok' => true]),
    ]);

    $this->postJson('/api/moderation/report', [
        'board_id' => 'board-1',
        'node_id' => 'node-1',
        'content' => 'offensive content',
        'type' => 's',
    ])->assertSuccessful();

    Http::assertSent(function ($request) {
        return $request->url() === 'https://alt-uu.binota.org/api/moderation/reports'
            && $request['board_hash'] === hash('sha256', 'board-1')
            && $request['node_hash'] === hash('sha256', 'node-1')
            && $request['content_hash'] === hash('sha256', 'offensive content')
            && $request['type'] === 's'
            && ! empty($request['client_hash'])
            && ! empty($request['site_hash']);
    });
});

it('validates report type is valid', function () {
    $this->postJson('/api/moderation/report', [
        'board_id' => 'board-1',
        'node_id' => 'node-1',
        'content' => 'test',
        'type' => 'x',
    ])->assertUnprocessable();
});

it('validates required report fields', function () {
    $this->postJson('/api/moderation/report', [])
        ->assertUnprocessable();
});

it('generates consistent client hash', function () {
    Http::fake([
        'alt-uu.binota.org/api/moderation/reports' => Http::response(['ok' => true]),
    ]);

    $this->postJson('/api/moderation/report', [
        'board_id' => 'b1',
        'node_id' => 'n1',
        'content' => 'c1',
        'type' => 'o',
    ])->assertSuccessful();

    $this->postJson('/api/moderation/report', [
        'board_id' => 'b2',
        'node_id' => 'n2',
        'content' => 'c2',
        'type' => 'i',
    ])->assertSuccessful();

    $requests = Http::recorded();
    expect($requests)->toHaveCount(2);
    expect($requests[0][0]['client_hash'])->toBe($requests[1][0]['client_hash']);
});

// ──────────────────────────────────────────────────────
// BlockUser / UnblockUser
// ──────────────────────────────────────────────────────

it('blocks a user', function () {
    $this->postJson('/api/moderation/block-user', [
        'poster' => 'user123',
        'realname' => '王小明',
    ])->assertSuccessful();

    expect(BlockedUser::count())->toBe(1);
    expect(BlockedUser::first()->poster)->toBe('user123');
    expect(BlockedUser::first()->realname)->toBe('王小明');
});

it('does not duplicate blocked user', function () {
    BlockedUser::create(['poster' => 'user123', 'realname' => '王小明']);

    $this->postJson('/api/moderation/block-user', [
        'poster' => 'user123',
        'realname' => '王小明',
    ])->assertSuccessful();

    expect(BlockedUser::count())->toBe(1);
});

it('unblocks a user', function () {
    BlockedUser::create(['poster' => 'user123', 'realname' => '王小明']);

    $this->deleteJson('/api/moderation/block-user', [
        'poster' => 'user123',
        'realname' => '王小明',
    ])->assertSuccessful();

    expect(BlockedUser::count())->toBe(0);
});

// ──────────────────────────────────────────────────────
// GetBlockedUsers
// ──────────────────────────────────────────────────────

it('lists blocked users', function () {
    BlockedUser::create(['poster' => 'user1', 'realname' => '張三']);
    BlockedUser::create(['poster' => 'user2', 'realname' => '李四']);

    $response = $this->getJson('/api/moderation/blocked-users')
        ->assertSuccessful();

    $data = $response->json();
    expect($data)->toHaveCount(2);
    expect(collect($data)->pluck('poster')->all())->toContain('user1', 'user2');
});

it('returns empty when no users blocked', function () {
    $response = $this->getJson('/api/moderation/blocked-users')
        ->assertSuccessful();

    expect($response->json())->toBeEmpty();
});
