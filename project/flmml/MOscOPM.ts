/// <reference path="MOscMod.ts" />
/// <reference path="../fmgenAs/OPM.ts" />

module flmml {
    import OPM = fmgenAs.OPM;

    /**
      * FM音源ドライバ MOscOPM for AS3
      * @author ALOE
      */
    export class MOscOPM extends MOscMod {
        // 音色メモリ数
        static MAX_WAVE: number = 128;
        // 動作周波数 (Hz)
        static OPM_CLOCK: number = 3580000; // 4000000;
        // 3.58MHz(基本)：動作周波数比 (cent)
        static OPM_RATIO: number = 0; //-192.048495012562; // 1200.0*Math.Log(3580000.0/OPM_CLOCK)/Math.Log(2.0); 
        // パラメータ長
        static TIMB_SZ_M: number = 55; // #OPM
        static TIMB_SZ_N: number = 51; // #OPN
        // パラメータタイプ
        static TYPE_OPM: number = 0;
        static TYPE_OPN: number = 1;

        private m_fm: OPM;
        private m_oneSample: Float32Array; // 固定長
        private m_opMask: number;
        private m_velocity: number;
        private m_al: number;
        private m_tl: Array<number>; // 固定長

        private static s_init: number = 0;
        private static s_table: Array<Array<number>> = new Array<Array<number>>(MOscOPM.MAX_WAVE);
        private static s_comGain: number = 14.25;
        
        // YM2151 アプリケーションマニュアル Fig.2.4より
        private static kctable: Array<number> = [
        //  C    C#   D    D#   E    F    F#   G    G#   A    A#   B  
            0xE, 0x0, 0x1, 0x2, 0x4, 0x5, 0x6, 0x8, 0x9, 0xA, 0xC, 0xD, // 3.58MHz         
        ];
            
        // スロットのアドレス
        private static slottable: Array<number> = [
            0, 2, 1, 3
        ];
            
        // キャリアとなるOP
        private static carrierop: Array<number> = [
        //   c2     m2     c1     m1
            0x40,                     // AL 0
            0x40,                     // AL 1
            0x40,                     // AL 2
            0x40,                     // AL 3
            0x40 | 0x10,              // AL 4
            0x40 | 0x20 | 0x10,       // AL 5
            0x40 | 0x20 | 0x10,       // AL 6
            0x40 | 0x20 | 0x10 | 0x08 // AL 7
        ];
     
        private static defTimbre: Array<number> = [
        //  AL FB
            4, 5,
        //  AR  DR  SR RR SL  TL  KS ML D1 D2 AM　
            31,  5, 0, 0,  0, 23, 1, 1, 3, 0, 0,
            20, 10, 3, 7,  8,  0, 1, 1, 3, 0, 0,
            31,  3, 0, 0,  0, 25, 1, 1, 7, 0, 0,
            31, 12, 3, 7, 10,  2, 1, 1, 7, 0, 0, 
        //  OM,
            15,
        //  WF LFRQ PMD AMD
            0, 0, 0, 0, 
        //  PMS AMS
            0, 0,
        //  NE NFRQ
            0, 0
        ];
     
        private static zeroTimbre: Array<number> = [
        //  AL FB */
            0, 0,
        //  AR DR SR RR SL TL KS ML D1 D2 AM
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        //  OM,
            15,
        //  WF LFRQ PMD AMD
            0, 0, 0, 0, 
        //  PMS AMS
            0, 0,
        //  NE NFRQ
            0, 0
        ];

        constructor() {
            this.m_fm = new OPM();
            this.m_oneSample = new Float32Array(1);
            this.m_velocity = 127;
            this.m_al = 0;
            this.m_tl = new Array<number>(4);
            super();
            MOscOPM.boot();
            this.m_fm.Init(MOscOPM.OPM_CLOCK, msgr.SAMPLE_RATE);
            this.m_fm.Reset();
            this.m_fm.SetVolume(MOscOPM.s_comGain);
            this.setOpMask(15);
            this.setWaveNo(0);
        }

        static boot(): void {
            if (this.s_init !== 0) return;
            this.s_table[0] = this.defTimbre;
            //FM.MakeLFOTable();
            this.s_init = 1;
        }

        static clearTimber(): void {
            for (var i: number = 0; i < this.s_table.length; i++) {
                if (i === 0) this.s_table[i] = this.defTimbre;
                else this.s_table[i] = null;
            }
        }

        // AS版のみ
        private static trim(str: String): String {
            var regexHead: RegExp = /^[,]*/m;
            var regexFoot: RegExp = /[,]*$/m;
            return str.replace(regexHead, '').replace(regexFoot, '');
        }

        static setTimber(no: number, type: number, s: String): void {
            if (no < 0 || this.MAX_WAVE <= no) return;

            s = s.replace(/[,;\s\t\r\n]+/gm, ",");
            s = this.trim(s);
            var a: Array<any> = s.split(",");
            var b: Array<number> = new Array<number>(this.TIMB_SZ_M);
            
            // パラメータの数の正当性をチェック
            switch (type) {
                case this.TYPE_OPM: if (a.length < 2 + 11 * 4) return; // 足りない
                    break;
                case this.TYPE_OPN: if (a.length < 2 + 10 * 4) return; // 足りない
                    break;
                default: return; // んなものねぇよ
            }

            var i: number, j: number, l: number;

            switch (type) {
                case this.TYPE_OPM:
                    l = Math.min(this.TIMB_SZ_M, a.length);
                    for (i = 0; i < l; i++) {
                        b[i] = a[i] | 0;
                    }
                    for (; i < this.TIMB_SZ_M; i++) {
                        b[i] = this.zeroTimbre[i];
                    }
                    break;

                case this.TYPE_OPN:
                    // AL FB
                    for (i = 0, j = 0; i < 2; i++ , j++) {
                        b[i] = a[j] | 0;
                    }
                    // AR DR SR RR SL TL KS ML DT AM 4セット
                    for (; i < 46; i++) {
                        if ((i - 2) % 11 === 9) b[i] = 0; // DT2
                        else b[i] = a[j++] | 0;
                    }
                    l = Math.min(this.TIMB_SZ_N, a.length);
                    for (; j < l; i++ , j++) {
                        b[i] = a[j] | 0;
                    }
                    for (; i < this.TIMB_SZ_M; i++) {
                        b[i] = this.zeroTimbre[i];
                    }
                    break;
            }           
        
            // 格納
            this.s_table[no] = b;
        }

        protected loadTimbre(p: Array<number>): void {
            this.SetFBAL(p[1], p[0]);

            var i: number, s: number;
            var slottable: Array<number> = MOscOPM.slottable;

            for (i = 2, s = 0; s < 4; s++ , i += 11) {
                this.SetDT1ML(slottable[s], p[i + 8], p[i + 7]);
                this.m_tl[s] = p[i + 5];
                this.SetTL(slottable[s], p[i + 5]);
                this.SetKSAR(slottable[s], p[i + 6], p[i + 0]);
                this.SetDRAMS(slottable[s], p[i + 1], p[i + 10]);
                this.SetDT2SR(slottable[s], p[i + 9], p[i + 2]);
                this.SetSLRR(slottable[s], p[i + 4], p[i + 3]);
            }

            this.setVelocity(this.m_velocity);
            this.setOpMask(p[i + 0]);
            this.setWF(p[i + 1]);
            this.setLFRQ(p[i + 2]);
            this.setPMD(p[i + 3]);
            this.setAMD(p[i + 4]);
            this.setPMSAMS(p[i + 5], p[i + 6]);
            this.setNENFRQ(p[i + 7], p[i + 8]);
        }

        static setCommonGain(gain: number): void {
            this.s_comGain = gain;
        }
        
        // レジスタ操作系 (非公開)
        private SetFBAL(fb: number, al: number): void {
            var pan: number = 3;
            this.m_al = al & 7;
            this.m_fm.SetReg(0x20, ((pan & 3) << 6) | ((fb & 7) << 3) | (al & 7));
        }
        private SetDT1ML(slot: number, DT1: number, MUL: number): void {
            this.m_fm.SetReg((2 << 5) | ((slot & 3) << 3), ((DT1 & 7) << 4) | (MUL & 15));
        }
        private SetTL(slot: number, TL: number): void {
            if (TL < 0) TL = 0;
            if (TL > 127) TL = 127;
            this.m_fm.SetReg((3 << 5) | ((slot & 3) << 3), TL & 0x7F);
        }
        private SetKSAR(slot: number, KS: number, AR: number): void {
            this.m_fm.SetReg((4 << 5) | ((slot & 3) << 3), ((KS & 3) << 6) | (AR & 0x1f));
        }
        private SetDRAMS(slot: number, DR: number, AMS: number): void {
            this.m_fm.SetReg((5 << 5) | ((slot & 3) << 3), ((AMS & 1) << 7) | (DR & 0x1f));
        }
        private SetDT2SR(slot: number, DT2: number, SR: number): void {
            this.m_fm.SetReg((6 << 5) | ((slot & 3) << 3), ((DT2 & 3) << 6) | (SR & 0x1f));
        }
        private SetSLRR(slot: number, SL: number, RR: number): void {
            this.m_fm.SetReg((7 << 5) | ((slot & 3) << 3), ((SL & 15) << 4) | (RR & 0x0f));
        }

        // レジスタ操作系 (公開)
        setPMSAMS(PMS: number, AMS: number): void {
            this.m_fm.SetReg(0x38, ((PMS & 7) << 4) | ((AMS & 3)));
        }
        setPMD(PMD: number): void {
            this.m_fm.SetReg(0x19, 0x80 | (PMD & 0x7f));
        }
        setAMD(AMD: number): void {
            this.m_fm.SetReg(0x19, 0x00 | (AMD & 0x7f));
        }
        setNENFRQ(NE: number, NFQR: number): void {
            this.m_fm.SetReg(0x0f, ((NE & 1) << 7) | (NFQR & 0x1F));
        }
        setLFRQ(f: number): void {
            this.m_fm.SetReg(0x18, f & 0xff);
        }
        setWF(wf: number): void {
            this.m_fm.SetReg(0x1b, wf & 3);
        }
        noteOn(): void {
            this.m_fm.SetReg(0x01, 0x02); // LFOリセット
            this.m_fm.SetReg(0x01, 0x00);
            this.m_fm.SetReg(0x08, this.m_opMask << 3);
        }
        noteOff(): void {
            this.m_fm.SetReg(0x08, 0x00);
        }       
        
        // 音色選択
        setWaveNo(waveNo: number): void {
            if (waveNo >= MOscOPM.MAX_WAVE) waveNo = MOscOPM.MAX_WAVE - 1;
            if (MOscOPM.s_table[waveNo] == null) waveNo = 0;
            this.m_fm.SetVolume(MOscOPM.s_comGain); // コモンゲイン適用
            this.loadTimbre(MOscOPM.s_table[waveNo]);
        }

        // ノートオン
        setNoteNo(noteNo: number): void {
            this.noteOn();
        }

        // オペレータマスク
        setOpMask(mask: number): void {
            this.m_opMask = mask & 0xF;
        }
        
        // 0～127のベロシティを設定 (キャリアのトータルレベルが操作される)
        setVelocity(vel: number): void {
            this.m_velocity = vel;
            var al: number = this.m_al;
            var tl: Array<number> = this.m_tl;
            var carrierop: number = MOscOPM.carrierop[al];
            var slottable: Array<number> = MOscOPM.slottable;
            this.SetTL(slottable[0], tl[0] + (carrierop & 0x08 ? 127 - vel : 0));
            this.SetTL(slottable[1], tl[1] + (carrierop & 0x10 ? 127 - vel : 0));
            this.SetTL(slottable[2], tl[2] + (carrierop & 0x20 ? 127 - vel : 0));
            this.SetTL(slottable[3], tl[3] + (carrierop & 0x40 ? 127 - vel : 0));
            //if ((carrierop & 0x08) !== 0) this.SetTL(slottable[0], tl[0] + (127 - vel)); else this.SetTL(slottable[0], tl[0]);
            //if ((carrierop & 0x10) !== 0) this.SetTL(slottable[1], tl[1] + (127 - vel)); else this.SetTL(slottable[1], tl[1]);
            //if ((carrierop & 0x20) !== 0) this.SetTL(slottable[2], tl[2] + (127 - vel)); else this.SetTL(slottable[2], tl[2]);
            //if ((carrierop & 0x40) !== 0) this.SetTL(slottable[3], tl[3] + (127 - vel)); else this.SetTL(slottable[3], tl[3]);
        }       

        // 0～1.0のエクスプレッションを設定
        setExpression(ex: number): void {
            this.m_fm.SetExpression(ex);
        }

        setFrequency(frequency: number): void {
            if (this.m_frequency === frequency) {
                return;
            }
            super.setFrequency(frequency);

            // 指示周波数からMIDIノート番号(≠FlMMLノート番号)を逆算する（まったくもって無駄・・）
            var n: number = 1200.0 * Math.log(frequency / 440.0) * Math.LOG2E + 5700.0 + MOscOPM.OPM_RATIO + 0.5 | 0;
            var note: number = n / 100 | 0;
            var cent: number = n % 100;

            // key flaction
            var kf: number = 64.0 * cent / 100.0 + 0.5 | 0;
            // key code
            //                   ------ octave ------   -------- note ---------
            var kc: number = (((note - 1) / 12) << 4) | MOscOPM.kctable[(note + 1200) % 12];

            this.m_fm.SetReg(0x30, kf << 2);
            this.m_fm.SetReg(0x28, kc);
        }

        getNextSample(): number {
            this.m_fm.Mix(this.m_oneSample, 0, 1);
            return this.m_oneSample[0];
        }

        getNextSampleOfs(ofs: number): number {
            this.m_fm.Mix(this.m_oneSample, 0, 1);
            return this.m_oneSample[0];
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            this.m_fm.Mix(samples, start, end - start);
        }

        IsPlaying(): boolean {
            return this.m_fm.IsOn(0);
        }
        
        /*
         * End Class Definition
         */
    }
}
