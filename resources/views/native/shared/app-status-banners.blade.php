@use ('App\Icons\Android')
@use ('App\Icons\Ios')

@php
    $severityStyles = [
        'info' => ['container' => 'bg-theme-primary-container border-theme-outline', 'text' => 'text-theme-on-primary-container'],
        'warning' => ['container' => 'bg-theme-warning-container border-theme-warning/40', 'text' => 'text-theme-on-warning-container'],
        'critical' => ['container' => 'bg-theme-destructive-container border-theme-destructive/40', 'text' => 'text-theme-on-destructive-container'],
    ];
@endphp

@if ($update !== null || $announcements !== [])
    <native:column class="w-full gap-2">
        @if ($update !== null)
            <native:row
                class="{{ $severityStyles['info']['container'] }} w-full items-start gap-3 rounded-xl border p-4"
                a11y-label="{{ $update->required ? '請更新至最新版本' : '有新版本可用' }}"
            >
                <native:icon
                    :ios="Ios::ArrowUpCircle"
                    :android="Android::SystemUpdate"
                    :size="22"
                    class="{{ $severityStyles['info']['text'] }}"
                />
                <native:column class="flex-1 gap-1">
                    <native:text
                        class="{{ $severityStyles['info']['text'] }} text-sm font-semibold"
                        >{{ $update->required ? '請更新至最新版本' : '有新版本可用' }}</native:text
                    >
                    <native:text
                        class="{{ $severityStyles['info']['text'] }} text-sm"
                        >{{ $update->required ? "目前的版本已不再支援，請更新至 {$update->latestVersion}。" : "Alt UU {$update->latestVersion} 已推出。" }}</native:text
                    >
                    @if ($update->storeUrl)
                        <native:pressable ref="open-store" @tap="openStore">
                            <native:text
                                class="{{ $severityStyles['info']['text'] }} pt-1 text-sm font-semibold underline"
                                >前往更新</native:text
                            >
                        </native:pressable>
                    @endif
                </native:column>
                @if (! $update->required)
                    <native:pressable
                        ref="dismiss-update"
                        a11y-label="關閉"
                        @tap="dismiss('{{ $update->dismissKey }}')"
                    >
                        <native:icon
                            :ios="Ios::Xmark"
                            :android="Android::Close"
                            :size="20"
                            class="{{ $severityStyles['info']['text'] }}"
                        />
                    </native:pressable>
                @endif
            </native:row>
        @endif

        @foreach ($announcements as $announcement)
            @php ($style = $severityStyles[$announcement->severity] ?? $severityStyles['info'])
            <native:row
                class="{{ $style['container'] }} w-full items-start gap-3 rounded-xl border p-4"
                key="announcement-{{ $announcement->dismissKey }}"
            >
                <native:icon
                    :ios="$announcement->severity === 'info' ? Ios::InfoCircle : ($announcement->severity === 'critical' ? Ios::ExclamationmarkCircle : Ios::ExclamationmarkTriangle)"
                    :android="$announcement->severity === 'info' ? Android::Info : ($announcement->severity === 'critical' ? Android::Error : Android::Warning)"
                    :size="22"
                    class="{{ $style['text'] }}"
                />
                <native:column class="flex-1 gap-1">
                    <native:text
                        class="{{ $style['text'] }} text-sm font-semibold"
                        >{{ $announcement->title }}</native:text
                    >
                    @if ($announcement->body !== '')
                        <native:text
                            class="{{ $style['text'] }} text-sm"
                            >{{ $announcement->body }}</native:text
                        >
                    @endif
                    @if ($announcement->url)
                        <native:pressable
                            ref="open-{{ $announcement->dismissKey }}"
                            @tap="openAnnouncement('{{ $announcement->dismissKey }}')"
                        >
                            <native:text
                                class="{{ $style['text'] }} pt-1 text-sm font-semibold underline"
                                >了解更多</native:text
                            >
                        </native:pressable>
                    @endif
                </native:column>
                @if ($announcement->dismissible)
                    <native:pressable
                        ref="dismiss-{{ $announcement->dismissKey }}"
                        a11y-label="關閉"
                        @tap="dismiss('{{ $announcement->dismissKey }}')"
                    >
                        <native:icon
                            :ios="Ios::Xmark"
                            :android="Android::Close"
                            :size="20"
                            class="{{ $style['text'] }}"
                        />
                    </native:pressable>
                @endif
            </native:row>
        @endforeach
    </native:column>
@else
    {{-- A component must render a root node; an empty column paints nothing. --}}
    <native:column />
@endif
