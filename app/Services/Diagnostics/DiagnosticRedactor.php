<?php

declare(strict_types=1);

namespace App\Services\Diagnostics;

/**
 * Strips secrets out of diagnostic payloads.
 *
 * This runs at WRITE time, never at export time, so the stored log itself
 * never holds a credential. An accidental export, a stray `sqlite3` dump or a
 * screenshot of the in-app viewer therefore cannot leak one.
 *
 * Two different treatments:
 *
 *  - Secrets (passwords, tickets, cookies, tokens, receipts) are DROPPED.
 *    They have no diagnostic value, so there is nothing to trade off.
 *  - Identifiers (usernames, student IDs, e-mail) are PSEUDONYMIZED to a
 *    stable per-install hash. "Are these two failures the same account?" is a
 *    real debugging question on a multi-account app, and the hash answers it
 *    without publishing who the account belongs to.
 */
final readonly class DiagnosticRedactor
{
    public const REDACTED = '[已遮蔽]';

    /**
     * Key fragments that mean "this value is a secret". Matched against a
     * normalized key (lowercased, separators stripped), so `access_token`,
     * `accessToken` and `ACCESS-TOKEN` all match `token`.
     *
     * @var list<string>
     */
    private const SECRET_KEY_FRAGMENTS = [
        'password',
        'passwd',
        'token',
        'secret',
        'cookie',
        'apikey',
        'receipt',
        'credential',
        'privatekey',
        'signature',
        'authorization',
    ];

    /**
     * Exact normalized keys that are secrets but whose names are too generic
     * to match as fragments.
     *
     * @var list<string>
     */
    private const SECRET_KEYS = [
        'ticket',
        'sessionidx',
        'sessionid',
        'signedpayload',
        'appkey',
        'anticsrf',
        'csrf',
        'ua',
        'auth',
        'pwd',
    ];

    /**
     * Exact normalized keys holding a personal identifier. Deliberately exact:
     * `accountId` is our own local integer primary key, which is useful and
     * carries no personal information, so it must NOT be caught here.
     *
     * @var list<string>
     */
    private const IDENTIFIER_KEYS = [
        'username',
        'user',
        'userid',
        'studentid',
        'studentno',
        'stdno',
        'loginid',
        'displayname',
        'realname',
        'nickname',
        'name',
        'email',
        'mail',
    ];

    /** Query-string parameters stripped from any recorded URL. */
    private const SECRET_QUERY_PARAMS = [
        'ticket',
        'ua',
        'username',
        'password',
        'token',
        'session_idx',
    ];

    public function __construct(private string $salt) {}

    /**
     * Redact an arbitrary context array, recursively.
     *
     * @param  array<array-key, mixed>  $context
     * @return array<array-key, mixed>
     */
    public function redact(array $context): array
    {
        $result = [];

        foreach ($context as $key => $value) {
            $normalized = $this->normalizeKey((string) $key);

            if ($this->isSecretKey($normalized)) {
                $result[$key] = self::REDACTED;

                continue;
            }

            if ($this->isIdentifierKey($normalized) && is_scalar($value) && $value !== '') {
                $result[$key] = $this->pseudonymize((string) $value);

                continue;
            }

            if (is_array($value)) {
                $result[$key] = $this->redact($value);

                continue;
            }

            if (is_string($value)) {
                $result[$key] = $this->redactText($value);

                continue;
            }

            $result[$key] = $value;
        }

        return $result;
    }

    /**
     * Sweep free text — a response body snippet, an exception message, a stack
     * trace — for anything that looks like a credential or an identifier.
     */
    public function redactText(string $text): string
    {
        if ($text === '') {
            return $text;
        }

        $text = $this->sweepQueryParameters(
            $this->sweepAssignments($text, pseudonymizeIdentifiers: true),
        );

        // Hungu-style account handles (u1001, U123456) wherever they appear.
        $text = (string) preg_replace_callback(
            '/\bu\d{4,}\b/i',
            fn (array $matches): string => $this->pseudonymize($matches[0]),
            $text,
        ) ?: $text;

        // Bare e-mail addresses.
        return (string) preg_replace_callback(
            '/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/',
            fn (array $matches): string => $this->pseudonymize($matches[0]),
            $text,
        ) ?: $text;
    }

    /**
     * Drop credentials from free text but leave everything else untouched.
     *
     * For text whose structure IS the payload — a page's HTML source — where
     * redactText() would rewrite `name="viewport"` into a pseudonym and make
     * the source unreadable. Identifiers are kept, so a caller must tell the
     * user to check the text before sharing it.
     */
    public function redactSecrets(string $text): string
    {
        if ($text === '') {
            return $text;
        }

        return $this->sweepQueryParameters(
            $this->sweepAssignments($text, pseudonymizeIdentifiers: false),
        );
    }

    /**
     * sweepAssignments() reads `https:` as a key and swallows the rest of the
     * URL as its value, so a `?ticket=` inside a link never reaches the key
     * check. Query parameters get their own pass.
     */
    private function sweepQueryParameters(string $text): string
    {
        return (string) preg_replace_callback(
            '/([?&;])(?<key>[A-Za-z0-9_\-]+)=(?<value>[^&"\'\s<>#]*)/',
            fn (array $matches): string => $this->isSecretKey($this->normalizeKey($matches['key']))
                ? $matches[1].$matches['key'].'='.self::REDACTED
                : $matches[0],
            $text,
        ) ?: $text;
    }

    /**
     * "username":"u1001" / username=u1001 / 'ticket' => 'abc123'
     */
    private function sweepAssignments(string $text, bool $pseudonymizeIdentifiers): string
    {
        return (string) preg_replace_callback(
            '/(["\']?(?<key>[A-Za-z_][A-Za-z0-9_-]*)["\']?\s*(?:=>|[:=])\s*)(["\']?)(?<value>[^"\'&,;}\s]+)(\3)/',
            function (array $matches) use ($pseudonymizeIdentifiers): string {
                $normalized = $this->normalizeKey($matches['key']);

                if ($this->isSecretKey($normalized)) {
                    return $matches[1].$matches[3].self::REDACTED.$matches[5];
                }

                if ($pseudonymizeIdentifiers && $this->isIdentifierKey($normalized)) {
                    return $matches[1].$matches[3].$this->pseudonymize($matches['value']).$matches[5];
                }

                return $matches[0];
            },
            $text,
        ) ?: $text;
    }

    /**
     * Strip credential-bearing query parameters from a URL, keeping the
     * scheme, host and path — which is the part with diagnostic value.
     */
    public function redactUrl(string $url): string
    {
        $parts = parse_url($url);

        if ($parts === false) {
            return $this->redactText($url);
        }

        $rebuilt = '';

        if (isset($parts['scheme'])) {
            $rebuilt .= $parts['scheme'].'://';
        }

        if (isset($parts['host'])) {
            $rebuilt .= $parts['host'];

            if (isset($parts['port'])) {
                $rebuilt .= ':'.$parts['port'];
            }
        }

        $rebuilt .= $parts['path'] ?? '';

        if (isset($parts['query']) && $parts['query'] !== '') {
            parse_str($parts['query'], $query);

            foreach ($query as $key => $value) {
                if (in_array(strtolower((string) $key), self::SECRET_QUERY_PARAMS, true)) {
                    $query[$key] = self::REDACTED;

                    continue;
                }

                if (is_string($value)) {
                    $query[$key] = $this->redactText($value);
                }
            }

            if ($query !== []) {
                $rebuilt .= '?'.urldecode(http_build_query($query));
            }
        }

        return $rebuilt === '' ? $this->redactText($url) : $rebuilt;
    }

    /**
     * Map a personal identifier onto a stable, non-reversible handle.
     *
     * Stable within an install (so the same account looks the same across
     * requests), different across installs (so two users' reports cannot be
     * correlated against each other).
     */
    public function pseudonymize(string $value): string
    {
        $normalized = mb_strtolower(trim($value));

        if ($normalized === '') {
            return $value;
        }

        return 'user#'.substr(hash_hmac('sha256', $normalized, $this->salt), 0, 4);
    }

    private function normalizeKey(string $key): string
    {
        return str_replace(['_', '-', ' '], '', mb_strtolower($key));
    }

    private function isSecretKey(string $normalizedKey): bool
    {
        if (in_array($normalizedKey, self::SECRET_KEYS, true)) {
            return true;
        }

        foreach (self::SECRET_KEY_FRAGMENTS as $fragment) {
            if (str_contains($normalizedKey, $fragment)) {
                return true;
            }
        }

        return false;
    }

    private function isIdentifierKey(string $normalizedKey): bool
    {
        return in_array($normalizedKey, self::IDENTIFIER_KEYS, true);
    }
}
