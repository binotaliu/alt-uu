<?php

declare(strict_types=1);

namespace App\NativeLayouts;

use App\Icons\Android;
use App\Icons\Ios;
use Native\Mobile\Edge\Layouts\Builders\NavBar;
use Native\Mobile\Edge\Layouts\Builders\Tab;
use Native\Mobile\Edge\Layouts\Builders\TabBar;
use Native\Mobile\Edge\Layouts\NativeLayout;
use Native\Mobile\Edge\NativeComponent;

/**
 * The four main tabs (courses, live sessions, school calendar, account),
 * mirroring CoursesBottomNav.vue. Tab screens normally declare their own
 * inline top-bar; the large-title bar here is only the fallback.
 */
final class MainTabsLayout extends NativeLayout
{
    public function usesNativeChrome(): bool
    {
        return true;
    }

    public function navBar(NativeComponent $screen): ?NavBar
    {
        return NavBar::make()
            ->title($screen->navTitle())
            ->displayMode('large')
            ->backgroundColor(theme('background'))
            ->textColor(theme('on-background'));
    }

    public function tabBar(NativeComponent $screen): ?TabBar
    {
        return TabBar::make()
            ->add(Tab::link('我的課程', route('native.courses.index', absolute: false), 'school', Ios::BooksVertical, Android::School)->id('courses'))
            ->add(Tab::link('視訊面授', route('native.courses.live-sessions', absolute: false), 'videocam', Ios::VideoBubble, Android::Videocam)->id('live-sessions'))
            ->add(Tab::link('學校行事曆', route('native.courses.school-calendar', absolute: false), 'event', Ios::Calendar, Android::Event)->id('school-calendar'))
            ->add(Tab::link('我的帳號', route('native.courses.account', absolute: false), 'person', Ios::PersonCircle, Android::AccountCircle)->id('account'))
            ->activeColor(theme('accent'))
            ->backgroundColor(theme('surface'))
            ->textColor(theme('on-surface-variant'));
    }
}
