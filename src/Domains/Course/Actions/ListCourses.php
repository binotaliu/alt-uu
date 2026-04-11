<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use App\Services\UUCourseClient;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Spatie\LaravelData\DataCollection;

final readonly class ListCourses
{
    private const COURSE_LIST_CACHE_KEY_PREFIX = 'alt-uu:courses:list:';

    private const ANONYMOUS_CACHE_SEGMENT = 'anonymous';

    private const COURSE_LIST_CACHE_TTL_MINUTES = 30;

    private const APP_COURSE_PATTERN = '/-(?<type>語音|網頁|影音|影音語音|其他)APP$/u';

    private const TITLE_PATTERN = '/^\((?<semester>[^)]+)\)(?<name>.+?)(?:-(?<className>.+))?$/u';

    public function __construct(private UUCourseClient $courseClient, private CacheRepository $cache) {}

    /**
     * @return DataCollection<CourseItemViewModel>
     */
    public function __invoke(Request $request): DataCollection
    {
        $cacheKey = $this->resolveCourseListCacheKey($request);
        $courses = $this->cache->get($cacheKey, []);

        if (! is_array($courses)) {
            $courses = [];
        }

        if ($courses === []) {
            $courseResult = $this->courseClient->fetchCourseList();

            $coursePayload = $courseResult['payload'];
            $courses = Arr::get($coursePayload, 'data.list', []);

            if (! is_array($courses)) {
                $courses = [];
            }

            if (! empty($courses)) {
                $this->cache->put(
                    $cacheKey,
                    $courses,
                    now()->addMinutes(self::COURSE_LIST_CACHE_TTL_MINUTES),
                );
            }
        }

        $courseTypesByTitleKey = $this->buildCourseTypeMap($courses);
        $courseTypeMatcher = app(CourseTypeMatcher::class);

        $items = [];
        foreach ($courses as $course) {
            if (! is_array($course) || ! $this->shouldIncludeCourse($course)) {
                continue;
            }

            $item = $this->makeCourseItem($course, $courseTypesByTitleKey, $courseTypeMatcher);

            if ($item === null) {
                continue;
            }

            $items[] = $item;
        }

        return new DataCollection(CourseItemViewModel::class, $items);
    }

    /**
     * @param  array<int, mixed>  $courses
     * @return array<string, array{courseType: string, commonCourseId: string|null}>
     */
    private function buildCourseTypeMap(array $courses): array
    {
        $result = [];

        foreach ($courses as $course) {
            if (! is_array($course)) {
                continue;
            }

            $title = $course['title'] ?? null;

            if (! is_string($title) || $title === '') {
                continue;
            }

            if (preg_match(self::APP_COURSE_PATTERN, $title, $matches) !== 1) {
                continue;
            }

            $type = trim((string) ($matches['type'] ?? ''));
            if ($type === '') {
                continue;
            }

            $titleKey = $this->resolveTitleKey($course);
            if ($titleKey === null) {
                continue;
            }

            $courseId = is_scalar($course['course_id'] ?? null)
                ? (string) $course['course_id']
                : '';

            $result[$titleKey] = [
                'courseType' => $type,
                'commonCourseId' => $courseId !== '' ? $courseId : null,
            ];
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $course
     */
    private function shouldIncludeCourse(array $course): bool
    {
        $title = $course['title'] ?? null;

        if (! is_string($title) || $title === '') {
            return true;
        }

        return preg_match(self::APP_COURSE_PATTERN, $title) !== 1;
    }

    /**
     * @param  array<string, mixed>  $course
     */
    private function makeCourseItem(array $course, array $courseTypesByTitleKey, CourseTypeMatcher $courseTypeMatcher): ?CourseItemViewModel
    {
        $courseId = is_scalar($course['course_id'] ?? null)
            ? (string) $course['course_id']
            : '';

        $title = $course['title'] ?? null;
        $title = is_string($title) ? trim($title) : '';

        $semester = null;
        $name = '';
        $className = null;

        if ($title !== '' && preg_match(self::TITLE_PATTERN, $title, $matches) === 1) {
            $semester = trim((string) ($matches['semester'] ?? '')) ?: null;
            $name = trim((string) ($matches['name'] ?? ''));
            $className = trim((string) ($matches['className'] ?? '')) ?: null;
        }

        if ($name === '') {
            $name = $title !== '' ? $title : '未命名課程';
        }
        if ($semester === null) {
            $semester = '其他';
        }

        $courseTypeData = $courseTypeMatcher($course, $courseTypesByTitleKey);

        return new CourseItemViewModel(
            courseId: $courseId,
            commonCourseId: $courseTypeData['commonCourseId'],
            semester: $semester,
            name: $name,
            className: $className,
            courseType: $courseTypeData['courseType'],
        );
    }

    /**
     * @param  array<string, mixed>  $course
     */
    private function resolveTitleKey(array $course): ?string
    {
        $title = $course['title'] ?? null;

        if (! is_string($title) || $title === '') {
            return null;
        }

        if (preg_match(self::TITLE_PATTERN, $title, $matches) !== 1) {
            return null;
        }

        $semester = trim((string) ($matches['semester'] ?? ''));
        $name = trim((string) ($matches['name'] ?? ''));

        if ($name === '') {
            return null;
        }

        return ($semester !== '' ? $semester : '').'|'.$name;
    }

    private function resolveCourseListCacheKey(Request $request): string
    {
        $username = '';

        if ($request->hasSession()) {
            $username = trim((string) $request->session()->get('hungu.profile.username', ''));
        }

        if ($username === '') {
            return self::COURSE_LIST_CACHE_KEY_PREFIX.self::ANONYMOUS_CACHE_SEGMENT;
        }

        return self::COURSE_LIST_CACHE_KEY_PREFIX.$username;
    }
}
