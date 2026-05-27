export type Mood = 'happy' | 'sleepy' | 'sad' | 'excited' | 'hungry';
export type TabName = 'home' | 'world' | 'inventory' | 'profile';
export type SceneName = 'bedroom' | 'restaurant' | 'kitchen' | 'playground'
                      | 'market' | 'gym' | 'cafe' | 'cinema';
export type BLEStatus = 'off' | 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'pin_required';
export type Proximity = 'close' | 'medium' | 'far';

export interface Stats {
  hunger:    number;
  happiness: number;
  energy:    number;
  clean:     number;
  health:    number;
}

export interface Prefs {
  petName:        string;
  likesCooking:   boolean | null;
  cinemaSleepy:   boolean | null;
  likesExercise:  boolean | null;
  likesShopping:  boolean | null;
  pairedAt:       number | null;
  deviceId:       string;
}

export interface CookedDish {
  id:        string;
  name:      string;
  sprite:    string;
  hunger:    number;
  happiness: number;
}
