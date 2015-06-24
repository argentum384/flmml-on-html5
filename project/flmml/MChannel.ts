/// <reference path="IChannel.ts" />

module flmml {
    export class MChannel implements IChannel {
        // 戻すときは正規表現使用の置換で
        // /\*MChannel\.LFO_TARGET_(.*)\*/[0-9]*
        //  ↓
        // MChannel.LFO_TARGET_$1
        //
        //private static LFO_TARGET_PITCH: number = 0;
        //private static LFO_TARGET_AMPLITUDE: number = 1;
        //private static LFO_TARGET_CUTOFF: number = 2;
        //private static LFO_TARGET_PWM: number = 3;
        //private static LFO_TARGET_FM: number = 4;
        //private static LFO_TARGET_PANPOT: number = 5;

        private static SAMPLE_RATE: number;
        private static emptyBuffer: Float32Array;

        private m_noteNo: number;
        private m_detune: number;
        private m_freqNo: number;
        private m_envelope1: MEnvelope; // for VCO
        private m_envelope2: MEnvelope; // for VCF
        private m_oscSet1: MOscillator; // for original wave
        private m_oscMod1: MOscMod;
        private m_oscSet2: MOscillator; // for Pitch LFO
        private m_oscMod2: MOscMod;
        private m_osc2Connect: number;
        private m_osc2Sign: number;
        private m_filter: MFilter;
        private m_filterConnect: number;
        private m_formant: MFormant;
        private m_expression: number;   // expression (max: 1.0)
        private m_velocity: number;     // velocity (max: 1.0)
        private m_ampLevel: number;     // amplifier level (max: 1.0)
        private m_pan: number;          // left 0.0 - 1.0 right
        private m_onCounter: number;
        private m_lfoDelay: number;
        private m_lfoDepth: number;
        private m_lfoEnd: number;
        private m_lfoTarget: number;
        private m_lpfAmt: number;
        private m_lpfFrq: number;
        private m_lpfRes: number;
        private m_pulseWidth: number;
        private m_volMode: number;
        private m_inSens: number;
        private m_inPipe: number;
        private m_outMode: number;
        private m_outPipe: number;
        private m_ringSens: number;
        private m_ringPipe: number;
        private m_syncMode: number;
        private m_syncPipe: number;

        private m_portDepth: number;
        private m_portDepthAdd: number;
        private m_portamento: number;
        private m_portRate: number;
        private m_lastFreqNo: number;

        private m_slaveVoice: boolean; // 従属ボイスか？
        private m_voiceid: number;     // ボイスID

        static PITCH_RESOLUTION: number = 100;
        protected static s_init: number = 0;
        protected static s_frequencyMap: Array<number> = new Array<number>(128 * MChannel.PITCH_RESOLUTION);
        protected static s_frequencyLen: number;
        protected static s_volumeMap: Array<Array<number>>;
        protected static s_volumeLen: number;
        protected static s_samples: Float32Array; // mono
        protected static s_pipeArr: Array<Float32Array>;
        protected static s_syncSources: Array<Array<boolean>>;
        protected static s_lfoDelta: number = 245;

        constructor() {
            this.m_noteNo = 0;
            this.m_detune = 0;
            this.m_freqNo = 0;
            this.m_envelope1 = new MEnvelope(0.0, 60.0 / 127.0, 30.0 / 127.0, 1.0 / 127.0);
            this.m_envelope2 = new MEnvelope(0.0, 30.0 / 127.0, 0.0, 1.0);
            this.m_oscSet1 = new MOscillator();
            this.m_oscMod1 = this.m_oscSet1.getCurrent();
            this.m_oscSet2 = new MOscillator();
            this.m_oscSet2.asLFO();
            this.m_oscSet2.setForm(MOscillator.SINE);
            this.m_oscMod2 = this.m_oscSet2.getCurrent();
            this.m_osc2Connect = 0;
            this.m_filter = new MFilter();
            this.m_filterConnect = 0;
            this.m_formant = new MFormant();
            this.m_volMode = 0;
            this.setExpression(127);
            this.setVelocity(100);
            this.setPan(64);
            this.m_onCounter = 0;
            this.m_lfoDelay = 0;
            this.m_lfoDepth = 0.0;
            this.m_lfoEnd = 0;
            this.m_lpfAmt = 0;
            this.m_lpfFrq = 0;
            this.m_lpfRes = 0;
            this.m_pulseWidth = 0.5;
            this.setInput(0, 0);
            this.setOutput(0, 0);
            this.setRing(0, 0);
            this.setSync(0, 0);
            this.m_portDepth = 0;
            this.m_portDepthAdd = 0;
            this.m_lastFreqNo = 4800;
            this.m_portamento = 0;
            this.m_portRate = 0;
            this.m_voiceid = 0;
            this.m_slaveVoice = false;
        }

        static boot(numSamples: number): void {
            if (!this.s_init) {
                var i: number;
                this.SAMPLE_RATE = msgr.SAMPLE_RATE;
                this.emptyBuffer = msgr.emptyBuffer;
                this.s_frequencyLen = this.s_frequencyMap.length;
                for (i = 0; i < this.s_frequencyLen; i++) {
                    this.s_frequencyMap[i] = 440.0 * Math.pow(2.0, (i - 69 * this.PITCH_RESOLUTION) / (12.0 * this.PITCH_RESOLUTION));
                }
                this.s_volumeLen = 128;
                this.s_volumeMap = new Array<Array<number>>(3)
                for (i = 0; i < 3; i++) {
                    this.s_volumeMap[i] = new Array<number>(this.s_volumeLen);
                    this.s_volumeMap[i][0] = 0.0;
                }
                for (i = 1; i < this.s_volumeLen; i++) {
                    this.s_volumeMap[0][i] = i / 127.0;
                    this.s_volumeMap[1][i] = Math.pow(10.0, (i - 127.0) * (48.0 / (127.0 * 20.0))); // min:-48db
                    this.s_volumeMap[2][i] = Math.pow(10.0, (i - 127.0) * (96.0 / (127.0 * 20.0))); // min:-96db
                    //console.log(i+","+this.s_volumeMap[i]);
                }
                this.s_init = 1;
            }
            this.s_samples = new Float32Array(numSamples);
        }
        
        static createPipes(num: number): void {
            this.s_pipeArr = new Array<Float32Array>(num);
            for (var i: number = 0; i < num; i++) {
                this.s_pipeArr[i] = new Float32Array(this.s_samples.length);
            }
        }

        static createSyncSources(num: number): void {
            this.s_syncSources = new Array<Array<boolean>>(num);
            for (var i: number = 0; i < num; i++) {
                this.s_syncSources[i] = new Array<boolean>(this.s_samples.length);
                for (var j: number = 0; j < this.s_samples.length; j++) {
                    this.s_syncSources[i][j] = false;
                }
            }
        }

        static getFrequency(freqNo: number): number {
            freqNo |= 0;
            freqNo = (freqNo < 0) ? 0 : (freqNo >= MChannel.s_frequencyLen) ? MChannel.s_frequencyLen - 1 : freqNo;
            return MChannel.s_frequencyMap[freqNo];
        }

        setExpression(ex: number): void {
            this.m_expression = MChannel.s_volumeMap[this.m_volMode][ex];
            this.m_ampLevel = this.m_velocity * this.m_expression;
            (<MOscOPM>this.m_oscSet1.getMod(MOscillator.OPM)).setExpression(this.m_expression); // ０～１．０の値
        }

        setVelocity(velocity: number): void {
            this.m_velocity = MChannel.s_volumeMap[this.m_volMode][velocity];
            this.m_ampLevel = this.m_velocity * this.m_expression;
            (<MOscOPM>this.m_oscSet1.getMod(MOscillator.OPM)).setVelocity(velocity); // ０～１２７の値
        }

        setNoteNo(noteNo: number, tie: boolean = true): void {
            this.m_noteNo = noteNo;
            this.m_freqNo = this.m_noteNo * MChannel.PITCH_RESOLUTION + this.m_detune;
            this.m_oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));

            if (this.m_portamento === 1) {
                if (!tie) {
                    this.m_portDepth = this.m_lastFreqNo - this.m_freqNo;
                }
                else {
                    this.m_portDepth += (this.m_lastFreqNo - this.m_freqNo);
                }
                this.m_portDepthAdd = (this.m_portDepth < 0) ? this.m_portRate : this.m_portRate * -1;
            }
            this.m_lastFreqNo = this.m_freqNo;
        }

        setDetune(detune: number): void {
            this.m_detune = detune;
            this.m_freqNo = this.m_noteNo * MChannel.PITCH_RESOLUTION + this.m_detune;
            this.m_oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
        }

        getNoteNo(): number {
            return this.m_noteNo;
        }

        isPlaying(): boolean {
            if (this.m_oscSet1.getForm() === MOscillator.OPM) {
                return (<MOscOPM>this.m_oscSet1.getCurrent()).IsPlaying();
            }
            else {
                return this.m_envelope1.isPlaying();
            }
        }

        getId(): number {
            return this.m_voiceid;
        }

        getVoiceCount(): number {
            return this.isPlaying() ? 1 : 0;
        }

        setSlaveVoice(f: boolean): void {
            this.m_slaveVoice = f;
        }

        noteOnWidthId(noteNo: number, velocity: number, id: number): void {
            this.m_voiceid = id;
            this.noteOn(noteNo, velocity);
        }

        noteOn(noteNo: number, velocity: number): void {
            this.setNoteNo(noteNo, false);
            this.m_envelope1.triggerEnvelope(0);
            this.m_envelope2.triggerEnvelope(1);
            this.m_oscMod1.resetPhase();
            this.m_oscMod2.resetPhase();
            this.m_filter.reset();
            this.setVelocity(velocity);
            this.m_onCounter = 0;

            var modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE);
            modPulse.setPWM(this.m_pulseWidth);

            var oscSet1 = this.m_oscSet1;
            oscSet1.getMod(MOscillator.FC_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(MOscillator.GB_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(MOscillator.GB_S_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(MOscillator.FC_DPCM).setNoteNo(this.m_noteNo);
            oscSet1.getMod(MOscillator.OPM).setNoteNo(this.m_noteNo);
        }

        noteOff(noteNo: number): void {
            if (noteNo < 0 || noteNo === this.m_noteNo) {
                this.m_envelope1.releaseEnvelope();
                this.m_envelope2.releaseEnvelope();
                (<MOscOPM>this.m_oscSet1.getMod(MOscillator.OPM)).noteOff();
            }
        }

        setSoundOff(): void {
            this.m_envelope1.soundOff();
            this.m_envelope2.soundOff();
        }

        close(): void {
            this.noteOff(this.m_noteNo);
            this.m_filter.setSwitch(0);
        }

        setNoiseFreq(frequency: number): void {
            var modNoise: MOscNoise = <MOscNoise>this.m_oscSet1.getMod(MOscillator.NOISE);
            modNoise.setNoiseFreq(1.0 - frequency * (1.0 / 128.0));
        }

        setForm(form: number, subform: number): void {
            this.m_oscMod1 = this.m_oscSet1.setForm(form);
            this.m_oscMod1.setWaveNo(subform);
        }

        setEnvelope1Atk(attack: number): void {
            this.m_envelope1.setAttack(attack * (1.0 / 127.0));
        }

        setEnvelope1Point(time: number, level: number): void {
            this.m_envelope1.addPoint(time * (1.0 / 127.0), level * (1.0 / 127.0));
        }

        setEnvelope1Rel(release: number): void {
            this.m_envelope1.setRelease(release * (1.0 / 127.0));
        }

        setEnvelope2Atk(attack: number): void {
            this.m_envelope2.setAttack(attack * (1.0 / 127.0));
        }

        setEnvelope2Point(time: number, level: number): void {
            this.m_envelope2.addPoint(time * (1.0 / 127.0), level * (1.0 / 127.0));
        }

        setEnvelope2Rel(release: number): void {
            this.m_envelope2.setRelease(release * (1.0 / 127.0));
        }

        setPWM(pwm: number): void {
            if (this.m_oscSet1.getForm() !== MOscillator.FC_PULSE) {
                var modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE);
                if (pwm < 0) {
                    modPulse.setMIX(1);
                    pwm *= -1;
                }
                else {
                    modPulse.setMIX(0);
                }
                this.m_pulseWidth = pwm * 0.01;
                modPulse.setPWM(this.m_pulseWidth);
            } else {
                var modFcPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.FC_PULSE);
                if (pwm < 0) pwm *= -1; // 以前との互換のため
                modFcPulse.setPWM(0.125 * Math.floor(pwm));
            }
        }

        setPan(pan: number): void {
            // left 1 - 64 - 127 right
            // master_vol = (0.25 * 2)
            this.m_pan = (pan - 1) * (0.5 / 63.0);
            if (this.m_pan < 0) this.m_pan = 0;
        }

        setFormant(vowel: number): void {
            if (vowel >= 0) this.m_formant.setVowel(vowel);
            else this.m_formant.disable();
        }

        setLFOFMSF(form: number, subform: number): void {
            this.m_oscMod2 = this.m_oscSet2.setForm((form >= 0) ? form - 1 : -form - 1);
            this.m_oscMod2.setWaveNo(subform);
            this.m_osc2Sign = (form >= 0) ? 1.0 : -1.0;
            if (form < 0) form = -form;
            form--;
            if (form >= MOscillator.MAX) this.m_osc2Connect = 0;
            //if (form === MOscillator.GB_WAVE)
            //    (MOscGbWave)(this.m_oscSet2.getMod(MOscillator.GB_WAVE)).setWaveNo(subform);
            //if (form === MOscillator.FC_DPCM)
            //    (MOscFcDpcm)(this.m_oscSet2.getMod(MOscillator.FC_DPCM)).setWaveNo(subform);
            //if (form === MOscillator.WAVE)
            //    (MOscWave)(this.m_oscSet2.getMod(MOscillator.WAVE)).setWaveNo(subform);
            //if (form === MOscillator.SINE)
            //    (MOscSine)(this.m_oscSet2.getMod(MOscillator.SINE)).setWaveNo(subform);
        }

        setLFODPWD(depth: number, freq: number): void {
            this.m_lfoDepth = depth;
            this.m_osc2Connect = (depth === 0) ? 0 : 1;
            this.m_oscMod2.setFrequency(freq);
            this.m_oscMod2.resetPhase();
            (<MOscNoise>this.m_oscSet2.getMod(MOscillator.NOISE)).setNoiseFreq(freq / MChannel.SAMPLE_RATE);
        }

        setLFODLTM(delay: number, time: number): void {
            this.m_lfoDelay = delay;
            this.m_lfoEnd = (time > 0) ? this.m_lfoDelay + time : 0;
        }

        setLFOTarget(target: number): void {
            this.m_lfoTarget = target;
        }

        setLpfSwtAmt(swt: number, amt: number): void {
            if (-3 < swt && swt < 3 && swt !== this.m_filterConnect) {
                this.m_filterConnect = swt;
                this.m_filter.setSwitch(swt);
            }
            this.m_lpfAmt = ((amt < -127) ? -127 : (amt < 127) ? amt : 127) * MChannel.PITCH_RESOLUTION;
        }

        setLpfFrqRes(frq: number, res: number): void {
            if (frq < 0) frq = 0;
            if (frq > 127) frq = 127;
            this.m_lpfFrq = frq * MChannel.PITCH_RESOLUTION;
            this.m_lpfRes = res * (1.0 / 127.0);
            if (this.m_lpfRes < 0.0) this.m_lpfRes = 0.0;
            if (this.m_lpfRes > 1.0) this.m_lpfRes = 1.0;
        }

        setVolMode(m: number): void {
            switch (m) {
                case 0:
                case 1:
                case 2:
                    this.m_volMode = m;
                    break;
            }
        }

        setInput(i: number, p: number): void {
            this.m_inSens = (1 << (i - 1)) * (1.0 / 8.0) * MOscMod.PHASE_LEN;
            this.m_inPipe = p;
        }

        setOutput(o: number, p: number): void {
            this.m_outMode = o;
            this.m_outPipe = p;
        }

        setRing(s: number, p: number): void {
            this.m_ringSens = (1 << (s - 1)) / 8.0;
            this.m_ringPipe = p;
        }

        setSync(m: number, p: number): void {
            this.m_syncMode = m;
            this.m_syncPipe = p;
        }

        setPortamento(depth: number, len: number): void {
            this.m_portamento = 0;
            this.m_portDepth = depth;
            this.m_portDepthAdd = (Math.floor(this.m_portDepth) / len) * -1;
        }

        setMidiPort(mode: number): void {
            this.m_portamento = mode;
            this.m_portDepth = 0;
        }

        setMidiPortRate(rate: number): void {
            this.m_portRate = rate;
        }

        setPortBase(base: number): void {
            this.m_lastFreqNo = base;
        }

        setVoiceLimit(voiceLimit: number): void {
            // 無視
        }

        setHwLfo(data: number): void {
            var w: number = (data >> 27) & 0x03;
            var f: number = (data >> 19) & 0xFF;
            var pmd: number = (data >> 12) & 0x7F;
            var amd: number = (data >> 5) & 0x7F;
            var pms: number = (data >> 2) & 0x07;
            var ams: number = (data >> 0) & 0x03;
            var fm: MOscOPM = <MOscOPM>this.m_oscSet1.getMod(MOscillator.OPM);
            fm.setWF(w);
            fm.setLFRQ(f);
            fm.setPMD(pmd);
            fm.setAMD(amd);
            fm.setPMSAMS(pms, ams);
        }

        reset(): void {
            // 基本
            this.setSoundOff();
            this.m_pulseWidth = 0.5;
            this.m_voiceid = 0;
            this.setForm(0, 0);
            this.setDetune(0);
            this.setExpression(127);
            this.setVelocity(100);
            this.setPan(64);
            this.setVolMode(0);
            this.setNoiseFreq(0.0);
            // LFO
            this.setLFOFMSF(0, 0);
            this.m_osc2Connect = 0;
            this.m_onCounter = 0;
            this.m_lfoTarget = 0;
            this.m_lfoDelay = 0;
            this.m_lfoDepth = 0.0;
            this.m_lfoEnd = 0;
            // フィルタ
            this.setLpfSwtAmt(0, 0);
            this.setLpfFrqRes(0, 0);
            this.setFormant(-1);
            // パイプ
            this.setInput(0, 0);
            this.setOutput(0, 0);
            this.setRing(0, 0);
            this.setSync(0, 0);
            // ポルタメント
            this.m_portDepth = 0;
            this.m_portDepthAdd = 0;
            this.m_lastFreqNo = 4800;
            this.m_portamento = 0;
            this.m_portRate = 0;
        }

        clearOutPipe(max: number, start: number, delta: number): void {
            if (this.m_outMode === 1) {
                MChannel.s_pipeArr[this.m_outPipe].set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
        }

        protected getNextCutoff(): number {
            var cut: number = this.m_lpfFrq + this.m_lpfAmt * this.m_envelope2.getNextAmplitudeLinear();
            cut = MChannel.getFrequency(cut) * this.m_oscMod1.getFrequency() * (2.0 * Math.PI / (MChannel.SAMPLE_RATE * 440.0));
            if (cut < (1.0 / 127.0)) cut = 0.0;
            return cut;
        }

        getSamples(samplesSt: Array<Float32Array>, max: number, start: number, delta: number): void {
            var end: number = start + delta;
            var trackBuffer: Float32Array = MChannel.s_samples, sens: number, pipe: Float32Array;
            var amplitude: number, rightAmplitude: number;
            var playing: boolean = this.isPlaying(), tmpFlag: boolean;
            var vol: number, lpffrq: number, pan: number, depth: number;
            var i: number, j: number, s: number, e: number;
            if (end >= max) end = max;
            var key: number = MChannel.getFrequency(this.m_freqNo);
            if (this.m_outMode === 1 && this.m_slaveVoice === false) {
                // @o1 が指定されていれば直接パイプに音声を書き込む
                trackBuffer = MChannel.s_pipeArr[this.m_outPipe];
            }
            if (playing) {
                if (this.m_portDepth === 0) {
                    if (this.m_inSens >= 0.000001) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesF__(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PITCH*/0) {
                            this.getSamplesFP_(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PWM*/3) {
                            this.getSamplesFW_(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_FM*/4) {
                            this.getSamplesFF_(trackBuffer, start, end);
                        } else {
                            this.getSamplesF__(trackBuffer, start, end);
                        }
                    } else if (this.m_syncMode === 2) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesI__(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PITCH*/0) {
                            this.getSamplesIP_(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PWM*/3) {
                            this.getSamplesIW_(trackBuffer, start, end);
                        } else {
                            this.getSamplesI__(trackBuffer, start, end);
                        }
                    } else if (this.m_syncMode === 1) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesO__(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PITCH*/0) {
                            this.getSamplesOP_(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PWM*/3) {
                            this.getSamplesOW_(trackBuffer, start, end);
                        } else {
                            this.getSamplesO__(trackBuffer, start, end);
                        }
                    } else {
                        if (this.m_osc2Connect === 0) {
                            this.getSamples___(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PITCH*/0) {
                            this.getSamples_P_(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PWM*/3) {
                            this.getSamples_W_(trackBuffer, start, end);
                        } else {
                            this.getSamples___(trackBuffer, start, end);
                        }
                    }
                } else {
                    if (this.m_inSens >= 0.000001) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesF_P(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PITCH*/0) {
                            this.getSamplesFPP(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PWM*/3) {
                            this.getSamplesFWP(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_FM*/4) {
                            this.getSamplesFFP(trackBuffer, start, end);
                        } else {
                            this.getSamplesF_P(trackBuffer, start, end);
                        }
                    } else if (this.m_syncMode === 2) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesI_P(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PITCH*/0) {
                            this.getSamplesIPP(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PWM*/3) {
                            this.getSamplesIWP(trackBuffer, start, end);
                        } else {
                            this.getSamplesI_P(trackBuffer, start, end);
                        }
                    } else if (this.m_syncMode === 1) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesO_P(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PITCH*/0) {
                            this.getSamplesOPP(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PWM*/3) {
                            this.getSamplesOWP(trackBuffer, start, end);
                        } else {
                            this.getSamplesO_P(trackBuffer, start, end);
                        }
                    } else {
                        if (this.m_osc2Connect === 0) {
                            this.getSamples__P(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PITCH*/0) {
                            this.getSamples_PP(trackBuffer, start, end);
                        } else if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PWM*/3) {
                            this.getSamples_WP(trackBuffer, start, end);
                        } else {
                            this.getSamples__P(trackBuffer, start, end);
                        }
                    }
                }
            }
            if (this.m_oscSet1.getForm() !== MOscillator.OPM) {
                if (this.m_volMode === 0) {
                    this.m_envelope1.ampSamplesLinear(trackBuffer, start, end, this.m_ampLevel);
                } else {
                    this.m_envelope1.ampSamplesNonLinear(trackBuffer, start, end, this.m_ampLevel, this.m_volMode);
                }
            }
            if (this.m_lfoTarget === /*MChannel.LFO_TARGET_AMPLITUDE*/1 && this.m_osc2Connect !== 0) { // with Amplitude LFO
                depth = this.m_osc2Sign * this.m_lfoDepth / 127.0;
                s = start;
                for (i = start; i < end; i++) {
                    vol = 1.0;
                    if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                        vol += this.m_oscMod2.getNextSample() * depth;
                    }
                    if (vol < 0) {
                        vol = 0;
                    }
                    trackBuffer[i] *= vol;
                    this.m_onCounter++;
                }
            }
            if (playing && (this.m_ringSens >= 0.000001)) { // with ring
                pipe = MChannel.s_pipeArr[this.m_ringPipe];
                sens = this.m_ringSens;
                for (i = start; i < end; i++) {
                    trackBuffer[i] *= pipe[i] * sens;
                }
            }
            
            // フォルマントフィルタを経由した後の音声が無音であればスキップ
            tmpFlag = playing;
            playing = playing || this.m_formant.checkToSilence();
            if (playing !== tmpFlag) {
                trackBuffer.set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
            if (playing) {
                this.m_formant.run(trackBuffer, start, end);
            }

            // フィルタを経由した後の音声が無音であればスキップ
            tmpFlag = playing;
            playing = playing || this.m_filter.checkToSilence();
            if (playing !== tmpFlag) {
                trackBuffer.set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
            if (playing) {
                if (this.m_lfoTarget === /*MChannel.LFO_TARGET_CUTOFF*/2 && this.m_osc2Connect !== 0) { // with Filter LFO
                    depth = this.m_osc2Sign * this.m_lfoDepth;
                    s = start;
                    do {
                        e = s + MChannel.s_lfoDelta;
                        if (e > end) e = end;
                        lpffrq = this.m_lpfFrq;
                        if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                            lpffrq += this.m_oscMod2.getNextSample() * depth | 0;
                            this.m_oscMod2.addPhase(e - s - 1);
                        }
                        if (lpffrq < 0) {
                            lpffrq = 0;
                        } else if (lpffrq > 127.0 * MChannel.PITCH_RESOLUTION) {
                            lpffrq = 127 * MChannel.PITCH_RESOLUTION;
                        }
                        this.m_filter.run(MChannel.s_samples, s, e, this.m_envelope2, lpffrq, this.m_lpfAmt, this.m_lpfRes, key);
                        this.m_onCounter += e - s;
                        s = e;
                    } while (s < end);
                } else {
                    this.m_filter.run(trackBuffer, start, end, this.m_envelope2, this.m_lpfFrq, this.m_lpfAmt, this.m_lpfRes, key);
                }
            }

            if (playing) {
                switch (this.m_outMode) {
                    case 0:
                        //console.log("output audio");
                        var samples0 = samplesSt[0];
                        var samples1 = samplesSt[1];
                        if (this.m_lfoTarget === /*MChannel.LFO_TARGET_PANPOT*/5 && this.m_osc2Connect !== 0) { // with Panpot LFO
                            depth = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0);
                            for (i = start; i < end; i++) {
                                pan = this.m_pan + this.m_oscMod2.getNextSample() * depth;
                                if (pan < 0) {
                                    pan = 0.0;
                                } else if (pan > 1.0) {
                                    pan = 1.0;
                                }
                                amplitude = trackBuffer[i] * 0.5;
                                rightAmplitude = amplitude * pan;
                                samples0[i] += amplitude - rightAmplitude;
                                samples1[i] += rightAmplitude;
                            }
                        } else {
                            for (i = start; i < end; i++) {
                                amplitude = trackBuffer[i] * 0.5;
                                rightAmplitude = amplitude * this.m_pan;
                                samples0[i] += amplitude - rightAmplitude;
                                samples1[i] += rightAmplitude;
                            }
                        }
                        break;
                    case 1: // overwrite
                        /* リングモジュレータと音量LFOの同時使用時に問題が出てたようなので
                            一旦戻します。 2010.09.22 tekisuke */
                        //console.log("output "+this.m_outPipe);
                        pipe = MChannel.s_pipeArr[this.m_outPipe];
                        if (this.m_slaveVoice === false) {
                            for (i = start; i < end; i++) {
                                pipe[i] = trackBuffer[i];
                            }
                        }
                        else {
                            for (i = start; i < end; i++) {
                                pipe[i] += trackBuffer[i];
                            }
                        }
                        break;
                    case 2: // add
                        pipe = MChannel.s_pipeArr[this.m_outPipe];
                        for (i = start; i < end; i++) {
                            pipe[i] += trackBuffer[i];
                        }
                        break;
                }
            } else if (this.m_outMode === 1) {
                pipe = MChannel.s_pipeArr[this.m_outPipe];
                if (this.m_slaveVoice === false) {
                    pipe.set(MChannel.emptyBuffer.subarray(0, delta), start);
                }
            }
        }
        
        // 波形生成部の関数群
        // [pipe] := [_:なし], [F:FM入力], [I:Sync入力], [O:Sync出力]
        // [lfo]  := [_:なし], [P:音程], [W:パルス幅], [F:FM入力レベル]
        // [pro.] := [_:なし], [p:ポルタメント]
        // private getSamples[pipe][lfo](samples: Float32Array, start: number, end: number): void
        
        // パイプ処理なし, LFOなし, ポルタメントなし
        private getSamples___(samples: Float32Array, start: number, end: number): void {
            this.m_oscMod1.getSamples(samples, start, end);
        }

        // パイプ処理なし, 音程LFO, ポルタメントなし
        private getSamples_P_(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number, depth: number = this.m_osc2Sign * this.m_lfoDepth;
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        // パイプ処理なし, パルス幅(@3)LFO, ポルタメントなし
        private getSamples_W_(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, pwm: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * 0.01,
                modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE);
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                } else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        // FM入力, LFOなし, ポルタメントなし
        private getSamplesF__(samples: Float32Array, start: number, end: number): void {
            var i: number, sens: number = this.m_inSens, pipe: Float32Array = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            // rev.35879 以前の挙動にあわせるため
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                //samples[i] = pipe[i];
            }
        }

        // FM入力, 音程LFO, ポルタメントなし
        private getSamplesFP_(samples: Float32Array, start: number, end: number): void {
            var i: number, freqNo: number, sens: number = this.m_inSens, depth: number = this.m_osc2Sign * this.m_lfoDepth,
                pipe: Float32Array = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        }

        // FM入力, パルス幅(@3)LFO, ポルタメントなし
        private getSamplesFW_(samples: Float32Array, start: number, end: number): void {
            var i: number, pwm: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * 0.01,
                modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE),
                sens: number = this.m_inSens, pipe: Float32Array = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            // rev.35879 以前の挙動にあわせるため
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                }
                if (pwm < 0) {
                    pwm = 0;
                } else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        }

        // FM入力, FM入力レベル, ポルタメントなし
        private getSamplesFF_(samples: Float32Array, start: number, end: number): void {
            var i: number, freqNo: number, sens: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0),
                pipe: Float32Array = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            // rev.35879 以前の挙動にあわせるため
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                sens = this.m_inSens;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    sens *= oscMod2.getNextSample() * depth;
                }
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        }

        // Sync入力, LFOなし, ポルタメントなし
        private getSamplesI__(samples: Float32Array, start: number, end: number): void {
            this.m_oscMod1.getSamplesWithSyncIn(samples, MChannel.s_syncSources[this.m_syncPipe], start, end);
        }

        // Sync入力, 音程LFO, ポルタメントなし
        private getSamplesIP_(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number, depth: number = this.m_osc2Sign * this.m_lfoDepth,
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        // Sync入力, パルス幅(@3)LFO, ポルタメントなし
        private getSamplesIW_(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, pwm: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * 0.01,
                modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE),
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                } else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        // Sync出力, LFOなし, ポルタメントなし
        private getSamplesO__(samples: Float32Array, start: number, end: number): void {
            this.m_oscMod1.getSamplesWithSyncOut(samples, MChannel.s_syncSources[this.m_syncPipe], start, end);
        }

        // Sync出力, 音程LFO, ポルタメントなし
        private getSamplesOP_(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number, depth: number = this.m_osc2Sign * this.m_lfoDepth,
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        // Sync出力, パルス幅(@3)LFO, ポルタメントなし
        private getSamplesOW_(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, pwm: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * 0.01,
                modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE),
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                } else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        /*** ここから下がポルタメントありの場合 ***/

        // パイプ処理なし, LFOなし, ポルタメントあり
        private getSamples__P(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number;
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                s = e;
            } while (s < end)
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        }

        // パイプ処理なし, 音程LFO, ポルタメントあり
        private getSamples_PP(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number, depth: number = this.m_osc2Sign * this.m_lfoDepth;
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        // パイプ処理なし, パルス幅(@3)LFO, ポルタメントあり
        private getSamples_WP(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, pwm: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * 0.01, freqNo: number,
                modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE);
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;

                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));

                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                } else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        }

        // FM入力, LFOなし, ポルタメントあり
        private getSamplesF_P(samples: Float32Array, start: number, end: number): void {
            var freqNo: number, i: number, sens: number = this.m_inSens, pipe: Float32Array = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
            }
        }

        // FM入力, 音程LFO, ポルタメントあり
        private getSamplesFPP(samples: Float32Array, start: number, end: number): void {
            var i: number, freqNo: number, sens: number = this.m_inSens, depth: number = this.m_osc2Sign * this.m_lfoDepth,
                pipe: Float32Array = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        }

        // FM入力, パルス幅(@3)LFO, ポルタメントあり
        private getSamplesFWP(samples: Float32Array, start: number, end: number): void {
            var i: number, freqNo: number, pwm: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * 0.01,
                modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE),
                sens: number = this.m_inSens, pipe: Float32Array = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                }
                if (pwm < 0) {
                    pwm = 0;
                } else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        }

        // FM入力, FM入力レベル, ポルタメントあり
        private getSamplesFFP(samples: Float32Array, start: number, end: number): void {
            var i: number, freqNo: number, sens: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0),
                pipe: Float32Array = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                sens = this.m_inSens;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    sens *= oscMod2.getNextSample() * depth;
                }
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        }

        // Sync入力, LFOなし, ポルタメントあり
        private getSamplesI_P(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number,
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        }

        // Sync入力, 音程LFO, ポルタメントあり
        private getSamplesIPP(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number, depth: number = this.m_osc2Sign * this.m_lfoDepth,
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        // Sync入力, パルス幅(@3)LFO, ポルタメントあり
        private getSamplesIWP(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number, pwm: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * 0.01,
                modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE),
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                } else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        }

        // Sync出力, LFOなし, ポルタメントあり
        private getSamplesO_P(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number,
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        }

        // Sync出力, 音程LFO, ポルタメントあり
        private getSamplesOPP(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number, depth: number = this.m_osc2Sign * this.m_lfoDepth,
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
        }

        // Sync出力, パルス幅(@3)LFO, ポルタメントあり
        private getSamplesOWP(samples: Float32Array, start: number, end: number): void {
            var s: number = start, e: number, freqNo: number, pwm: number, depth: number = this.m_osc2Sign * this.m_lfoDepth * 0.01,
                modPulse: MOscPulse = <MOscPulse>this.m_oscSet1.getMod(MOscillator.PULSE),
                syncLine: Array<boolean> = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end) e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0) this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                } else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end)
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        }
    }
}
