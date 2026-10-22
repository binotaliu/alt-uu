import AttachmentBridgeModule from './AttachmentBridgeModule';
import { createAttachmentBridge } from './createAttachmentBridge';

export * from './AttachmentBridge.types';
export {
  createAttachmentBridge,
  createDownloadId,
  type AttachmentBridge,
} from './createAttachmentBridge';
export {
  createAttachmentBridgeError,
  isAttachmentBridgeError,
  type AttachmentBridgeError,
} from './errors';

const attachmentBridge = createAttachmentBridge(AttachmentBridgeModule);

export const {
  setWebViewCookies,
  clearWebViewCookies,
  addDownloadProgressListener,
  startDownload,
  download,
  cancelDownload,
  previewFile,
  saveFile,
  readLegacyNativePhpAppKey,
  fileExists,
  captureVideoFrame,
  getCornerInsets,
  getReservedRegions,
} = attachmentBridge;

export default attachmentBridge;
