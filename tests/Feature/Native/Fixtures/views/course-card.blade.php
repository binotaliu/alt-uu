@php ($course = new AltUU\Domains\Course\ViewModels\CourseItemViewModel(courseId: '42', name: '資料結構', className: '甲班', courseType: '必修', semester: '114-1'))

<native:course-card
    key="course-42"
    :course="$course"
    :pending-homeworks="$state['pending'] ?? 0"
    :unread-articles="$state['unread'] ?? 0"
    :tasks-loading="$state['loading'] ?? false"
    :tasks-error="$state['error'] ?? false"
    @selected="record('selected')"
/>
