export const SAMPLE_RATE = 44100;

export const MsgTypes = {
    BOOT     :  1, // Main->Worker
    PLAY     :  2, // Main->Worker
    STOP     :  3, // Main->Worker
    PAUSE    :  4, // Main->Worker
//  BUFFER   :  5, // Main->Worker->Main (Not used)
    COMPCOMP :  6, // Worker->Main
    BUFRING  :  7, // Worker->Main
    COMPLETE :  8, // Worker->Main
    SYNCINFO :  9, // Main->Worker->Main
    PLAYSOUND: 10, // Worker->Main->Worker
    STOPSOUND: 11, // Worker->Main->Worker
    EXPORT   : 12  // Main->Worker->Main
} as const;
