/// <reference path="MOscMod.ts" />

module flmml {
    export class MOscNoise extends MOscMod {
        static TABLE_MSK: number = MOscNoise.TABLE_LEN - 1;
        static NOISE_PHASE_SFT: number = 30;
        static NOISE_PHASE_MSK: number = (1 << MOscNoise.NOISE_PHASE_SFT) - 1;0
        protected m_noiseFreq: number;
        protected m_counter: number;
        protected m_resetPhase: boolean;
        static s_init: number = 0;
        static s_table: Array<number> = new Array<number>(MOscNoise.TABLE_LEN);

        constructor() {
            MOscNoise.boot();
            super();
            this.setNoiseFreq(1.0);
            this.m_phase = 0;
            this.m_counter = 0;
            this.m_resetPhase = true;
        }

        disableResetPhase(): void {
            this.m_resetPhase = false;
        }

        static boot(): void {
            if (this.s_init) return;
            for (var i: number = 0; i < this.TABLE_LEN; i++) {
                this.s_table[i] = Math.random() * 2.0 - 1.0;
            }
            this.s_init = 1;
        }

        resetPhase(): void {
            if (this.m_resetPhase) this.m_phase = 0;
            //this.m_counter = 0;
        }

        addPhase(time: number): void {
            this.m_counter = (this.m_counter + this.m_freqShift * time);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
        }

        getNextSample(): number {
            var val: number = MOscNoise.s_table[this.m_phase];
            this.m_counter = (this.m_counter + this.m_freqShift);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = MOscNoise.s_table[(this.m_phase + (ofs << MOscNoise.PHASE_SFT)) & MOscNoise.TABLE_MSK];
            this.m_counter = (this.m_counter + this.m_freqShift);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                samples[i] = MOscNoise.s_table[this.m_phase];
                this.m_counter = (this.m_counter + this.m_freqShift);
                this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
                this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            }
        }

        setFrequency(frequency: number): void {
            this.m_frequency = frequency;
        }

        setNoiseFreq(frequency: number): void {
            this.m_noiseFreq = frequency * (1 << MOscNoise.NOISE_PHASE_SFT);
            this.m_freqShift = this.m_noiseFreq;
        }

        restoreFreq(): void {
            this.m_freqShift = this.m_noiseFreq;
        }
    }
}
