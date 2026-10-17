package org.binota.altuu.attachmentbridge

import androidx.core.content.FileProvider

/**
 * Own subclass so the manifest entry never clashes with other libraries' FileProviders.
 * Authority: `${applicationId}.AltUUAttachmentBridgeFileProvider`.
 */
class AttachmentBridgeFileProvider : FileProvider()
