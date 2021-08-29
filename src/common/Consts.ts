export const SEQUENCER_SAMPLE_RATE = 44100;
export const AUDIO_BUFFER_SIZE = 8192;

export const MsgTypes = {
    BOOT     :  1, // Main->Worker
    PLAY     :  2, // Main->Worker
    STOP     :  3, // Main->Worker
    PAUSE    :  4, // Main->Worker
    BUFFER   :  5, // Main->Worker->Main
    COMPCOMP :  6, // Worker->Main
    BUFRING  :  7, // Worker->Main
    COMPLETE :  8, // Worker->Main
    SYNCINFO :  9, // Main->Worker->Main
    PLAYSOUND: 10, // Worker->Main
    STOPSOUND: 11  // Worker->Main->Worker
} as const;
