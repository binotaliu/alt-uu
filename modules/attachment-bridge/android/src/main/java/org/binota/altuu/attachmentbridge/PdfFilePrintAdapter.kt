package org.binota.altuu.attachmentbridge

import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException

/** Streams a local PDF to the Android print framework unchanged. */
internal class PdfFilePrintAdapter(
  private val context: Context,
  private val source: Uri,
  private val name: String
) : PrintDocumentAdapter() {
  override fun onLayout(
    oldAttributes: PrintAttributes?,
    newAttributes: PrintAttributes?,
    cancellationSignal: CancellationSignal?,
    callback: LayoutResultCallback,
    extras: Bundle?
  ) {
    if (cancellationSignal?.isCanceled == true) {
      callback.onLayoutCancelled()
      return
    }

    val info = PrintDocumentInfo.Builder(name)
      .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
      .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
      .build()

    callback.onLayoutFinished(info, true)
  }

  override fun onWrite(
    pages: Array<out PageRange>?,
    destination: ParcelFileDescriptor,
    cancellationSignal: CancellationSignal?,
    callback: WriteResultCallback
  ) {
    try {
      val input = context.contentResolver.openInputStream(source)
        ?: throw IOException("無法讀取檔案。")

      input.use { stream ->
        FileOutputStream(destination.fileDescriptor).use { output -> stream.copyTo(output) }
      }

      callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
    } catch (error: IOException) {
      callback.onWriteFailed(error.localizedMessage)
    }
  }
}
