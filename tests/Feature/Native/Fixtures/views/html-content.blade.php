<native:column class="h-full w-full">
    <native:html-content
        key="content"
        :html="$state['html'] ?? '<p>內容</p>'"
        base-url="https://uu.nou.edu.tw/media/course/1/index.html"
        :appearance="$state['appearance'] ?? 'light'"
        :font-scale="$state['scale'] ?? 1.0"
        :node-links="[['identifier' => 'N2', 'href' => 'https://uu.nou.edu.tw/media/course/1/n2.html?x=1']]"
        active-node-url="https://uu.nou.edu.tw/media/course/1/index.html"
        :auto-height="$state['autoHeight'] ?? false"
        :estimated-height="$state['estimatedHeight'] ?? null"
        :webview-class="$state['webviewClass'] ?? 'w-full flex-1'"
        @node-link="record('node-link')"
        @subpage-link="record('subpage-link')"
        @tronclass-link="record('tronclass-link')"
        @external-link="record('external-link')"
        @mailto-link="record('mailto-link')"
        @tel-link="record('tel-link')"
        @height="record('height')"
    />
</native:column>
