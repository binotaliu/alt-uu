@use ('App\NativeComponents\Courses\Discuss\PostText')
@use ('App\Icons\Android')
@use ('App\Icons\Ios')

@if ($post === null)
    <native:column />
@elseif ($blockedByReport)
    <native:column
        class="bg-theme-warning-container border-theme-warning w-full gap-1 rounded-xl border p-3"
    >
        <native:text class="text-theme-on-warning-container text-sm"
            >本內容經檢舉已在 Alt UU 中隱藏，若有需要請前往其他平台檢視。原因：{{ $blockedReasonLabel }}。</native:text
        >
        <native:pressable
            ref="reveal-{{ $post->node }}"
            a11y-label="仍要檢視"
            @tap="reveal"
        >
            <native:text
                class="text-theme-on-warning-container py-1 text-xs font-medium underline"
                >仍要檢視</native:text
            >
        </native:pressable>
    </native:column>
@elseif ($userBlocked)
    <native:column
        class="bg-theme-surface-variant border-theme-outline-variant w-full gap-2 rounded-xl border p-3"
    >
        <native:text class="text-theme-on-surface-variant text-sm"
            >由於你封鎖了名稱為「{{ $post->realname }}」、帳號為「{{ $post->poster }}」的使用者，因此此內容已隱藏。</native:text
        >
        <native:button
            ref="unblock-{{ $post->floor }}"
            variant="secondary"
            label="解除封鎖"
            @tap="unblock"
        />
    </native:column>
@else
    <native:column
        class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-3"
    >
        <native:row class="w-full items-center gap-2">
            <native:text class="text-theme-on-surface-variant flex-1 text-sm"
                >樓層 {{ $this->floor() }} · {{ $this->author() }} · {{ $post->postDate ?? '' }}</native:text
            >
            <native:pressable
                ref="like-{{ $post->floor }}"
                a11y-label="{{ $post->liked ? '取消讚' : '讚' }}"
                @tap="like"
            >
                <native:row
                    class="{{ $post->liked ? 'bg-theme-primary' : 'bg-theme-surface-variant' }} items-center gap-1 rounded-lg px-2 py-1"
                >
                    <native:icon
                        :ios="$post->liked ? Ios::HandThumbsupFill : Ios::HandThumbsup"
                        :android="Android::ThumbUp"
                        :size="16"
                        class="{{ $post->liked ? 'text-theme-on-primary' : 'text-theme-on-surface-variant' }}"
                    />
                    <native:text
                        class="{{ $post->liked ? 'text-theme-on-primary' : 'text-theme-on-surface-variant' }} text-xs"
                        >{{ $post->push }}</native:text
                    >
                </native:row>
            </native:pressable>
        </native:row>

        @if ($plainText !== null)
            <native:text
                ref="content"
                class="text-theme-on-surface w-full text-base select-text"
                >{{ $plainText !== '' ? $plainText : '（無內容）' }}</native:text
            >
        @else
            <native:html-content
                key="content-{{ $post->floor }}"
                :html="$post->content"
                :base-url="$baseUrl"
                appearance="{{ $appearance }}"
                :auto-height="true"
                @external-link="openExternal"
                @tronclass-link="openTronclass"
                @mailto-link="openSystem"
                @tel-link="openSystem"
            />
        @endif

        @if ($linkDownloadHref !== null)
            <native:column class="w-full gap-1">
                <native:attachment-row
                    key="link-download"
                    ref-prefix="link-download-"
                    cid="{{ $cid }}"
                    :filename="$linkDownloadName"
                    :href="$linkDownloadHref"
                    :confirm="true"
                />
                <native:pressable
                    ref="dismiss-link-download"
                    a11y-label="關閉附件連結"
                    @tap="dismissLinkDownload"
                >
                    <native:text
                        class="text-theme-on-surface-variant px-1 text-xs underline"
                        >關閉</native:text
                    >
                </native:pressable>
            </native:column>
        @endif

        @if (count($post->attachments) > 0)
            <native:column
                class="bg-theme-surface-variant w-full gap-2 rounded-lg p-3"
            >
                <native:text
                    class="text-theme-on-surface-variant text-xs font-semibold"
                    >附件 ({{ count($post->attachments) }})</native:text
                >
                @if (count($this->imageAttachments()) > 0)
                    <native:row class="w-full flex-wrap gap-2">
                        @foreach ($this->imageAttachments() as $i => $attachment)
                            <native:discuss-image-attachment
                                key="image-{{ $post->floor }}-{{ md5((string) $attachment->href) }}"
                                cid="{{ $cid }}"
                                :filename="$attachment->filename"
                                :href="$attachment->href"
                                @open-image="openImage"
                            />
                        @endforeach
                    </native:row>
                @endif
                @foreach ($this->fileAttachments() as $i => $attachment)
                    @if ($attachment->href)
                        <native:attachment-row
                            key="file-{{ $post->floor }}-{{ md5((string) $attachment->href) }}"
                            ref-prefix="file-{{ $post->floor }}-{{ substr(md5((string) $attachment->href), 0, 8) }}-"
                            cid="{{ $cid }}"
                            :filename="$attachment->filename ?? ''"
                            :href="$attachment->href"
                            :confirm="true"
                        />
                    @else
                        <native:text
                            class="text-theme-on-surface text-sm"
                            >{{ $attachment->filename ?? '檔案' }}</native:text
                        >
                    @endif
                @endforeach
            </native:column>
        @endif

        @if ($this->showWhispers())
            <native:column
                class="bg-theme-surface-variant w-full gap-2 rounded-lg p-3"
            >
                <native:row class="w-full items-center">
                    <native:text
                        class="text-theme-on-surface-variant flex-1 text-xs font-semibold"
                        >留言 ({{ $post->whisperCount ?: count($post->whispers) }})</native:text
                    >
                    <native:button
                        ref="whisper-add-{{ $post->floor }}"
                        variant="secondary"
                        size="sm"
                        label="新增留言"
                        @tap="addWhisper"
                    />
                </native:row>

                @foreach ($post->whispers as $wi => $whisper)
                    <native:column
                        key="whisper-{{ $post->floor }}-{{ $whisper->wid ?? $whisper->sid ?? $wi }}"
                        class="bg-theme-surface w-full gap-1 rounded-lg px-3 py-2"
                    >
                        <native:text
                            class="text-theme-on-surface-variant text-sm"
                            >{{ $whisper->realname ?? $whisper->creator ?? '匿名' }} · {{ $whisper->createTime ?? '' }}</native:text
                        >
                        <native:text
                            class="text-theme-on-surface text-sm select-text"
                            >{{ PostText::whisper($whisper->content) !== '' ? PostText::whisper($whisper->content) : '（無內容）' }}</native:text
                        >
                        @if ($whisper->canDelete && $whisper->wid)
                            <native:row class="w-full gap-4">
                                <native:pressable
                                    ref="whisper-edit-{{ $whisper->wid }}"
                                    a11y-label="編輯留言"
                                    @tap="editWhisper('{{ $whisper->wid }}')"
                                >
                                    <native:text
                                        class="text-theme-accent py-1 text-xs font-medium"
                                        >編輯</native:text
                                    >
                                </native:pressable>
                                <native:pressable
                                    ref="whisper-delete-{{ $whisper->wid }}"
                                    a11y-label="刪除留言"
                                    @tap="deleteWhisper('{{ $whisper->wid }}')"
                                >
                                    <native:text
                                        class="text-theme-destructive py-1 text-xs font-medium"
                                        >刪除</native:text
                                    >
                                </native:pressable>
                            </native:row>
                        @endif
                    </native:column>
                @endforeach
            </native:column>
        @endif

        <native:divider class="bg-theme-outline-variant w-full" />

        <native:row class="w-full items-center gap-2">
            @if ($post->node)
                <native:pressable
                    ref="report-{{ $post->floor }}"
                    a11y-label="檢舉"
                    @tap="report"
                >
                    <native:row
                        class="bg-theme-surface-variant items-center gap-1 rounded-lg px-2 py-1"
                    >
                        <native:icon
                            :ios="Ios::Flag"
                            :android="Android::Flag"
                            :size="14"
                            class="text-theme-on-surface-variant"
                        />
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >檢舉</native:text
                        >
                    </native:row>
                </native:pressable>
            @endif
            @if ($post->poster && $post->realname)
                <native:pressable
                    ref="block-{{ $post->floor }}"
                    a11y-label="封鎖使用者"
                    @tap="block"
                >
                    <native:row
                        class="bg-theme-surface-variant items-center gap-1 rounded-lg px-2 py-1"
                    >
                        <native:icon
                            :ios="Ios::Nosign"
                            :android="Android::Block"
                            :size="14"
                            class="text-theme-on-surface-variant"
                        />
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >封鎖使用者</native:text
                        >
                    </native:row>
                </native:pressable>
            @endif
        </native:row>
    </native:column>
@endif
