<native:scroll-view class="h-full w-full">
    <native:column class="w-full p-3">
        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full rounded-2xl border p-3"
        >
            <native:material-directory
                key="material-directory"
                cid="{{ $cid }}"
                :material-nodes="$materialNodes"
                :learning-time-items="$learningTimeItems"
                active-node-identifier="{{ $activeNodeIdentifier }}"
                :last-seen-identifier="$lastSeenIdentifier"
                :last-seen-position-seconds="$lastSeenPositionSeconds"
                :last-seen-duration-seconds="$lastSeenDurationSeconds"
                :loading="false"
                select-mode="event"
                @node-selected="selectNode"
            />
        </native:column>
    </native:column>
</native:scroll-view>
