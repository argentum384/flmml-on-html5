module flmml {
    export class MEnvelope {
        private static SAMPLE_RATE: number;

        private m_envelopePoint: MEnvelopePoint;
        private m_envelopeLastPoint: MEnvelopePoint;
        private m_currentPoint: MEnvelopePoint;
        private m_releaseTime: number;
        private m_currentVal: number;
        private m_releaseStep: number;
        private m_releasing: boolean;
        private m_step: number;
        private m_playing: boolean;
        private m_counter: number;
        private m_timeInSamples: number;
        
        private static s_init: number = 0;
        private static s_volumeMap: Array<Array<number>> = new Array<Array<number>>(3);
        private static s_volumeLen: number;

        // 以前のバージョンとの互換性のためにADSRで初期化
        constructor(attack: number, decay: number, sustain: number, release: number) {
            this.setAttack(attack);
            this.addPoint(decay, sustain);
            this.setRelease(release);
            this.m_playing = false;
            this.m_currentVal = 0;
            this.m_releasing = true;
            this.m_releaseStep = 0;
        }

        static boot(): void {
            if (!this.s_init) {
                var i: number;
                this.SAMPLE_RATE = msgr.SAMPLE_RATE;
                this.s_volumeLen = 256; // MEnvelopeのエンベロープは256段階であることに注意する。
                for (i = 0; i < 3; i++) {
                    this.s_volumeMap[i] = new Array<number>(this.s_volumeLen);
                    this.s_volumeMap[i][0] = 0.0;
                }
                for (i = 1; i < this.s_volumeLen; i++) {
                    this.s_volumeMap[0][i] = i / 255.0;
                    this.s_volumeMap[1][i] = Math.pow(10.0, (i - 255.0) * (48.0 / (255.0 * 20.0))); // min:-48db
                    this.s_volumeMap[2][i] = Math.pow(10.0, (i - 255.0) * (96.0 / (255.0 * 20.0))); // min:-96db
                }
                this.s_init = 1;
            }
        }

        setAttack(attack: number): void {
            this.m_envelopePoint = this.m_envelopeLastPoint = new MEnvelopePoint();
            this.m_envelopePoint.time = 0;
            this.m_envelopePoint.level = 0;
            this.addPoint(attack, 1.0);
        }

        setRelease(release: number): void {
            this.m_releaseTime = ((release > 0) ? release : (1.0 / 127.0)) * MEnvelope.SAMPLE_RATE;
            // 現在のボリュームなどを設定
            if (this.m_playing && !this.m_releasing) {
                this.m_counter = this.m_timeInSamples;
                this.m_currentPoint = this.m_envelopePoint;
                while (this.m_currentPoint.next !== null && this.m_counter >= this.m_currentPoint.next.time) {
                    this.m_currentPoint = this.m_currentPoint.next;
                    this.m_counter -= this.m_currentPoint.time;
                }
                if (this.m_currentPoint.next == null) {
                    this.m_currentVal = this.m_currentPoint.level;
                } else {
                    this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                    this.m_currentVal = this.m_currentPoint.level + (this.m_step * this.m_counter);
                }
            }
        }

        addPoint(time: number, level: number): void {
            var point: MEnvelopePoint = new MEnvelopePoint();
            point.time = time * MEnvelope.SAMPLE_RATE;
            point.level = level;
            this.m_envelopeLastPoint.next = point;
            this.m_envelopeLastPoint = point;
        }

        triggerEnvelope(zeroStart: number): void {
            this.m_playing = true;
            this.m_releasing = false;
            this.m_currentPoint = this.m_envelopePoint;
            this.m_currentVal = this.m_currentPoint.level = (zeroStart) ? 0 : this.m_currentVal;
            this.m_step = (1.0 - this.m_currentVal) / this.m_currentPoint.next.time;
            this.m_timeInSamples = this.m_counter = 0;
        }

        releaseEnvelope(): void {
            this.m_releasing = true;
            this.m_releaseStep = (this.m_currentVal / this.m_releaseTime);
        }

        soundOff(): void {
            this.releaseEnvelope();
            this.m_playing = false;
        }

        getNextAmplitudeLinear(): number {
            if (!this.m_playing) return 0;

            if (!this.m_releasing) {
                if (this.m_currentPoint.next == null) { // sustain phase
                    this.m_currentVal = this.m_currentPoint.level;
                } else {
                    var processed: boolean = false;
                    while (this.m_counter >= this.m_currentPoint.next.time) {
                        this.m_counter = 0;
                        this.m_currentPoint = this.m_currentPoint.next;
                        if (this.m_currentPoint.next == null) {
                            this.m_currentVal = this.m_currentPoint.level;
                            processed = true;
                            break;
                        } else {
                            this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                            this.m_currentVal = this.m_currentPoint.level;
                            processed = true;
                        }
                    }
                    if (!processed) {
                        this.m_currentVal += this.m_step;
                    }
                    this.m_counter++;
                }
            } else {
                this.m_currentVal -= this.m_releaseStep; //release phase
            }
            if (this.m_currentVal <= 0 && this.m_releasing) {
                this.m_playing = false;
                this.m_currentVal = 0;
            }
            this.m_timeInSamples++;
            return this.m_currentVal;
        }

        ampSamplesLinear(samples: Float32Array, start: number, end: number, velocity: number): void {
            var i: number, amplitude: number = this.m_currentVal * velocity;
            for (i = start; i < end; i++) {
                if (!this.m_playing) {
                    samples[i] = 0;
                    continue;
                }

                if (!this.m_releasing) {
                    if (this.m_currentPoint.next == null) { // sustain phase
                        // this.m_currentVal = this.m_currentPoint.level;
                    } else {
                        var processed: boolean = false;
                        while (this.m_counter >= this.m_currentPoint.next.time) {
                            this.m_counter = 0;
                            this.m_currentPoint = this.m_currentPoint.next;
                            if (this.m_currentPoint.next == null) {
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                                break;
                            } else {
                                this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                            }
                        }
                        if (!processed) {
                            this.m_currentVal += this.m_step;
                        }
                        amplitude = this.m_currentVal * velocity;
                        this.m_counter++;
                    }
                } else {
                    this.m_currentVal -= this.m_releaseStep; //release phase
                    amplitude = this.m_currentVal * velocity;
                }
                if (this.m_currentVal <= 0 && this.m_releasing) {
                    this.m_playing = false;
                    amplitude = this.m_currentVal = 0;
                }
                this.m_timeInSamples++;
                samples[i] *= amplitude;
            }
        }

        ampSamplesNonLinear(samples: Float32Array, start: number, end: number, velocity: number, volMode: number): void {
            var i: number;
            for (i = start; i < end; i++) {
                if (!this.m_playing) {
                    samples[i] = 0;
                    continue;
                }

                if (!this.m_releasing) {
                    if (this.m_currentPoint.next == null) { // sustain phase
                        this.m_currentVal = this.m_currentPoint.level;
                    } else {
                        var processed: boolean = false;
                        while (this.m_counter >= this.m_currentPoint.next.time) {
                            this.m_counter = 0;
                            this.m_currentPoint = this.m_currentPoint.next;
                            if (this.m_currentPoint.next == null) {
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                                break;
                            } else {
                                this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                            }
                        }
                        if (!processed) {
                            this.m_currentVal += this.m_step;
                        }
                        this.m_counter++;
                    }
                } else {
                    this.m_currentVal -= this.m_releaseStep; // release phase
                }
                if (this.m_currentVal <= 0 && this.m_releasing) {
                    this.m_playing = false;
                    this.m_currentVal = 0;
                }
                this.m_timeInSamples++;
                var cv: number = (this.m_currentVal * 255) | 0;
                if (cv > 255) {
                    cv = 0; // 0にするのは過去バージョンを再現するため。
                }
                samples[i] *= MEnvelope.s_volumeMap[volMode][cv] * velocity;
            }
        }

        isPlaying(): boolean {
            return this.m_playing;
        }

        isReleasing(): boolean {
            return this.m_releasing;
        }

    }
}
