'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Video, RotateCcw, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Instruction {
  _id: string;
  text: string;
  category: string;
}

interface CapturedSelfie {
  blob: Blob;
  preview: string;
  instruction: string;
}

interface Props {
  instructions: Instruction[];
  onSubmit: (form: FormData) => void;
  onBack: () => void;
  loading?: boolean;
}

const SELFIE_COUNT = 3;
const MAX_VIDEO_SEC = 15;
const MIN_VIDEO_SEC = 3;

/** Strip codec params so the server accepts `video/webm;codecs=…`. */
function baseMime(type: string, fallback: string) {
  const base = (type || '').split(';')[0].trim().toLowerCase();
  return base || fallback;
}

function blobToFile(blob: Blob, name: string, fallbackMime: string): File {
  return new File([blob], name, { type: baseMime(blob.type, fallbackMime) });
}

function pickRecorderMime(): string {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
    return 'video/webm;codecs=vp8,opus';
  }
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
  if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';
  return '';
}

/** Live camera capture for host identity verification — no file picker. */
export function IdentityLiveCapture({ instructions, onSubmit, onBack, loading }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selfieInstructions = instructions.filter((i) => i.category === 'selfie');
  const videoInstruction =
    instructions.find((i) => i.category === 'video')?.text ??
    "Hold a paper with today's date and say your full name clearly.";

  const getSelfieInstruction = (index: number) =>
    selfieInstructions[index]?.text ??
    ['Look straight into the camera', 'Turn your head to the left', 'Smile naturally'][index] ??
    `Selfie ${index + 1}`;

  const [phase, setPhase] = useState<'selfies' | 'video'>('selfies');
  const [selfieIndex, setSelfieIndex] = useState(0);
  const [selfies, setSelfies] = useState<CapturedSelfie[]>([]);
  const [videoCapture, setVideoCapture] = useState<{ blob: Blob; preview: string } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Keep resolution modest — large webm uploads were crashing the API (connection reset).
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: phase === 'video',
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError('Camera access denied. Please allow camera permission and try again.');
    }
  }, [phase, stopStream]);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const preview = URL.createObjectURL(blob);
        const instruction = getSelfieInstruction(selfieIndex);
        setSelfies((prev) => {
          const next = [...prev];
          if (next[selfieIndex]?.preview) URL.revokeObjectURL(next[selfieIndex].preview);
          next[selfieIndex] = { blob, preview, instruction };
          return next;
        });
        if (selfieIndex < SELFIE_COUNT - 1) {
          setSelfieIndex((i) => i + 1);
        }
      },
      'image/jpeg',
      0.72,
    );
  };

  const retakeSelfie = (index: number) => {
    setSelfies((prev) => {
      prev.slice(index).forEach((s) => URL.revokeObjectURL(s.preview));
      return prev.slice(0, index);
    });
    setSelfieIndex(index);
  };

  const allSelfiesDone = selfies.length === SELFIE_COUNT;

  const goToVideoPhase = () => {
    setPhase('video');
    setVideoCapture(null);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const mimeType = pickRecorderMime();

    try {
      const recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 800_000,
            audioBitsPerSecond: 64_000,
          })
        : new MediaRecorder(stream, {
            videoBitsPerSecond: 800_000,
            audioBitsPerSecond: 64_000,
          });
      recorderRef.current = recorder;
      const blobType = baseMime(recorder.mimeType || mimeType, 'video/webm');
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: blobType });
        const preview = URL.createObjectURL(blob);
        setVideoCapture({ blob, preview });
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_VIDEO_SEC) {
            recorderRef.current?.stop();
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setCameraError('Video recording is not supported in this browser.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const retakeVideo = () => {
    if (videoCapture?.preview) URL.revokeObjectURL(videoCapture.preview);
    setVideoCapture(null);
    setRecordSeconds(0);
  };

  const handleSubmit = () => {
    if (selfies.length < SELFIE_COUNT || !videoCapture) return;
    const form = new FormData();
    selfies.forEach((s, i) => {
      form.append('selfies', blobToFile(s.blob, `live-selfie-${i + 1}.jpg`, 'image/jpeg'));
      form.append('instructions', s.instruction);
    });
    const videoMime = baseMime(videoCapture.blob.type, 'video/webm');
    const videoExt = videoMime.includes('mp4') ? 'mp4' : 'webm';
    form.append(
      'video',
      blobToFile(videoCapture.blob, `live-verification.${videoExt}`, videoMime),
    );
    form.append('videoInstruction', videoInstruction);
    onSubmit(form);
  };

  const currentInstruction =
    phase === 'selfies' ? getSelfieInstruction(selfieIndex) : videoInstruction;

  return (
    <div className="space-y-5">
      {/* Instruction banner */}
      <div className="rounded-2xl border border-brand-pink/30 bg-brand-pink/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          {phase === 'selfies' ? (
            <Camera className="h-4 w-4 text-brand-pink" />
          ) : (
            <Video className="h-4 w-4 text-brand-orange" />
          )}
          {phase === 'selfies'
            ? `Live selfie ${Math.min(selfieIndex + 1, SELFIE_COUNT)} of ${SELFIE_COUNT}`
            : 'Live verification video'}
        </p>
        <p className="mt-2 text-lg font-semibold text-white">{currentInstruction}</p>
        {phase === 'video' && !videoCapture && (
          <p className="mt-1 text-xs text-white/50">
            Record {MIN_VIDEO_SEC}–{MAX_VIDEO_SEC} seconds. Speak clearly and follow the instruction above.
          </p>
        )}
      </div>

      {/* Camera / preview area */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black aspect-[4/3]">
        {cameraError ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera className="h-10 w-10 text-white/30" />
            <p className="text-sm text-red-400">{cameraError}</p>
            <Button size="sm" variant="secondary" onClick={startCamera}>
              Retry camera
            </Button>
          </div>
        ) : phase === 'video' && videoCapture ? (
          <video src={videoCapture.preview} controls className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={phase === 'selfies'}
              className={cn('h-full w-full object-cover', phase === 'selfies' && 'scale-x-[-1]')}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white/60">
                Starting camera…
              </div>
            )}
            {isRecording && (
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-xs font-bold">
                <Circle className="h-2 w-2 animate-pulse fill-white" />
                REC {recordSeconds}s
              </div>
            )}
          </>
        )}
      </div>

      {/* Selfie thumbnails */}
      {phase === 'selfies' && (
        <div className="flex gap-3">
          {Array.from({ length: SELFIE_COUNT }).map((_, i) => {
            const captured = selfies[i];
            return (
              <div
                key={i}
                className={cn(
                  'relative flex-1 overflow-hidden rounded-xl border-2 aspect-square',
                  i === selfieIndex && !allSelfiesDone
                    ? 'border-brand-pink'
                    : captured
                      ? 'border-emerald-500/60'
                      : 'border-white/10',
                )}
              >
                {captured ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={captured.preview} alt={`Selfie ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => retakeSelfie(i)}
                      className="absolute bottom-1 right-1 rounded-md bg-black/60 p-1 text-white/80 hover:text-white"
                      title="Retake"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <Check className="absolute left-1 top-1 h-4 w-4 text-emerald-400 drop-shadow" />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center bg-white/5 text-xs text-white/30">
                    {i + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>

        {phase === 'selfies' && (
          <>
            {!allSelfiesDone ? (
              <Button
                type="button"
                className="flex-1"
                disabled={!cameraReady}
                onClick={captureSelfie}
              >
                <Camera className="h-4 w-4" />
                Capture photo {selfieIndex + 1}
              </Button>
            ) : (
              <Button type="button" className="flex-1" onClick={goToVideoPhase}>
                Continue to live video
              </Button>
            )}
          </>
        )}

        {phase === 'video' && !videoCapture && (
          <>
            {!isRecording ? (
              <Button
                type="button"
                className="flex-1"
                disabled={!cameraReady}
                onClick={startRecording}
              >
                <Video className="h-4 w-4" /> Start recording
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={recordSeconds < MIN_VIDEO_SEC}
                onClick={stopRecording}
              >
                Stop recording {recordSeconds < MIN_VIDEO_SEC ? `(min ${MIN_VIDEO_SEC}s)` : ''}
              </Button>
            )}
          </>
        )}

        {phase === 'video' && videoCapture && (
          <>
            <Button type="button" variant="secondary" onClick={retakeVideo}>
              <RotateCcw className="h-4 w-4" /> Retake video
            </Button>
            <Button type="button" className="flex-1" loading={loading} onClick={handleSubmit}>
              Submit for review
            </Button>
          </>
        )}
      </div>

      {/* All admin instructions reference */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">Verification checklist</p>
        <ul className="mt-2 space-y-1">
          {instructions.map((ins) => (
            <li key={ins._id} className="flex items-center gap-2 text-xs text-white/55">
              <Badge variant="secondary" className="text-[10px]">
                {ins.category}
              </Badge>
              {ins.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
