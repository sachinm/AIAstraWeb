/** What makes a real call possible with no microphone or sound card, in a browser nobody is sitting at. */
export const BASE_FLAGS = [
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-features=WebRtcHideLocalIpsWithMdns',
  // one network interface, so each side has one socket for the relay to answer. This one keeps private addresses.
  '--force-webrtc-ip-handling-policy=default_public_and_private_interfaces',
];
