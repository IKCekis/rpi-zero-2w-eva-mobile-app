// BLE UUIDs — must match Pi's ble_server.py exactly
export const EVA_DEVICE_NAME = 'EVA-001';

export const EVA_SERVICE_UUID     = 'a1f7b540-0f8e-4a64-a027-f21f65ff8c1d';
export const MOOD_CHAR_UUID       = 'a1f7b541-0f8e-4a64-a027-f21f65ff8c1d';
export const PREFS_CHAR_UUID      = 'a1f7b542-0f8e-4a64-a027-f21f65ff8c1d';
export const CMD_CHAR_UUID        = 'a1f7b543-0f8e-4a64-a027-f21f65ff8c1d';
export const STATE_CHAR_UUID      = 'a1f7b544-0f8e-4a64-a027-f21f65ff8c1d';

// RSSI thresholds for proximity
export const RSSI_CLOSE  = -65;   // >  -65 dBm → close
export const RSSI_MEDIUM = -80;   // -80..-65 → medium
                                   // < -80 → far

export const RSSI_POLL_INTERVAL_MS = 2500;
export const FAR_TIMEOUT_MS        = 5000;  // trigger wave after 5s of being far
