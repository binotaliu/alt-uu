@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="bg-theme-background h-full w-full">
    <native:top-bar
        back="true"
        title="{{ $this->courseTitle() }}"
        subtitle="{{ $this->boardTitle() }}"
        display-mode="inline"
    >
        @if (! $loading && $this->canCreatePost())
            <native:top-bar-action
                id="compose"
                label="新增文章"
                @tap="openCompose"
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
                    class="text-theme-on-surface text-base font-semibold"
                    >文章列表</native:text
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
            @elseif ($loading && count($nodes) === 0)
                <native:column class="w-full gap-2" a11y-label="載入中">
                    @for ($i = 0; $i < 5; $i++)
                        <native:rect
                            class="bg-theme-outline-variant h-14 w-full rounded-xl"
                            key="node-skeleton-{{ $i }}"
                        />
                    @endfor
                </native:column>
            @elseif (count($nodes) > 0)
                <native:column class="w-full gap-2">
                    @foreach ($nodes as $node)
                        @if ($node->isBlocked && ! $this->isRevealed($node->node))
                            <native:column
                                key="node-{{ $node->node }}"
                                class="bg-theme-warning-container border-theme-warning w-full gap-1 rounded-xl border px-3 py-2"
                            >
                                <native:text
                                    class="text-theme-on-warning-container text-sm"
                                    >本內容經檢舉已在 Alt UU
                                    中隱藏，若有需要請前往其他平台檢視。原因：{{ $this->reasonLabel($node->blockedReason) }}。</native:text
                                >
                                <native:pressable
                                    ref="reveal-{{ $node->node }}"
                                    a11y-label="仍要檢視"
                                    @tap="revealNode('{{ $node->node }}')"
                                >
                                    <native:text
                                        class="text-theme-on-warning-container py-1 text-xs font-medium underline"
                                        >仍要檢視</native:text
                                    >
                                </native:pressable>
                            </native:column>
                        @else
                            <native:pressable
                                ref="node-{{ $node->node }}"
                                key="node-{{ $node->node }}"
                                class="w-full"
                                a11y-label="{{ $node->subject !== '' ? $node->subject : '未命名主題' }}"
                                @tap="openNode('{{ $node->node }}')"
                            >
                                <native:row
                                    class="bg-theme-surface border-theme-outline-variant w-full items-start justify-between gap-3 rounded-xl border px-3 py-2"
                                >
                                    <native:column class="flex-1 gap-0.5">
                                        <native:row class="items-center gap-2">
                                            <native:text
                                                max-lines="2"
                                                class="text-theme-on-surface shrink text-base font-medium"
                                                >{{ $node->subject !== '' ? $node->subject : '未命名主題' }}</native:text
                                            >
                                            @if ($node->isRead === false)
                                                <native:column
                                                    class="bg-theme-warning rounded-full px-2 py-0.5"
                                                >
                                                    <native:text
                                                        class="text-theme-on-warning text-xs font-semibold"
                                                        >未讀</native:text
                                                    >
                                                </native:column>
                                            @endif
                                        </native:row>
                                        <native:text
                                            class="text-theme-on-surface-variant text-sm"
                                            >{{ $node->poster ?? '匿名' }} · {{ $node->repliesCount ?? '' }} 則回覆</native:text
                                        >
                                    </native:column>

                                    @if ($node->likesCount && $node->likesCount > 0)
                                        <native:row class="items-center gap-1">
                                            <native:icon
                                                :ios="Ios::HandThumbsup"
                                                :android="Android::ThumbUp"
                                                :size="16"
                                                class="text-theme-on-surface-variant"
                                            />
                                            <native:text
                                                class="text-theme-on-surface-variant text-sm"
                                                >{{ $node->likesCount }}</native:text
                                            >
                                        </native:row>
                                    @endif
                                </native:row>
                            </native:pressable>
                        @endif
                    @endforeach
                </native:column>
            @else
                <native:empty-state
                    key="empty"
                    message="目前沒有可顯示的文章主題。"
                />
            @endif
        </native:column>
    </native:refreshable>

    <native:bottom-sheet
        ref="compose-sheet"
        :visible="$composeVisible"
        detents="large"
        @dismiss="closeCompose"
    >
        <native:column class="w-full gap-4 p-5">
            <native:column class="w-full gap-1">
                <native:text class="text-theme-on-surface text-lg font-semibold"
                    >新增文章</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >討論板：{{ $this->boardTitle() }}</native:text
                >
            </native:column>

            <native:outlined-text-input
                ref="subject"
                native:model="newSubject"
                placeholder="主題（選填）"
                :disabled="$submitting"
            />
            <native:outlined-text-input
                ref="content"
                native:model="newContent"
                placeholder="內容"
                multiline
                :min-lines="6"
                :max-lines="10"
                :error="$composeError !== ''"
                :supporting="$composeError"
                :disabled="$submitting"
            />

            <native:row class="w-full justify-end gap-3">
                <native:button
                    ref="cancel"
                    variant="secondary"
                    label="取消"
                    :disabled="$submitting"
                    @tap="closeCompose"
                />
                <native:button
                    ref="submit"
                    variant="primary"
                    :label="$submitting ? '送出中…' : '送出文章'"
                    :loading="$submitting"
                    @tap="submitPost"
                />
            </native:row>
        </native:column>
    </native:bottom-sheet>

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $this->route('native.courses.discuss.board.show', ['cid' => $cid, 'boardCid' => $boardCid, 'bid' => $bid]) }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
