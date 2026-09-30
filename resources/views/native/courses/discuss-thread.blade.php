@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="bg-theme-background h-full w-full">
    <native:top-bar
        back="true"
        title="{{ $this->courseTitle() }}"
        subtitle="{{ $this->boardTitle() }}"
        display-mode="inline"
    >
        @if ($error === '')
            <native:top-bar-action
                id="reply"
                label="新增回覆"
                @tap="openReply"
                :ios-icon="Ios::Plus"
                :android-icon="Android::Add"
            />
        @endif
    </native:top-bar>

    <native:refreshable class="w-full flex-1" @refresh="retry">
        <native:column class="w-full gap-3 px-3 py-3 pb-8">
            <native:row class="items-center gap-2 px-1">
                <native:icon
                    :ios="Ios::Bubble"
                    :android="Android::Forum"
                    :size="18"
                    class="text-theme-on-surface-variant"
                />
                <native:text
                    max-lines="2"
                    class="text-theme-on-surface flex-1 text-base font-semibold"
                    >{{ $this->threadTitle() }}</native:text
                >
            </native:row>

            @if ($error !== '')
                <native:error-retry
                    key="error"
                    :message="$error"
                    :detail="$errorDetail"
                    :retrying="$loading"
                    @retry="retry"
                />
            @elseif ($loading && count($posts) === 0)
                <native:column class="w-full gap-2" a11y-label="載入中">
                    @for ($i = 0; $i < 3; $i++)
                        <native:rect
                            class="bg-theme-outline-variant h-24 w-full rounded-xl"
                            key="post-skeleton-{{ $i }}"
                        />
                    @endfor
                </native:column>
            @elseif (count($posts) > 0)
                <native:column class="w-full gap-2">
                    @foreach ($this->visiblePosts() as $index => $post)
                        <native:discuss-post-card
                            key="post-{{ $post->floor }}"
                            :post="$post"
                            :index="$index"
                            cid="{{ $cid }}"
                            board-id="{{ $bid }}"
                            appearance="{{ $appearance }}"
                            :base-url="$schoolBaseUrl"
                            :user-blocked="$this->isUserBlocked($post->poster, $post->realname)"
                            :revealed="$this->isRevealed($post->node)"
                            blocked-reason-label="{{ $this->reasonLabel($post->blockedReason) }}"
                            @like="toggleLike"
                            @reveal="revealPost"
                            @report="openReport"
                            @block="askBlock"
                            @unblock="unblock"
                            @whisper-add="openWhisperCreate"
                            @whisper-edit="openWhisperEdit"
                            @whisper-delete="askDeleteWhisper"
                            @open-image="openImage"
                        />
                    @endforeach

                    @if ($this->hiddenPostCount() > 0)
                        <native:button
                            ref="show-more"
                            variant="secondary"
                            label="顯示更多樓層（還有 {{ $this->hiddenPostCount() }} 則）"
                            @tap="showMore"
                        />
                    @endif
                </native:column>
            @else
                <native:empty-state
                    key="empty"
                    message="目前沒有可顯示的討論內容。"
                />
            @endif
        </native:column>
    </native:refreshable>

    <native:bottom-sheet
        ref="reply-sheet"
        :visible="$replyVisible"
        detents="large"
        @dismiss="closeReply"
    >
        <native:column class="w-full gap-4 p-5">
            <native:column class="w-full gap-1">
                <native:text class="text-theme-on-surface text-lg font-semibold"
                    >新增回覆</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >回覆文章：{{ $this->threadTitle() }}</native:text
                >
            </native:column>

            <native:outlined-text-input
                ref="reply-subject"
                native:model="replySubject"
                placeholder="主題（選填）"
                :disabled="$replySubmitting"
            />
            <native:outlined-text-input
                ref="reply-content"
                native:model="replyContent"
                placeholder="內容"
                multiline
                :min-lines="6"
                :max-lines="10"
                :error="$replyError !== ''"
                :supporting="$replyError"
                :disabled="$replySubmitting"
            />

            <native:row class="w-full justify-end gap-3">
                <native:button
                    ref="reply-cancel"
                    variant="secondary"
                    label="取消"
                    :disabled="$replySubmitting"
                    @tap="closeReply"
                />
                <native:button
                    ref="reply-submit"
                    variant="primary"
                    :label="$replySubmitting ? '送出中…' : '送出回覆'"
                    :loading="$replySubmitting"
                    @tap="submitReply"
                />
            </native:row>
        </native:column>
    </native:bottom-sheet>

    <native:bottom-sheet
        ref="whisper-sheet"
        :visible="$whisperVisible"
        detents="large"
        @dismiss="closeWhisper"
    >
        <native:column class="w-full gap-4 p-5">
            <native:column class="w-full gap-1">
                <native:text
                    class="text-theme-on-surface text-lg font-semibold"
                    >{{ $whisperId !== '' ? '編輯留言' : '新增留言' }}</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >留言於：{{ $whisperFloor ? '樓層 '.$whisperFloor : $this->threadTitle() }}</native:text
                >
            </native:column>

            <native:outlined-text-input
                ref="whisper-content"
                native:model="whisperContent"
                placeholder="留言內容"
                multiline
                :min-lines="4"
                :max-lines="8"
                :error="$whisperError !== ''"
                :supporting="$whisperError"
                :disabled="$whisperSubmitting"
            />

            <native:row class="w-full justify-end gap-3">
                <native:button
                    ref="whisper-cancel"
                    variant="secondary"
                    label="取消"
                    :disabled="$whisperSubmitting"
                    @tap="closeWhisper"
                />
                <native:button
                    ref="whisper-submit"
                    variant="primary"
                    :label="$whisperSubmitting ? '送出中…' : ($whisperId !== '' ? '儲存留言' : '送出留言')"
                    :loading="$whisperSubmitting"
                    @tap="submitWhisper"
                />
            </native:row>
        </native:column>
    </native:bottom-sheet>

    <native:bottom-sheet
        ref="report-sheet"
        :visible="$reportVisible"
        detents="large"
        @dismiss="closeReport"
    >
        <native:column class="w-full gap-3 p-5">
            <native:text class="text-theme-on-surface text-lg font-semibold"
                >檢舉此內容</native:text
            >
            <native:text class="text-theme-on-surface-variant text-sm"
                >請選擇檢舉原因：</native:text
            >

            @foreach (\App\NativeComponents\Courses\DiscussThread::REPORT_REASONS as $value => $label)
                <native:pressable
                    ref="report-reason-{{ $value }}"
                    key="report-reason-{{ $value }}"
                    class="w-full"
                    a11y-label="{{ $label }}"
                    @tap="selectReportReason('{{ $value }}')"
                >
                    <native:row
                        class="{{ $reportType === $value ? 'bg-theme-primary/15 border-theme-primary' : 'border-theme-outline-variant' }} w-full items-center gap-2 rounded-lg border px-3 py-2"
                    >
                        @if ($reportType === $value)
                            <native:icon
                                :ios="Ios::CheckmarkCircleFill"
                                :android="Android::CheckCircle"
                                :size="18"
                                class="text-theme-primary"
                            />
                        @endif
                        <native:text
                            class="text-theme-on-surface text-sm"
                            >{{ $label }}</native:text
                        >
                    </native:row>
                </native:pressable>
            @endforeach

            <native:column
                class="bg-theme-surface-variant w-full rounded-lg p-3"
            >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >本檢舉功能由 Alt UU 提供：你的檢舉內容將傳送給 Alt UU
                    而非校方，包含去識別化的裝置資訊與討論板資訊，以及所檢舉的文字內容。一般來說，檢舉的內容將會在
                    24 小時內被處理。</native:text
                >
            </native:column>

            @if ($reportSuccess === false)
                <native:text class="text-theme-destructive text-sm"
                    >檢舉送出失敗，請稍後再試。</native:text
                >
            @endif

            <native:row class="w-full justify-end gap-3">
                <native:button
                    ref="report-cancel"
                    variant="secondary"
                    label="取消"
                    :disabled="$reportSubmitting"
                    @tap="closeReport"
                />
                <native:button
                    ref="report-submit"
                    variant="primary"
                    :label="$reportSubmitting ? '送出中…' : '送出檢舉'"
                    :loading="$reportSubmitting"
                    :disabled="$reportType === ''"
                    @tap="submitReport"
                />
            </native:row>
        </native:column>
    </native:bottom-sheet>

    <native:confirm-sheet
        key="block-sheet"
        ref-prefix="block-"
        :visible="$blockVisible"
        title="封鎖使用者"
        message="確定要封鎖名稱為「{{ $blockRealname }}」、帳號為「{{ $blockPoster }}」的使用者嗎？封鎖後，所有相同名稱使用者的所有貼文將被隱藏。"
        confirm-label="確定封鎖"
        :danger="true"
        :processing="$blocking"
        @confirm="confirmBlock"
        @cancel="cancelBlock"
    />

    <native:confirm-sheet
        key="delete-whisper-sheet"
        ref-prefix="delete-whisper-"
        :visible="$deleteWhisperVisible"
        title="刪除留言"
        message="確定要刪除這則留言嗎？"
        confirm-label="刪除"
        :danger="true"
        :processing="$deletingWhisper"
        @confirm="confirmDeleteWhisper"
        @cancel="cancelDeleteWhisper"
    />

    <native:modal
        ref="image-viewer"
        :visible="$lightboxSrc !== ''"
        :dismissible="true"
        @dismiss="closeImage"
    >
        <native:column
            class="h-full w-full items-center justify-center bg-black"
        >
            @if ($lightboxSrc !== '')
                <native:gesture-area
                    ref="image-zoom"
                    class="h-full w-full"
                    :pinch="$lightboxZoom"
                    pinch-min="1"
                    pinch-max="4"
                >
                    <native:image
                        src="{{ $lightboxSrc }}"
                        alt="{{ $lightboxAlt }}"
                        fit="contain"
                        class="h-full w-full"
                        :scale="$lightboxZoom"
                    />
                </native:gesture-area>
            @endif
            <native:button
                ref="close-image"
                variant="secondary"
                label="關閉"
                a11y-label="關閉圖片"
                class="absolute top-4 right-4"
                @tap="closeImage"
            />
        </native:column>
    </native:modal>

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $this->route('native.courses.discuss.thread.show', ['cid' => $cid, 'boardCid' => $boardCid, 'bid' => $bid, 'nid' => $nid]) }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
