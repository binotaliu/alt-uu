<native:column class="h-full w-full">
    <native:media-playback
        key="player"
        src="{{ $state['src'] ?? 'https://uu.nou.edu.tw/media/a.mp4' }}"
        :kind="$state['kind'] ?? 'video'"
        :title="$state['title'] ?? ''"
        :course-name="$state['courseName'] ?? ''"
        :poster="$state['poster'] ?? null"
        :subtitles="$state['subtitles'] ?? null"
        :start="$state['start'] ?? 0"
        :rate="$state['rate'] ?? 1"
        :appearance="$state['appearance'] ?? 'auto'"
        :watermark="$state['watermark'] ?? null"
        :autoplay="$state['autoplay'] ?? false"
        :session-context="$state['sessionContext'] ?? null"
        @progress="record('progress')"
        @state-changed="record('state-changed')"
        @ended="record('ended')"
        @error="record('error')"
    />
</native:column>
