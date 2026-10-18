import ExpoModulesCore
import QuickLook
import UIKit
import UniformTypeIdentifiers

/// Presents a local file in QuickLook. Must be used on the main thread.
internal final class AttachmentPreviewPresenter: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
  private var previewURL: URL?
  private var stagedDirectory: URL?

  func present(fileURL: URL, mimeType: String?, from presenter: UIViewController) throws {
    var itemURL = fileURL
    var staged: URL?

    // QuickLook picks the renderer from the extension; give extension-less files one from the MIME type.
    if AttachmentFileNaming.fileExtension(of: fileURL.lastPathComponent) == nil,
       let mimeType = AttachmentFileNaming.normalizedMimeType(mimeType),
       let ext = AttachmentFileNaming.preferredExtension(forMimeType: mimeType) {
      itemURL = try stageFile(fileURL, named: "\(fileURL.lastPathComponent).\(ext)", folder: "attachment-preview")
      staged = itemURL.deletingLastPathComponent()
    }

    guard QLPreviewController.canPreview(itemURL as NSURL) else {
      if let staged {
        try? FileManager.default.removeItem(at: staged)
      }
      throw AttachmentBridgeException.noViewer
    }

    cleanUp()
    previewURL = itemURL
    stagedDirectory = staged

    let controller = QLPreviewController()
    controller.dataSource = self
    controller.delegate = self
    presenter.present(controller, animated: true)
  }

  private func cleanUp() {
    if let stagedDirectory {
      try? FileManager.default.removeItem(at: stagedDirectory)
    }

    stagedDirectory = nil
    previewURL = nil
  }

  func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
    previewURL == nil ? 0 : 1
  }

  func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
    (previewURL ?? URL(fileURLWithPath: NSTemporaryDirectory())) as NSURL
  }

  func previewControllerDidDismiss(_ controller: QLPreviewController) {
    cleanUp()
  }
}

/// Exports a local file through the system document picker. Must be used on the main thread.
internal final class AttachmentSavePresenter: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  private var pendingPromise: Promise?
  private var stagedDirectory: URL?

  func present(fileURL: URL, fileName: String, from presenter: UIViewController, promise: Promise) throws {
    guard pendingPromise == nil else {
      throw AttachmentBridgeException.saveInProgress
    }

    var exportURL = fileURL
    var staged: URL?
    let desiredName = AttachmentFileNaming.sanitize(fileName) ?? fileURL.lastPathComponent

    // The picker names the copy after the source file; stage it under the requested name.
    if desiredName != fileURL.lastPathComponent {
      do {
        exportURL = try stageFile(fileURL, named: desiredName, folder: "attachment-export")
        staged = exportURL.deletingLastPathComponent()
      } catch {
        throw AttachmentBridgeException.saveFailed(error.localizedDescription)
      }
    }

    let picker = UIDocumentPickerViewController(forExporting: [exportURL], asCopy: true)
    picker.delegate = self

    pendingPromise = promise
    stagedDirectory = staged

    presenter.present(picker, animated: true)
    picker.presentationController?.delegate = self
  }

  private func finish(saved: Bool) {
    guard let promise = pendingPromise else {
      return
    }

    pendingPromise = nil

    if let stagedDirectory {
      try? FileManager.default.removeItem(at: stagedDirectory)
    }

    stagedDirectory = nil
    promise.resolve(["saved": saved])
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    finish(saved: !urls.isEmpty)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    finish(saved: false)
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    finish(saved: false)
  }
}
