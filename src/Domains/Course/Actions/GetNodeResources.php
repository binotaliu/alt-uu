<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\ViewModels\CourseMaterialResourceViewModel;
use App\Services\UUCourseClient;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Spatie\LaravelData\DataCollection;

final readonly class GetNodeResources
{
    private const COURSE_NODE_RESOURCES_CACHE_PREFIX = 'alt-uu:courses:node-resources:';

    public function __construct(private UUCourseClient $courseClient) {}

    /**
     * @return DataCollection<CourseMaterialResourceViewModel>
     */
    public function __invoke(Request $request, string $cid, string $scoid): DataCollection
    {
        $resourceCacheKey = self::COURSE_NODE_RESOURCES_CACHE_PREFIX.$cid.'.'.$scoid;
        $cachedResources = $request->session()->get($resourceCacheKey, ['loaded' => false, 'items' => []]);

        if (! is_array($cachedResources)) {
            $cachedResources = ['loaded' => false, 'items' => []];
        }

        $isLoadedFromCache = (bool) ($cachedResources['loaded'] ?? false);
        $resources = is_array($cachedResources['items'] ?? null) ? $cachedResources['items'] : [];

        if (! $isLoadedFromCache) {
            $resourceResult = $this->courseClient->fetchCourseNodeResources($cid, $scoid);

            $resources = Arr::get($resourceResult['payload'], 'data.list', []);

            if (! is_array($resources)) {
                $resources = [];
            }

            $request->session()->put($resourceCacheKey, [
                'loaded' => true,
                'items' => $resources,
            ]);
        }

        return new DataCollection(
            CourseMaterialResourceViewModel::class,
            $this->mapResources($resources),
        );
    }

    /**
     * @param  array<int, mixed>  $resources
     * @return array<int, CourseMaterialResourceViewModel>
     */
    private function mapResources(array $resources): array
    {
        $result = [];

        foreach ($resources as $resource) {
            if (! is_array($resource)) {
                continue;
            }

            $result[] = CourseMaterialResourceViewModel::fromPayload($resource);
        }

        return $result;
    }
}
