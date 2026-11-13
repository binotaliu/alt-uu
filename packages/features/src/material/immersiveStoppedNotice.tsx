import { ConfirmDialog } from '@altuu/ui';
import { create } from 'zustand';

interface ImmersiveStoppedNoticeState {
  open: boolean;
  show: () => void;
  dismiss: () => void;
}

/** Survives the navigation from the material page back to the directory that shows the notice. */
export const useImmersiveStoppedNotice = create<ImmersiveStoppedNoticeState>(
  (set) => ({
    open: false,
    show: () => set({ open: true }),
    dismiss: () => set({ open: false }),
  }),
);

/** Why 沉浸式播放 ended on its own after the network switched to mobile data. */
export function ImmersiveStoppedDialog() {
  const open = useImmersiveStoppedNotice((state) => state.open);
  const dismiss = useImmersiveStoppedNotice((state) => state.dismiss);

  return (
    <ConfirmDialog
      isOpen={open}
      title="沉浸式播放已停止"
      message="您已開啟「行動網路播放提醒」，而目前網路已切換為行動網路，繼續播放可能產生非預期的數據費用，因此已停止沉浸式播放。若不希望如此，可以在設定頁面關閉「行動網路播放提醒」。"
      confirmLabel="我知道了"
      cancelLabel="關閉"
      onConfirm={dismiss}
      onCancel={dismiss}
    />
  );
}
