@use ('App\Icons\Android')
@use ('App\Icons\Ios')

@if ($m->isYoutube())
    <native:column class="w-full gap-2">
        <native:html-content
            key="youtube-{{ $activeNodeIdentifier }}"
            embed-url="{{ $content->embedVideoUrl }}"
            @progress="onYoutubeProgress"
            @external-link="openExternal"
        />
    </native:column>
@elseif ($m->hasNativePlayer())
    @if ($mediaReady)
        <native:media-playback
            key="media-{{ $activeNodeIdentifier }}"
            src="{{ $content->videoUrl }}"
            kind="{{ $m->isAudioCourse() ? 'audio' : 'video' }}"
            title="{{ $m->activeNodeText() }}"
            course-name="{{ $m->courseTitle() }}"
            :subtitles="$subtitleUrl"
            :start="$mediaStart"
            :rate="$playbackRate"
            appearance="{{ $appearance }}"
            watermark="{{ $studentId }}"
            :autoplay="$mediaAutoplay"
            :session-context="$m->sessionContext()"
            @progress="onPlaybackProgress"
            @error="onPlayerError"
        />
    @else
        <native:stack
            class="bg-theme-surface-variant {{ $m->isAudioCourse() ? 'h-24' : 'aspect-video' }} w-full items-center justify-center rounded-2xl"
        >
            <native:text class="text-theme-on-surface-variant text-sm"
                >請先選擇是否接續播放</native:text
            >
        </native:stack>
    @endif
    @if ($playerError !== '')
        <native:text
            ref="player-error"
            class="text-theme-destructive px-1 text-xs"
            >{{ $playerError }}</native:text
        >
    @endif
@endif

<native:column class="w-full gap-3">
    @if ($captureError !== '')
        <native:text
            class="text-theme-destructive px-1 text-xs"
            >{{ $captureError }}</native:text
        >
    @endif
    @if ($reloadError !== '')
        <native:text
            class="text-theme-destructive px-1 text-xs"
            >{{ $reloadError }}</native:text
        >
    @endif

    <native:row
        class="bg-theme-surface border-theme-outline-variant w-full items-center gap-2 rounded-2xl border px-3 py-3"
    >
        <native:button
            ref="open-in-app-browser"
            variant="secondary"
            class="flex-1"
            label="使用內建瀏覽器開啟"
            :disabled="($m->activeNode()?->href ?? '') === ''"
            @tap="openInAppBrowser"
        />

        <native:pressable
            ref="reload"
            a11y-label="重新載入教材"
            class="bg-theme-surface-variant h-10 w-10 items-center justify-center rounded-lg"
            @tap="reloadContent"
        >
            @if ($reloading)
                <native:activity-indicator />
            @else
                <native:icon
                    :ios="Ios::ArrowClockwise"
                    :android="Android::Refresh"
                    :size="20"
                    class="text-theme-on-surface"
                />
            @endif
        </native:pressable>

        @if ($m->canCaptureFrame())
            <native:pressable
                ref="capture"
                a11y-label="截取畫面"
                class="bg-theme-surface-variant h-10 w-10 items-center justify-center rounded-lg"
                @tap="captureFrame"
            >
                @if ($capturing)
                    <native:activity-indicator />
                @else
                    <native:icon
                        :ios="Ios::Camera"
                        :android="Android::PhotoCamera"
                        :size="20"
                        class="text-theme-on-surface"
                    />
                @endif
            </native:pressable>
        @endif
    </native:row>

    @if ($m->hasHtml() && ! $m->hasDownload())
        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full rounded-2xl border"
        >
            <native:row class="w-full items-center justify-end px-4 py-2">
                <native:row
                    class="bg-theme-surface-variant items-center gap-1 rounded-xl p-1"
                >
                    <native:button
                        ref="zoom-out"
                        variant="secondary"
                        label="A-"
                        a11y-label="縮小字體"
                        :disabled="! $m->canZoomOut()"
                        @tap="zoomOut"
                    />
                    <native:pressable
                        ref="zoom-reset"
                        a11y-label="重設字體大小"
                        class="h-8 w-14 items-center justify-center"
                        @tap="resetZoom"
                    >
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >{{ $m->scaleLabel() }}</native:text
                        >
                    </native:pressable>
                    <native:button
                        ref="zoom-in"
                        variant="secondary"
                        label="A+"
                        a11y-label="放大字體"
                        :disabled="! $m->canZoomIn()"
                        @tap="zoomIn"
                    />
                </native:row>
            </native:row>
            <native:divider />
            <native:column class="w-full px-2 py-3">
                <native:html-content
                    key="article-{{ $activeNodeIdentifier }}"
                    :html="$html"
                    base-url="{{ $contentUrl }}"
                    appearance="{{ $appearance }}"
                    :font-scale="$fontScale"
                    :node-links="$materialNodes"
                    active-node-url="{{ $m->activeNode()?->href }}"
                    :auto-height="true"
                    @node-link="openNodeLink"
                    @subpage-link="loadSubpage"
                    @tronclass-link="openTronclass"
                    @external-link="openExternal"
                    @mailto-link="openSystem"
                    @tel-link="openSystem"
                />
            </native:column>
        </native:column>
    @elseif ($m->hasDownload())
        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-2xl border p-4"
        >
            <native:text
                class="text-theme-on-surface text-sm"
                >{{ $m->downloadDescription() }}</native:text
            >
            <native:attachment-row
                key="download-{{ $activeNodeIdentifier }}"
                cid="{{ $cid }}"
                filename="{{ $m->downloadFilename() }}"
                href="{{ $downloadUrl }}"
                source="hungu"
            />
        </native:column>
    @endif

    @if ($m->isEmpty())
        <native:empty-state
            key="empty"
            message="此節點沒有可顯示的教材內容。"
        />
    @endif

    @if (count($resources) > 1)
        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-2xl border p-4"
        >
            <native:text class="text-theme-on-surface text-sm font-semibold"
                >附件資源</native:text
            >
            @foreach ($m->resourceLabels() as $index => $label)
                <native:column
                    class="bg-theme-surface-variant w-full rounded-lg px-3 py-2"
                    key="resource-{{ $index }}"
                >
                    <native:text
                        class="text-theme-on-surface text-sm"
                        >{{ $label }}</native:text
                    >
                </native:column>
            @endforeach
        </native:column>
    @endif
</native:column>
