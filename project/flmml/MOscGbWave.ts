/// <reference path="MOscMod.ts" />

module flmml {
    export class MOscGbWave extends MOscMod {
        static MAX_WAVE: number = 32;
        static GB_WAVE_TABLE_LEN: number = (1 << 5);
        protected static s_init: number = 0;
        protected static s_table: Array<Array<number>>;
        protected m_waveNo: number;

        constructor() {
            MOscGbWave.boot();
            super();
            this.setWaveNo(0);
        }

        static boot(): void {
            if (this.s_init) return;
            this.s_table = new Array<Array<number>>(this.MAX_WAVE);
            this.setWave(0, "0123456789abcdeffedcba9876543210");
            this.s_init = 1;
        }

        static setWave(waveNo: number, wave: string): void {
            //console.log("["+waveNo+"]"+wave);
            this.s_table[waveNo] = new Array<number>(this.GB_WAVE_TABLE_LEN);
            for (var i: number = 0; i < 32; i++) {
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
                this.s_table[waveNo][i] = (code - 7.5) / 7.5;
            }
        }

        setWaveNo(waveNo: number): void {
            if (waveNo >= MOscGbWave.MAX_WAVE) waveNo = MOscGbWave.MAX_WAVE - 1;
            if (!MOscGbWave.s_table[waveNo]) waveNo = 0;
            this.m_waveNo = waveNo;
        }

        getNextSample(): number {
            var val: number = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = MOscGbWave.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscGbWave.PHASE_MSK) >> (MOscGbWave.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            }
        }

        getSamplesWithSyncIn(samples: Float32Array, syncin: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            }
        }

        getSamplesWithSyncOut(samples: Float32Array, syncout: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscGbWave.PHASE_MSK);
                this.m_phase &= MOscGbWave.PHASE_MSK;
            }
        }
    }
}
