// リテラル化したので未使用

// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------

//module fmgenAs {
//    /**
//     * ...
//     * @author ALOE
//     */
//    export class FM {
//        // #define
//        static readonly FM_SINEPRESIS: number = 2;            // EGとサイン波の精度の差  0(低)-2(高)
//        static readonly FM_OPSINBITS: number = 10;
//        static readonly FM_OPSINENTS: number = (1 << FM.FM_OPSINBITS);
//        static readonly FM_EGCBITS: number = 18;           // eg の count のシフト値
//        static readonly FM_LFOCBITS: number = 14;
//        static readonly FM_PGBITS: number = 9;
//        static readonly FM_RATIOBITS: number = 7;            // 8-12 くらいまで？
//        static readonly FM_EGBITS: number = 16;
//        static readonly FM_VOLBITS: number = 14;           // fmvolumeのシフト値
//        static readonly FM_VOLENTS: number = (1 << FM.FM_VOLBITS);
//
//        //  定数その１
//        //  静的テーブルのサイズ
//        static readonly FM_LFOBITS: number = 8;                    // 変更不可
//        static readonly FM_TLBITS: number = 7;
//        static readonly FM_TLENTS: number = (1 << FM.FM_TLBITS);
//        static readonly FM_LFOENTS: number = (1 << FM.FM_LFOBITS);
//        static readonly FM_TLPOS: number = (FM.FM_TLENTS / 4);
//
//        //  サイン波の精度は 2^(1/256)
//        static readonly FM_CLENTS: number = (0x1000 * 2);
//        static readonly FM_EG_BOTTOM: number = 955;
//
//        /*
//         * End Class Definition
//         */
//    }
//}
