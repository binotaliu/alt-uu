@php
    use AltUU\Domains\Course\ViewModels\CourseLearningTimeItemViewModel as Item;
    use AltUU\Domains\Course\ViewModels\CourseMaterialNodeViewModel as Node;
    $nodes = [
        new Node(identifier: 'A', href: 'https://x/a', text: '第一章', level: 0),
        new Node(identifier: 'A1', href: 'https://x/a1', text: '影片一', level: 1),
        new Node(identifier: 'A2', href: null, text: '停用項目', level: 1, itemDisabled: true),
        new Node(identifier: 'B', href: null, text: '第二章', level: 0),
        new Node(identifier: 'B1', href: 'https://x/b1', text: '影片二', level: 1),
    ];
    $items = ($state['withDurations'] ?? false)
        ? [new Item('A1', 'https://x/a1', '影片一', 1, false, '10:00')]
        : [];
@endphp

<native:material-directory
    key="directory"
    cid="C1"
    :material-nodes="$nodes"
    :learning-time-items="$items"
    :active-node-identifier="$state['active'] ?? null"
    :last-seen-identifier="$state['lastSeen'] ?? null"
    :last-seen-position-seconds="$state['position'] ?? null"
    :last-seen-duration-seconds="$state['duration'] ?? null"
    :loading="$state['loading'] ?? false"
    :select-mode="$state['mode'] ?? 'event'"
    @node-selected="record('node-selected')"
/>
