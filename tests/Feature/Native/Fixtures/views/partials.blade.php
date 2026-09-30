<native:column>
    @include ('native.partials.section-header', ['title' => '114-1', 'description' => '本學期'])
    @include ('native.partials.section-card', ['title' => '外觀', 'lines' => [['label' => '主題', 'value' => '暖橘']]])
    @include ('native.partials.course-skeleton', ['groups' => 1, 'cards' => 2])
</native:column>
