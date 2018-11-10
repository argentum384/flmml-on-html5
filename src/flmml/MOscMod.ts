/// <reference path="MSequencer.ts" />

module flmml {
    export class MOscMod {
        static TABLE_LEN: number = 1 << 16;
        static PHASE_SFT: number = 14;
        static PHASE_LEN: number = MOscMod.TABLE_LEN << MOscMod.PHASE_SFT;
        static PHASE_HLF: number = MOscMod.TABLE_LEN << (MOscMod.PHASE_SFT - 1);
        static PHASE_MSK: number = MOscMod.PHASE_LEN - 1;

        protected m_frequency: number;
        protected m_freqShift: number;
        protected m_phase: number;

        constructor() {
            this.resetPhase();
            this.setFrequency(440.0);
        }

        resetPhase(): void {
            this.m_phase = 0;
        }

        addPhase(time: number): void {
            this.m_phase = (this.m_phase + this.m_freqShift * time) & MOscMod.PHASE_MSK;
        }

        getNextSample(): number {
            return 0;
        }

        getNextSampleOfs(ofs: number): number {
            return 0;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
        }

        getSamplesWithSyncIn(samples: Float32Array, syncin: Array<boolean>, start: number, end: number): void {
            this.getSamples(samples, start, end);
        }

        getSamplesWithSyncOut(samples: Float32Array, syncout: Array<boolean>, start: number, end: number): void {
            this.getSamples(samples, start, end);
        }

        getFrequency(): number {
            return this.m_frequency;
        }

        setFrequency(frequency: number): void {
            this.m_frequency = frequency;
            this.m_freqShift = frequency * (MOscMod.PHASE_LEN / MSequencer.SAMPLE_RATE) | 0;
        }

        setWaveNo(waveNo: number): void {
        }

        setNoteNo(noteNo: number): void {
        }
    }
}
