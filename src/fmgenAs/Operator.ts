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
    export class Operator {
        chip_: Chip = null;
        out_: number;
        out2_: number;
        in2_: number;

        //  Phase Generator ------------------------------------------------------
        private dp_: number;                       // ΔP
        private detune_: number;                   // Detune
        private detune2_: number;                  // DT2
        private multiple_: number;                 // Multiple
        pg_count_: number;                 // Phase 現在値
        pg_diff_: number;                  // Phase 差分値
        pg_diff_lfo_: number;              // Phase 差分値 >> x

        //  Envelop Generator ---------------------------------------------------
        type_: number/*OpType*/;           // OP の種類 (M, N...)
        bn_: number;                       // Block/Note
        eg_level_: number;                 // EG の出力値
        eg_level_on_next_phase_: number;   // 次の eg_phase_ に移る値
        eg_count_: number;                 // EG の次の変移までの時間
        eg_count_diff_: number;            // eg_count_ の差分
        eg_out_: number;                   // EG+TL を合わせた出力値
        tl_out_: number;                   // TL 分の出力値
        eg_rate_: number;
        eg_curve_count_: number;
        ssg_offset_: number;
        ssg_vector_: number;
        ssg_phase_: number;

        key_scale_rate_: number;           // key scale rate
        eg_phase_: number/*EGPhase*/;
        ams_: Array<number>;
        ms_: number;

        private tl_: number;                       // Total Level   (0-127)
        private tl_latch_: number;                 // Total Level Latch (for CSM mode)
        private ar_: number;                       // Attack Rate   (0-63)
        private dr_: number;                       // Decay Rate    (0-63)
        private sr_: number;                       // Sustain Rate  (0-63)
        private sl_: number;                       // Sustain Level (0-127)
        private rr_: number;                       // Release Rate  (0-63)
        private ks_: number;                       // Keyscale      (0-3)
        private ssg_type_: number;                 // SSG-Type Envelop Control

        private keyon_: boolean;
        amon_: boolean;                         // enable Amplitude Modulation
        private param_changed_: boolean;        // パラメータが更新された
        private mute_: boolean;

        private static notetable: Array<number>/*[128]*/ = [
             0,  0,  0,  0,  0,  0,  0,  1,  2,  3,  3,  3,  3,  3,  3,  3, 
             4,  4,  4,  4,  4,  4,  4,  5,  6,  7,  7,  7,  7,  7,  7,  7, 
             8,  8,  8,  8,  8,  8,  8,  9, 10, 11, 11, 11, 11, 11, 11, 11,
            12, 12, 12, 12, 12, 12, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15,
            16, 16, 16, 16, 16, 16, 16, 17, 18, 19, 19, 19, 19, 19, 19, 19,
            20, 20, 20, 20, 20, 20, 20, 21, 22, 23, 23, 23, 23, 23, 23, 23,
            24, 24, 24, 24, 24, 24, 24, 25, 26, 27, 27, 27, 27, 27, 27, 27,
            28, 28, 28, 28, 28, 28, 28, 29, 30, 31, 31, 31, 31, 31, 31, 31
        ];

        private static dttable: Array<number>/*[256]*/ = [
              0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  
              0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  
              0,   0,   0,   0,   2,   2,   2,   2,   2,   2,   2,   2,   4,   4,   4,   4,  
              4,   6,   6,   6,   8,   8,   8,  10,  10,  12,  12,  14,  16,  16,  16,  16, 
              2,   2,   2,   2,   4,   4,   4,   4,   4,   6,   6,   6,   8,   8,   8,  10, 
             10,  12,  12,  14,  16,  16,  18,  20,  22,  24,  26,  28,  32,  32,  32,  32, 
              4,   4,   4,   4,   4,   6,   6,   6,   8,   8,   8,  10,  10,  12,  12,  14, 
             16,  16,  18,  20,  22,  24,  26,  28,  32,  34,  38,  40,  44,  44,  44,  44, 
              0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  
              0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  
              0,   0,   0,   0,  -2,  -2,  -2,  -2,  -2,  -2,  -2,  -2,  -4,  -4,  -4,  -4, 
             -4,  -6,  -6,  -6,  -8,  -8,  -8, -10, -10, -12, -12, -14, -16, -16, -16, -16,
             -2,  -2,  -2,  -2,  -4,  -4,  -4,  -4,  -4,  -6,  -6,  -6,  -8,  -8,  -8, -10,
            -10, -12, -12, -14, -16, -16, -18, -20, -22, -24, -26, -28, -32, -32, -32, -32,
             -4,  -4,  -4,  -4,  -4,  -6,  -6,  -6,  -8,  -8,  -8, -10, -10, -12, -12, -14,
            -16, -16, -18, -20, -22, -24, -26, -28, -32, -34, -38, -40, -44, -44, -44, -44
        ];

        static decaytable1: Array<Array<number>>/*[64][8]*/ = [
            [ 0,  0,  0,  0,  0,  0,  0,  0], [ 0,  0,  0,  0,  0,  0,  0,  0], 
            [ 1,  1,  1,  1,  1,  1,  1,  1], [ 1,  1,  1,  1,  1,  1,  1,  1], 
            [ 1,  1,  1,  1,  1,  1,  1,  1], [ 1,  1,  1,  1,  1,  1,  1,  1], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  0,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  0,  1,  0,  1,  0,  1,  0], [ 1,  1,  1,  0,  1,  0,  1,  0], 
            [ 1,  1,  1,  0,  1,  1,  1,  0], [ 1,  1,  1,  1,  1,  1,  1,  0], 
            [ 1,  1,  1,  1,  1,  1,  1,  1], [ 2,  1,  1,  1,  2,  1,  1,  1], 
            [ 2,  1,  2,  1,  2,  1,  2,  1], [ 2,  2,  2,  1,  2,  2,  2,  1], 
            [ 2,  2,  2,  2,  2,  2,  2,  2], [ 4,  2,  2,  2,  4,  2,  2,  2], 
            [ 4,  2,  4,  2,  4,  2,  4,  2], [ 4,  4,  4,  2,  4,  4,  4,  2], 
            [ 4,  4,  4,  4,  4,  4,  4,  4], [ 8,  4,  4,  4,  8,  4,  4,  4], 
            [ 8,  4,  8,  4,  8,  4,  8,  4], [ 8,  8,  8,  4,  8,  8,  8,  4], 
            [16, 16, 16, 16, 16, 16, 16, 16], [16, 16, 16, 16, 16, 16, 16, 16],
            [16, 16, 16, 16, 16, 16, 16, 16], [16, 16, 16, 16, 16, 16, 16, 16]
        ];

        private static decaytable2: Array<number>/*[16]*/ = [
            1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2047, 2047, 2047, 2047, 2047
        ];

        static attacktable: Array<Array<number>>/*[64][8]*/ = [
            [-1, -1, -1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1, -1, -1], 
            [ 4,  4,  4,  4,  4,  4,  4,  4], [ 4,  4,  4,  4,  4,  4,  4,  4], 
            [ 4,  4,  4,  4,  4,  4,  4,  4], [ 4,  4,  4,  4,  4,  4,  4,  4], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4, -1,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4, -1,  4, -1,  4, -1,  4, -1], [ 4,  4,  4, -1,  4, -1,  4, -1], 
            [ 4,  4,  4, -1,  4,  4,  4, -1], [ 4,  4,  4,  4,  4,  4,  4, -1], 
            [ 4,  4,  4,  4,  4,  4,  4,  4], [ 3,  4,  4,  4,  3,  4,  4,  4], 
            [ 3,  4,  3,  4,  3,  4,  3,  4], [ 3,  3,  3,  4,  3,  3,  3,  4], 
            [ 3,  3,  3,  3,  3,  3,  3,  3], [ 2,  3,  3,  3,  2,  3,  3,  3], 
            [ 2,  3,  2,  3,  2,  3,  2,  3], [ 2,  2,  2,  3,  2,  2,  2,  3], 
            [ 2,  2,  2,  2,  2,  2,  2,  2], [ 1,  2,  2,  2,  1,  2,  2,  2], 
            [ 1,  2,  1,  2,  1,  2,  1,  2], [ 1,  1,  1,  2,  1,  1,  1,  2], 
            [ 0,  0,  0,  0,  0,  0,  0,  0], [ 0,  0,  0,  0,  0,  0,  0,  0], 
            [ 0,  0,  0,  0,  0,  0,  0,  0], [ 0,  0,  0,  0,  0,  0,  0,  0]
        ];

        private static ssgenvtable: Array<Array<Array<Array<number>>>>/*[8][2][3][2]*/ = [
            [[[1,  1], [1,  1], [1,  1]],  // 08 
             [[0,  1], [1,  1], [1,  1]]], // 08 56~
            [[[0,  1], [2,  0], [2,  0]],  // 09
             [[0,  1], [2,  0], [2,  0]]], // 09
            [[[1, -1], [0,  1], [1, -1]],  // 10
             [[0,  1], [1, -1], [0,  1]]], // 10 60~
            [[[1, -1], [0,  0], [0,  0]],  // 11
             [[0,  1], [0,  0], [0,  0]]], // 11 60~
            [[[2, -1], [2, -1], [2, -1]],  // 12
             [[1, -1], [2, -1], [2, -1]]], // 12 56~
            [[[1, -1], [0,  0], [0,  0]],  // 13
             [[1, -1], [0,  0], [0,  0]]], // 13
            [[[0,  1], [1, -1], [0,  1]],  // 14
             [[1, -1], [0,  1], [1, -1]]], // 14 60~
            [[[0,  1], [2,  0], [2,  0]],  // 15
             [[1, -1], [2,  0], [2,  0]]]  // 15 60~
        ];
        
        // サインテーブルの作成
        static sinetable: Array<number> = (() => {
            var sinetable: Array<number> = [];
            var log2: number = Math.log(2.0);
            for (var i = 0; i < /*FM.FM_OPSINENTS*/1024 / 2; i++) {
                var r: number = (i * 2 + 1) * Math.PI / /*FM.FM_OPSINENTS*/1024;
                var q: number = -256 * Math.log(Math.sin(r)) / log2;
                var s: number = Math.floor(q + 0.5) + 1;
                sinetable[i] = s * 2;
                sinetable[/*FM.FM_OPSINENTS*/1024 / 2 + i | 0] = s * 2 + 1;
            }
            return sinetable;
        })();
        
        // 対数テーブルの作成
        static cltable: Array<number> = (() => {
            var cltable: Array<number> = [];
            var i: number, j: number;
            for (i = 0, j = 0; i < 256; i++) {
                var v: number = Math.floor(Math.pow(2.0, 13.0 - i / 256.0));
                v = (v + 2) & ~3;
                cltable[j++] = v;
                cltable[j++] = -v;
            }
            i = j;
            while (j < /*FM.FM_CLENTS*/8192) {
                cltable[j++] = cltable[i++ - 512] / 2 | 0;
            }
            return cltable;
        })();

        static amtable: Array<Array<Array<number>>> = (() => {
            var amtable: Array<Array<Array<number>>> = JaggArray.I3(2, 8, /*FM.FM_LFOENTS*/256);
            var i: number, j: number;
            var amt: Array<Array<number>> = [
                [31, 6, 4, 3], // OPNA
                [31, 2, 1, 0], // OPM
            ];
            for (var type: number = 0; type < 2; type++) {
                for (i = 0; i < 4; i++) {
                    for (j = 0; j < /*FM.FM_LFOENTS*/256; j++) {
                        amtable[type][i][j] = (((j * 4) >> amt[type][i]) * 2) << 2;
                    }
                }
            }
            return amtable;
        })();

        constructor() {
            // EG Part
            this.ar_ = this.dr_ = this.sr_ = this.rr_ = this.key_scale_rate_ = 0;
            this.ams_ = Operator.amtable[0][0];
            this.mute_ = false;
            this.keyon_ = false;
            this.tl_out_ = 0;
            this.ssg_type_ = 0;
            // PG Part
            this.multiple_ = 0;
            this.detune_ = 0;
            this.detune2_ = 0;
            // LFO
            this.ms_ = 0;
        }

        SetChip(chip: Chip): void {
            this.chip_ = chip;
        }

        Reset(): void {
            // EG part
            this.tl_ = this.tl_latch_ = 127;
            this.ShiftPhase(EGPhase.off);
            this.eg_count_ = 0;
            this.eg_curve_count_ = 0;
            this.ssg_phase_ = 0;
            // PG part
            this.pg_count_ = 0;
            // OP part
            this.out_ = this.out2_ = 0;
            this.param_changed_ = true;
        }

        SetDPBN(dp: number, bn: number): void {
            this.dp_ = dp;
            this.bn_ = bn;
            this.param_changed_ = true;
        }
        
        //  準備
        Prepare(): void {
            if (this.param_changed_ === false) {
                return;
            }
            this.param_changed_ = false;
            //  PG Part
            this.pg_diff_ = ((this.dp_ + Operator.dttable[this.detune_ + this.bn_]) * this.chip_.GetMulValue(this.detune2_, this.multiple_));
            this.pg_diff_lfo_ = this.pg_diff_ >> 11;

            // EG Part
            this.key_scale_rate_ = this.bn_ >> (3 - this.ks_);
            this.tl_out_ = this.mute_ ? 0x3ff : this.tl_ * 8;

            switch (this.eg_phase_) {
                case EGPhase.attack:
                    this.SetEGRate(this.ar_ !== 0 ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
                    break;
                case EGPhase.decay:
                    this.SetEGRate(this.dr_ !== 0 ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0);
                    this.eg_level_on_next_phase_ = this.sl_ * 8;
                    break;
                case EGPhase.sustain:
                    this.SetEGRate(this.sr_ !== 0 ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
                    break;
                case EGPhase.release:
                    this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
                    break;
            }

            // SSG-EG
            if (this.ssg_type_ !== 0 && (this.eg_phase_ !== EGPhase.release)) {
                var m: number = (this.ar_ >= ((this.ssg_type_ === 8 || this.ssg_type_ === 12) ? 56 : 60)) ? 1 : 0;
                this.ssg_offset_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][0] * 0x200;
                this.ssg_vector_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][1];
            }
            // LFO
            this.ams_ = Operator.amtable[this.type_ | 0][this.amon_ ? (this.ms_ >> 4) & 3 : 0];

            this.EGUpdate();
        }       
        
        //  envelop の eg_phase_ 変更
        ShiftPhase(nextphase: number/*EGPhase*/): void {
            switch (nextphase) {
                case EGPhase.attack:        // Attack Phase
                    this.tl_ = this.tl_latch_;
                    if (this.ssg_type_ !== 0) {
                        this.ssg_phase_ = this.ssg_phase_ + 1;
                        if (this.ssg_phase_ > 2)
                            this.ssg_phase_ = 1;

                        var m: number = (this.ar_ >= ((this.ssg_type_ === 8 || this.ssg_type_ === 12) ? 56 : 60)) ? 1 : 0;

                        this.ssg_offset_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][0] * 0x200;
                        this.ssg_vector_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][1];
                    }
                    if ((this.ar_ + this.key_scale_rate_) < 62) {
                        this.SetEGRate(this.ar_ !== 0 ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
                        this.eg_phase_ = EGPhase.attack;
                        break;
                    }
                // C#               goto case EGPhase.decay;
                case EGPhase.decay:         // Decay Phase
                    if (this.sl_ !== 0) {
                        this.eg_level_ = 0;
                        this.eg_level_on_next_phase_ = ((this.ssg_type_ !== 0) ? Math.min(this.sl_ * 8, 0x200) : this.sl_ * 8);

                        this.SetEGRate(this.dr_ !== 0 ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0);
                        this.eg_phase_ = EGPhase.decay;
                        break;
                    }
                // C#               goto case EGPhase.sustain;
                case EGPhase.sustain:       // Sustain Phase
                    this.eg_level_ = this.sl_ * 8;
                    this.eg_level_on_next_phase_ = (this.ssg_type_ !== 0) ? 0x200 : 0x400;

                    this.SetEGRate(this.sr_ !== 0 ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
                    this.eg_phase_ = EGPhase.sustain;
                    break;
                case EGPhase.release:       // Release Phase
                    if (this.ssg_type_ !== 0) {
                        this.eg_level_ = this.eg_level_ * this.ssg_vector_ + this.ssg_offset_;
                        this.ssg_vector_ = 1;
                        this.ssg_offset_ = 0;
                    }
                    if (this.eg_phase_ === EGPhase.attack || (this.eg_level_ < /*FM.FM_EG_BOTTOM*/955)) {
                        this.eg_level_on_next_phase_ = 0x400;
                        this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
                        this.eg_phase_ = EGPhase.release;
                        break;
                    }
                // C#               goto case EGPhase.off;
                case EGPhase.off:           // off
                default:
                    this.eg_level_ = /*FM.FM_EG_BOTTOM*/955;
                    this.eg_level_on_next_phase_ = /*FM.FM_EG_BOTTOM*/955;
                    this.EGUpdate();
                    this.SetEGRate(0);
                    this.eg_phase_ = EGPhase.off;
                    break;
            }
        }       
    
        //  Block/F-Num
        SetFNum(f: number): void {
            this.dp_ = (f & 2047) << ((f >> 11) & 7);
            this.bn_ = Operator.notetable[(f >> 7) & 127];
            this.param_changed_ = true;
        }       
        
        //  １サンプル合成

        //  ISample を envelop count (2π) に変換するシフト量   
        static IS2EC_SHIFT: number = ((20 + /*FM.FM_PGBITS*/9) - 13);

        private SINE(s: number): number {
            return Operator.sinetable[(s) & (/*FM.FM_OPSINENTS*/1024 - 1)];
        }
        private LogToLin(a: number): number {
            return (a < /*FM.FM_CLENTS*/8192) ? Operator.cltable[a] : 0;
        }

        private EGUpdate(): void {
            //var a: number;
            //if (this.ssg_type_ === 0) a = this.tl_out_ + this.eg_level_;
            //else a = this.tl_out_ + this.eg_level_ * this.ssg_vector_ + this.ssg_offset_;
            var a: number = (this.ssg_type_ === 0) ? this.tl_out_ + this.eg_level_ : this.tl_out_ + this.eg_level_ * this.ssg_vector_ + this.ssg_offset_;
            //if (a < 0x3ff) this.eg_out_ = a << (1 + 2);
            //else this.eg_out_ = 0x3ff << (1 + 2);
            this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
        }

        private SetEGRate(rate: number): void {
            this.eg_rate_ = rate;
            this.eg_count_diff_ = Operator.decaytable2[(rate / 4) | 0] * this.chip_.GetRatio();
        }       

        //  EG 計算
        private EGCalc(): void {
            this.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;              // ##この手抜きは再現性を低下させる

            if (this.eg_phase_ === EGPhase.attack) {
                var c: number = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                if (c >= 0) {
                    this.eg_level_ -= 1 + (this.eg_level_ >> c);
                    if (this.eg_level_ <= 0)
                        this.ShiftPhase(EGPhase.decay);
                }
                this.EGUpdate();
            }
            else {
                if (this.ssg_type_ === 0) {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                    this.EGUpdate();
                }
                else {
                    this.eg_level_ += 4 * Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_) {
                        this.EGUpdate();
                        switch (this.eg_phase_) {
                            case EGPhase.decay:
                                this.ShiftPhase(EGPhase.sustain);
                                break;
                            case EGPhase.sustain:
                                this.ShiftPhase(EGPhase.attack);
                                break;
                            case EGPhase.release:
                                this.ShiftPhase(EGPhase.off);
                                break;
                        }
                    }
                }
            }
            this.eg_curve_count_++;
        }

        private EGStep(): void {
            this.eg_count_ -= this.eg_count_diff_;

            // EG の変化は全スロットで同期しているという噂もある
            if (this.eg_count_ <= 0)
                this.EGCalc();
        }

        //  PG 計算
        //  ret:2^(20+PGBITS) / cycle
        private PGCalc(): number {
            var ret: number = this.pg_count_;
            this.pg_count_ += this.pg_diff_;
            return ret;
        }

        private PGCalcL(): number {
            var ret: number = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.GetPMV()) >> 5);// & -(1 << (2+IS2EC_SHIFT)));
            return ret /* + pmv * this.pg_diff_;*/;
        }

        //  OP 計算
        //  in: ISample (最大 8π)
        Calc(ii: number): number {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                if (this.eg_phase_ === EGPhase.attack) {
                    var c: number = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0) this.ShiftPhase(EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_) this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a: number = this.tl_out_ + this.eg_level_;
                //if (a < 0x3ff) this.eg_out_ = a << (1 + 2);
                //else this.eg_out_ = 0x3ff << (1 + 2);
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }

            this.out2_ = this.out_;

            var pgo: number = this.pg_count_;
            this.pg_count_ += this.pg_diff_;
            var pgin: number = pgo >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
            pgin += ii >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10 - (2 + Operator.IS2EC_SHIFT));

            var sino: number = this.eg_out_ + Operator.sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)];
            //if (sino < /*FM.FM_CLENTS*/8192) this.out_ = Operator.cltable[sino]; // 三項演算子は遅いという噂
            //else this.out_ = 0;
            this.out_ = (sino < /*FM.FM_CLENTS*/8192) ? Operator.cltable[sino] : 0; // JavaScriptでは三項演算子の方が速いようです

            return this.out_;
        }

        CalcL(ii: number): number {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                if (this.eg_phase_ === EGPhase.attack) {
                    var c: number = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0) this.ShiftPhase(EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_) this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a: number = this.tl_out_ + this.eg_level_;
                //if (a < 0x3ff) this.eg_out_ = a << (1 + 2);
                //else this.eg_out_ = 0x3ff << (1 + 2);
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            var pgo: number = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.pmv_) >> 5);
            var pgin: number = pgo >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
            pgin += ii >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10 - (2 + Operator.IS2EC_SHIFT));

            //  LogToLin(); SINE();
            var sino: number = this.eg_out_ + Operator.sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)] + this.ams_[this.chip_.aml_];
            //if (sino < /*FM.FM_CLENTS*/8192) this.out_ = Operator.cltable[sino];
            //else this.out_ = 0;
            this.out_ = (sino < /*FM.FM_CLENTS*/8192) ? Operator.cltable[sino] : 0;

            return this.out_;
        }

        CalcN(noise: number): number {
            this.EGStep();

            var lv: number = Math.max(0, 0x3ff - (this.tl_out_ + this.eg_level_)) << 1;

            // noise & 1 ? lv : -lv と等価 
            noise = (noise & 1) - 1;
            this.out_ = (lv + noise) ^ noise;

            return this.out_;
        }

        //  OP (FB) 計算
        //  Self Feedback の変調最大 = 4π
        CalcFB(fb: number): number {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                if (this.eg_phase_ === EGPhase.attack) {
                    var c: number = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0) this.ShiftPhase(EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_) this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a: number = this.tl_out_ + this.eg_level_;
                //if (a < 0x3ff) this.eg_out_ = a << (1 + 2);
                //else this.eg_out_ = 0x3ff << (1 + 2);
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }

            var ii: number = this.out_ + this.out2_;
            this.out2_ = this.out_;

            var pgo: number = this.pg_count_;
            this.pg_count_ += this.pg_diff_;

            var pgin: number = pgo >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
            if (fb < 31) {
                pgin += ((ii << (1 + Operator.IS2EC_SHIFT)) >> fb) >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
            }

            var sino: number = this.eg_out_ + Operator.sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)];
            //if (sino < /*FM.FM_CLENTS*/8192) this.out_ = Operator.cltable[sino];
            //else this.out_ = 0;
            this.out_ = (sino < /*FM.FM_CLENTS*/8192) ? Operator.cltable[sino] : 0;

            return this.out2_;
        }

        CalcFBL(fb: number): number {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                if (this.eg_phase_ === EGPhase.attack) {
                    var c: number = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0) this.ShiftPhase(EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_) this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a: number = this.tl_out_ + this.eg_level_;
                //if (a < 0x3ff) this.eg_out_ = a << (1 + 2);
                //else this.eg_out_ = 0x3ff << (1 + 2);
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }

            var ii: number = this.out_ + this.out2_;
            this.out2_ = this.out_;

            var pgo: number = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.pmv_) >> 5);

            var pgin: number = pgo >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
            if (fb < 31) {
                pgin += ((ii << (1 + Operator.IS2EC_SHIFT)) >> fb) >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
            }

            var sino: number = this.eg_out_ + Operator.sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)] + this.ams_[this.chip_.aml_];
            //if (sino < /*FM.FM_CLENTS*/8192) this.out_ = Operator.cltable[sino]; // 三項演算子は遅いという噂
            //else this.out_ = 0;
            this.out_ = (sino < /*FM.FM_CLENTS*/8192) ? Operator.cltable[sino] : 0;

            return this.out_;
        }

        //  フィードバックバッファをクリア
        ResetFB(): void {
            this.out_ = this.out2_ = 0;
        }

        //  キーオン
        KeyOn(): void {
            if (!this.keyon_) {
                this.keyon_ = true;
                if (this.eg_phase_ === EGPhase.off || this.eg_phase_ === EGPhase.release) {
                    this.ssg_phase_ = -1;
                    this.ShiftPhase(EGPhase.attack);
                    this.EGUpdate();
                    this.in2_ = this.out_ = this.out2_ = 0;
                    this.pg_count_ = 0;
                }
            }
        }

        //  キーオフ
        KeyOff(): void {
            if (this.keyon_) {
                this.keyon_ = false;
                this.ShiftPhase(EGPhase.release);
            }
        }

        //  オペレータは稼働中か？
        IsOn(): boolean {
            return this.eg_phase_ !== EGPhase.off;
        }

        //  Detune (0-7)
        SetDT(dt: number): void {
            this.detune_ = dt * 0x20;
            this.param_changed_ = true;
        }

        //  DT2 (0-3)
        SetDT2(dt2: number): void {
            this.detune2_ = dt2 & 3;
            this.param_changed_ = true;
        }

        //  Multiple (0-15)
        SetMULTI(mul: number): void {
            this.multiple_ = mul;
            this.param_changed_ = true;
        }

        //  Total Level (0-127) (0.75dB step)
        SetTL(tl: number, csm: boolean): void {
            if (!csm) {
                this.tl_ = tl; this.param_changed_ = true;
            }
            this.tl_latch_ = tl;
        }

        //  Attack Rate (0-63)
        SetAR(ar: number): void {
            this.ar_ = ar;
            this.param_changed_ = true;
        }

        //  Decay Rate (0-63)
        SetDR(dr: number): void {
            this.dr_ = dr;
            this.param_changed_ = true;
        }

        //  Sustain Rate (0-63)
        SetSR(sr: number): void {
            this.sr_ = sr;
            this.param_changed_ = true;
        }

        //  Sustain Level (0-127)
        SetSL(sl: number): void {
            this.sl_ = sl;
            this.param_changed_ = true;
        }

        //  Release Rate (0-63)
        SetRR(rr: number): void {
            this.rr_ = rr;
            this.param_changed_ = true;
        }

        //  Keyscale (0-3)
        SetKS(ks: number): void {
            this.ks_ = ks;
            this.param_changed_ = true;
        }

        SetAMON(amon: boolean): void {
            this.amon_ = amon;
            this.param_changed_ = true;
        }

        Mute(mute: boolean): void {
            this.mute_ = mute;
            this.param_changed_ = true;
        }

        SetMS(ms: number): void {
            this.ms_ = ms;
            this.param_changed_ = true;
        }

        Out(): number {
            return this.out_;
        }

        Refresh(): void {
            this.param_changed_ = true;
        }

        /*
         * End Class Definition
         */
    }
}
