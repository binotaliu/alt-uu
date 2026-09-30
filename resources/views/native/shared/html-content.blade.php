@if ($isEmbed)
    @if ($embedAllowed)
        <native:stack class="aspect-video w-full">
            <native:html-view
                ref="embed"
                src="{{ $embedUrl }}"
                javascript="true"
                dom-storage="true"
                :user-script="$embedUserScript"
                class="h-full w-full"
                on-link-tap="onLinkTap"
                on-message="onMessage"
            />
        </native:stack>
    @else
        <native:column />
    @endif
@else
    <native:html-view
        ref="content"
        :html="$document"
        :auto-height="$autoHeight ?: null"
        :estimated-height="$estimatedHeight"
        :color-scheme="$colorScheme"
        class="{{ $htmlViewClass }}"
        on-link-tap="onLinkTap"
        on-height-change="onHeight"
    />
@endif
