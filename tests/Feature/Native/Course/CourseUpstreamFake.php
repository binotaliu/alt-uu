<?php

declare(strict_types=1);

namespace Tests\Feature\Native\Course;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * Routes every upstream request of the course screens by URL fragment.
 *
 * Defaults describe a healthy account with two homework rows, one self exam,
 * a small material tree and one discussion board. Pass `$overrides`
 * (`fragment => response|Closure`) to replace or break single endpoints; a
 * `ConnectionException` instance simulates being offline.
 */
final class CourseUpstreamFake
{
    /**
     * @param  array<string, mixed>  $overrides
     */
    public static function install(array $overrides = []): void
    {
        $responses = [...self::defaults(), ...$overrides];

        Http::swap(new Factory);
        Http::fake(function (Request $request) use ($responses) {
            $url = $request->url();

            foreach (array_reverse($responses, true) as $fragment => $response) {
                if (! str_contains($url, (string) $fragment)) {
                    continue;
                }

                if ($response instanceof ConnectionException) {
                    throw $response;
                }

                return is_callable($response) ? $response($request) : $response;
            }

            return Http::response('', 404);
        });
    }

    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            'action=my-course-list' => Http::response([
                'code' => 0,
                'data' => ['list' => [
                    ['course_id' => '1001', 'title' => '(114下)行動學習導論-甲班'],
                    ['course_id' => '9000', 'title' => '(114下)行動學習導論-語音APP'],
                    ['course_id' => '1002', 'title' => '(114下)資料結構-乙班'],
                ]],
            ]),
            'action=go-course' => Http::response(['code' => 0, 'message' => 'success', 'data' => []]),
            'action=my-course-path-info' => Http::response([
                'code' => 0,
                'data' => ['path' => ['item' => [
                    ['identifier' => 'A', 'href' => 'https://uu.nou.edu.tw/a', 'text' => '第一章', 'item' => [
                        ['identifier' => 'A1', 'href' => 'https://uu.nou.edu.tw/a1', 'text' => '影片一'],
                    ]],
                ]]],
            ]),
            '/learn/last10.php' => Http::response('<table class="subject"><tr><td>影片一</td><td>00:10:00</td></tr></table>'),
            '/learn/my_homework.php' => Http::response(self::taskTable('1001', 2)),
            '/learn/my_forum.php' => Http::response(self::taskTable('1001', 3, column: 2)),
            '/learn/homework/homework_list.php' => Http::response(self::homeworkHtml()),
            '/learn/exam/co_self_exam_list.php' => Http::response(self::selfExamHtml()),
            'action=get-board-list' => Http::response([
                'code' => 0,
                'data' => ['list' => [
                    ['board_id' => 'B-1', 'board_name' => '課程討論', 'subject_cnt' => 3, 'is_bulletin' => 0, 'read_flag' => 0],
                    ['board_id' => 'B-2', 'board_name' => '公告區', 'subject_cnt' => 1, 'is_bulletin' => 1, 'read_flag' => 1],
                ]],
            ]),
            'action=get-board-node-list' => Http::response([
                'code' => 0,
                'data' => ['list' => [
                    ['node' => 'N-1', 'subject' => '第一週問題', 'read' => 0, 'realname' => '王小明', 'reply' => 2, 'push' => 4],
                    ['node' => 'N-2', 'subject' => '期中考範圍', 'read' => 1, 'realname' => '李老師', 'reply' => 0, 'push' => 0],
                ]],
            ]),
        ];
    }

    public static function taskTable(string $courseId, int $count, int $column = 3): string
    {
        $cells = array_fill(0, 5, '<td><div>0</div></td>');
        $cells[0] = "<td><div>{$courseId}</div></td>";
        $cells[$column] = "<td><div>{$count}</div></td>";

        return '<div class="data2"><table class="table subject"><tr>'.implode('', $cells).'</tr></table></div>';
    }

    public static function homeworkHtml(): string
    {
        return <<<'HTML'
            <html><body>
            <script>function view_homework(type, eid, obj) { window.open('/learn/' + type + '/view_exemplar.php?' + eid + '+s1234567+personal'); }</script>
            <div class="box2" data-type="homework">
                <div class="title"><span class="sparkpie exam-percent-tips" title="100%">100,0</span>
                    <span title="作業 A">作業 A</span></div>
                <div class="content"><div class="data5 mooc-process">
                    <div class="process-btn pay active" onclick="togo('200001+1+tokenabc', false, this)">
                        <div class="level1"><div class="main-text">進行作業</div><div class="sub-text">從 2026-01-01 00:00 到 2026-01-31 23:59</div></div>
                    </div>
                    <div class="process-btn score active" onclick="view_homework('homework', '200001+1+tokenabc', this);">
                        <div class="level1"><div class="main-text">查看結果</div></div>
                    </div>
                </div></div>
            </div>
            <div class="box2" data-type="homework">
                <div class="title"><span title="作業 B">作業 B</span></div>
                <div class="content"><div class="data5 mooc-process">
                    <div class="process-btn pay"><div class="level1"><div class="main-text">已繳作業</div></div></div>
                    <div class="process-btn score"><div class="level1"><div class="main-text">查看結果</div></div></div>
                </div></div>
            </div>
            </body></html>
            HTML;
    }

    public static function selfExamHtml(): string
    {
        return <<<'HTML'
            <html><body>
            <div class="box2" data-type="self-exam">
                <div class="title"><span title="示範自我測驗 A">示範自我測驗 A</span></div>
                <div class="content"><div class="data5 mooc-process">
                    <div class="process-btn pay active">
                        <div class="level1 active"><div class="main-text">進行測驗</div></div>
                        <div class="level2" style="display: none;">
                            <div class="btn btn-blue" onclick="togo('300001+2+tok', false, this)">重新測驗</div>
                        </div>
                    </div>
                    <div class="process-btn score active" onclick="viewResult('300001+2+tok');"><div class="level1"><div class="main-text">查看結果</div></div></div>
                </div></div>
            </div>
            </body></html>
            HTML;
    }
}
