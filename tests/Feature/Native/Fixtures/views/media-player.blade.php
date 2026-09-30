<native:column class="h-full w-full">
    <native:media-player
        key="player"
        :src="$state['src'] ?? null"
        :kind="$state['kind'] ?? null"
        :title="$state['title'] ?? null"
        :course-name="$state['courseName'] ?? null"
        :poster="$state['poster'] ?? null"
        :subtitles="$state['subtitles'] ?? null"
        :start="$state['start'] ?? null"
        :rate="$state['rate'] ?? null"
        :appearance="$state['appearance'] ?? null"
        :watermark="$state['watermark'] ?? null"
        :autoplay="$state['autoplay'] ?? null"
        :session-context="$state['sessionContext'] ?? null"
        on-progress="record('progress')"
        on-state-change="record('state')"
        on-ended="record('ended')"
        on-error="record('error')"
    />
</native:column>
