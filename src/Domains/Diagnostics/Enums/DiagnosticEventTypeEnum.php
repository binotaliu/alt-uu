<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Enums;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
enum DiagnosticEventTypeEnum: string
{
    /** An inbound request to our own Laravel backend. */
    case ApiRequest = 'api.request';

    /** An outbound call to an upstream service (Hungu, NOU tools, IAP…). */
    case UpstreamCall = 'upstream.call';

    /**
     * An upstream call that succeeded at the HTTP level but returned a shape
     * we could not use. This is the case that used to vanish silently: the
     * user sees an empty screen and HTTP 200.
     */
    case ParseAnomaly = 'parse.anomaly';

    /** An unhandled PHP exception. */
    case Exception = 'exception';

    /** A JavaScript error reported by the frontend. */
    case ClientError = 'client.error';

    /** An SPA navigation, recorded to give failures surrounding context. */
    case ClientNavigation = 'client.nav';

    public function label(): string
    {
        return match ($this) {
            self::ApiRequest => 'App 請求',
            self::UpstreamCall => '外部服務呼叫',
            self::ParseAnomaly => '資料解析異常',
            self::Exception => '伺服器例外',
            self::ClientError => '前端錯誤',
            self::ClientNavigation => '頁面切換',
        };
    }
}
