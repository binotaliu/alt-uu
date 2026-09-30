<native:error-retry
    key="error"
    :message="$state['message']"
    :retrying="$state['retrying'] ?? false"
    :detail="$state['detail'] ?? []"
    @retry="record('retry')"
/>
