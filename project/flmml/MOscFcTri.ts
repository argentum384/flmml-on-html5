/// <reference path="MOscMod.ts" />

module flmml {
    export class MOscFcTri extends MOscMod {
        static FC_TRI_TABLE_LEN: number = (1 << 5);
        static MAX_WAVE: number = 2;
        protected static s_init: number = 0;
        protected static s_table: Array<Array<number>>;
        protected m_waveNo: number;

        constructor() {
            MOscFcTri.boot();
            super();
            this.setWaveNo(0);
        }

        static boot(): void {
            if (this.s_init) return;
            this.s_table = new Array<Array<number>>(this.MAX_WAVE);
            this.s_table[0] = new Array<number>(this.FC_TRI_TABLE_LEN); // @6-0
            this.s_table[1] = new Array<number>(this.FC_TRI_TABLE_LEN); // @6-1
            var i: number;
            for (i = 0; i < 16; i++) {
                this.s_table[0][i] = this.s_table[0][31 - i] = i * 2.0 / 15.0 - 1.0;
            }
            for (i = 0; i < 32; i++) {
                this.s_table[1][i] = (i < 8) ? i * 2.0 / 14.0 : ((i < 24) ? (8 - i) * 2.0 / 15.0 + 1.0 : (i - 24) * 2.0 / 15.0 - 1.0);
            }
            this.s_init = 1;
        }

        getNextSample(): number {
            var val: number = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = MOscFcTri.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscFcTri.PHASE_MSK) >> (MOscFcTri.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            }
        }

        getSamplesWithSyncIn(samples: Float32Array, syncin: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            }
        }

        getSamplesWithSyncOut(samples: Float32Array, syncout: Array<boolean>, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscFcTri.PHASE_MSK);
                this.m_phase &= MOscFcTri.PHASE_MSK;
            }
        }

        setWaveNo(waveNo: number): void {
            this.m_waveNo = Math.min(waveNo, MOscFcTri.MAX_WAVE - 1);
        }
    }
}
