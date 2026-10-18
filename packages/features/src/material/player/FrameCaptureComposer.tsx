import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  FRAME_CAPTURE_DISCLAIMER,
  frameCaptureFileName,
  frameInfoLine,
  watermarkPlacements,
} from './frameCapture';
import type { CapturedFrameImage } from './MaterialPlayer';

export interface FrameCaptureJob {
  thumbnail: CapturedFrameImage;
  seconds: number;
  studentId: string;
  courseName: string;
  materialName: string;
}

/** Layout width (dp) the composition is drawn at before scaling to pixels. */
const COMPOSE_WIDTH = 640;

interface PendingCapture {
  job: FrameCaptureJob;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * Port of legacy `CaptureFrame`: the current frame with the student ID
 * tiled at random angles, a dark footer with course · material · time and
 * the fair-use note, written as JPEG and handed to the share sheet.
 *
 * Returns the `capture` function and an element to mount anywhere: the
 * composition renders off-screen only while a capture runs.
 */
export function useFrameCapture(): {
  capture: (job: FrameCaptureJob) => Promise<void>;
  composer: ReactNode;
} {
  const [pending, setPending] = useState<PendingCapture | null>(null);

  const capture = useCallback(
    (job: FrameCaptureJob) =>
      new Promise<void>((resolve, reject) => {
        setPending({ job, resolve, reject });
      }),
    [],
  );

  const composer =
    pending === null ? null : (
      <FrameComposition
        key={`${pending.job.seconds}`}
        job={pending.job}
        onDone={(error) => {
          setPending(null);

          if (error) {
            pending.reject(error);
          } else {
            pending.resolve();
          }
        }}
      />
    );

  return { capture, composer };
}

function FrameComposition({
  job,
  onDone,
}: {
  job: FrameCaptureJob;
  onDone: (error?: Error) => void;
}) {
  const viewRef = useRef<ComponentRef<typeof View>>(null);
  const startedRef = useRef(false);
  const width = COMPOSE_WIDTH;
  const frameHeight = Math.round(
    (width * job.thumbnail.height) / Math.max(1, job.thumbnail.width),
  );
  const footerFont = Math.max(14, width / 55);
  const watermarkFont = Math.max(11, width / 60);
  const labelWidth = job.studentId.length * watermarkFont * 0.62;
  const [placements] = useState(() =>
    watermarkPlacements(width, frameHeight, labelWidth),
  );
  const infoLine = useMemo(
    () => frameInfoLine(job.courseName, job.materialName, job.seconds),
    [job],
  );

  const run = async () => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    try {
      const uri = await captureRef(viewRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
        fileName: frameCaptureFileName(job.materialName, job.seconds),
        width: job.thumbnail.width,
      });

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('無法顯示分享選單');
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
      onDone();
    } catch (error) {
      onDone(
        error instanceof Error && error.message
          ? error
          : new Error('截圖失敗，請稍後再試。'),
      );
    }
  };

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: -(width + 200),
        width,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        ref={viewRef}
        collapsable={false}
        style={{ width, backgroundColor: '#141414' }}
      >
        <View style={{ width, height: frameHeight, overflow: 'hidden' }}>
          <Image
            source={job.thumbnail}
            style={{ width, height: frameHeight }}
            contentFit="fill"
            onDisplay={() => void run()}
            onError={() => onDone(new Error('目前沒有可擷取的影片畫面'))}
          />
          {placements.map((placement, index) => (
            <Text
              key={index}
              style={{
                position: 'absolute',
                left: placement.centerX - labelWidth / 2,
                top: placement.centerY - watermarkFont * 0.7,
                width: labelWidth,
                textAlign: 'center',
                fontSize: watermarkFont,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.22)',
                textShadowColor: 'rgba(0,0,0,0.35)',
                textShadowRadius: watermarkFont * 0.08,
                textShadowOffset: {
                  width: 0,
                  height: watermarkFont * 0.04,
                },
                transform: [{ rotate: `${placement.angle}rad` }],
              }}
              numberOfLines={1}
            >
              {job.studentId}
            </Text>
          ))}
        </View>
        <View style={{ padding: footerFont * 0.8 }}>
          <Text
            style={{
              color: '#ffffff',
              fontSize: footerFont,
              fontWeight: '600',
            }}
          >
            {infoLine}
          </Text>
          <Text
            style={{
              marginTop: footerFont * 0.32,
              color: 'rgba(255,255,255,0.75)',
              fontSize: footerFont * 0.8,
            }}
          >
            {FRAME_CAPTURE_DISCLAIMER}
          </Text>
        </View>
      </View>
    </View>
  );
}
