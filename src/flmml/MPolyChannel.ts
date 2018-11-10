/// <reference path="IChannel.ts" />

module flmml {
    /**
     * ...
     * @author ALOE
     */
    export class MPolyChannel implements IChannel {
        protected m_form: number;
        protected m_subform: number;
        protected m_volMode: number;
        protected m_voiceId: number;
        protected m_lastVoice: MChannel;
        protected m_voiceLimit: number;
        protected m_voices: Array<MChannel>;
        protected m_voiceLen: number;

        constructor(voiceLimit: number) {
            this.m_voices = new Array<MChannel>(voiceLimit);
            for (var i: number = 0; i < this.m_voices.length; i++) {
                this.m_voices[i] = new MChannel();
            }
            this.m_form = MOscillator.FC_PULSE;
            this.m_subform = 0;
            this.m_voiceId = 0;
            this.m_volMode = 0;
            this.m_voiceLimit = voiceLimit;
            this.m_lastVoice = null;
            this.m_voiceLen = this.m_voices.length;
        }

        setExpression(ex: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setExpression(ex);
        }

        setVelocity(velocity: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setVelocity(velocity);
        }

        setNoteNo(noteNo: number, tie: boolean = true): void {
            if (this.m_lastVoice !== null && this.m_lastVoice.isPlaying()) {
                this.m_lastVoice.setNoteNo(noteNo, tie);
            }
        }

        setDetune(detune: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setDetune(detune);
        }

        getVoiceCount(): number {
            var i: number;
            var c: number = 0;
            for (i = 0; i < this.m_voiceLen; i++) {
                c += this.m_voices[i].getVoiceCount();
            }
            return c;
        }

        noteOn(noteNo: number, velocity: number): void {
            var i: number;
            var vo: MChannel = null;
            
            // ボイススロットに空きがあるようだ
            if (this.getVoiceCount() <= this.m_voiceLimit) {
                for (i = 0; i < this.m_voiceLen; i++) {
                    if (this.m_voices[i].isPlaying() === false) {
                        vo = this.m_voices[i];
                        break;
                    }
                }
            }
            // やっぱ埋まってたので一番古いボイスを探す
            if (vo == null) {
                var minId: number = Number.MAX_VALUE;
                for (i = 0; i < this.m_voiceLen; i++) {
                    if (minId > this.m_voices[i].getId()) {
                        minId = this.m_voices[i].getId();
                        vo = this.m_voices[i];
                    }
                }
            }
            // 発音する
            vo.setForm(this.m_form, this.m_subform);
            vo.setVolMode(this.m_volMode);
            vo.noteOnWidthId(noteNo, velocity, this.m_voiceId++);
            this.m_lastVoice = vo;
        }

        noteOff(noteNo: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) {
                if (this.m_voices[i].getNoteNo() === noteNo) {
                    this.m_voices[i].noteOff(noteNo);
                }
            }
        }

        setSoundOff(): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setSoundOff();
        }

        close(): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].close();
        }

        setNoiseFreq(frequency: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setNoiseFreq(frequency);
        }

        setForm(form: number, subform: number): void {
            // ノートオン時に適用する
            this.m_form = form;
            this.m_subform = subform;
        }

        setEnvelope1Atk(attack: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setEnvelope1Atk(attack);
        }

        setEnvelope1Point(time: number, level: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setEnvelope1Point(time, level);
        }

        setEnvelope1Rel(release: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setEnvelope1Rel(release);
        }

        setEnvelope2Atk(attack: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setEnvelope2Atk(attack);
        }

        setEnvelope2Point(time: number, level: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setEnvelope2Point(time, level);
        }

        setEnvelope2Rel(release: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setEnvelope2Rel(release);
        }

        setPWM(pwm: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setPWM(pwm);
        }

        setPan(pan: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setPan(pan);
        }

        setFormant(vowel: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setFormant(vowel);
        }

        setLFOFMSF(form: number, subform: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setLFOFMSF(form, subform);
        }

        setLFODPWD(depth: number, freq: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setLFODPWD(depth, freq);
        }

        setLFODLTM(delay: number, time: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setLFODLTM(delay, time);
        }

        setLFOTarget(target: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setLFOTarget(target);
        }

        setLpfSwtAmt(swt: number, amt: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setLpfSwtAmt(swt, amt);
        }

        setLpfFrqRes(frq: number, res: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setLpfFrqRes(frq, res);
        }

        setVolMode(m: number): void {
            // ノートオン時に適用する
            this.m_volMode = m;
        }

        setInput(ii: number, p: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setInput(ii, p);
        }

        setOutput(oo: number, p: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setOutput(oo, p);
        }

        setRing(s: number, p: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setRing(s, p);
        }

        setSync(m: number, p: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setSync(m, p);
        }

        setPortamento(depth: number, len: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setPortamento(depth, len);
        }

        setMidiPort(mode: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setMidiPort(mode);
        }

        setMidiPortRate(rate: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setMidiPortRate(rate);
        }

        setPortBase(portBase: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setPortBase(portBase);
        }

        setVoiceLimit(voiceLimit: number): void {
            this.m_voiceLimit = Math.max(1, Math.min(voiceLimit, this.m_voiceLen));
        }

        setHwLfo(data: number): void {
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].setHwLfo(data);
        }

        reset(): void {
            this.m_form = 0;
            this.m_subform = 0;
            this.m_voiceId = 0;
            this.m_volMode = 0;
            for (var i: number = 0; i < this.m_voiceLen; i++) this.m_voices[i].reset();
        }

        getSamples(samplesSt: Array<Float32Array>, max: number, start: number, delta: number): void {
            var slave: boolean = false;
            for (var i: number = 0; i < this.m_voiceLen; i++) {
                if (this.m_voices[i].isPlaying()) {
                    this.m_voices[i].setSlaveVoice(slave);
                    this.m_voices[i].getSamples(samplesSt, max, start, delta);
                    slave = true;
                }
            }
            if (slave === false) {
                this.m_voices[0].clearOutPipe(max, start, delta);
            }
        }
        /*
         * End Class Definition
         */
    }
}
