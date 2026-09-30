@use ('App\Icons\Android')
@use ('App\Icons\Ios')

{{--
    One service row. Include with: @include('native.settings.connectivity-row', ['row' => $row])
--}}
<native:row
    class="bg-theme-surface border-theme-outline-variant w-full items-center gap-3 rounded-xl border p-4"
>
    <native:column class="flex-1 gap-1">
        <native:text
            class="text-theme-on-surface text-sm font-semibold"
            >{{ $row['label'] }}</native:text
        >
        <native:text
            class="text-theme-on-surface-variant text-xs"
            max-lines="2"
        >
            @if ($row['status'] === 'pending') 尚未執行檢查@elseif ($row['status'] === 'checking') 檢查中…@elseif ($row['reachable']) 回應時間{{ $row['latencyMs'] }}ms（狀態碼{{ $row['statusCode'] }}）@else {{ $row['error'] ?? '無法連線（狀態碼 '.($row['statusCode'] ?? '無回應').'）' }}@endif
        </native:text>
    </native:column>

    @if ($row['status'] === 'checking')
        <native:activity-indicator />
    @elseif ($row['status'] === 'done' && $row['reachable'])
        <native:icon
            :ios="Ios::CheckmarkCircle"
            :android="Android::CheckCircle"
            :size="24"
            class="text-theme-success"
        />
    @elseif ($row['status'] === 'done')
        <native:icon
            :ios="Ios::XmarkCircle"
            :android="Android::Cancel"
            :size="24"
            class="text-theme-destructive"
        />
    @endif
</native:row>
