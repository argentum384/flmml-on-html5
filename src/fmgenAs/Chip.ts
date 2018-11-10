// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------

/// <reference path="JaggArray.ts" />

module fmgenAs {
    /**
     * ...
     * @author ALOE
     */

    var dt2lv: Array<number> = [
        1.0, 1.414, 1.581, 1.732
    ];

    export class Chip {
        private ratio_: number = 0;
        aml_: number = 0; // ←
        pml_: number = 0; // ←最適化のためにpublicにしてしまう
        pmv_: number = 0; // ←
        private multable_: Array<Array<number>> = JaggArray.I2(4, 16);

        Chip() {
            this.MakeTable();
        }

        SetRatio(ratio: number): void {
            if (this.ratio_ !== ratio) {
                this.ratio_ = ratio;
                this.MakeTable();
            }
        }
        SetAML(l: number): void {
            this.aml_ = l & (/*FM.FM_LFOENTS*/256 - 1);
        }
        SetPML(l: number): void {
            this.pml_ = l & (/*FM.FM_LFOENTS*/256 - 1);
        }
        SetPMV(pmv: number): void {
            this.pmv_ = pmv;
        }

        GetMulValue(dt2: number, mul: number): number {
            return this.multable_[dt2][mul];
        }

        GetAML(): number {
            return this.aml_;
        }

        GetPML(): number {
            return this.pml_;
        }

        GetPMV(): number {
            return this.pmv_;
        }

        GetRatio(): number {
            return this.ratio_;
        }

        private MakeTable(): void {
            var h: number, l: number;

            // PG Part
            for (h = 0; h < 4; h++) {
                var rr: number = dt2lv[h] * this.ratio_ / (1 << (2 + /*FM.FM_RATIOBITS*/7 - /*FM.FM_PGBITS*/9));
                for (l = 0; l < 16; l++) {
                    var mul: number = (l !== 0) ? l * 2 : 1;
                    this.multable_[h][l] = (mul * rr) | 0;
                }
            }
        }

        /*
         * End Class Definition
         */
    }
}
