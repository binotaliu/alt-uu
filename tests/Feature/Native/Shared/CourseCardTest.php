<?php

declare(strict_types=1);

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\Course\ViewModels\CourseTasksCountViewModel;
use App\NativeComponents\Shared\EmptyState;
use App\NativeComponents\Support\CourseListing;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\RecordingHost;

it('renders the course chips, name and task counters', function (): void {
    RecordingHost::mountView('course-card', ['pending' => 2, 'unread' => 120])
        ->assertSee('資料結構')
        ->assertSee('必修')
        ->assertSee('甲班')
        ->assertSee('未繳作業 2')
        ->assertSee('未讀文章 99+')
        ->assertDontSee('無待辦');
});

it('shows 無待辦 when nothing is pending', function (): void {
    RecordingHost::mountView('course-card')->assertSee('無待辦');
});

it('shows a placeholder while tasks load and an error label when they fail', function (): void {
    RecordingHost::mountView('course-card', ['loading' => true])
        ->assertDontSee('無待辦')
        ->assertDontSee('取得待辦失敗');

    RecordingHost::mountView('course-card', ['error' => true])->assertSee('取得待辦失敗');
});

it('emits selected and navigates to the course on tap', function (): void {
    $host = RecordingHost::mountView('course-card')->tap('course-42');

    expect($host->get('events'))->toBe([['selected', '42']]);
    $host->assertNavigatedTo('/native/courses/42');
});

it('groups courses by semester and merges common course counters', function (): void {
    $a = new CourseItemViewModel(courseId: '1', commonCourseId: '9', semester: ' 114-1 ', name: 'A');
    $b = new CourseItemViewModel(courseId: '2', semester: null, name: 'B');
    $c = new CourseItemViewModel(courseId: '3', semester: '114-1', name: 'C');

    $groups = CourseListing::groupBySemester([$a, $b, $c]);

    expect(array_keys($groups))->toBe(['114-1', '其他'])
        ->and($groups['114-1'])->toHaveCount(2);

    $tasks = [
        '1' => new CourseTasksCountViewModel('1', 1, 2),
        '9' => ['pendingHomeworks' => 3, 'unreadArticles' => 4],
    ];

    expect(CourseListing::tasksFor($a, $tasks))->toBe(['pendingHomeworks' => 4, 'unreadArticles' => 6])
        ->and(CourseListing::tasksFor($b, $tasks))->toBe(['pendingHomeworks' => 0, 'unreadArticles' => 0]);
});

it('renders the empty state and skeleton partials', function (): void {
    Native::test(EmptyState::class)
        ->set('message', '您的帳號目前未有課程')
        ->assertSee('您的帳號目前未有課程');
});
