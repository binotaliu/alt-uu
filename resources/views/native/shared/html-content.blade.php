@if ($isEmbed)
    @if ($embedAllowed)
        <native:stack class="aspect-video w-full">
            <native:webview
                ref="embed"
                src="{{ $embedUrl }}"
                javascript="true"
                dom-storage="true"
                class="h-full w-full"
            />
        </native:stack>
    @else
        <native:column />
    @endif
@else
    <native:webview
        ref="content"
        :html="$document"
        class="{{ $webviewClass }}"
        @navigated="onNavigated"
    />
@endif
