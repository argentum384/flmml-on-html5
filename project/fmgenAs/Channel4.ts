// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------

/// <reference path="Operator.ts" />
/// <reference path="JaggArray.ts" />

module fmgenAs {
    /**
     * ...
     * @author ALOE
     */
    export class Channel4 {
        fb: number;
        buf: Array<number> = new Array<number>(4);
        pms: Array<number>;
        ix: Array<number> = new Array<number>(3);
        ox: Array<number> = new Array<number>(3);
        algo_: number;
        chip_: Chip;

        op: Array<Operator> = [
            new Operator(),
            new Operator(),
            new Operator(),
            new Operator()
        ];

        private static fbtable: Array<number> = [
            31, 7, 6, 5, 4, 3, 2, 1
        ];

        private static kftable: Array<number> = [
            65536, 65595, 65654, 65713, 65773, 65832, 65891, 65951,
            66010, 66070, 66130, 66189, 66249, 66309, 66369, 66429,
            66489, 66549, 66609, 66669, 66729, 66789, 66850, 66910,
            66971, 67031, 67092, 67152, 67213, 67273, 67334, 67395,
            67456, 67517, 67578, 67639, 67700, 67761, 67822, 67883,
            67945, 68006, 68067, 68129, 68190, 68252, 68314, 68375,
            68437, 68499, 68561, 68623, 68685, 68747, 68809, 68871,
            68933, 68995, 69057, 69120, 69182, 69245, 69307, 69370
        ];

        private static kctable: Array<number> = [
            5197, 5506, 5833, 6180, 6180, 6547, 6937, 7349,
            7349, 7786, 8249, 8740, 8740, 9259, 9810, 10394
        ];

        private static iotable: Array<Array<number>> = [
            [0, 1, 1, 2, 2, 3], [1, 0, 0, 1, 1, 2],
            [1, 1, 1, 0, 0, 2], [0, 1, 2, 1, 1, 2],
            [0, 1, 2, 2, 2, 1], [0, 1, 0, 1, 0, 1],
            [0, 1, 2, 1, 2, 1], [1, 0, 1, 0, 1, 0]
        ];

        static pmtable: Array<Array<Array<number>>> = (() => {
            var pmtable: Array<Array<Array<number>>> = JaggArray.I3(2, 8, /*FM.FM_LFOENTS*/256);
            var i: number, j: number;
            var pms: Array<Array<number>> = [
                [0, 1 / 360.0, 2 / 360.0, 3 / 360.0, 4 / 360.0, 6 / 360.0, 12 / 360.0, 24 / 360.0],   // OPNA
                [0, 1 / 480.0, 2 / 480.0, 4 / 480.0, 10 / 480.0, 20 / 480.0, 80 / 480.0, 140 / 480.0] // OPM
            ];
            for (var type: number = 0; type < 2; type++) {
                for (i = 0; i < 8; i++) {
                    var pmb: number = pms[type][i];
                    for (j = 0; j < /*FM.FM_LFOENTS*/256; j++) {
                        var v: number = Math.pow(2.0, pmb * (2 * j - /*FM.FM_LFOENTS*/256 + 1) / (/*FM.FM_LFOENTS*/256 - 1));
                        var w: number = 0.6 * pmb * Math.sin(2 * j * Math.PI / /*FM.FM_LFOENTS*/256) + 1;
                        pmtable[type][i][j] = (0x10000 * (w - 1)) | 0;
                    }
                }
            }
            return pmtable;
        })();

        constructor() {
            this.SetAlgorithm(0);
            this.pms = Channel4.pmtable[0][0];
        }

        // オペレータの種類 (LFO) を設定
        SetType(type: number/*OpType*/): void {
            for (var i: number = 0; i < 4; i++) this.op[i].type_ = type;
        }

        // セルフ・フィードバックレートの設定 (0-7)
        SetFB(feedback: number): void {
            this.fb = Channel4.fbtable[feedback];
        }

        // OPNA 系 LFO の設定
        SetMS(ms: number): void {
            this.op[0].SetMS(ms);
            this.op[1].SetMS(ms);
            this.op[2].SetMS(ms);
            this.op[3].SetMS(ms);
        }

        // チャンネル・マスク
        Mute(m: boolean): void {
            for (var i: number = 0; i < 4; i++) this.op[i].Mute(m);
        }

        // 内部パラメータを再計算
        Refresh(): void {
            for (var i: number = 0; i < 4; i++) this.op[i].Refresh();
        }

        SetChip(chip: Chip): void {
            this.chip_ = chip;
            for (var i: number = 0; i < 4; i++) this.op[i].SetChip(chip);
        }

        // リセット
        Reset(): void {
            this.op[0].Reset();
            this.op[1].Reset();
            this.op[2].Reset();
            this.op[3].Reset();
        }

        // Calc の用意
        Prepare(): number {
            var op: Array<Operator> = this.op;

            op[0].Prepare();
            op[1].Prepare();
            op[2].Prepare();
            op[3].Prepare();

            this.pms = Channel4.pmtable[op[0].type_][op[0].ms_ & 7];
            var key: number = (op[0].IsOn() || op[1].IsOn() || op[2].IsOn() || op[3].IsOn()) ? 1 : 0;
            var lfo: number = (op[0].ms_ & (op[0].amon_ || op[1].amon_ || op[2].amon_ || op[3].amon_ ? 0x37 : 7)) ? 2 : 0;
            return key | lfo;
            }

        // F-Number/BLOCK を設定
        SetFNum(f: number): void {
            for (var i: number = 0; i < 4; i++) this.op[i].SetFNum(f);
        }

        // KC/KF を設定
        SetKCKF(kc: number, kf: number): void {
            var oct: number = 19 - ((kc >> 4) & 7);
            var kcv: number = Channel4.kctable[kc & 0x0f];
            kcv = ((kcv + 2) / 4 | 0) * 4;
            var dp: number = kcv * Channel4.kftable[kf & 0x3f];
            dp >>= 16 + 3;
            dp <<= 16 + 3;
            dp >>= oct;
            var bn: number = (kc >> 2) & 31;
            this.op[0].SetDPBN(dp, bn);
            this.op[1].SetDPBN(dp, bn);
            this.op[2].SetDPBN(dp, bn);
            this.op[3].SetDPBN(dp, bn);
        }

        // キー制御
        KeyControl(key: number): void {
            var op: Array<Operator> = this.op;
            if (key & 0x1) op[0].KeyOn(); else op[0].KeyOff();
            if (key & 0x2) op[1].KeyOn(); else op[1].KeyOff();
            if (key & 0x4) op[2].KeyOn(); else op[2].KeyOff();
            if (key & 0x8) op[3].KeyOn(); else op[3].KeyOff();
        }

        // アルゴリズムを設定
        SetAlgorithm(algo: number): void {
            var iotable = Channel4.iotable;

            this.ix[0] = iotable[algo][0];
            this.ox[0] = iotable[algo][1];
            this.ix[1] = iotable[algo][2];
            this.ox[1] = iotable[algo][3];
            this.ix[2] = iotable[algo][4];
            this.ox[2] = iotable[algo][5];
            this.op[0].ResetFB();
            this.algo_ = algo;
        }
  
        // アルゴリズムを取得
        GetAlgorithm(): number {
            return this.algo_;
        }

        //  合成
        Calc(): number {
            var r: number = 0;
            switch (this.algo_) {
                case 0:
                    this.op[2].Calc(this.op[1].Out());
                    this.op[1].Calc(this.op[0].Out());
                    r = this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 1:
                    this.op[2].Calc(this.op[0].Out() + this.op[1].Out());
                    this.op[1].Calc(0);
                    r = this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 2:
                    this.op[2].Calc(this.op[1].Out());
                    this.op[1].Calc(0);
                    r = this.op[3].Calc(this.op[0].Out() + this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 3:
                    this.op[2].Calc(0);
                    this.op[1].Calc(this.op[0].Out());
                    r = this.op[3].Calc(this.op[1].Out() + this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 4:
                    this.op[2].Calc(0);
                    r = this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 5:
                    r = this.op[2].Calc(this.op[0].Out());
                    r += this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(this.op[0].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 6:
                    r = this.op[2].Calc(0);
                    r += this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(0);
                    this.op[0].CalcFB(this.fb);
                    break;
                case 7:
                    r = this.op[2].Calc(0);
                    r += this.op[1].Calc(0);
                    r += this.op[3].Calc(0);
                    r += this.op[0].CalcFB(this.fb);
                    break;
            }
            return r;
        }

        //  合成
        CalcL(): number {
            this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);

            var r: number = 0;
            switch (this.algo_) {
                case 0:
                    this.op[2].CalcL(this.op[1].Out());
                    this.op[1].CalcL(this.op[0].Out());
                    r = this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 1:
                    this.op[2].CalcL(this.op[0].Out() + this.op[1].Out());
                    this.op[1].CalcL(0);
                    r = this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 2:
                    this.op[2].CalcL(this.op[1].Out());
                    this.op[1].CalcL(0);
                    r = this.op[3].CalcL(this.op[0].Out() + this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 3:
                    this.op[2].CalcL(0);
                    this.op[1].CalcL(this.op[0].Out());
                    r = this.op[3].CalcL(this.op[1].Out() + this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 4:
                    this.op[2].CalcL(0);
                    r = this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 5:
                    r = this.op[2].CalcL(this.op[0].Out());
                    r += this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(this.op[0].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 6:
                    r = this.op[2].CalcL(0);
                    r += this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(0);
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 7:
                    r = this.op[2].CalcL(0);
                    r += this.op[1].CalcL(0);
                    r += this.op[3].CalcL(0);
                    r += this.op[0].CalcFBL(this.fb);
                    break;
            }
            return r;
        }

        //  合成
        CalcN(noise: number): number {
            this.buf[1] = this.buf[2] = this.buf[3] = 0;
            this.buf[0] = this.op[0].Out(); this.op[0].CalcFB(this.fb);
            this.buf[this.ox[0]] += this.op[1].Calc(this.buf[this.ix[0]]);
            this.buf[this.ox[1]] += this.op[2].Calc(this.buf[this.ix[1]]);
            var o: number = this.op[3].Out();
            this.op[3].CalcN(noise);
            return this.buf[this.ox[2]] + o;
        }

        //  合成
        CalcLN(noise: number): number {
            this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
            this.buf[1] = this.buf[2] = this.buf[3] = 0;
            this.buf[0] = this.op[0].Out(); this.op[0].CalcFBL(this.fb);
            this.buf[this.ox[0]] += this.op[1].CalcL(this.buf[this.ix[0]]);
            this.buf[this.ox[1]] += this.op[2].CalcL(this.buf[this.ix[1]]);
            var o: number = this.op[3].Out();
            this.op[3].CalcN(noise);
            return this.buf[this.ox[2]] + o;
        }
        
        /*
         * End Class Definition
         */
    }
}
