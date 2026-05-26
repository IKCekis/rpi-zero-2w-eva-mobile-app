import { NativeModules } from 'react-native';

interface MediaStateNative {
  isMusicActive(): Promise<boolean>;
}

const native: MediaStateNative | null = NativeModules.MediaState ?? null;

export const MediaState = {
  /** True if Android AudioManager reports any STREAM_MUSIC playback. */
  isMusicActive: async (): Promise<boolean> => {
    if (!native) return false;
    try { return await native.isMusicActive(); }
    catch { return false; }
  },
};
