'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Mic, Paperclip, Send, Trash2, Video } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Mirrors the API allowlist so the picker cannot offer a file upload would reject. */
const ACCEPT = {
  photo: 'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif',
  video: 'video/mp4,video/webm,video/quicktime,video/3gpp,video/x-matroska',
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/rtf',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'text/csv',
  ].join(','),
} as const;

type AttachKind = keyof typeof ACCEPT;

/** Matches the server's multer limit; catching it here avoids a wasted upload. */
const MAX_BYTES = 40 * 1024 * 1024;
/** Below this a click on the mic reads as a mis-click, not a voice note. */
const MIN_VOICE_MS = 800;

const ATTACH_OPTIONS: { kind: AttachKind; label: string; Icon: typeof ImageIcon }[] = [
  { kind: 'photo', label: 'Photo', Icon: ImageIcon },
  { kind: 'video', label: 'Video', Icon: Video },
  { kind: 'document', label: 'Document', Icon: FileText },
];

function clock(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

type Props = {
  onSendText: (text: string) => void;
  onSendFile: (file: File, type: 'image' | 'video' | 'file' | 'voice') => void;
  sending?: boolean;
};

export function ChatComposer({ onSendText, onSendFile, sending }: Props) {
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<AttachKind>('photo');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const keepRef = useRef(true);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  // Never leave the mic hot if the thread unmounts mid-recording.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        keepRef.current = false;
        recorder.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const submitText = () => {
    const value = text.trim();
    if (!value || sending) return;
    onSendText(value);
    setText('');
  };

  const pick = (kind: AttachKind) => {
    kindRef.current = kind;
    setMenuOpen(false);
    if (!fileRef.current) return;
    fileRef.current.accept = ACCEPT[kind];
    fileRef.current.value = '';
    fileRef.current.click();
  };

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('That file is over the 40 MB limit.');
      return;
    }
    const kind = kindRef.current;
    onSendFile(file, kind === 'photo' ? 'image' : kind === 'video' ? 'video' : 'file');
  };

  const startRecording = async () => {
    if (sending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Safari has no webm encoder; letting the browser choose keeps it working
      // and the API accepts every type MediaRecorder produces here.
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      keepRef.current = true;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const duration = Date.now() - startedAt.current;
        const chunks = chunksRef.current;
        chunksRef.current = [];
        recorderRef.current = null;
        if (!keepRef.current || !chunks.length) return;
        if (duration < MIN_VOICE_MS) {
          setError('Hold the mic a little longer to record a voice note.');
          return;
        }
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        const extension = type.includes('mp4') ? 'm4a' : 'webm';
        onSendFile(new File([blob], `voice-${Date.now()}.${extension}`, { type }), 'voice');
      };

      recorderRef.current = recorder;
      recorder.start();
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
    } catch {
      setError('Microphone access is needed to record a voice note.');
    }
  };

  const stopRecording = (keep: boolean) => {
    keepRef.current = keep;
    setRecording(false);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const canSend = Boolean(text.trim()) && !sending;

  if (recording) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-card/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:p-4">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-full text-red-400"
          aria-label="Cancel recording"
          onClick={() => stopRecording(false)}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        <div className="flex flex-1 items-center gap-2 px-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="font-semibold tabular-nums">{clock(elapsed)}</span>
          <span className="text-xs text-white/40">Recording…</span>
        </div>
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          aria-label="Send voice note"
          onClick={() => stopRecording(true)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-white/10 bg-card/80 backdrop-blur-md">
      {error && (
        <p className="px-4 pt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitText();
        }}
        className="flex items-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      >
        <input ref={fileRef} type="file" className="hidden" onChange={onFileChosen} />

        <div className="relative shrink-0">
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close attachment menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute bottom-14 left-0 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-card shadow-xl">
                {ATTACH_OPTIONS.map(({ kind, label, Icon }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => pick(kind)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
                  >
                    <Icon className="h-4 w-4 text-brand-pink" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn('h-11 w-11 rounded-full', menuOpen && 'bg-white/10')}
            aria-label="Add attachment"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>

        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="min-h-11 flex-1 rounded-full border-white/10 bg-white/5 px-4"
          autoComplete="off"
        />

        {canSend ? (
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            loading={sending}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-11 w-11 shrink-0 rounded-full"
            aria-label="Record voice note"
            disabled={sending}
            onClick={() => void startRecording()}
          >
            <Mic className="h-5 w-5 text-brand-pink" />
          </Button>
        )}
      </form>
    </div>
  );
}
