/// <reference path="MOscMod.ts" />

module flmml {
    /**
       DPCM Oscillator by OffGao
       09/05/11：作成
       09/11/05：波形データ格納処理で、データが32bitごとに1bit抜けていたのを修正
     */
    export class MOscFcDpcm extends MOscMod {
        static MAX_WAVE: number = 16;
        static FC_CPU_CYCLE: number = 1789773;
        static FC_DPCM_PHASE_SFT: number = 2;
        static FC_DPCM_MAX_LEN: number = 0xff1;//(0xff * 0x10) + 1 ファミコン準拠の最大レングス
        static FC_DPCM_TABLE_MAX_LEN: number = (MOscFcDpcm.FC_DPCM_MAX_LEN >> 2) + 2;
        static FC_DPCM_NEXT: number;
        protected m_readCount: number; //次の波形生成までのカウント値
        protected m_address: number;   //読み込み中のアドレス位置
        protected m_bit: number;       //読み込み中のビット位置
        protected m_wav: number;       //現在のボリューム
        protected m_length: number;    //残り読み込み長
        protected m_ofs: number;       //前回のオフセット
        protected static s_init: number;
        protected static s_table: Array<Array<number>>;
        protected static s_intVol: Array<number>; //波形初期位置
        protected static s_loopFg: Array<number>; //ループフラグ
        protected static s_length: Array<number>; //再生レングス
        protected m_waveNo: number;
        protected static s_interval: Array<number> = [ //音程
            428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 85, 72, 54,
        ];

        constructor() {
            MOscFcDpcm.boot();
            this.m_readCount = 0;
            this.m_address = 0;
            this.m_bit = 0;
            this.m_wav = 0;
            this.m_length = 0;
            this.m_ofs = 0;
            super();
            this.setWaveNo(0);
        }

        static boot(): void {
            if (this.s_init) return;

            this.FC_DPCM_NEXT = msgr.SAMPLE_RATE << this.FC_DPCM_PHASE_SFT;

            this.s_table = new Array<Array<number>>(this.MAX_WAVE);
            this.s_intVol = new Array<number>(this.MAX_WAVE);
            this.s_loopFg = new Array<number>(this.MAX_WAVE);
            this.s_length = new Array<number>(this.MAX_WAVE);
            this.setWave(0, 127, 0, "");
            this.s_init = 1;
        }

        static setWave(waveNo: number, intVol: number, loopFg: number, wave: string): void {
            this.s_intVol[waveNo] = intVol;
            this.s_loopFg[waveNo] = loopFg;
            this.s_length[waveNo] = 0;

            this.s_table[waveNo] = new Array<number>(this.FC_DPCM_TABLE_MAX_LEN);
            var strCnt: number = 0;
            var intCnt: number = 0;
            var intCn2: number = 0;
            var intPos: number = 0;
            for (var i: number = 0; i < this.FC_DPCM_TABLE_MAX_LEN; i++) {
                this.s_table[waveNo][i] = 0;
            }

            for (strCnt = 0; strCnt < wave.length; strCnt++) {
                var code: number = wave.charCodeAt(strCnt);
                if (0x41 <= code && code <= 0x5a) { //A-Z
                    code -= 0x41;
                }
                else if (0x61 <= code && code <= 0x7a) { //a-z
                    code -= 0x61 - 26;
                }
                else if (0x30 <= code && code <= 0x39) { //0-9
                    code -= 0x30 - 26 - 26;
                }
                else if (0x2b === code) { //+
                    code = 26 + 26 + 10;
                }
                else if (0x2f === code) { // /
                    code = 26 + 26 + 10 + 1;
                }
                else if (0x3d === code) { // =
                    code = 0;
                }
                else {
                    code = 0;
                }
                for (i = 5; i >= 0; i--) {
                    this.s_table[waveNo][intPos] += ((code >> i) & 1) << (intCnt * 8 + 7 - intCn2);
                    intCn2++;
                    if (intCn2 >= 8) {
                        intCn2 = 0;
                        intCnt++;
                    }
                    this.s_length[waveNo]++;
                    if (intCnt >= 4) {
                        intCnt = 0;
                        intPos++;
                        if (intPos >= this.FC_DPCM_TABLE_MAX_LEN) {
                            intPos = this.FC_DPCM_TABLE_MAX_LEN - 1;
                        }
                    }
                }
            }
            //レングス中途半端な場合、削る
            this.s_length[waveNo] -= ((this.s_length[waveNo] - 8) % 0x80);
            //最大・最小サイズ調整
            if (this.s_length[waveNo] > this.FC_DPCM_MAX_LEN * 8) {
                this.s_length[waveNo] = this.FC_DPCM_MAX_LEN * 8;
            }
            if (this.s_length[waveNo] === 0) {
                this.s_length[waveNo] = 8;
            }
            //長さが指定されていれば、それを格納
            //if (length >= 0) this.s_length[waveNo] = (length * 0x10 + 1) * 8;
        }

        setWaveNo(waveNo: number): void {
            if (waveNo >= MOscFcDpcm.MAX_WAVE) waveNo = MOscFcDpcm.MAX_WAVE - 1;
            if (!MOscFcDpcm.s_table[waveNo]) waveNo = 0;
            this.m_waveNo = waveNo;
        }

        private getValue(): number {
            if (this.m_length > 0) {
                if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                    if (this.m_wav < 126) this.m_wav += 2;
                } else {
                    if (this.m_wav > 1) this.m_wav -= 2;
                }
                this.m_bit++;
                if (this.m_bit >= 32) {
                    this.m_bit = 0;
                    this.m_address++;
                }
                this.m_length--;
                if (this.m_length === 0) {
                    if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                        this.m_address = 0;
                        this.m_bit = 0;
                        this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                    }
                }
                return (this.m_wav - 64) / 64.0;
            } else {
                return (this.m_wav - 64) / 64.0;
            }
        }

        resetPhase(): void {
            this.m_phase = 0;
            this.m_address = 0;
            this.m_bit = 0;
            this.m_ofs = 0;
            this.m_wav = MOscFcDpcm.s_intVol[this.m_waveNo];
            this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
        }

        getNextSample(): number {
            var val: number = (this.m_wav - 64) / 64.0;
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcDpcm.PHASE_MSK;
            while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                //CPU負荷軽減のため
                //val = getValue();
                {
                    if (this.m_length > 0) {
                        if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                            if (this.m_wav < 126) this.m_wav += 2;
                        } else {
                            if (this.m_wav > 1) this.m_wav -= 2;
                        }
                        this.m_bit++;
                        if (this.m_bit >= 32) {
                            this.m_bit = 0;
                            this.m_address++;
                        }
                        this.m_length--;
                        if (this.m_length === 0) {
                            if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                this.m_address = 0;
                                this.m_bit = 0;
                                this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                            }
                        }
                        val = (this.m_wav - 64) / 64.0;
                    } else {
                        val = (this.m_wav - 64) / 64.0;
                    }
                }
            }
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = (this.m_wav - 64) / 64.0;
            this.m_phase = (this.m_phase + this.m_freqShift + ((ofs - this.m_ofs) >> (MOscFcDpcm.PHASE_SFT - 7))) & MOscFcDpcm.PHASE_MSK;
            while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                //CPU負荷軽減のため
                //val = getValue();
                {
                    if (this.m_length > 0) {
                        if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                            if (this.m_wav < 126) this.m_wav += 2;
                        } else {
                            if (this.m_wav > 1) this.m_wav -= 2;
                        }
                        this.m_bit++;
                        if (this.m_bit >= 32) {
                            this.m_bit = 0;
                            this.m_address++;
                        }
                        this.m_length--;
                        if (this.m_length === 0) {
                            if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                this.m_address = 0;
                                this.m_bit = 0;
                                this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                            }
                        }
                        val = (this.m_wav - 64) / 64.0;
                    } else {
                        val = (this.m_wav - 64) / 64.0;
                    }
                }
            }
            this.m_ofs = ofs;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            var val: number = (this.m_wav - 64) / 64.0;
            for (i = start; i < end; i++) {
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcDpcm.PHASE_MSK;
                while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                    this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                    //CPU負荷軽減のため
                    //val = getValue();
                    {
                        if (this.m_length > 0) {
                            if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                                if (this.m_wav < 126) this.m_wav += 2;
                            } else {
                                if (this.m_wav > 1) this.m_wav -= 2;
                            }
                            this.m_bit++;
                            if (this.m_bit >= 32) {
                                this.m_bit = 0;
                                this.m_address++;
                            }
                            this.m_length--;
                            if (this.m_length === 0) {
                                if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                    this.m_address = 0;
                                    this.m_bit = 0;
                                    this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                                }
                            }
                            val = (this.m_wav - 64) / 64.0;
                        } else {
                            val = (this.m_wav - 64) / 64.0;
                        }
                    }
                }
                samples[i] = val;
            }
        }

        setFrequency(frequency: number): void {
            //this.m_frequency = frequency;
            this.m_freqShift = frequency * (1 << (MOscFcDpcm.FC_DPCM_PHASE_SFT + 4)) | 0; // as interval
        }

        setDpcmFreq(no: number): void {
            if (no < 0) no = 0;
            if (no > 15) no = 15;
            this.m_freqShift = (MOscFcDpcm.FC_CPU_CYCLE << MOscFcDpcm.FC_DPCM_PHASE_SFT) / MOscFcDpcm.s_interval[no] | 0; // as interval
        }

        setNoteNo(noteNo: number): void {
            this.setDpcmFreq(noteNo);
        }
    }
}
