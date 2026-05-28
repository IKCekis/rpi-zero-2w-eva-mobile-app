// OLED face/animation catalog sent to the Pi over BLE as { cmd: 'face', anim }.
// The Pi firmware (separate repo) is responsible for rendering these on its OLED.
// The mobile app only emits the commands at the right moments.

export type FaceAnim =
  | 'idle'
  | 'happy'
  | 'sad'
  | 'dance'          // music playing
  | 'whistle'        // music playing (alt)
  | 'cinema_glasses' // watching a movie
  | 'popcorn'        // watching a movie (eating)
  | 'cook'           // cooking in the kitchen
  | 'eat'            // eating food
  | 'workout'        // gym
  | 'sleep'          // bedroom / resting
  | 'wash'           // cleaning
  | 'play';          // mini-games

export const FACE_ANIMS: Record<FaceAnim, FaceAnim> = {
  idle: 'idle', happy: 'happy', sad: 'sad', dance: 'dance', whistle: 'whistle',
  cinema_glasses: 'cinema_glasses', popcorn: 'popcorn', cook: 'cook', eat: 'eat',
  workout: 'workout', sleep: 'sleep', wash: 'wash', play: 'play',
};
