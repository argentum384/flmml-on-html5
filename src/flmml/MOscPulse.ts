/// <reference path="MOscMod.ts" />

module flmml {
    export class MOscPulse extends MOscMod {
        protected m_pwm: number;
        protected m_mix: number;
        protected m_modNoise: MOscNoise;

        constructor() {
            MOscPulse.boot();
            super();
            this.setPWM(0.5);
            this.setMIX(0);
        }
        static boot(): void {

        }

        getNextSample(): number {
            var val: number = (this.m_phase < this.m_pwm) ? 1.0 : (this.m_mix ? this.m_modNoise.getNextSample() : -1.0);
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
            return val;
        }

        getNextSampleOfs(ofs: number): number {
            var val: number = (((this.m_phase + ofs) & MOscPulse.PHASE_MSK) < this.m_pwm) ? 1.0 : (this.m_mix ? this.m_modNoise.getNextSampleOfs(ofs) : -1.0);
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
            return val;
        }

        getSamples(samples: Float32Array, start: number, end: number): void {
            var i: number;
            if (this.m_mix) { // MIXモード
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
            else { // 通常の矩形波
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
        }

        getSamplesWithSyncIn(samples: Float32Array, syncin: Array<boolean>, start: number, end: number): void {
            var i: number;
            if (this.m_mix) { // MIXモード
                for (i = start; i < end; i++) {
                    if (syncin[i]) this.resetPhase();
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
            else { // 通常の矩形波
                for (i = start; i < end; i++) {
                    if (syncin[i]) this.resetPhase();
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
        }

        getSamplesWithSyncOut(samples: Float32Array, syncout: Array<boolean>, start: number, end: number): void {
            var i: number;
            if (this.m_mix) { // MIXモード
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase += this.m_freqShift;
                    syncout[i] = (this.m_phase > MOscPulse.PHASE_MSK);
                    this.m_phase &= MOscPulse.PHASE_MSK;
                }
            }
            else { // 通常の矩形波
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase += this.m_freqShift;
                    syncout[i] = (this.m_phase > MOscPulse.PHASE_MSK);
                    this.m_phase &= MOscPulse.PHASE_MSK;
                }
            }
        }

        setPWM(pwm: number): void {
            this.m_pwm = pwm * MOscPulse.PHASE_LEN;
        }

        setMIX(mix: number): void {
            this.m_mix = mix;
        }

        setNoise(noise: MOscNoise): void {
            this.m_modNoise = noise;
        }
    }
}
