/// <reference path="MOscMod.ts" />

module flmml {
    export class MOscTriangle extends MOscMod {
        static MAX_WAVE: number = 2;
        protected static s_init: number = 0;
        protected static s_table: Array<Array<number>>;
        protected m_waveNo: number;

        constructor() {
            MOscTriangle.boot();
            super();
            this.setWaveNo(0);
        }

        static boot(): void {
            if (this.s_init) return;
            var d0: number = 1.0 / this.TABLE_LEN;
            var p0: number;
            var i: number;
            this.s_table = new Array<Array<number>>(this.MAX_WAVE);
            for (i = 0; i < this.MAX_WAVE; i++) {
                this.s_table[i] = new Array<number>(this.TABLE_LEN); // 固定長
            }
            for (i = 0, p0 = 0.0; i < this.TABLE_LEN; i++) {
                this.s_table[0][i] = (p0 < 0.50) ? (1.0 - 4.0 * p0) : (1.0 - 4.0 * (1.0 - p0));
                this.s_table[1][i] = (p0 < 0.25) ? (0.0 - 4.0 * p0) : ((p0 < 0.75) ? (-2.0 + 4.0 * p0) : (4.0 - 4.0 * p0));
                p0 += d0;
            }
            this.s_init = 1;
        }

        getNextSample(): number {
            var val: number = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = MOscTriangle.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscTriangle.PHASE_MSK) >> MOscTriangle.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            }
        }

        getSamplesWithSyncIn(samples: Float32Array, syncin: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            }
        }

        getSamplesWithSyncOut(samples: Float32Array, syncout: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscTriangle.PHASE_MSK);
                this.m_phase &= MOscTriangle.PHASE_MSK;
            }
        }

        setWaveNo(waveNo: number): void {
            this.m_waveNo = Math.min(waveNo, MOscTriangle.MAX_WAVE - 1);
        }
    }
}
