/// <reference path="MOscMod.ts" />

module FlMMLWorker.flmml {
    export class MOscSaw extends MOscMod {
        static MAX_WAVE: number = 2;
        protected static s_init: number = 0
        protected static s_table: Array<Array<number>>;
        protected m_waveNo: number;

        constructor() {
            MOscSaw.boot();
            super();
            this.setWaveNo(0);
        }

        static boot(): void {
            if (MOscSaw.s_init) return;
            var d0: number = 1.0 / MOscSaw.TABLE_LEN;
            var p0: number;
            var i: number;
            MOscSaw.s_table = new Array<Array<number>>(MOscSaw.MAX_WAVE);
            for (i = 0; i < MOscSaw.MAX_WAVE; i++) {
                MOscSaw.s_table[i] = new Array<number>(MOscSaw.TABLE_LEN); // 固定長
            }
            for (i = 0, p0 = 0.0; i < MOscSaw.TABLE_LEN; i++) {
                MOscSaw.s_table[0][i] = p0 * 2.0 - 1.0;
                MOscSaw.s_table[1][i] = (p0 < 0.5) ? 2.0 * p0 : 2.0 * p0 - 2.0;
                p0 += d0;
            }
            MOscSaw.s_init = 1;
        }

        getNextSample(): number {
            var val: number = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = MOscSaw.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscSaw.PHASE_MSK) >> MOscSaw.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            }
        }

        getSamplesWithSyncIn(samples: Float32Array, syncin: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            }
        }

        getSamplesWithSyncOut(samples: Float32Array, syncout: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscSaw.PHASE_MSK);
                this.m_phase &= MOscSaw.PHASE_MSK;
            }
        }

        setWaveNo(waveNo: number): void {
            this.m_waveNo = Math.min(waveNo, MOscSaw.MAX_WAVE - 1);
        }
    }
} 