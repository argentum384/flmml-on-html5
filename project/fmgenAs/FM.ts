// ---------------------------------------------------------------------------
//	FM Sound Generator - Core Unit
//	Copyright (C) cisc 1998, 2003.
//	Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------

/// <reference path="JaggArray.ts" />

module FlMMLWorker.fmgenAs {
	/**
	 * ...
	 * @author ALOE
	 */
    export class FM {
        // #define
        static FM_SINEPRESIS: number = 2;            // EGとサイン波の精度の差  0(低)-2(高)
        static FM_OPSINBITS: number = 10;
        static FM_OPSINENTS: number = (1 << FM.FM_OPSINBITS);
        static FM_EGCBITS: number = 18;           // eg の count のシフト値
        static FM_LFOCBITS: number = 14;
        static FM_PGBITS: number = 9;
        static FM_RATIOBITS: number = 7;            // 8-12 くらいまで？
        static FM_EGBITS: number = 16;
        static FM_VOLBITS: number = 14;           // fmvolumeのシフト値
        static FM_VOLENTS: number = (1 << FM.FM_VOLBITS);
		
        //  定数その１
        //  静的テーブルのサイズ
        static FM_LFOBITS: number = 8;                    // 変更不可
        static FM_TLBITS: number = 7;
        static FM_TLENTS: number = (1 << FM.FM_TLBITS);
        static FM_LFOENTS: number = (1 << FM.FM_LFOBITS);
        static FM_TLPOS: number = (FM.FM_TLENTS / 4);

        //  サイン波の精度は 2^(1/256)
        static FM_CLENTS: number = (0x1000 * 2);
        static FM_EG_BOTTOM: number = 955;

        static pmtable: Array<Array<Array<number>>> = JaggArray.I3(2, 8, FM.FM_LFOENTS);
        static amtable: Array<Array<Array<number>>> = JaggArray.I3(2, 8, FM.FM_LFOENTS);

        private static tablemade: Boolean = false;

        static MakeLFOTable(): void {
            var i: number;
            var j: number;

            if (FM.tablemade)
                return;

            var pms: Array<Array<number>> = [
                [0, 1 / 360.0, 2 / 360.0, 3 / 360.0, 4 / 360.0, 6 / 360.0, 12 / 360.0, 24 / 360.0, ], // OPNA
                //      [ 0, 1/240.0, 2/240.0, 4/240.0, 10/240.0, 20/240.0, 80/240.0, 140/240.0, ], // OPM
                [0, 1 / 480.0, 2 / 480.0, 4 / 480.0, 10 / 480.0, 20 / 480.0, 80 / 480.0, 140 / 480.0, ], // OPM
                //      [ 0, 1/960.0, 2/960.0, 4/960.0, 10/960.0, 20/960.0, 80/960.0, 140/960.0, ], // OPM
            ];
            //       3       6,      12      30       60       240      420     / 720
            //  1.000963
            //  lfofref[level * max * wave];
            //  pre = lfofref[level][pms * wave >> 8];
            var amt: Array<Array<number>> = [
                [31, 6, 4, 3], // OPNA
                [31, 2, 1, 0], // OPM
            ];

            for (var type: number = 0; type < 2; type++) {
                for (i = 0; i < 8; i++) {
                    var pmb: number = pms[type][i];
                    for (j = 0; j < FM.FM_LFOENTS; j++) {
                        var v: number = Math.pow(2.0, pmb * (2 * j - FM.FM_LFOENTS + 1) / (FM.FM_LFOENTS - 1));
                        var w: number = 0.6 * pmb * Math.sin(2 * j * Math.PI / FM.FM_LFOENTS) + 1;
                        FM.pmtable[type][i][j] = (0x10000 * (w - 1)) | 0;
                    }
                }
                for (i = 0; i < 4; i++) {
                    for (j = 0; j < FM.FM_LFOENTS; j++) {
                        FM.amtable[type][i][j] = (((j * 4) >> amt[type][i]) * 2) << 2;
                    }
                }
            }

            FM.tablemade = true;
        }		
		
        /*
         * End Class Definition
         */
    }
}  