<?php

use AltUU\Domains\Course\Actions\CourseTypeMatcher;
use AltUU\Domains\Course\Actions\ListCourses;
use App\Services\UUCourseClient;
use App\Services\UUProxyClient;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository as CacheRepository;
use Illuminate\Http\Request;
use Mockery as MockeryManager;

it('populates commonCourseId when courseType comes from an app course', function () {
    $cache = new CacheRepository(new ArrayStore);

    $proxyClient = MockeryManager::mock(UUProxyClient::class);
    $proxyClient->shouldReceive('request')
        ->once()
        ->with('my-course-list', 'GET', ['offset' => 0, 'pagesize' => 100])
        ->andReturn([
            'payload' => [
                'data' => [
                    'list' => [
                        ['course_id' => '1001', 'title' => '(114下)行動學習導論-ZZZ001班'],
                        ['course_id' => '1002', 'title' => '(114下)行動學習導論-語音APP'],
                    ],
                ],
            ],
        ]);

    $courseClient = new UUCourseClient($proxyClient);
    $action = new ListCourses($courseClient, $cache);

    $request = MockeryManager::mock(Request::class);
    $request->shouldReceive('hasSession')->once()->andReturn(false);

    $result = $action($request);

    expect($cache->has('alt-uu:courses:list:anonymous'))->toBeTrue();

    $items = collect($result->items());
    expect($items)->toHaveCount(1);
    $first = $items->first();

    expect($first->courseId)->toBe('1001');
    expect($first->commonCourseId)->toBe('1002');
    expect($first->courseType)->toBe('語音');
});

it('resolves course type and commonCourseId using CourseTypeMatcher utility', function () {
    $course = ['course_id' => '1005', 'title' => '(114下)行動學習導論-語音APP', 'course_type' => ''];
    $courseTypesByTitleKey = ['114下|行動學習導論' => ['courseType' => '語音', 'commonCourseId' => '1005']];

    $matcher = new CourseTypeMatcher;
    $result = $matcher($course, $courseTypesByTitleKey);

    expect($result['courseType'])->toBe('語音');
    expect($result['commonCourseId'])->toBe('1005');
});

it('supports hyphenated class names when matching app course type', function () {
    $cache = new CacheRepository(new ArrayStore);

    $proxyClient = MockeryManager::mock(UUProxyClient::class);
    $proxyClient->shouldReceive('request')
        ->once()
        ->with('my-course-list', 'GET', ['offset' => 0, 'pagesize' => 100])
        ->andReturn([
            'payload' => [
                'data' => [
                    'list' => [
                        ['course_id' => '2001', 'title' => '(114下)某某課程-台北-測試班'],
                        ['course_id' => '2002', 'title' => '(114下)某某課程-語音APP'],
                    ],
                ],
            ],
        ]);

    $courseClient = new UUCourseClient($proxyClient);
    $action = new ListCourses($courseClient, $cache);

    $request = MockeryManager::mock(Request::class);
    $request->shouldReceive('hasSession')->once()->andReturn(false);

    $result = $action($request);

    expect($cache->has('alt-uu:courses:list:anonymous'))->toBeTrue();

    $items = collect($result->items());
    expect($items)->toHaveCount(1);

    $first = $items->first();
    expect($first->courseId)->toBe('2001');
    expect($first->commonCourseId)->toBe('2002');
    expect($first->courseType)->toBe('語音');
});
