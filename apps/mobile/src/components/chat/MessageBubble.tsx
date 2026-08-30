import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import { MessageType, type ChatMessage } from '@/types';
import { formatRelative } from '@/utils/format';

type Props = {
  message: ChatMessage;
  isMine?: boolean;
  mine?: boolean;
  onLongPress?: () => void;
};

const MEDIA_TYPES: MessageType[] = [
  MessageType.Image,
  MessageType.Video,
  MessageType.Voice,
  MessageType.File,
];

function attachmentLabel(type: MessageType) {
  if (type === MessageType.Video) return 'Video';
  if (type === MessageType.Voice) return 'Voice message';
  if (type === MessageType.File) return 'File';
  return 'Photo';
}

function attachmentIcon(type: MessageType): keyof typeof Ionicons.glyphMap {
  if (type === MessageType.Video) return 'play-circle';
  if (type === MessageType.Voice) return 'mic';
  if (type === MessageType.File) return 'document-text';
  return 'image';
}

function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function fileSize(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Cloudinary renders a still frame when a video URL is requested as .jpg, which
 * gives us a poster without shipping a video decoder into the message list.
 */
function posterOf(url: string) {
  if (!url.includes('/video/upload/')) return null;
  return url.replace(/\.[a-z0-9]+(\?.*)?$/i, '.jpg');
}

function VoiceMessage({
  url,
  durationSec,
  tint,
  track,
}: {
  url: string;
  durationSec?: number;
  tint: string;
  track: string;
}) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const total = status.duration || durationSec || 0;
  const elapsed = status.playing || status.currentTime > 0 ? status.currentTime : 0;
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (total > 0 && elapsed >= total - 0.2)) {
      player.seekTo(0);
    }
    player.play();
  };

  return (
    <Pressable onPress={toggle} style={styles.voice} accessibilityLabel="Play voice message">
      <Ionicons name={status.playing ? 'pause' : 'play'} size={22} color={tint} />
      <View style={styles.voiceBody}>
        <View style={[styles.voiceTrack, { backgroundColor: track }]}>
          <View
            style={[styles.voiceFill, { backgroundColor: tint, width: `${progress * 100}%` }]}
          />
        </View>
        <Text variant="tiny" color={tint}>
          {clock(elapsed > 0 ? elapsed : total)}
        </Text>
      </View>
    </Pressable>
  );
}

function FileMessage({
  url,
  name,
  bytes,
  tint,
}: {
  url: string;
  name: string;
  bytes?: number;
  tint: string;
}) {
  const size = fileSize(bytes);
  return (
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(url)}
      style={[styles.attachment, { borderColor: tint }]}
    >
      <Ionicons name="document-text" size={22} color={tint} />
      <View style={{ flexShrink: 1 }}>
        <Text variant="captionBold" color={tint} numberOfLines={1}>
          {name}
        </Text>
        <Text variant="tiny" color={tint}>
          {size ? `${size} · tap to open` : 'Tap to open'}
        </Text>
      </View>
    </Pressable>
  );
}

/** Renders the attachment on an image / video / voice / file message. */
function MessageMedia({ message, tint }: { message: ChatMessage; tint: string }) {
  const { width: screenWidth } = useWindowDimensions();
  const [broken, setBroken] = useState(false);
  const [viewing, setViewing] = useState(false);
  const url = message.media?.url;
  if (!url) return null;

  const width = Math.min(248, Math.round(screenWidth * 0.6));
  // Clamp so a very tall or very wide photo still fits the bubble.
  const ratio = message.media?.width && message.media?.height
    ? message.media.width / message.media.height
    : 3 / 4;
  const height = Math.round(width / Math.min(1.8, Math.max(0.6, ratio)));

  if (message.type === MessageType.Voice) {
    return (
      <VoiceMessage
        url={url}
        durationSec={message.media?.durationSec}
        tint={tint}
        track={tint === '#fff' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.14)'}
      />
    );
  }

  if (message.type === MessageType.File) {
    return (
      <FileMessage
        url={url}
        name={message.media?.fileName || 'Document'}
        bytes={message.media?.bytes}
        tint={tint}
      />
    );
  }

  if (message.type === MessageType.Image && !broken) {
    return (
      <>
        <Pressable onPress={() => setViewing(true)}>
          <Image
            source={{ uri: url }}
            style={[styles.photo, { width, height }]}
            resizeMode="cover"
            onError={() => setBroken(true)}
          />
        </Pressable>
        <Modal
          visible={viewing}
          transparent
          animationType="fade"
          onRequestClose={() => setViewing(false)}
        >
          <Pressable style={styles.viewer} onPress={() => setViewing(false)}>
            <Image source={{ uri: url }} style={styles.viewerPhoto} resizeMode="contain" />
          </Pressable>
        </Modal>
      </>
    );
  }

  const poster = message.type === MessageType.Video && !broken ? posterOf(url) : null;
  if (poster) {
    return (
      <Pressable onPress={() => void WebBrowser.openBrowserAsync(url)}>
        <Image
          source={{ uri: poster }}
          style={[styles.photo, { width, height }]}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
        <View style={styles.playBadge}>
          <Ionicons name="play" size={22} color="#fff" />
        </View>
        {message.media?.durationSec ? (
          <Text variant="tiny" style={styles.duration}>
            {clock(message.media.durationSec)}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(url)}
      style={[styles.attachment, { borderColor: tint }]}
    >
      <Ionicons name={attachmentIcon(message.type)} size={18} color={tint} />
      <Text variant="caption" color={tint}>
        {attachmentLabel(message.type)} — tap to open
      </Text>
    </Pressable>
  );
}

export function MessageBubble({ message, isMine, mine, onLongPress }: Props) {
  const c = useThemeColors();
  const mineSide = isMine ?? mine ?? false;

  if (message.deletedAt) {
    return (
      <View style={[styles.row, mineSide && styles.mine]}>
        <Text muted variant="caption" style={styles.deleted}>
          Message deleted
        </Text>
      </View>
    );
  }

  const textColor = mineSide ? '#fff' : c.text;
  const metaColor = mineSide ? 'rgba(255,255,255,0.72)' : c.textMuted;
  const hasMedia = Boolean(message.media?.url);
  const expectsMedia = MEDIA_TYPES.includes(message.type);

  const body = (
    <>
      {hasMedia ? <MessageMedia message={message} tint={textColor} /> : null}
      {!hasMedia && expectsMedia ? (
        <Text color={metaColor}>{attachmentLabel(message.type)} unavailable</Text>
      ) : null}
      {message.text ? (
        <Text color={textColor} style={hasMedia ? { marginTop: 6 } : undefined}>
          {message.text}
        </Text>
      ) : null}
      {!message.text && !hasMedia && message.type === MessageType.Gift ? (
        <Text color={textColor}>🎁 Gift</Text>
      ) : null}
      <Text variant="tiny" style={{ marginTop: 4, color: metaColor }}>
        {formatRelative(message.createdAt)}
      </Text>
    </>
  );

  return (
    <Pressable onLongPress={onLongPress} style={[styles.row, mineSide && styles.mine]}>
      {mineSide ? (
        <LinearGradient
          colors={[...c.gradientSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.mineBubble]}
        >
          {body}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bubble,
            styles.peerBubble,
            { backgroundColor: c.elevated, borderColor: c.border },
          ]}
        >
          {body}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 5, alignItems: 'flex-start' },
  mine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  mineBubble: {
    borderRadius: radius.xl,
    borderBottomRightRadius: 6,
  },
  peerBubble: {
    borderRadius: radius.xl,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deleted: { fontStyle: 'italic', paddingHorizontal: 8 },
  photo: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  playBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 168,
    paddingVertical: 2,
  },
  voiceBody: { flex: 1, gap: 4 },
  voiceTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  voiceFill: { height: 4, borderRadius: 2 },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerPhoto: {
    width: '100%',
    height: '100%',
  },
});
