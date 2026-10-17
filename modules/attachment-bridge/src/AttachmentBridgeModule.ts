import { requireNativeModule } from 'expo';

import type { AttachmentBridgeNativeModule } from './AttachmentBridge.types';

export default requireNativeModule<AttachmentBridgeNativeModule>(
    'AltUUAttachmentBridge',
);
