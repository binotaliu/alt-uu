@if ($error !== '' && ! $loading)
    <native:error-retry
        key="error"
        :message="$error"
        :detail="$errorDetail"
        :retrying="$loading"
        @retry="retry"
    />
@else
    <native:column
        class="bg-theme-surface border-theme-outline-variant w-full rounded-xl border p-3"
    >
        <native:material-directory
            key="material-directory"
            cid="{{ $cid }}"
            :learning-time-items="$learningTimeItems"
            :last-seen-identifier="$lastSeenIdentifier"
            :last-seen-position-seconds="$lastSeenPositionSeconds"
            :last-seen-duration-seconds="$lastSeenDurationSeconds"
            :loading="$loading"
            select-mode="link"
        />
    </native:column>
@endif
