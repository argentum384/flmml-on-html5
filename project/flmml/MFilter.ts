module flmml {
    export class MFilter {
        private static SAMPLE_RATE: number = null;

        private m_t1: number;
        private m_t2: number;
        private m_b0: number;
        private m_b1: number;
        private m_b2: number;
        private m_b3: number;
        private m_b4: number;
        private sw: number;

        constructor() {
            if (!MFilter.SAMPLE_RATE) MFilter.SAMPLE_RATE = msgr.SAMPLE_RATE;
            this.setSwitch(0);
        }

        reset(): void {
            this.m_t1 = this.m_t2 = this.m_b0 = this.m_b1 = this.m_b2 = this.m_b3 = this.m_b4 = 0.0;
        }

        setSwitch(s: number): void {
            this.reset();
            this.sw = s;
        }

        checkToSilence(): boolean {
            switch (this.sw) {
                case 0:
                    return false;
                case 1:
                case -1:
                    return (-0.000001 <= this.m_b0 && this.m_b0 <= 0.000001 && -0.000001 <= this.m_b1 && this.m_b1 <= 0.000001);
                case 2:
                case -2:
                    return (
                        -0.000001 <= this.m_t1 && this.m_t1 <= 0.000001 &&
                        -0.000001 <= this.m_t2 && this.m_t2 <= 0.000001 &&
                        -0.000001 <= this.m_b0 && this.m_b0 <= 0.000001 &&
                        -0.000001 <= this.m_b1 && this.m_b1 <= 0.000001 &&
                        -0.000001 <= this.m_b2 && this.m_b2 <= 0.000001 &&
                        -0.000001 <= this.m_b3 && this.m_b3 <= 0.000001 &&
                        -0.000001 <= this.m_b4 && this.m_b4 <= 0.000001
                        );
            }
            return false;
        }

        run(samples: Float32Array, start: number, end: number, envelope: MEnvelope, frq: number, amt: number, res: number, key: number): void {
            switch (this.sw) {
                case -2: this.hpf2(samples, start, end, envelope, frq, amt, res, key); break;
                case -1: this.hpf1(samples, start, end, envelope, frq, amt, res, key); break;
                case 0: return;
                case 1: this.lpf1(samples, start, end, envelope, frq, amt, res, key); break;
                case 2: this.lpf2(samples, start, end, envelope, frq, amt, res, key); break;
            }
        }

        lpf1(samples: Float32Array, start: number, end: number, envelope: MEnvelope, frq: number, amt: number, res: number, key: number): void {
            var b0: number = this.m_b0, b1: number = this.m_b1;
            var i: number;
            var fb: number;
            var cut: number;
            var k: number = key * (2.0 * Math.PI / (MFilter.SAMPLE_RATE * 440.0));
            if (amt > 0.0001 || amt < -0.0001) {
                for (i = start; i < end; i++) {
                    cut = MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                    if (cut < (1.0 / 127.0)) cut = 0.0;
                    if (cut > (1.0 - 0.0001)) cut = 1.0 - 0.0001;
                    fb = res + res / (1.0 - cut);
                    // for each sample...
                    b0 = b0 + cut * (samples[i] - b0 + fb * (b0 - b1));
                    samples[i] = b1 = b1 + cut * (b0 - b1);
                }
            }
            else {
                cut = MChannel.getFrequency(frq) * k;
                if (cut < (1.0 / 127.0)) cut = 0.0;
                if (cut > (1.0 - 0.0001)) cut = 1.0 - 0.0001;
                fb = res + res / (1.0 - cut);
                for (i = start; i < end; i++) {
                    // for each sample...
                    b0 = b0 + cut * (samples[i] - b0 + fb * (b0 - b1));
                    samples[i] = b1 = b1 + cut * (b0 - b1);
                }
            }
            this.m_b0 = b0;
            this.m_b1 = b1;
        }

        lpf2(samples: Float32Array, start: number, end: number, envelope: MEnvelope, frq: number, amt: number, res: number, key: number): void {
            var t1: number = this.m_t1, t2: number = this.m_t2, b0: number = this.m_b0, b1: number = this.m_b1, b2: number = this.m_b2, b3: number = this.m_b3, b4: number = this.m_b4;
            var k: number = key * (2.0 * Math.PI / (MFilter.SAMPLE_RATE * 440.0));
            for (var i: number = start; i < end; i++) {
                var cut: number = MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                if (cut < (1.0 / 127.0)) cut = 0.0;
                if (cut > 1.0) cut = 1.0;
                // Set coefficients given frequency & resonance [0.0...1.0]
                var q: number = 1.0 - cut;
                var p: number = cut + 0.8 * cut * q;
                var f: number = p + p - 1.0;
                q = res * (1.0 + 0.5 * q * (1.0 - q + 5.6 * q * q));
                // Filter (input [-1.0...+1.0])
                var input: number = samples[i];
                input -= q * b4;                      //feedback
                t1 = b1; b1 = (input + b0) * p - b1 * f;
                t2 = b2; b2 = (b1 + t1) * p - b2 * f;
                t1 = b3; b3 = (b2 + t2) * p - b3 * f;
                b4 = (b3 + t1) * p - b4 * f;
                b4 = b4 - b4 * b4 * b4 * 0.166667;    //clipping
                b0 = input;
                samples[i] = b4;
            }
            this.m_t1 = t1;
            this.m_t2 = t2;
            this.m_b0 = b0;
            this.m_b1 = b1;
            this.m_b2 = b2;
            this.m_b3 = b3;
            this.m_b4 = b4;
        }

        hpf1(samples: Float32Array, start: number, end: number, envelope: MEnvelope, frq: number, amt: number, res: number, key: number): void {
            var b0: number = this.m_b0, b1: number = this.m_b1;
            var i: number;
            var fb: number;
            var cut: number;
            var k: number = key * (2.0 * Math.PI / (MFilter.SAMPLE_RATE * 440.0));
            var input: number;
            if (amt > 0.0001 || amt < -0.0001) {
                for (i = start; i < end; i++) {
                    cut = MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                    if (cut < (1.0 / 127.0)) cut = 0.0;
                    if (cut > (1.0 - 0.0001)) cut = 1.0 - 0.0001;
                    fb = res + res / (1.0 - cut);
                    // for each sample...
                    input = samples[i];
                    b0 = b0 + cut * (input - b0 + fb * (b0 - b1));
                    b1 = b1 + cut * (b0 - b1);
                    samples[i] = input - b0;
                }
            } else {
                cut = MChannel.getFrequency(frq) * k;
                if (cut < (1.0 / 127.0)) cut = 0.0;
                if (cut > (1.0 - 0.0001)) cut = 1.0 - 0.0001;
                fb = res + res / (1.0 - cut);
                for (i = start; i < end; i++) {
                    // for each sample...
                    input = samples[i];
                    b0 = b0 + cut * (input - b0 + fb * (b0 - b1));
                    b1 = b1 + cut * (b0 - b1);
                    samples[i] = input - b0;
                }
            }
            this.m_b0 = b0;
            this.m_b1 = b1;
        }

        hpf2(samples: Float32Array, start: number, end: number, envelope: MEnvelope, frq: number, amt: number, res: number, key: number): void {
            var t1: number = this.m_t1, t2: number = this.m_t2, b0: number = this.m_b0, b1: number = this.m_b1, b2: number = this.m_b2, b3: number = this.m_b3, b4: number = this.m_b4;
            var k: number = key * (2.0 * Math.PI / (MFilter.SAMPLE_RATE * 440.0));
            for (var i: number = start; i < end; i++) {
                var cut: number = MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                if (cut < (1.0 / 127.0)) cut = 0.0;
                if (cut > 1.0) cut = 1.0;
                // Set coefficients given frequency & resonance [0.0...1.0]
                var q: number = 1.0 - cut;
                var p: number = cut + 0.8 * cut * q;
                var f: number = p + p - 1.0;
                q = res * (1.0 + 0.5 * q * (1.0 - q + 5.6 * q * q));
                // Filter (input [-1.0...+1.0])
                var input: number = samples[i];
                input -= q * b4;                      //feedback
                t1 = b1; b1 = (input + b0) * p - b1 * f;
                t2 = b2; b2 = (b1 + t1) * p - b2 * f;
                t1 = b3; b3 = (b2 + t2) * p - b3 * f;
                b4 = (b3 + t1) * p - b4 * f;
                b4 = b4 - b4 * b4 * b4 * 0.166667;    //clipping
                b0 = input;
                samples[i] = input - b4;
            }
            this.m_t1 = t1;
            this.m_t2 = t2;
            this.m_b0 = b0;
            this.m_b1 = b1;
            this.m_b2 = b2;
            this.m_b3 = b3;
            this.m_b4 = b4;
        }
    }
}
