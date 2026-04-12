<?php

declare(strict_types=1);

namespace AltUU\Domains\Moderation\Actions;

use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

final readonly class ReportContent
{
    private const string SITE_HASH = '1b04f287644330e02cab8e616c5a657a24e0a759081235d2739612924eb73680';

    private const string API_URL = 'https://alt-uu.binota.org/api/moderation/reports';

    private const string FINGERPRINT_KEY = 'moderation:client_fingerprint';

    public function __invoke(
        string $boardId,
        string $nodeId,
        string $content,
        string $type,
    ): bool {
        $response = Http::asJson()
            ->post(self::API_URL, [
                'client_hash' => $this->getClientHash(),
                'site_hash' => self::SITE_HASH,
                'board_hash' => hash('sha256', $boardId),
                'node_hash' => hash('sha256', $nodeId),
                'content_hash' => hash('sha256', $content),
                'type' => $type,
                'content' => $content,
            ])->throw();

        return $response->successful();
    }

    private function getClientHash(): string
    {
        $record = KeyValueStore::firstOrCreate(
            ['key' => self::FINGERPRINT_KEY],
            ['value' => Str::uuid()->toString()],
        );

        return hash('sha256', $record->value);
    }
}
