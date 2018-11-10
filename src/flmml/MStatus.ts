// 定数化したので未使用

// 戻すときは正規表現使用の置換で
// /\*MStatus\.(.*)\*/[0-9]*
//  ↓
// MStatus.$1

//module flmml {
//    export class MStatus {
//        static EOT: number = 0;
//        static NOP: number = 1;
//        static NOTE_ON: number = 2;
//        static NOTE_OFF: number = 3;
//        static TEMPO: number = 4;
//        static VOLUME: number = 5;
//        static NOTE: number = 6;
//        static FORM: number = 7;
//        static ENVELOPE1_ATK: number = 8;
//        static ENVELOPE1_ADD: number = 9;
//        static ENVELOPE1_REL: number = 10;
//        static NOISE_FREQ: number = 11;
//        static PWM: number = 12;
//        static PAN: number = 13;
//        static FORMANT: number = 14;
//        static DETUNE: number = 15;
//        static LFO_FMSF: number = 16;
//        static LFO_DPWD: number = 17;
//        static LFO_DLTM: number = 18;
//        static LFO_TARGET: number = 19;
//        static LPF_SWTAMT: number = 20;
//        static LPF_FRQRES: number = 21;
//        static CLOSE: number = 22;
//        static VOL_MODE: number = 23;
//        static ENVELOPE2_ATK: number = 24;
//        static ENVELOPE2_ADD: number = 25;
//        static ENVELOPE2_REL: number = 26;
//        static INPUT: number = 27;
//        static OUTPUT: number = 28;
//        static EXPRESSION: number = 29;
//        static RINGMODULATE: number = 30;
//        static SYNC: number = 31;
//        static PORTAMENTO: number = 32;
//        static MIDIPORT: number = 33;
//        static MIDIPORTRATE: number = 34;
//        static BASENOTE: number = 35;
//        static POLY: number = 36;
//        static SOUND_OFF: number = 37;
//        static RESET_ALL: number = 38;
//        static HW_LFO: number = 39;
//    }
//}
