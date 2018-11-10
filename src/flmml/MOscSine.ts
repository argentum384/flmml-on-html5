/// <reference path="MOscMod.ts" />

module flmml {
    export class MOscSine extends MOscMod {
        static MAX_WAVE: number = 3;
        protected m_waveNo: number;
        protected static s_init: number = 0;
        protected static s_table: Array<Array<number>> = new Array<Array<number>>(MOscSine.MAX_WAVE);;

        constructor() {
            MOscSine.boot();
            super();
            this.setWaveNo(0);
        }

        static boot(): void {
            if (this.s_init) return;
            var d0: number = 2.0 * Math.PI / this.TABLE_LEN;
            var p0: number;
            var i: number;
            for (i = 0; i < this.MAX_WAVE; i++) {
                this.s_table[i] = new Array<number>(this.TABLE_LEN); // 固定長
            }
            for (i = 0, p0 = 0.0; i < this.TABLE_LEN; i++) {
                this.s_table[0][i] = Math.sin(p0);
                this.s_table[1][i] = Math.max(0.0, this.s_table[0][i]);
                this.s_table[2][i] = (this.s_table[0][i] >= 0.0) ? this.s_table[0][i] : this.s_table[0][i] * -1.0;
                p0 += d0;
            }
            this.s_init = 1;
        }

        getNextSample(): number {
            var val: number = MOscSine.s_table[this.m_waveNo][this.m_phase >> MOscSine.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = MOscSine.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscSine.PHASE_MSK) >> MOscSine.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            var tbl: Array<number> = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            }
        }

        getSamplesWithSyncIn(samples: Float32Array, syncin: Array<boolean>, start: number, end: number): void {
            var i: number;
            var tbl: Array<number> = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            }
        }

        getSamplesWithSyncOut(samples: Float32Array, syncout: Array<boolean>, start: number, end: number): void {
            var i: number;
            var tbl: Array<number> = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscSine.PHASE_MSK);
                this.m_phase &= MOscSine.PHASE_MSK;
            }
        }

        setWaveNo(waveNo: number): void {
            if (waveNo >= MOscSine.MAX_WAVE) waveNo = MOscSine.MAX_WAVE - 1;
            if (!MOscSine.s_table[waveNo]) waveNo = 0;
            this.m_waveNo = waveNo;
        }
    }
}
