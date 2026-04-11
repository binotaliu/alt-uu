<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\ViewModels\CourseMaterialNodeViewModel;
use AltUU\Domains\Course\ViewModels\CoursePathInfoViewModel;
use App\Services\UUCourseClient;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Spatie\LaravelData\DataCollection;

final readonly class GetCoursePathInfo
{
    private const COURSE_PATH_INFO_CACHE_PREFIX = 'alt-uu:courses:path-info:';

    private const COURSE_PATH_INFO_IDS_KEY = 'alt-uu:courses:path-info:ids';

    private const COURSE_PATH_INFO_CACHE_TTL_MINUTES = 30;

    public function __construct(private UUCourseClient $courseClient) {}

    /**
     * @return array{pathInfo: CoursePathInfoViewModel, materialNodes: DataCollection<CourseMaterialNodeViewModel>}
     */
    public function __invoke(Request $request, string $cid): array
    {
        $pathInfoCacheKey = self::COURSE_PATH_INFO_CACHE_PREFIX.$cid;
        $pathInfo = Cache::get($pathInfoCacheKey);

        if (empty($pathInfo) || ! is_array($pathInfo)) {
            $pathResult = $this->courseClient->fetchCoursePathInfo($cid);

            $pathInfo = $pathResult['payload'];

            Cache::put(
                $pathInfoCacheKey,
                $pathInfo,
                now()->addMinutes(self::COURSE_PATH_INFO_CACHE_TTL_MINUTES),
            );
            $this->registerPathInfoKey($cid);
        }

        $flatNodes = $this->flattenNodes(Arr::get($pathInfo, 'data.path.item', []));

        $materialNodes = new DataCollection(
            CourseMaterialNodeViewModel::class,
            $this->mapMaterialNodes($flatNodes),
        );

        return [
            'pathInfo' => CoursePathInfoViewModel::fromPayload($pathInfo),
            'materialNodes' => $materialNodes,
        ];
    }

    /**
     * @param  array<int|string, mixed>  $nodes
     * @return array<int, array<string, mixed>>
     */
    private function flattenNodes(array $nodes, int $level = 0): array
    {
        $result = [];

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            $children = $node['item'] ?? [];
            $entry = $node;
            $entry['level'] = $level;
            unset($entry['item']);
            $result[] = $entry;

            if (is_array($children) && $children !== []) {
                $result = [...$result, ...$this->flattenNodes($children, $level + 1)];
            }
        }

        return $result;
    }

    /**
     * @param  array<int, mixed>  $nodes
     * @return array<int, CourseMaterialNodeViewModel>
     */
    private function mapMaterialNodes(array $nodes): array
    {
        $result = [];

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            $result[] = CourseMaterialNodeViewModel::fromPayload($node);
        }

        return $result;
    }

    private function registerPathInfoKey(string $cid): void
    {
        $ids = Cache::get(self::COURSE_PATH_INFO_IDS_KEY, []);

        if (! is_array($ids)) {
            $ids = [];
        }

        if (! in_array($cid, $ids, true)) {
            $ids[] = $cid;
            Cache::put(
                self::COURSE_PATH_INFO_IDS_KEY,
                $ids,
                now()->addMinutes(self::COURSE_PATH_INFO_CACHE_TTL_MINUTES),
            );
        }
    }
}
