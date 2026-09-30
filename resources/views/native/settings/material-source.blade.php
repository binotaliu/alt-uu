<native:scroll-view class="bg-theme-background h-full w-full">
    <native:column class="w-full gap-4 p-4 pb-16">
        @if (! $viewingSource)
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
            >
                <native:text class="text-theme-on-surface-variant text-xs"
                    >當教材目錄或內容顯示不出來時，可以在這裡看到學校實際送來的資料：目錄中每個節點的網址，以及每個節點頁面的原始碼與解析結果。</native:text
                >
                <native:text class="text-theme-on-surface-variant text-xs"
                    >原始碼中的密碼、Cookie
                    與登入憑證已遮蔽，但頁面內容可能包含您的姓名或學號，分享前請先檢查。</native:text
                >
                <native:text
                    class="text-theme-on-surface pt-2 text-sm font-semibold"
                    >選擇課程</native:text
                >
                @if ($loadingCourses)
                    <native:text class="text-theme-on-surface-variant text-xs"
                        >載入課程中…</native:text
                    >
                @endif
                @if ($coursesError)
                    <native:text
                        ref="courses-error"
                        class="text-theme-destructive text-xs"
                        >{{ $coursesError }}</native:text
                    >
                @endif
                @foreach ($courses as $course)
                    <native:pressable
                        ref="course-{{ $course['courseId'] }}"
                        key="course-{{ $course['courseId'] }}"
                        @tap="selectCourse('{{ $course['courseId'] }}')"
                    >
                        <native:column
                            class="{{ $selectedCid === $course['courseId'] ? 'bg-theme-primary/15' : 'bg-theme-surface-variant' }} w-full rounded-lg px-3 py-2"
                        >
                            <native:text
                                class="text-theme-on-surface text-sm"
                                >{{ $course['name'] }}</native:text
                            >
                        </native:column>
                    </native:pressable>
                @endforeach
            </native:column>
            @if ($selectedCid !== '')
                @if ($loadingDirectory)
                    <native:text class="text-theme-on-surface-variant text-sm"
                        >載入教材目錄中…</native:text
                    >
                @elseif ($directoryError)
                    <native:error-retry
                        key="directory-error"
                        :message="$directoryError"
                        :retrying="$loadingDirectory"
                        @retry="loadDirectory"
                    />
                @elseif ($directory)
                    <native:column
                        class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
                    >
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >教材目錄（{{ $directory['nodeCount'] }} 個節點）</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >學校回應：code={{ $directory['apiCode'] ?? '無' }}{{ $directory['apiMessage'] ? ' · '.$directory['apiMessage'] : '' }}</native:text
                        >

                        @if ($directory['nodeCount'] === 0)
                            <native:text
                                class="text-theme-on-surface-variant text-xs"
                                >學校沒有回傳任何節點。這通常代表目錄本身是空的，或學校的回應格式有變，請展開下方原始
                                JSON 檢視。</native:text
                            >
                        @endif

                        @foreach ($directory['nodes'] as $node)
                            <native:column
                                class="w-full gap-1"
                                key="node-{{ $loop->index }}"
                            >
                                <native:divider />
                                <native:row class="w-full items-start gap-2">
                                    <native:column class="flex-1 gap-0.5">
                                        <native:text
                                            class="text-theme-on-surface text-sm"
                                            >{{ str_repeat('　', $node['level']).($node['text'] !== '' ? $node['text'] : '（無標題）') }}{{ $node['itemDisabled'] ? '（已停用）' : '' }}</native:text
                                        >
                                        <native:text
                                            class="text-theme-on-surface-variant font-mono text-xs"
                                            >{{ $node['identifier'] }}</native:text
                                        >
                                        <native:text
                                            class="text-theme-on-surface-variant font-mono text-xs select-text"
                                            >{{ $node['href'] ?? '（無連結）' }}</native:text
                                        >
                                    </native:column>
                                    @if ($node['isInspectable'])
                                        <native:button
                                            ref="inspect-{{ $node['identifier'] }}"
                                            variant="secondary"
                                            size="sm"
                                            label="檢視"
                                            @tap="inspect('{{ $node['identifier'] }}')"
                                        />
                                    @endif
                                </native:row>
                            </native:column>
                        @endforeach

                        <native:divider />
                        <native:button
                            ref="toggle-raw"
                            variant="secondary"
                            :label="$showRawJson ? '收合原始 JSON' : '展開原始 JSON'"
                            @tap="toggleRawJson"
                        />
                        @if ($showRawJson)
                            <native:text
                                ref="raw-json"
                                class="text-theme-on-surface-variant font-mono text-xs select-text"
                                >{{ $directory['rawJson'] }}</native:text
                            >
                            @if ($directory['rawJsonTruncated'])
                                <native:text
                                    class="text-theme-on-surface-variant text-xs"
                                    >內容過長，已截斷。</native:text
                                >
                            @endif
                        @endif
                    </native:column>
                @endif
            @endif
        @else
            <native:button
                ref="back-to-directory"
                variant="secondary"
                label="回到目錄"
                @tap="backToDirectory"
            />
            @if ($loadingSource)
                <native:text class="text-theme-on-surface-variant text-sm"
                    >載入教材來源中…</native:text
                >
            @elseif ($sourceError)
                <native:error-retry
                    key="source-error"
                    :message="$sourceError"
                    :retrying="$loadingSource"
                    @retry="loadSource"
                />
            @elseif ($source)
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
                >
                    <native:text
                        class="text-theme-on-surface text-sm font-semibold"
                        >{{ $source['nodeText'] }}</native:text
                    >
                    @if ($verdict)
                        <native:text
                            ref="verdict"
                            class="text-theme-warning text-sm font-medium"
                            >{{ $verdict }}</native:text
                        >
                    @endif
                    @foreach ([
                        ['網址', $source['url']],
                        ['HTTP 狀態', $source['fetchStatus'] ?? '無（未取得回應）'],
                        ['Content-Type', $source['contentType'] ?? '未知'],
                        ['大小', $source['bodyBytes'].' bytes'.($source['bodyTruncated'] ? '（原始碼已截斷）' : '')],
                        ['解析結果', $parseKindLabels[$source['parse']['kind']] ?? $source['parse']['kind']],
                    ] as [$label, $value])
                        <native:column
                            class="w-full gap-0.5"
                            key="fact-{{ $label }}"
                        >
                            <native:text
                                class="text-theme-on-surface-variant text-xs"
                                >{{ $label }}</native:text
                            >
                            <native:text
                                class="text-theme-on-surface font-mono text-xs select-text"
                                >{{ $value }}</native:text
                            >
                        </native:column>
                    @endforeach
                    @if ($source['fetchError'])
                        <native:text
                            class="text-theme-destructive text-xs select-text"
                            >取得頁面失敗：{{ $source['fetchError'] }}</native:text
                        >
                    @endif
                    @if ($source['parse']['errorClass'])
                        <native:text
                            class="text-theme-destructive text-xs select-text"
                            >解析錯誤：{{ $source['parse']['errorClass'] }}: {{ $source['parse']['errorMessage'] }}（{{ $source['parse']['errorLocation'] }}）</native:text
                        >
                    @endif
                </native:column>
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
                >
                    <native:text
                        class="text-theme-on-surface text-sm font-semibold"
                        >原始碼</native:text
                    >
                    @if ($source['isText'] && $source['body'] !== null && $source['body'] !== '')
                        <native:text
                            ref="source-body"
                            class="text-theme-on-surface-variant font-mono text-xs select-text"
                            >{{ $source['body'] }}</native:text
                        >
                        @if ($source['bodyTruncated'])
                            <native:text
                                class="text-theme-on-surface-variant text-xs"
                                >內容過長，已截斷。</native:text
                            >
                        @endif
                    @elseif ($source['isText'])
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >學校回傳了空白頁面。</native:text
                        >
                    @else
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >非文字內容，未顯示。</native:text
                        >
                    @endif
                </native:column>
            @endif
        @endif
    </native:column>
</native:scroll-view>
