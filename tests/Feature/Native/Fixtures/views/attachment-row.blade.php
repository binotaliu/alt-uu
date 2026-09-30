<native:attachment-row
    key="attachment"
    cid="C1"
    filename="講義.pdf"
    href="https://uu.nou.edu.tw/file/1.pdf"
    :confirm="$state['confirm'] ?? false"
    @opened="record('opened')"
    @failed="record('failed')"
/>
