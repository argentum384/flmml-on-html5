/// <reference path="MOscMod.ts" />

module flmml {
    export class MOscWave extends MOscMod {
        static MAX_WAVE: number = 32;
        static MAX_LENGTH: number = 2048;
        protected static s_init: number = 0;
        protected static s_table: Array<Array<number>>;
        protected static s_length: Array<number>;
        protected m_waveNo: number;

        constructor() {
            MOscWave.boot();
            super();
            this.setWaveNo(0);
        }

        static boot(): void {
            if (this.s_init) return;
            this.s_table = new Array<Array<number>>(this.MAX_WAVE);
            this.s_length = new Array<number>(this.MAX_WAVE);
            this.setWave(0, "00112233445566778899AABBCCDDEEFFFFEEDDCCBBAA99887766554433221100");
            this.s_init = 1;
        }

        static setWave(waveNo: number, wave: String): void {
            //console.log("["+waveNo+"]"+wave);
            this.s_length[waveNo] = 0;
            this.s_table[waveNo] = new Array<number>(wave.length / 2);
            this.s_table[waveNo][0] = 0;
            for (var i: number = 0, j: number = 0, val: number = 0; i < this.MAX_LENGTH && i < wave.length; i++ , j++) {
                var code: number = wave.charCodeAt(i);
                if (48 <= code && code < 58) {
                    code -= 48;
                }
                else if (97 <= code && code < 103) {
                    code -= 97 - 10;
                }
                else {
                    code = 0;
                }
                if (j & 1) {
                    val += code;
                    this.s_table[waveNo][this.s_length[waveNo]] = (Number(val) - 127.5) / 127.5;
                    this.s_length[waveNo]++;
                } else {
                    val = code << 4;
                }
            }
            if (this.s_length[waveNo] === 0) this.s_length[waveNo] = 1;
            this.s_length[waveNo] = (this.PHASE_MSK + 1) / this.s_length[waveNo];
        }

        setWaveNo(waveNo: number): void {
            if (waveNo >= MOscWave.MAX_WAVE) waveNo = MOscWave.MAX_WAVE - 1;
            if (!MOscWave.s_table[waveNo]) waveNo = 0;

            this.m_waveNo = waveNo;
        }
        getNextSample(): number {
            var val: number = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = MOscWave.s_table[this.m_waveNo][Math.floor(((this.m_phase + ofs) & MOscWave.PHASE_MSK) / MOscWave.s_length[this.m_waveNo])];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            }
        }

        getSamplesWithSyncIn(samples: Float32Array, syncin: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            }
        }

        getSamplesWithSyncOut(samples: Float32Array, syncout: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscWave.PHASE_MSK);
                this.m_phase &= MOscWave.PHASE_MSK;
            }
        }
    }
}
