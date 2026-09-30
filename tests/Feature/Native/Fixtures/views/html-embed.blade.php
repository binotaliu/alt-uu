<native:html-content
    key="embed"
    :embed-url="$state['url']"
    @external-link="record('external-link')"
    @message="record('message')"
    @progress="record('progress')"
/>
