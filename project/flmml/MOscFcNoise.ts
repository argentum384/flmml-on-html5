/// <reference path="MOscMod.ts" />

module flmml {
    /**
       Special thanks to OffGao.
     */
    export class MOscFcNoise extends MOscMod {
        static FC_NOISE_PHASE_SFT: number = 10;
        static FC_NOISE_PHASE_SEC: number = (1789773 << MOscFcNoise.FC_NOISE_PHASE_SFT) | 0;
        static FC_NOISE_PHASE_DLT: number;
        protected static s_interval: Array<number> = [
            0x004, 0x008, 0x010, 0x020, 0x040, 0x060, 0x080, 0x0a0, 0x0ca, 0x0fe, 0x17c, 0x1fc, 0x2fa, 0x3f8, 0x7f2, 0xfe4
        ];
        protected m_fcr: number;
        protected m_snz: number;
        protected m_val: number;

        private getValue(): number {
            this.m_fcr >>= 1;
            this.m_fcr |= ((this.m_fcr ^ (this.m_fcr >> this.m_snz)) & 1) << 15;
            return (this.m_fcr & 1) ? 1.0 : -1.0;
        }

        setShortMode(): void {
            this.m_snz = 6;
        }

        setLongMode(): void {
            this.m_snz = 1;
        }

        constructor() {
            MOscFcNoise.boot();
            super();
            this.setLongMode();
            this.m_fcr = 0x8000;
            this.m_val = this.getValue();
            this.setNoiseFreq(0);
        }

        resetPhase(): void {
        }

        addPhase(time: number): void {
            this.m_phase = this.m_phase + MOscFcNoise.FC_NOISE_PHASE_DLT * time | 0;
            while (this.m_phase >= this.m_freqShift) {
                this.m_phase -= this.m_freqShift;
                this.m_val = this.getValue();
            }
        }

        static boot(): void {
            MOscFcNoise.FC_NOISE_PHASE_DLT = MOscFcNoise.FC_NOISE_PHASE_SEC / msgr.SAMPLE_RATE | 0;
        }

        getNextSample(): number {
            var val: number = this.m_val;
            var sum: number = 0;
            var cnt: number = 0;
            var delta: number = MOscFcNoise.FC_NOISE_PHASE_DLT;
            while (delta >= this.m_freqShift) {
                delta -= this.m_freqShift;
                this.m_phase = 0;
                sum += this.getValue();
                cnt += 1.0;
            }
            if (cnt > 0) {
                this.m_val = sum / cnt;
            }
            this.m_phase = this.m_phase + delta | 0;
            if (this.m_phase >= this.m_freqShift) {
                this.m_phase -= this.m_freqShift;
                this.m_val = this.getValue();
            }
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var fcr: number = this.m_fcr;
            var phase: number = this.m_phase;
            var val: number = this.m_val;
            var sum: number = 0;
            var cnt: number = 0;
            var delta: number = MOscFcNoise.FC_NOISE_PHASE_DLT + ofs
            while (delta >= this.m_freqShift) {
                delta -= this.m_freqShift;
                this.m_phase = 0;
                sum += this.getValue();
                cnt += 1.0;
            }
            if (cnt > 0) {
                this.m_val = sum / cnt;
            }
            this.m_phase = this.m_phase + delta | 0;
            if (this.m_phase >= this.m_freqShift) {
                this.m_phase = this.m_freqShift;
                this.m_val = this.getValue();
            }
            /* */
            this.m_fcr = fcr;
            this.m_phase = phase;
            this.getNextSample();
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            for (var i: number = start; i < end; i++) {
                samples[i] = this.getNextSample();
            }
        }

        setFrequency(frequency: number): void {
            //this.m_frequency = frequency;
            this.m_freqShift = MOscFcNoise.FC_NOISE_PHASE_SEC / frequency | 0;
        }

        setNoiseFreq(no: number): void {
            if (no < 0) no = 0;
            if (no > 15) no = 15;
            this.m_freqShift = MOscFcNoise.s_interval[no] << MOscFcNoise.FC_NOISE_PHASE_SFT | 0; // as interval
        }

        setNoteNo(noteNo: number): void {
            this.setNoiseFreq(noteNo);
        }
    }
}
