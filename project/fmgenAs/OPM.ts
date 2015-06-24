// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------

/// <reference path="Timer.ts" />
/// <reference path="Operator.ts" />

module fmgenAs {
    /**
     * ...
     * @author ALOE
     */
    export class OPM extends Timer {
        //private static OPM_LFOENTS: number = 512;

        private fmvolume: number;
        private amplevel: number = /*FM.FM_VOLENTS*/16384;
        private clock: number;
        private rate: number;
        private pcmrate: number;
        private pmd: number;
        private amd: number;
        private lfo_count_: number;
        private lfo_count_diff_: number;
        private lfo_step_: number;
        private lfo_count_prev_: number;
        private lfowaveform: number;
        private rateratio: number;
        private noise: number;
        private noisecount: number;
        private noisedelta: number;
        private lfofreq: number;
        private reg01: number;
        private kc: Array<number> = new Array<number>(8);
        private kf: Array<number> = new Array<number>(8);
        private pan: Array<number> = new Array<number>(8);
        private chip: Chip = new Chip();

        private static s_init: boolean = false;

        private static amtable: Array<Array<number>> = JaggArray.I2(4, /*OPM.OPM_LFOENTS*/512);
        private static pmtable: Array<Array<number>> = JaggArray.I2(4, /*OPM.OPM_LFOENTS*/512);
        
        // Channel4から移植
        private buf: Array<number> = new Array<number>(4);
        private ix: Array<number>;
        private ox: Array<number>; // Channel4ここまで  
        
        private static sltable: Array<number> = [
            0, 4, 8, 12, 16, 20, 24, 28,
            32, 36, 40, 44, 48, 52, 56, 124,
        ];

        private static slottable: Array<number> = [
            0, 2, 1, 3
        ];

        static decaytable1: Array<Array<number>> = Operator.decaytable1;
        static attacktable: Array<Array<number>> = Operator.attacktable;
        static sinetable: Array<number> = Operator.sinetable;
        static cltable: Array<number> = Operator.cltable;

        private ch: Array<Channel4> = [
            new Channel4(), new Channel4(),
            new Channel4(), new Channel4(),
            new Channel4(), new Channel4(),
            new Channel4(), new Channel4()
        ];

        constructor() {
            super();
            this.lfo_count_ = 0;
            this.lfo_count_prev_ = ~0;
            OPM.BuildLFOTable();
            for (var i: number = 0; i < 8; i++) {
                this.ch[i].SetChip(this.chip);
                this.ch[i].SetType(OpType.typeM);
            }
            this.ix = this.ch[0].ix;
            this.ox = this.ch[0].ox;
        }

        private static BuildLFOTable(): void {
            if (this.s_init) return;
            for (var type: number = 0; type < 4; type++) {
                var r: number = 0;
                for (var c: number = 0; c < /*OPM.OPM_LFOENTS*/512; c++) {
                    var a: number = 0;
                    var p: number = 0;
                    switch (type) {
                        case 0:
                            p = (((c + 0x100) & 0x1ff) / 2) - 0x80;
                            a = 0xff - c / 2;
                            break;
                        case 1:
                            a = c < 0x100 ? 0xff : 0;
                            p = c < 0x100 ? 0x7f : -0x80;
                            break;
                        case 2:
                            p = (c + 0x80) & 0x1ff;
                            p = p < 0x100 ? p - 0x80 : 0x17f - p;
                            a = c < 0x100 ? 0xff - c : c - 0x100;
                            break;
                        case 3:
                            if ((c & 3) === 0)
                                r = ((Math.random() * 32768 | 0) / 17) & 0xff;
                            a = r;
                            p = r - 0x80;
                            break;
                    }
                    this.amtable[type][c] = a;
                    this.pmtable[type][c] = -p - 1;
                }
            }
            this.s_init = true;
        }

        //  初期化
        Init(c: number, rf: number): boolean {
            if (!this.SetRate(c, rf))
                return false;
            this.Reset();
            this.SetVolume(0);
            this.SetChannelMask(0);
            return true;
        }

        //  再設定
        SetRate(c: number, r: number): boolean {
            this.clock = c;
            this.pcmrate = r;
            this.rate = r;

            this.RebuildTimeTable();

            return true;
        }

        //  チャンネルマスクの設定
        SetChannelMask(mask: number): void {
            for (var i: number = 0; i < 8; i++)
                this.ch[i].Mute((mask & (1 << i)) !== 0);
        }

        //  リセット
        Reset(): void {
            var i: number;
            for (i = 0x0; i < 0x100; i++) this.SetReg(i, 0);
            this.SetReg(0x19, 0x80);
            super.Reset();

            this.status = 0;
            this.noise = 12345;
            this.noisecount = 0;

            for (i = 0; i < 8; i++)
                this.ch[i].Reset();
        }

        //  設定に依存するテーブルの作成
        protected RebuildTimeTable(): void {
            var fmclock: number = this.clock / 64 | 0;

            this.rateratio = ((fmclock << /*FM.FM_RATIOBITS*/7) + (this.rate / 2)) / this.rate | 0;
            this.SetTimerBase(fmclock);

            this.chip.SetRatio(this.rateratio);
        }

        // タイマー A 発生時イベント (CSM)
        protected TimerA(): void {
            if (this.regtc & 0x80) {
                for (var i: number = 0; i < 8; i++) {
                    this.ch[i].KeyControl(0x0);
                    this.ch[i].KeyControl(0xf);
                }
            }
        }

        //  音量設定 (FM GAIN)
        SetVolume(db: number): void {
            db = Math.min(db, 20);
            if (db > -192)
                this.fmvolume = /*FM.FM_VOLENTS*/16384 * Math.pow(10.0, db / 40.0) | 0;
            else
                this.fmvolume = 0;
        }

        //  音量設定 (エクスプレッション)
        SetExpression(amp: number): void {
            this.amplevel = amp * /*FM.FM_VOLENTS*/16384 | 0;
        }

        ReadStatus(): number {
            return this.status & 0x03;
        }

        //  ステータスフラグ設定
        protected SetStatus(bits: number): void {
            if ((this.status & bits) === 0) {
                this.status |= bits;
                this.Intr(true);
            }
        }

        //  ステータスフラグ解除
        protected ResetStatus(bits: number): void {
            if (this.status & bits) {
                this.status &= ~bits;
                if (this.status === 0)
                    this.Intr(false);
            }
        }

        //  レジスタアレイにデータを設定
        SetReg(addr: number, data: number): void {
            if (addr >= 0x100)
                return;

            var c: number = addr & 7;
            switch (addr & 0xff) {
                case 0x01:                  // TEST (lfo restart)
                    if (data & 2) {
                        this.lfo_count_ = 0;
                        this.lfo_count_prev_ = ~0;
                    }
                    this.reg01 = data;
                    break;

                case 0x08:                  // KEYON
                    if ((this.regtc & 0x80) === 0) {
                        this.ch[data & 7].KeyControl(data >> 3);
                    }
                    else {
                        c = data & 7;
                        if ((data & 0x08) === 0) this.ch[c].op[0].KeyOff();
                        if ((data & 0x10) === 0) this.ch[c].op[1].KeyOff();
                        if ((data & 0x20) === 0) this.ch[c].op[2].KeyOff();
                        if ((data & 0x40) === 0) this.ch[c].op[3].KeyOff();
                    }
                    break;

                case 0x10: case 0x11:       // CLKA1, CLKA2
                    this.SetTimerA(addr, data);
                    break;

                case 0x12:                  // CLKB
                    this.SetTimerB(data);
                    break;

                case 0x14:                  // CSM, TIMER
                    this.SetTimerControl(data);
                    break;

                case 0x18:                  // LFRQ(lfo freq)
                    this.lfofreq = data;

                    this.lfo_count_diff_ = this.rateratio * ((16 + (this.lfofreq & 15)) << (16 - 4 - /*FM.FM_RATIOBITS*/7)) / (1 << (15 - (this.lfofreq >> 4)));
                    break;

                case 0x19:                  // PMD/AMD
                    //              (data & 0x80 ? pmd : amd) = data & 0x7f;
                    if (data & 0x80)
                        this.pmd = data & 0x7f;
                    else
                        this.amd = data & 0x7f;
                    break;

                case 0x1b:                  // CT, W(lfo waveform)
                    this.lfowaveform = data & 3;
                    break;

                // RL, FB, Connect
                case 0x20: case 0x21: case 0x22: case 0x23:
                case 0x24: case 0x25: case 0x26: case 0x27:
                    this.ch[c].SetFB((data >> 3) & 7);
                    this.ch[c].SetAlgorithm(data & 7);
                    this.pan[c] = (data >> 6) & 3;
                    break;
                
                // KC
                case 0x28: case 0x29: case 0x2a: case 0x2b:
                case 0x2c: case 0x2d: case 0x2e: case 0x2f:
                    this.kc[c] = data;
                    this.ch[c].SetKCKF(this.kc[c], this.kf[c]);
                    break;
                
                // KF
                case 0x30: case 0x31: case 0x32: case 0x33:
                case 0x34: case 0x35: case 0x36: case 0x37:
                    this.kf[c] = data >> 2;
                    this.ch[c].SetKCKF(this.kc[c], this.kf[c]);
                    break;
                
                // PMS, AMS
                case 0x38: case 0x39: case 0x3a: case 0x3b:
                case 0x3c: case 0x3d: case 0x3e: case 0x3f:
                    this.ch[c].SetMS((data << 4) | (data >> 4));
                    break;

                case 0x0f:          // NE/NFRQ (noise)
                    this.noisedelta = data;
                    this.noisecount = 0;
                    break;

                default:
                    if (addr >= 0x40)
                        this.SetParameter(addr, data);
                    break;
            }
        }

        //  パラメータセット
        protected SetParameter(addr: number, data: number): void {
            var slot: number = OPM.slottable[(addr >> 3) & 3];
            var op: Operator = this.ch[addr & 7].op[slot];

            switch ((addr >> 5) & 7) {
                case 2: // 40-5F DT1/MULTI
                    op.SetDT((data >> 4) & 0x07);
                    op.SetMULTI(data & 0x0f);
                    break;
                case 3: // 60-7F TL
                    op.SetTL(data & 0x7f, (this.regtc & 0x80) !== 0);
                    break;
                case 4: // 80-9F KS/AR
                    op.SetKS((data >> 6) & 3);
                    op.SetAR((data & 0x1f) * 2);
                    break;
                case 5: // A0-BF DR/AMON(D1R/AMS-EN)
                    op.SetDR((data & 0x1f) * 2);
                    op.SetAMON((data & 0x80) !== 0);
                    break;
                case 6: // C0-DF SR(D2R), DT2
                    op.SetSR((data & 0x1f) * 2);
                    op.SetDT2((data >> 6) & 3);
                    break;
                case 7: // E0-FF SL(D1L)/RR
                    op.SetSL(OPM.sltable[(data >> 4) & 15]);
                    op.SetRR((data & 0x0f) * 4 + 2);
                    break;
            }
        }

        
        //private Noise(): number {
        //    this.noisecount += 2 * this.rateratio;
        //    if (this.noisecount >= (32 << /*FM.FM_RATIOBITS*/7)) {
        //        var n: number = 32 - (this.noisedelta & 0x1f);
        //        if (n === 1)
        //            n = 2;
        //        this.noisecount = this.noisecount - (n << /*FM.FM_RATIOBITS*/7);
        //        if ((this.noisedelta & 0x1f) === 0x1f)
        //            this.noisecount -= FM.FM_RATIOBITS;
        //        this.noise = (this.noise >> 1) ^ ((this.noise & 1) !== 0 ? 0x8408 : 0);
        //    }
        //    return this.noise;
        //}
        //
        ////  合成の一部
        //private MixSub(activech: number, ibuf: Array<number>): void {
        //    if ((activech & 0x4000) !== 0) ibuf[this.pan[0]] = this.ch[0].Calc();
        //    if ((activech & 0x1000) !== 0) ibuf[this.pan[1]] += this.ch[1].Calc();
        //    if ((activech & 0x0400) !== 0) ibuf[this.pan[2]] += this.ch[2].Calc();
        //    if ((activech & 0x0100) !== 0) ibuf[this.pan[3]] += this.ch[3].Calc();
        //    if ((activech & 0x0040) !== 0) ibuf[this.pan[4]] += this.ch[4].Calc();
        //    if ((activech & 0x0010) !== 0) ibuf[this.pan[5]] += this.ch[5].Calc();
        //    if ((activech & 0x0004) !== 0) ibuf[this.pan[6]] += this.ch[6].Calc();
        //    if ((activech & 0x0001) !== 0) {
        //        if ((this.noisedelta & 0x80) !== 0)
        //            ibuf[this.pan[7]] += this.ch[7].CalcN(this.Noise());
        //        else
        //            ibuf[this.pan[7]] += this.ch[7].Calc();
        //    }
        //}
        //
        //private MixSubL(activech: number, ibuf: Array<number>): void {
        //    if ((activech & 0x4000) !== 0) ibuf[this.pan[0]] = this.ch[0].CalcL();
        //    if ((activech & 0x1000) !== 0) ibuf[this.pan[1]] += this.ch[1].CalcL();
        //    if ((activech & 0x0400) !== 0) ibuf[this.pan[2]] += this.ch[2].CalcL();
        //    if ((activech & 0x0100) !== 0) ibuf[this.pan[3]] += this.ch[3].CalcL();
        //    if ((activech & 0x0040) !== 0) ibuf[this.pan[4]] += this.ch[4].CalcL();
        //    if ((activech & 0x0010) !== 0) ibuf[this.pan[5]] += this.ch[5].CalcL();
        //    if ((activech & 0x0004) !== 0) ibuf[this.pan[6]] += this.ch[6].CalcL();
        //    if ((activech & 0x0001) !== 0) {
        //        if ((this.noisedelta & 0x80) !== 0)
        //            ibuf[this.pan[7]] += this.ch[7].CalcLN(this.Noise());
        //        else
        //            ibuf[this.pan[7]] += this.ch[7].CalcL();
        //    }
        //}
        

        //  合成
        Mix(buffer: Float32Array, start: number, nsamples: number): void {
            var i: number;
            // odd bits - active, even bits - lfo
            var activech: number = 0;
            for (i = 0; i < 8; i++)
                activech = (activech << 2) | this.ch[i].Prepare();

            if (activech & 0x5555) {
                // LFO 波形初期化ビット = 1 ならば LFO はかからない?
                if (this.reg01 & 0x02)
                    activech &= 0x5555;

                // Mix
                var a: number, c: number, r: number, o: number, ii: number;
                var pgex: number, pgin: number, sino: number;
                var al: number = this.ch[0].algo_;
                var fb: number = this.ch[0].fb;

                var op0: Operator = this.ch[0].op[0];
                var op1: Operator = this.ch[0].op[1];
                var op2: Operator = this.ch[0].op[2];
                var op3: Operator = this.ch[0].op[3];

                var buf: Array<number> = this.buf;
                var ix: Array<number> = this.ix;
                var ox: Array<number> = this.ox; // Channel4ここまで  

                var cltable = OPM.cltable;
                var sinetable = OPM.sinetable;
                var attacktable = OPM.attacktable;
                var decaytable1 = OPM.decaytable1;

                if (this.lfowaveform !== 3) {
                    var pmtable = OPM.pmtable;
                    var amtable = OPM.amtable;
                }

                for (i = start; i < start + nsamples; i++) {
                    if (this.lfowaveform !== 3) {
                        c = (this.lfo_count_ >> 15) & 0x1fe;
                        this.chip.pml_ = (pmtable[this.lfowaveform][c] * this.pmd / 128 + 0x80) & (/*FM.FM_LFOENTS*/256 - 1);
                        this.chip.aml_ = (amtable[this.lfowaveform][c] * this.amd / 128) & (/*FM.FM_LFOENTS*/256 - 1);
                    }
                    else {
                        if ((this.lfo_count_ ^ this.lfo_count_prev_) & ~((1 << 17) - 1)) {
                            c = ((Math.random() * 32768 | 0) / 17) & 0xff;
                            this.chip.pml_ = ((c - 0x80) * this.pmd / 128 + 0x80) & (/*FM.FM_LFOENTS*/256 - 1);
                            this.chip.aml_ = (c * this.amd / 128) & (/*FM.FM_LFOENTS*/256 - 1);
                        }
                    }
                    this.lfo_count_prev_ = this.lfo_count_;
                    this.lfo_step_++;
                    if ((this.lfo_step_ & 7) === 0) {
                        this.lfo_count_ += this.lfo_count_diff_;
                    }

                    r = 0;

                    if (activech & 0x4000) {
                        // LFOあり*****************************************************************************************
                        if (activech & 0xaaaa) {
                            this.ch[0].chip_.pmv_ = this.ch[0].pms[this.ch[0].chip_.pml_];
                            buf[1] = buf[2] = buf[3] = 0;
                            buf[0] = op0.out_;         

                            // --------------------------------------------------------------------------------------------
                            // op[0] 
                            op0.eg_count_ -= op0.eg_count_diff_;
                            if (op0.eg_count_ <= 0) {
                                op0.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                                if (op0.eg_phase_ === EGPhase.attack) {
                                    c = attacktable[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op0.eg_level_ -= 1 + (op0.eg_level_ >> c);
                                        if (op0.eg_level_ <= 0) op0.ShiftPhase(EGPhase.decay);
                                    }
                                }
                                else {
                                    op0.eg_level_ += decaytable1[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (op0.eg_level_ >= op0.eg_level_on_next_phase_) op0.ShiftPhase(op0.eg_phase_ + 1);
                                }
                                a = op0.tl_out_ + op0.eg_level_;
                                //if (a < 0x3ff) op0.eg_out_ = a << (1 + 2);
                                //else op0.eg_out_ = 0x3ff << (1 + 2);
                                op0.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op0.eg_curve_count_++;
                            }

                            ii = op0.out_ + op0.out2_;
                            op0.out2_ = op0.out_;

                            pgex = op0.pg_count_;
                            op0.pg_count_ += op0.pg_diff_ + ((op0.pg_diff_lfo_ * op0.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            if (fb < 31) {
                                pgin += ((ii << (1 + Operator.IS2EC_SHIFT)) >> fb) >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            }

                            sino = op0.eg_out_ + sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)] + op0.ams_[op0.chip_.aml_];
                            //if (sino < /*FM.FM_CLENTS*/8192) op0.out_ = cltable[sino];
                            //else op0.out_ = 0;  
                            op0.out_ = (sino < /*FM.FM_CLENTS*/8192) ? cltable[sino] : 0;

                            // --------------------------------------------------------------------------------------------
                            // op[1] 
                            op1.eg_count_ -= op1.eg_count_diff_;
                            if (op1.eg_count_ <= 0) {
                                op1.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                                if (op1.eg_phase_ === EGPhase.attack) {
                                    c = attacktable[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op1.eg_level_ -= 1 + (op1.eg_level_ >> c);
                                        if (op1.eg_level_ <= 0) op1.ShiftPhase(EGPhase.decay);
                                    }
                                }
                                else {
                                    op1.eg_level_ += decaytable1[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (op1.eg_level_ >= op1.eg_level_on_next_phase_) op1.ShiftPhase(op1.eg_phase_ + 1);
                                }
                                a = op1.tl_out_ + op1.eg_level_;
                                //if (a < 0x3ff) op1.eg_out_ = a << (1 + 2);
                                //else op1.eg_out_ = 0x3ff << (1 + 2);
                                op1.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op1.eg_curve_count_++;
                            }

                            ii = buf[ix[0]];
                            op1.out2_ = op1.out_;

                            pgex = op1.pg_count_;
                            op1.pg_count_ += op1.pg_diff_ + ((op1.pg_diff_lfo_ * op1.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            pgin += ii >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10 - (2 + Operator.IS2EC_SHIFT));

                            sino = op1.eg_out_ + sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)] + op1.ams_[op1.chip_.aml_];
                            //if (sino < /*FM.FM_CLENTS*/8192) op1.out_ = cltable[sino];
                            //else op1.out_ = 0;
                            op1.out_ = (sino < /*FM.FM_CLENTS*/8192) ? cltable[sino] : 0;

                            buf[ox[0]] += op1.out_;

                            // --------------------------------------------------------------------------------------------
                            // op[2] 
                            op2.eg_count_ -= op2.eg_count_diff_;
                            if (op2.eg_count_ <= 0) {
                                op2.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                                if (op2.eg_phase_ === EGPhase.attack) {
                                    c = attacktable[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op2.eg_level_ -= 1 + (op2.eg_level_ >> c);
                                        if (op2.eg_level_ <= 0) op2.ShiftPhase(EGPhase.decay);
                                    }
                                }
                                else {
                                    op2.eg_level_ += decaytable1[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (op2.eg_level_ >= op2.eg_level_on_next_phase_) op2.ShiftPhase(op2.eg_phase_ + 1);
                                }
                                a = op2.tl_out_ + op2.eg_level_;
                                //if (a < 0x3ff) op2.eg_out_ = a << (1 + 2);
                                //else op2.eg_out_ = 0x3ff << (1 + 2);
                                op2.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op2.eg_curve_count_++;
                            }

                            ii = buf[ix[1]];
                            op2.out2_ = op2.out_;

                            pgex = op2.pg_count_;
                            op2.pg_count_ += op2.pg_diff_ + ((op2.pg_diff_lfo_ * op2.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            pgin += ii >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10 - (2 + Operator.IS2EC_SHIFT));

                            sino = op2.eg_out_ + sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)] + op2.ams_[op2.chip_.aml_];
                            //if (sino < /*FM.FM_CLENTS*/8192) op2.out_ = cltable[sino];
                            //else op2.out_ = 0;
                            op2.out_ = (sino < /*FM.FM_CLENTS*/8192) ? cltable[sino] : 0;

                            buf[ox[1]] += op2.out_;     

                            // --------------------------------------------------------------------------------------------
                            // op[3] 
                            op3.eg_count_ -= op3.eg_count_diff_;
                            if (op3.eg_count_ <= 0) {
                                op3.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                                if (op3.eg_phase_ === EGPhase.attack) {
                                    c = attacktable[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op3.eg_level_ -= 1 + (op3.eg_level_ >> c);
                                        if (op3.eg_level_ <= 0) op3.ShiftPhase(EGPhase.decay);
                                    }
                                }
                                else {
                                    op3.eg_level_ += decaytable1[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (op3.eg_level_ >= op3.eg_level_on_next_phase_) op3.ShiftPhase(op3.eg_phase_ + 1);
                                }
                                a = op3.tl_out_ + op3.eg_level_;
                                //if (a < 0x3ff) op3.eg_out_ = a << (1 + 2);
                                //else op3.eg_out_ = 0x3ff << (1 + 2);
                                op3.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op3.eg_curve_count_++;
                            }

                            ii = buf[ix[2]];
                            op3.out2_ = op3.out_;

                            pgex = op3.pg_count_;
                            op3.pg_count_ += op3.pg_diff_ + ((op3.pg_diff_lfo_ * op3.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            pgin += ii >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10 - (2 + Operator.IS2EC_SHIFT));

                            sino = op3.eg_out_ + sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)] + op3.ams_[op3.chip_.aml_];
                            //if (sino < /*FM.FM_CLENTS*/8192) op3.out_ = cltable[sino];
                            //else op3.out_ = 0;
                            op3.out_ = (sino < /*FM.FM_CLENTS*/8192) ? cltable[sino] : 0;

                            r = buf[ox[2]] + op3.out_;
                        }
                        // LFOなし*****************************************************************************************
                        else {
                            buf[1] = buf[2] = buf[3] = 0;
                            buf[0] = op0.out_;                            

                            // --------------------------------------------------------------------------------------------
                            // op[0] 
                            op0.eg_count_ -= op0.eg_count_diff_;
                            if (op0.eg_count_ <= 0) {
                                op0.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                                if (op0.eg_phase_ === EGPhase.attack) {
                                    c = attacktable[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op0.eg_level_ -= 1 + (op0.eg_level_ >> c);
                                        if (op0.eg_level_ <= 0) op0.ShiftPhase(EGPhase.decay);
                                    }
                                }
                                else {
                                    op0.eg_level_ += decaytable1[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (op0.eg_level_ >= op0.eg_level_on_next_phase_) op0.ShiftPhase(op0.eg_phase_ + 1);
                                }
                                a = op0.tl_out_ + op0.eg_level_;
                                //if (a < 0x3ff) op0.eg_out_ = a << (1 + 2);
                                //else op0.eg_out_ = 0x3ff << (1 + 2);
                                op0.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op0.eg_curve_count_++;
                            }

                            ii = op0.out_ + op0.out2_;
                            op0.out2_ = op0.out_;

                            pgex = op0.pg_count_;
                            op0.pg_count_ += op0.pg_diff_;
                            pgin = pgex >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            if (fb < 31) {
                                pgin += ((ii << (1 + Operator.IS2EC_SHIFT)) >> fb) >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            }

                            sino = op0.eg_out_ + sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)];
                            //if (sino < /*FM.FM_CLENTS*/8192) op0.out_ = cltable[sino];
                            //else op0.out_ = 0;
                            op0.out_ = (sino < /*FM.FM_CLENTS*/8192) ? cltable[sino] : 0;

                            // --------------------------------------------------------------------------------------------
                            // op[1] 
                            op1.eg_count_ -= op1.eg_count_diff_;
                            if (op1.eg_count_ <= 0) {
                                op1.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                                if (op1.eg_phase_ === EGPhase.attack) {
                                    c = attacktable[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op1.eg_level_ -= 1 + (op1.eg_level_ >> c);
                                        if (op1.eg_level_ <= 0) op1.ShiftPhase(EGPhase.decay);
                                    }
                                }
                                else {
                                    op1.eg_level_ += decaytable1[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (op1.eg_level_ >= op1.eg_level_on_next_phase_) op1.ShiftPhase(op1.eg_phase_ + 1);
                                }
                                a = op1.tl_out_ + op1.eg_level_;
                                //if (a < 0x3ff) op1.eg_out_ = a << (1 + 2);
                                //else op1.eg_out_ = 0x3ff << (1 + 2);
                                op1.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op1.eg_curve_count_++;
                            }

                            ii = buf[ix[0]];
                            op1.out2_ = op1.out_;

                            pgex = op1.pg_count_;
                            op1.pg_count_ += op1.pg_diff_;
                            pgin = pgex >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            pgin += ii >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10 - (2 + Operator.IS2EC_SHIFT));

                            sino = op1.eg_out_ + sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)];
                            //if (sino < /*FM.FM_CLENTS*/8192) op1.out_ = cltable[sino];
                            //else op1.out_ = 0;
                            op1.out_ = (sino < /*FM.FM_CLENTS*/8192) ? cltable[sino] : 0;

                            buf[ox[0]] += op1.out_;

                            // --------------------------------------------------------------------------------------------
                            // op[2] 
                            op2.eg_count_ -= op2.eg_count_diff_;
                            if (op2.eg_count_ <= 0) {
                                op2.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                                if (op2.eg_phase_ === EGPhase.attack) {
                                    c = attacktable[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op2.eg_level_ -= 1 + (op2.eg_level_ >> c);
                                        if (op2.eg_level_ <= 0) op2.ShiftPhase(EGPhase.decay);
                                    }
                                }
                                else {
                                    op2.eg_level_ += decaytable1[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (op2.eg_level_ >= op2.eg_level_on_next_phase_) op2.ShiftPhase(op2.eg_phase_ + 1);
                                }
                                a = op2.tl_out_ + op2.eg_level_;
                                //if (a < 0x3ff) op2.eg_out_ = a << (1 + 2);
                                //else op2.eg_out_ = 0x3ff << (1 + 2);
                                op2.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op2.eg_curve_count_++;
                            }

                            ii = buf[ix[1]];
                            op2.out2_ = op2.out_;

                            pgex = op2.pg_count_;
                            op2.pg_count_ += op2.pg_diff_;
                            pgin = pgex >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            pgin += ii >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10 - (2 + Operator.IS2EC_SHIFT));

                            sino = op2.eg_out_ + sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)];
                            //if (sino < /*FM.FM_CLENTS*/8192) op2.out_ = cltable[sino];
                            //else op2.out_ = 0;
                            op2.out_ = (sino < /*FM.FM_CLENTS*/8192) ? cltable[sino] : 0;

                            buf[ox[1]] += op2.out_;     

                            // --------------------------------------------------------------------------------------------
                            // op[3] 
                            op3.eg_count_ -= op3.eg_count_diff_;
                            if (op3.eg_count_ <= 0) {
                                op3.eg_count_ = (2047 * 3) << /*FM.FM_RATIOBITS*/7;
                                if (op3.eg_phase_ === EGPhase.attack) {
                                    c = attacktable[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op3.eg_level_ -= 1 + (op3.eg_level_ >> c);
                                        if (op3.eg_level_ <= 0) op3.ShiftPhase(EGPhase.decay);
                                    }
                                }
                                else {
                                    op3.eg_level_ += decaytable1[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (op3.eg_level_ >= op3.eg_level_on_next_phase_) op3.ShiftPhase(op3.eg_phase_ + 1);
                                }
                                a = op3.tl_out_ + op3.eg_level_;
                                //if (a < 0x3ff) op3.eg_out_ = a << (1 + 2);
                                //else op3.eg_out_ = 0x3ff << (1 + 2);
                                op3.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op3.eg_curve_count_++;
                            }
                            
                            ii = buf[ix[2]];
                            op3.out2_ = op3.out_;

                            pgex = op3.pg_count_;
                            op3.pg_count_ += op3.pg_diff_;
                            pgin = pgex >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10);
                            pgin += ii >> (20 + /*FM.FM_PGBITS*/9 - /*FM.FM_OPSINBITS*/10 - (2 + Operator.IS2EC_SHIFT));

                            sino = op3.eg_out_ + sinetable[pgin & (/*FM.FM_OPSINENTS*/1024 - 1)];
                            //if (sino < /*FM.FM_CLENTS*/8192) op3.out_ = cltable[sino];
                            //else op3.out_ = 0;
                            op3.out_ = (sino < /*FM.FM_CLENTS*/8192) ? cltable[sino] : 0;

                            r = buf[ox[2]] + op3.out_;
                        }
                        buffer[i] = ((((r * this.fmvolume) >> /*FM.FM_VOLBITS*/14) * this.amplevel) >> /*FM.FM_VOLBITS*/14) / 8192.0;
                    }
                }
            }
            // @LinearDrive: add start [2011/12/04]
            else {
                //全てのオペレータがEGPhase.offの場合、無音をレンダリング
                buffer.set(msgr.emptyBuffer.subarray(0, nsamples), start);
            }
            // @LinearDrive: add end
        }

        protected Intr(f: boolean): void {
            //
        }

        /* 機能追加分 */
    
        //  チャンネル(キャリア)は稼働中か？
        IsOn(c: number): boolean {
            var c4: Channel4 = this.ch[c & 7];
            switch (c4.algo_) {
                case 0: case 1:
                case 2: case 3:
                    return (c4.op[3].eg_phase_ !== EGPhase.off);
                case 4:
                    return (c4.op[1].eg_phase_ !== EGPhase.off) || (c4.op[3].eg_phase_ !== EGPhase.off);
                case 5:
                case 6:
                    return (c4.op[1].eg_phase_ !== EGPhase.off) || (c4.op[2].eg_phase_ !== EGPhase.off) || (c4.op[3].eg_phase_ !== EGPhase.off);
                case 7:
                    return (c4.op[0].eg_phase_ !== EGPhase.off) || (c4.op[1].eg_phase_ !== EGPhase.off) || (c4.op[2].eg_phase_ !== EGPhase.off) || (c4.op[3].eg_phase_ !== EGPhase.off);
            }
            return false;
        }
        
        /*
         * End Class Definition
         */
    }
} 