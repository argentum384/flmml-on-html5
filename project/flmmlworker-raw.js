/// <reference path="IChannel.ts" />
var flmml;
(function (flmml) {
    var MChannel = (function () {
        function MChannel() {
            this.m_noteNo = 0;
            this.m_detune = 0;
            this.m_freqNo = 0;
            this.m_envelope1 = new flmml.MEnvelope(0.0, 60.0 / 127.0, 30.0 / 127.0, 1.0 / 127.0);
            this.m_envelope2 = new flmml.MEnvelope(0.0, 30.0 / 127.0, 0.0, 1.0);
            this.m_oscSet1 = new flmml.MOscillator();
            this.m_oscMod1 = this.m_oscSet1.getCurrent();
            this.m_oscSet2 = new flmml.MOscillator();
            this.m_oscSet2.asLFO();
            this.m_oscSet2.setForm(flmml.MOscillator.SINE);
            this.m_oscMod2 = this.m_oscSet2.getCurrent();
            this.m_osc2Connect = 0;
            this.m_filter = new flmml.MFilter();
            this.m_filterConnect = 0;
            this.m_formant = new flmml.MFormant();
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
        MChannel.boot = function (numSamples) {
            if (!this.s_init) {
                var i;
                this.emptyBuffer = msgr.emptyBuffer;
                this.s_frequencyLen = this.s_frequencyMap.length;
                for (i = 0; i < this.s_frequencyLen; i++) {
                    this.s_frequencyMap[i] = 440.0 * Math.pow(2.0, (i - 69 * this.PITCH_RESOLUTION) / (12.0 * this.PITCH_RESOLUTION));
                }
                this.s_volumeLen = 128;
                this.s_volumeMap = new Array(3);
                for (i = 0; i < 3; i++) {
                    this.s_volumeMap[i] = new Array(this.s_volumeLen);
                    this.s_volumeMap[i][0] = 0.0;
                }
                for (i = 1; i < this.s_volumeLen; i++) {
                    this.s_volumeMap[0][i] = i / 127.0;
                    this.s_volumeMap[1][i] = Math.pow(10.0, (i - 127.0) * (48.0 / (127.0 * 20.0)));
                    this.s_volumeMap[2][i] = Math.pow(10.0, (i - 127.0) * (96.0 / (127.0 * 20.0)));
                }
                this.s_init = 1;
            }
            this.s_samples = new Float32Array(numSamples);
        };
        MChannel.createPipes = function (num) {
            this.s_pipeArr = new Array(num);
            for (var i = 0; i < num; i++) {
                this.s_pipeArr[i] = new Float32Array(this.s_samples.length);
            }
        };
        MChannel.createSyncSources = function (num) {
            this.s_syncSources = new Array(num);
            for (var i = 0; i < num; i++) {
                this.s_syncSources[i] = new Array(this.s_samples.length);
                for (var j = 0; j < this.s_samples.length; j++) {
                    this.s_syncSources[i][j] = false;
                }
            }
        };
        MChannel.getFrequency = function (freqNo) {
            freqNo |= 0;
            freqNo = (freqNo < 0) ? 0 : (freqNo >= MChannel.s_frequencyLen) ? MChannel.s_frequencyLen - 1 : freqNo;
            return MChannel.s_frequencyMap[freqNo];
        };
        MChannel.prototype.setExpression = function (ex) {
            this.m_expression = MChannel.s_volumeMap[this.m_volMode][ex];
            this.m_ampLevel = this.m_velocity * this.m_expression;
            this.m_oscSet1.getMod(flmml.MOscillator.OPM).setExpression(this.m_expression);
        };
        MChannel.prototype.setVelocity = function (velocity) {
            this.m_velocity = MChannel.s_volumeMap[this.m_volMode][velocity];
            this.m_ampLevel = this.m_velocity * this.m_expression;
            this.m_oscSet1.getMod(flmml.MOscillator.OPM).setVelocity(velocity);
        };
        MChannel.prototype.setNoteNo = function (noteNo, tie) {
            if (tie === void 0) { tie = true; }
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
        };
        MChannel.prototype.setDetune = function (detune) {
            this.m_detune = detune;
            this.m_freqNo = this.m_noteNo * MChannel.PITCH_RESOLUTION + this.m_detune;
            this.m_oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
        };
        MChannel.prototype.getNoteNo = function () {
            return this.m_noteNo;
        };
        MChannel.prototype.isPlaying = function () {
            if (this.m_oscSet1.getForm() === flmml.MOscillator.OPM) {
                return this.m_oscSet1.getCurrent().IsPlaying();
            }
            else {
                return this.m_envelope1.isPlaying();
            }
        };
        MChannel.prototype.getId = function () {
            return this.m_voiceid;
        };
        MChannel.prototype.getVoiceCount = function () {
            return this.isPlaying() ? 1 : 0;
        };
        MChannel.prototype.setSlaveVoice = function (f) {
            this.m_slaveVoice = f;
        };
        MChannel.prototype.noteOnWidthId = function (noteNo, velocity, id) {
            this.m_voiceid = id;
            this.noteOn(noteNo, velocity);
        };
        MChannel.prototype.noteOn = function (noteNo, velocity) {
            this.setNoteNo(noteNo, false);
            this.m_envelope1.triggerEnvelope(0);
            this.m_envelope2.triggerEnvelope(1);
            this.m_oscMod1.resetPhase();
            this.m_oscMod2.resetPhase();
            this.m_filter.reset();
            this.setVelocity(velocity);
            this.m_onCounter = 0;
            var modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE);
            modPulse.setPWM(this.m_pulseWidth);
            var oscSet1 = this.m_oscSet1;
            oscSet1.getMod(flmml.MOscillator.FC_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(flmml.MOscillator.GB_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(flmml.MOscillator.GB_S_NOISE).setNoteNo(this.m_noteNo);
            oscSet1.getMod(flmml.MOscillator.FC_DPCM).setNoteNo(this.m_noteNo);
            oscSet1.getMod(flmml.MOscillator.OPM).setNoteNo(this.m_noteNo);
        };
        MChannel.prototype.noteOff = function (noteNo) {
            if (noteNo < 0 || noteNo === this.m_noteNo) {
                this.m_envelope1.releaseEnvelope();
                this.m_envelope2.releaseEnvelope();
                this.m_oscSet1.getMod(flmml.MOscillator.OPM).noteOff();
            }
        };
        MChannel.prototype.setSoundOff = function () {
            this.m_envelope1.soundOff();
            this.m_envelope2.soundOff();
        };
        MChannel.prototype.close = function () {
            this.noteOff(this.m_noteNo);
            this.m_filter.setSwitch(0);
        };
        MChannel.prototype.setNoiseFreq = function (frequency) {
            var modNoise = this.m_oscSet1.getMod(flmml.MOscillator.NOISE);
            modNoise.setNoiseFreq(1.0 - frequency * (1.0 / 128.0));
        };
        MChannel.prototype.setForm = function (form, subform) {
            this.m_oscMod1 = this.m_oscSet1.setForm(form);
            this.m_oscMod1.setWaveNo(subform);
        };
        MChannel.prototype.setEnvelope1Atk = function (attack) {
            this.m_envelope1.setAttack(attack * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope1Point = function (time, level) {
            this.m_envelope1.addPoint(time * (1.0 / 127.0), level * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope1Rel = function (release) {
            this.m_envelope1.setRelease(release * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope2Atk = function (attack) {
            this.m_envelope2.setAttack(attack * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope2Point = function (time, level) {
            this.m_envelope2.addPoint(time * (1.0 / 127.0), level * (1.0 / 127.0));
        };
        MChannel.prototype.setEnvelope2Rel = function (release) {
            this.m_envelope2.setRelease(release * (1.0 / 127.0));
        };
        MChannel.prototype.setPWM = function (pwm) {
            if (this.m_oscSet1.getForm() !== flmml.MOscillator.FC_PULSE) {
                var modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE);
                if (pwm < 0) {
                    modPulse.setMIX(1);
                    pwm *= -1;
                }
                else {
                    modPulse.setMIX(0);
                }
                this.m_pulseWidth = pwm * 0.01;
                modPulse.setPWM(this.m_pulseWidth);
            }
            else {
                var modFcPulse = this.m_oscSet1.getMod(flmml.MOscillator.FC_PULSE);
                if (pwm < 0)
                    pwm *= -1;
                modFcPulse.setPWM(0.125 * Math.floor(pwm));
            }
        };
        MChannel.prototype.setPan = function (pan) {
            this.m_pan = (pan - 1) * (0.5 / 63.0);
            if (this.m_pan < 0)
                this.m_pan = 0;
        };
        MChannel.prototype.setFormant = function (vowel) {
            if (vowel >= 0)
                this.m_formant.setVowel(vowel);
            else
                this.m_formant.disable();
        };
        MChannel.prototype.setLFOFMSF = function (form, subform) {
            this.m_oscMod2 = this.m_oscSet2.setForm((form >= 0) ? form - 1 : -form - 1);
            this.m_oscMod2.setWaveNo(subform);
            this.m_osc2Sign = (form >= 0) ? 1.0 : -1.0;
            if (form < 0)
                form = -form;
            form--;
            if (form >= flmml.MOscillator.MAX)
                this.m_osc2Connect = 0;
        };
        MChannel.prototype.setLFODPWD = function (depth, freq) {
            this.m_lfoDepth = depth;
            this.m_osc2Connect = (depth === 0) ? 0 : 1;
            this.m_oscMod2.setFrequency(freq);
            this.m_oscMod2.resetPhase();
            this.m_oscSet2.getMod(flmml.MOscillator.NOISE).setNoiseFreq(freq / flmml.MSequencer.SAMPLE_RATE);
        };
        MChannel.prototype.setLFODLTM = function (delay, time) {
            this.m_lfoDelay = delay;
            this.m_lfoEnd = (time > 0) ? this.m_lfoDelay + time : 0;
        };
        MChannel.prototype.setLFOTarget = function (target) {
            this.m_lfoTarget = target;
        };
        MChannel.prototype.setLpfSwtAmt = function (swt, amt) {
            if (-3 < swt && swt < 3 && swt !== this.m_filterConnect) {
                this.m_filterConnect = swt;
                this.m_filter.setSwitch(swt);
            }
            this.m_lpfAmt = ((amt < -127) ? -127 : (amt < 127) ? amt : 127) * MChannel.PITCH_RESOLUTION;
        };
        MChannel.prototype.setLpfFrqRes = function (frq, res) {
            if (frq < 0)
                frq = 0;
            if (frq > 127)
                frq = 127;
            this.m_lpfFrq = frq * MChannel.PITCH_RESOLUTION;
            this.m_lpfRes = res * (1.0 / 127.0);
            if (this.m_lpfRes < 0.0)
                this.m_lpfRes = 0.0;
            if (this.m_lpfRes > 1.0)
                this.m_lpfRes = 1.0;
        };
        MChannel.prototype.setVolMode = function (m) {
            switch (m) {
                case 0:
                case 1:
                case 2:
                    this.m_volMode = m;
                    break;
            }
        };
        MChannel.prototype.setInput = function (i, p) {
            this.m_inSens = (1 << (i - 1)) * (1.0 / 8.0) * flmml.MOscMod.PHASE_LEN;
            this.m_inPipe = p;
        };
        MChannel.prototype.setOutput = function (o, p) {
            this.m_outMode = o;
            this.m_outPipe = p;
        };
        MChannel.prototype.setRing = function (s, p) {
            this.m_ringSens = (1 << (s - 1)) / 8.0;
            this.m_ringPipe = p;
        };
        MChannel.prototype.setSync = function (m, p) {
            this.m_syncMode = m;
            this.m_syncPipe = p;
        };
        MChannel.prototype.setPortamento = function (depth, len) {
            this.m_portamento = 0;
            this.m_portDepth = depth;
            this.m_portDepthAdd = (Math.floor(this.m_portDepth) / len) * -1;
        };
        MChannel.prototype.setMidiPort = function (mode) {
            this.m_portamento = mode;
            this.m_portDepth = 0;
        };
        MChannel.prototype.setMidiPortRate = function (rate) {
            this.m_portRate = rate;
        };
        MChannel.prototype.setPortBase = function (base) {
            this.m_lastFreqNo = base;
        };
        MChannel.prototype.setVoiceLimit = function (voiceLimit) {
        };
        MChannel.prototype.setHwLfo = function (data) {
            var w = (data >> 27) & 0x03;
            var f = (data >> 19) & 0xFF;
            var pmd = (data >> 12) & 0x7F;
            var amd = (data >> 5) & 0x7F;
            var pms = (data >> 2) & 0x07;
            var ams = (data >> 0) & 0x03;
            var fm = this.m_oscSet1.getMod(flmml.MOscillator.OPM);
            fm.setWF(w);
            fm.setLFRQ(f);
            fm.setPMD(pmd);
            fm.setAMD(amd);
            fm.setPMSAMS(pms, ams);
        };
        MChannel.prototype.reset = function () {
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
            this.setLFOFMSF(0, 0);
            this.m_osc2Connect = 0;
            this.m_onCounter = 0;
            this.m_lfoTarget = 0;
            this.m_lfoDelay = 0;
            this.m_lfoDepth = 0.0;
            this.m_lfoEnd = 0;
            this.setLpfSwtAmt(0, 0);
            this.setLpfFrqRes(0, 0);
            this.setFormant(-1);
            this.setInput(0, 0);
            this.setOutput(0, 0);
            this.setRing(0, 0);
            this.setSync(0, 0);
            this.m_portDepth = 0;
            this.m_portDepthAdd = 0;
            this.m_lastFreqNo = 4800;
            this.m_portamento = 0;
            this.m_portRate = 0;
        };
        MChannel.prototype.clearOutPipe = function (max, start, delta) {
            if (this.m_outMode === 1) {
                MChannel.s_pipeArr[this.m_outPipe].set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
        };
        MChannel.prototype.getNextCutoff = function () {
            var cut = this.m_lpfFrq + this.m_lpfAmt * this.m_envelope2.getNextAmplitudeLinear();
            cut = MChannel.getFrequency(cut) * this.m_oscMod1.getFrequency() * (2.0 * Math.PI / (flmml.MSequencer.SAMPLE_RATE * 440.0));
            if (cut < (1.0 / 127.0))
                cut = 0.0;
            return cut;
        };
        MChannel.prototype.getSamples = function (samplesSt, max, start, delta) {
            var end = start + delta;
            var trackBuffer = MChannel.s_samples, sens, pipe;
            var amplitude, rightAmplitude;
            var playing = this.isPlaying(), tmpFlag;
            var vol, lpffrq, pan, depth;
            var i, j, s, e;
            if (end >= max)
                end = max;
            var key = MChannel.getFrequency(this.m_freqNo);
            if (this.m_outMode === 1 && this.m_slaveVoice === false) {
                trackBuffer = MChannel.s_pipeArr[this.m_outPipe];
            }
            if (playing) {
                if (this.m_portDepth === 0) {
                    if (this.m_inSens >= 0.000001) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesF__(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesFP_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesFW_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 4) {
                            this.getSamplesFF_(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesF__(trackBuffer, start, end);
                        }
                    }
                    else if (this.m_syncMode === 2) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesI__(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesIP_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesIW_(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesI__(trackBuffer, start, end);
                        }
                    }
                    else if (this.m_syncMode === 1) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesO__(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesOP_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesOW_(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesO__(trackBuffer, start, end);
                        }
                    }
                    else {
                        if (this.m_osc2Connect === 0) {
                            this.getSamples___(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamples_P_(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamples_W_(trackBuffer, start, end);
                        }
                        else {
                            this.getSamples___(trackBuffer, start, end);
                        }
                    }
                }
                else {
                    if (this.m_inSens >= 0.000001) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesF_P(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesFPP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesFWP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 4) {
                            this.getSamplesFFP(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesF_P(trackBuffer, start, end);
                        }
                    }
                    else if (this.m_syncMode === 2) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesI_P(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesIPP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesIWP(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesI_P(trackBuffer, start, end);
                        }
                    }
                    else if (this.m_syncMode === 1) {
                        if (this.m_osc2Connect === 0) {
                            this.getSamplesO_P(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamplesOPP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamplesOWP(trackBuffer, start, end);
                        }
                        else {
                            this.getSamplesO_P(trackBuffer, start, end);
                        }
                    }
                    else {
                        if (this.m_osc2Connect === 0) {
                            this.getSamples__P(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 0) {
                            this.getSamples_PP(trackBuffer, start, end);
                        }
                        else if (this.m_lfoTarget === 3) {
                            this.getSamples_WP(trackBuffer, start, end);
                        }
                        else {
                            this.getSamples__P(trackBuffer, start, end);
                        }
                    }
                }
            }
            if (this.m_oscSet1.getForm() !== flmml.MOscillator.OPM) {
                if (this.m_volMode === 0) {
                    this.m_envelope1.ampSamplesLinear(trackBuffer, start, end, this.m_ampLevel);
                }
                else {
                    this.m_envelope1.ampSamplesNonLinear(trackBuffer, start, end, this.m_ampLevel, this.m_volMode);
                }
            }
            if (this.m_lfoTarget === 1 && this.m_osc2Connect !== 0) {
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
            if (playing && (this.m_ringSens >= 0.000001)) {
                pipe = MChannel.s_pipeArr[this.m_ringPipe];
                sens = this.m_ringSens;
                for (i = start; i < end; i++) {
                    trackBuffer[i] *= pipe[i] * sens;
                }
            }
            tmpFlag = playing;
            playing = playing || this.m_formant.checkToSilence();
            if (playing !== tmpFlag) {
                trackBuffer.set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
            if (playing) {
                this.m_formant.run(trackBuffer, start, end);
            }
            tmpFlag = playing;
            playing = playing || this.m_filter.checkToSilence();
            if (playing !== tmpFlag) {
                trackBuffer.set(MChannel.emptyBuffer.subarray(0, delta), start);
            }
            if (playing) {
                if (this.m_lfoTarget === 2 && this.m_osc2Connect !== 0) {
                    depth = this.m_osc2Sign * this.m_lfoDepth;
                    s = start;
                    do {
                        e = s + MChannel.s_lfoDelta;
                        if (e > end)
                            e = end;
                        lpffrq = this.m_lpfFrq;
                        if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                            lpffrq += this.m_oscMod2.getNextSample() * depth | 0;
                            this.m_oscMod2.addPhase(e - s - 1);
                        }
                        if (lpffrq < 0) {
                            lpffrq = 0;
                        }
                        else if (lpffrq > 127.0 * MChannel.PITCH_RESOLUTION) {
                            lpffrq = 127 * MChannel.PITCH_RESOLUTION;
                        }
                        this.m_filter.run(MChannel.s_samples, s, e, this.m_envelope2, lpffrq, this.m_lpfAmt, this.m_lpfRes, key);
                        this.m_onCounter += e - s;
                        s = e;
                    } while (s < end);
                }
                else {
                    this.m_filter.run(trackBuffer, start, end, this.m_envelope2, this.m_lpfFrq, this.m_lpfAmt, this.m_lpfRes, key);
                }
            }
            if (playing) {
                switch (this.m_outMode) {
                    case 0:
                        var samples0 = samplesSt[0];
                        var samples1 = samplesSt[1];
                        if (this.m_lfoTarget === 5 && this.m_osc2Connect !== 0) {
                            depth = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0);
                            for (i = start; i < end; i++) {
                                pan = this.m_pan + this.m_oscMod2.getNextSample() * depth;
                                if (pan < 0) {
                                    pan = 0.0;
                                }
                                else if (pan > 1.0) {
                                    pan = 1.0;
                                }
                                amplitude = trackBuffer[i] * 0.5;
                                rightAmplitude = amplitude * pan;
                                samples0[i] += amplitude - rightAmplitude;
                                samples1[i] += rightAmplitude;
                            }
                        }
                        else {
                            for (i = start; i < end; i++) {
                                amplitude = trackBuffer[i] * 0.5;
                                rightAmplitude = amplitude * this.m_pan;
                                samples0[i] += amplitude - rightAmplitude;
                                samples1[i] += rightAmplitude;
                            }
                        }
                        break;
                    case 1:
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
                    case 2:
                        pipe = MChannel.s_pipeArr[this.m_outPipe];
                        for (i = start; i < end; i++) {
                            pipe[i] += trackBuffer[i];
                        }
                        break;
                }
            }
            else if (this.m_outMode === 1) {
                pipe = MChannel.s_pipeArr[this.m_outPipe];
                if (this.m_slaveVoice === false) {
                    pipe.set(MChannel.emptyBuffer.subarray(0, delta), start);
                }
            }
        };
        MChannel.prototype.getSamples___ = function (samples, start, end) {
            this.m_oscMod1.getSamples(samples, start, end);
        };
        MChannel.prototype.getSamples_P_ = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth;
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamples_W_ = function (samples, start, end) {
            var s = start, e, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE);
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesF__ = function (samples, start, end) {
            var i, sens = this.m_inSens, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
            }
        };
        MChannel.prototype.getSamplesFP_ = function (samples, start, end) {
            var i, freqNo, sens = this.m_inSens, depth = this.m_osc2Sign * this.m_lfoDepth, pipe = MChannel.s_pipeArr[this.m_inPipe];
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
        };
        MChannel.prototype.getSamplesFW_ = function (samples, start, end) {
            var i, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), sens = this.m_inSens, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesFF_ = function (samples, start, end) {
            var i, freqNo, sens, depth = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0), pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            for (i = start; i < end; i++) {
                sens = this.m_inSens;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    sens *= oscMod2.getNextSample() * depth;
                }
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesI__ = function (samples, start, end) {
            this.m_oscMod1.getSamplesWithSyncIn(samples, MChannel.s_syncSources[this.m_syncPipe], start, end);
        };
        MChannel.prototype.getSamplesIP_ = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesIW_ = function (samples, start, end) {
            var s = start, e, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesO__ = function (samples, start, end) {
            this.m_oscMod1.getSamplesWithSyncOut(samples, MChannel.s_syncSources[this.m_syncPipe], start, end);
        };
        MChannel.prototype.getSamplesOP_ = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += (oscMod2.getNextSample() * depth) | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesOW_ = function (samples, start, end) {
            var s = start, e, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamples__P = function (samples, start, end) {
            var s = start, e, freqNo;
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamples_PP = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth;
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamples_WP = function (samples, start, end) {
            var s = start, e, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, freqNo, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE);
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamples(samples, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamplesF_P = function (samples, start, end) {
            var freqNo, i, sens = this.m_inSens, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
            }
        };
        MChannel.prototype.getSamplesFPP = function (samples, start, end) {
            var i, freqNo, sens = this.m_inSens, depth = this.m_osc2Sign * this.m_lfoDepth, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesFWP = function (samples, start, end) {
            var i, freqNo, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), sens = this.m_inSens, pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesFFP = function (samples, start, end) {
            var i, freqNo, sens, depth = this.m_osc2Sign * this.m_lfoDepth * (1.0 / 127.0), pipe = MChannel.s_pipeArr[this.m_inPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            for (i = start; i < end; i++) {
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += this.m_portDepthAdd;
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                sens = this.m_inSens;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    sens *= oscMod2.getNextSample() * depth;
                }
                samples[i] = oscMod1.getNextSampleOfs(pipe[i] * sens);
                this.m_onCounter++;
            }
        };
        MChannel.prototype.getSamplesI_P = function (samples, start, end) {
            var s = start, e, freqNo, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamplesIPP = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesIWP = function (samples, start, end) {
            var s = start, e, freqNo, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncIn(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamplesO_P = function (samples, start, end) {
            var s = start, e, freqNo, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.prototype.getSamplesOPP = function (samples, start, end) {
            var s = start, e, freqNo, depth = this.m_osc2Sign * this.m_lfoDepth, syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    freqNo += oscMod2.getNextSample() * depth | 0;
                    oscMod2.addPhase(e - s - 1);
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
        };
        MChannel.prototype.getSamplesOWP = function (samples, start, end) {
            var s = start, e, freqNo, pwm, depth = this.m_osc2Sign * this.m_lfoDepth * 0.01, modPulse = this.m_oscSet1.getMod(flmml.MOscillator.PULSE), syncLine = MChannel.s_syncSources[this.m_syncPipe];
            var oscMod1 = this.m_oscMod1;
            var oscMod2 = this.m_oscMod2;
            do {
                e = s + MChannel.s_lfoDelta;
                if (e > end)
                    e = end;
                freqNo = this.m_freqNo;
                if (this.m_portDepth !== 0) {
                    freqNo += this.m_portDepth | 0;
                    this.m_portDepth += (this.m_portDepthAdd * (e - s - 1));
                    if (this.m_portDepth * this.m_portDepthAdd > 0)
                        this.m_portDepth = 0;
                }
                oscMod1.setFrequency(MChannel.getFrequency(freqNo));
                pwm = this.m_pulseWidth;
                if (this.m_onCounter >= this.m_lfoDelay && (this.m_lfoEnd === 0 || this.m_onCounter < this.m_lfoEnd)) {
                    pwm += oscMod2.getNextSample() * depth;
                    oscMod2.addPhase(e - s - 1);
                }
                if (pwm < 0) {
                    pwm = 0;
                }
                else if (pwm > 100.0) {
                    pwm = 100.0;
                }
                modPulse.setPWM(pwm);
                oscMod1.getSamplesWithSyncOut(samples, syncLine, s, e);
                this.m_onCounter += e - s;
                s = e;
            } while (s < end);
            if (this.m_portDepth === 0) {
                oscMod1.setFrequency(MChannel.getFrequency(this.m_freqNo));
            }
        };
        MChannel.PITCH_RESOLUTION = 100;
        MChannel.s_init = 0;
        MChannel.s_frequencyMap = new Array(128 * MChannel.PITCH_RESOLUTION);
        MChannel.s_lfoDelta = 245;
        return MChannel;
    })();
    flmml.MChannel = MChannel;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MEnvelope = (function () {
        function MEnvelope(attack, decay, sustain, release) {
            this.setAttack(attack);
            this.addPoint(decay, sustain);
            this.setRelease(release);
            this.m_playing = false;
            this.m_currentVal = 0;
            this.m_releasing = true;
            this.m_releaseStep = 0;
        }
        MEnvelope.boot = function () {
            if (!this.s_init) {
                var i;
                this.s_volumeLen = 256;
                for (i = 0; i < 3; i++) {
                    this.s_volumeMap[i] = new Array(this.s_volumeLen);
                    this.s_volumeMap[i][0] = 0.0;
                }
                for (i = 1; i < this.s_volumeLen; i++) {
                    this.s_volumeMap[0][i] = i / 255.0;
                    this.s_volumeMap[1][i] = Math.pow(10.0, (i - 255.0) * (48.0 / (255.0 * 20.0)));
                    this.s_volumeMap[2][i] = Math.pow(10.0, (i - 255.0) * (96.0 / (255.0 * 20.0)));
                }
                this.s_init = 1;
            }
        };
        MEnvelope.prototype.setAttack = function (attack) {
            this.m_envelopePoint = this.m_envelopeLastPoint = new flmml.MEnvelopePoint();
            this.m_envelopePoint.time = 0;
            this.m_envelopePoint.level = 0;
            this.addPoint(attack, 1.0);
        };
        MEnvelope.prototype.setRelease = function (release) {
            this.m_releaseTime = ((release > 0) ? release : (1.0 / 127.0)) * flmml.MSequencer.SAMPLE_RATE;
            if (this.m_playing && !this.m_releasing) {
                this.m_counter = this.m_timeInSamples;
                this.m_currentPoint = this.m_envelopePoint;
                while (this.m_currentPoint.next !== null && this.m_counter >= this.m_currentPoint.next.time) {
                    this.m_currentPoint = this.m_currentPoint.next;
                    this.m_counter -= this.m_currentPoint.time;
                }
                if (this.m_currentPoint.next == null) {
                    this.m_currentVal = this.m_currentPoint.level;
                }
                else {
                    this.m_step = (this.m_currentPoint.next.level - this.m_currentPoint.level) / this.m_currentPoint.next.time;
                    this.m_currentVal = this.m_currentPoint.level + (this.m_step * this.m_counter);
                }
            }
        };
        MEnvelope.prototype.addPoint = function (time, level) {
            var point = new flmml.MEnvelopePoint();
            point.time = time * flmml.MSequencer.SAMPLE_RATE;
            point.level = level;
            this.m_envelopeLastPoint.next = point;
            this.m_envelopeLastPoint = point;
        };
        MEnvelope.prototype.triggerEnvelope = function (zeroStart) {
            this.m_playing = true;
            this.m_releasing = false;
            this.m_currentPoint = this.m_envelopePoint;
            this.m_currentVal = this.m_currentPoint.level = (zeroStart) ? 0 : this.m_currentVal;
            this.m_step = (1.0 - this.m_currentVal) / this.m_currentPoint.next.time;
            this.m_timeInSamples = this.m_counter = 0;
        };
        MEnvelope.prototype.releaseEnvelope = function () {
            this.m_releasing = true;
            this.m_releaseStep = (this.m_currentVal / this.m_releaseTime);
        };
        MEnvelope.prototype.soundOff = function () {
            this.releaseEnvelope();
            this.m_playing = false;
        };
        MEnvelope.prototype.getNextAmplitudeLinear = function () {
            if (!this.m_playing)
                return 0;
            if (!this.m_releasing) {
                if (this.m_currentPoint.next == null) {
                    this.m_currentVal = this.m_currentPoint.level;
                }
                else {
                    var processed = false;
                    while (this.m_counter >= this.m_currentPoint.next.time) {
                        this.m_counter = 0;
                        this.m_currentPoint = this.m_currentPoint.next;
                        if (this.m_currentPoint.next == null) {
                            this.m_currentVal = this.m_currentPoint.level;
                            processed = true;
                            break;
                        }
                        else {
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
            }
            else {
                this.m_currentVal -= this.m_releaseStep;
            }
            if (this.m_currentVal <= 0 && this.m_releasing) {
                this.m_playing = false;
                this.m_currentVal = 0;
            }
            this.m_timeInSamples++;
            return this.m_currentVal;
        };
        MEnvelope.prototype.ampSamplesLinear = function (samples, start, end, velocity) {
            var i, amplitude = this.m_currentVal * velocity;
            for (i = start; i < end; i++) {
                if (!this.m_playing) {
                    samples[i] = 0;
                    continue;
                }
                if (!this.m_releasing) {
                    if (this.m_currentPoint.next == null) {
                    }
                    else {
                        var processed = false;
                        while (this.m_counter >= this.m_currentPoint.next.time) {
                            this.m_counter = 0;
                            this.m_currentPoint = this.m_currentPoint.next;
                            if (this.m_currentPoint.next == null) {
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                                break;
                            }
                            else {
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
                }
                else {
                    this.m_currentVal -= this.m_releaseStep;
                    amplitude = this.m_currentVal * velocity;
                }
                if (this.m_currentVal <= 0 && this.m_releasing) {
                    this.m_playing = false;
                    amplitude = this.m_currentVal = 0;
                }
                this.m_timeInSamples++;
                samples[i] *= amplitude;
            }
        };
        MEnvelope.prototype.ampSamplesNonLinear = function (samples, start, end, velocity, volMode) {
            var i;
            for (i = start; i < end; i++) {
                if (!this.m_playing) {
                    samples[i] = 0;
                    continue;
                }
                if (!this.m_releasing) {
                    if (this.m_currentPoint.next == null) {
                        this.m_currentVal = this.m_currentPoint.level;
                    }
                    else {
                        var processed = false;
                        while (this.m_counter >= this.m_currentPoint.next.time) {
                            this.m_counter = 0;
                            this.m_currentPoint = this.m_currentPoint.next;
                            if (this.m_currentPoint.next == null) {
                                this.m_currentVal = this.m_currentPoint.level;
                                processed = true;
                                break;
                            }
                            else {
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
                }
                else {
                    this.m_currentVal -= this.m_releaseStep;
                }
                if (this.m_currentVal <= 0 && this.m_releasing) {
                    this.m_playing = false;
                    this.m_currentVal = 0;
                }
                this.m_timeInSamples++;
                var cv = (this.m_currentVal * 255) | 0;
                if (cv > 255) {
                    cv = 0;
                }
                samples[i] *= MEnvelope.s_volumeMap[volMode][cv] * velocity;
            }
        };
        MEnvelope.prototype.isPlaying = function () {
            return this.m_playing;
        };
        MEnvelope.prototype.isReleasing = function () {
            return this.m_releasing;
        };
        MEnvelope.s_init = 0;
        MEnvelope.s_volumeMap = new Array(3);
        return MEnvelope;
    })();
    flmml.MEnvelope = MEnvelope;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MEnvelopePoint = (function () {
        function MEnvelopePoint() {
            this.next = null;
        }
        return MEnvelopePoint;
    })();
    flmml.MEnvelopePoint = MEnvelopePoint;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MEvent = (function () {
        function MEvent(tick) {
            this.TEMPO_SCALE = 100;
            this.set(1, 0, 0);
            this.setTick(tick);
        }
        MEvent.prototype.set = function (status, data0, data1) {
            this.m_status = status;
            this.m_data0 = data0;
            this.m_data1 = data1;
        };
        MEvent.prototype.setEOT = function () { this.set(0, 0, 0); };
        MEvent.prototype.setNoteOn = function (noteNo, vel) { this.set(2, noteNo, vel); };
        MEvent.prototype.setNoteOff = function (noteNo, vel) { this.set(3, noteNo, vel); };
        MEvent.prototype.setTempo = function (tempo) { this.set(4, tempo * this.TEMPO_SCALE, 0); };
        MEvent.prototype.setVolume = function (vol) { this.set(5, vol, 0); };
        MEvent.prototype.setNote = function (noteNo) { this.set(6, noteNo, 0); };
        MEvent.prototype.setForm = function (form, sub) { this.set(7, form, sub); };
        MEvent.prototype.setEnvelope1Atk = function (a) { this.set(8, a, 0); };
        MEvent.prototype.setEnvelope1Point = function (t, l) { this.set(9, t, l); };
        MEvent.prototype.setEnvelope1Rel = function (r) { this.set(10, r, 0); };
        MEvent.prototype.setEnvelope2Atk = function (a) { this.set(24, a, 0); };
        MEvent.prototype.setEnvelope2Point = function (t, l) { this.set(25, t, l); };
        MEvent.prototype.setEnvelope2Rel = function (r) { this.set(26, r, 0); };
        MEvent.prototype.setNoiseFreq = function (f) { this.set(11, f, 0); };
        MEvent.prototype.setPWM = function (w) { this.set(12, w, 0); };
        MEvent.prototype.setPan = function (p) { this.set(13, p, 0); };
        MEvent.prototype.setFormant = function (vowel) { this.set(14, vowel, 0); };
        MEvent.prototype.setDetune = function (d) { this.set(15, d, 0); };
        MEvent.prototype.setLFOFMSF = function (fm, sf) { this.set(16, fm, sf); };
        MEvent.prototype.setLFODPWD = function (dp, wd) { this.set(17, dp, wd); };
        MEvent.prototype.setLFODLTM = function (dl, tm) { this.set(18, dl, tm); };
        MEvent.prototype.setLFOTarget = function (target) { this.set(19, target, 0); };
        MEvent.prototype.setLPFSWTAMT = function (swt, amt) { this.set(20, swt, amt); };
        MEvent.prototype.setLPFFRQRES = function (frq, res) { this.set(21, frq, res); };
        MEvent.prototype.setClose = function () { this.set(22, 0, 0); };
        MEvent.prototype.setVolMode = function (m) { this.set(23, m, 0); };
        MEvent.prototype.setInput = function (sens, pipe) { this.set(27, sens, pipe); };
        MEvent.prototype.setOutput = function (mode, pipe) { this.set(28, mode, pipe); };
        MEvent.prototype.setExpression = function (ex) { this.set(29, ex, 0); };
        MEvent.prototype.setRing = function (sens, pipe) { this.set(30, sens, pipe); };
        MEvent.prototype.setSync = function (mode, pipe) { this.set(31, mode, pipe); };
        MEvent.prototype.setDelta = function (delta) { this.m_delta = delta; };
        MEvent.prototype.setTick = function (tick) { this.m_tick = tick; };
        MEvent.prototype.setPortamento = function (depth, len) { this.set(32, depth, len); };
        MEvent.prototype.setMidiPort = function (mode) { this.set(33, mode, 0); };
        ;
        MEvent.prototype.setMidiPortRate = function (rate) { this.set(34, rate, 0); };
        ;
        MEvent.prototype.setPortBase = function (base) { this.set(35, base, 0); };
        ;
        MEvent.prototype.setPoly = function (voiceCount) { this.set(36, voiceCount, 0); };
        ;
        MEvent.prototype.setResetAll = function () { this.set(38, 0, 0); };
        MEvent.prototype.setSoundOff = function () { this.set(37, 0, 0); };
        MEvent.prototype.setHwLfo = function (w, f, pmd, amd, pms, ams, s) {
            this.set(39, ((w & 3) << 27) | ((f & 0xff) << 19) | ((pmd & 0x7f) << 12) | ((amd & 0x7f) << 5) | ((pms & 7) << 2) | (ams & 3), 0);
        };
        MEvent.prototype.getStatus = function () { return this.m_status; };
        MEvent.prototype.getDelta = function () { return this.m_delta; };
        MEvent.prototype.getTick = function () { return this.m_tick; };
        MEvent.prototype.getNoteNo = function () { return this.m_data0; };
        MEvent.prototype.getVelocity = function () { return this.m_data1; };
        MEvent.prototype.getTempo = function () { return Math.floor(this.m_data0) / this.TEMPO_SCALE; };
        MEvent.prototype.getVolume = function () { return this.m_data0; };
        MEvent.prototype.getForm = function () { return this.m_data0; };
        MEvent.prototype.getSubForm = function () { return this.m_data1; };
        MEvent.prototype.getEnvelopeA = function () { return this.m_data0; };
        MEvent.prototype.getEnvelopeT = function () { return this.m_data0; };
        MEvent.prototype.getEnvelopeL = function () { return this.m_data1; };
        MEvent.prototype.getEnvelopeR = function () { return this.m_data0; };
        MEvent.prototype.getNoiseFreq = function () { return this.m_data0; };
        MEvent.prototype.getPWM = function () { return this.m_data0; };
        MEvent.prototype.getPan = function () { return this.m_data0; };
        MEvent.prototype.getVowel = function () { return this.m_data0; };
        MEvent.prototype.getDetune = function () { return this.m_data0; };
        MEvent.prototype.getLFODepth = function () { return this.m_data0; };
        MEvent.prototype.getLFOWidth = function () { return this.m_data1; };
        MEvent.prototype.getLFOForm = function () { return this.m_data0; };
        MEvent.prototype.getLFOSubForm = function () { return this.m_data1; };
        MEvent.prototype.getLFODelay = function () { return this.m_data0; };
        MEvent.prototype.getLFOTime = function () { return this.m_data1; };
        MEvent.prototype.getLFOTarget = function () { return this.m_data0; };
        MEvent.prototype.getLPFSwt = function () { return this.m_data0; };
        MEvent.prototype.getLPFAmt = function () { return this.m_data1; };
        MEvent.prototype.getLPFFrq = function () { return this.m_data0; };
        MEvent.prototype.getLPFRes = function () { return this.m_data1; };
        MEvent.prototype.getVolMode = function () { return this.m_data0; };
        MEvent.prototype.getInputSens = function () { return this.m_data0; };
        MEvent.prototype.getInputPipe = function () { return this.m_data1; };
        MEvent.prototype.getOutputMode = function () { return this.m_data0; };
        MEvent.prototype.getOutputPipe = function () { return this.m_data1; };
        MEvent.prototype.getExpression = function () { return this.m_data0; };
        MEvent.prototype.getRingSens = function () { return this.m_data0; };
        MEvent.prototype.getRingInput = function () { return this.m_data1; };
        MEvent.prototype.getSyncMode = function () { return this.m_data0; };
        MEvent.prototype.getSyncPipe = function () { return this.m_data1; };
        MEvent.prototype.getPorDepth = function () { return this.m_data0; };
        MEvent.prototype.getPorLen = function () { return this.m_data1; };
        MEvent.prototype.getMidiPort = function () { return this.m_data0; };
        MEvent.prototype.getMidiPortRate = function () { return this.m_data0; };
        MEvent.prototype.getPortBase = function () { return this.m_data0; };
        MEvent.prototype.getVoiceCount = function () { return this.m_data0; };
        MEvent.prototype.getHwLfoData = function () { return this.m_data0; };
        return MEvent;
    })();
    flmml.MEvent = MEvent;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MFilter = (function () {
        function MFilter() {
            this.setSwitch(0);
        }
        MFilter.prototype.reset = function () {
            this.m_t1 = this.m_t2 = this.m_b0 = this.m_b1 = this.m_b2 = this.m_b3 = this.m_b4 = 0.0;
        };
        MFilter.prototype.setSwitch = function (s) {
            this.reset();
            this.sw = s;
        };
        MFilter.prototype.checkToSilence = function () {
            switch (this.sw) {
                case 0:
                    return false;
                case 1:
                case -1:
                    return (-0.000001 <= this.m_b0 && this.m_b0 <= 0.000001 && -0.000001 <= this.m_b1 && this.m_b1 <= 0.000001);
                case 2:
                case -2:
                    return (-0.000001 <= this.m_t1 && this.m_t1 <= 0.000001 &&
                        -0.000001 <= this.m_t2 && this.m_t2 <= 0.000001 &&
                        -0.000001 <= this.m_b0 && this.m_b0 <= 0.000001 &&
                        -0.000001 <= this.m_b1 && this.m_b1 <= 0.000001 &&
                        -0.000001 <= this.m_b2 && this.m_b2 <= 0.000001 &&
                        -0.000001 <= this.m_b3 && this.m_b3 <= 0.000001 &&
                        -0.000001 <= this.m_b4 && this.m_b4 <= 0.000001);
            }
            return false;
        };
        MFilter.prototype.run = function (samples, start, end, envelope, frq, amt, res, key) {
            switch (this.sw) {
                case -2:
                    this.hpf2(samples, start, end, envelope, frq, amt, res, key);
                    break;
                case -1:
                    this.hpf1(samples, start, end, envelope, frq, amt, res, key);
                    break;
                case 0: return;
                case 1:
                    this.lpf1(samples, start, end, envelope, frq, amt, res, key);
                    break;
                case 2:
                    this.lpf2(samples, start, end, envelope, frq, amt, res, key);
                    break;
            }
        };
        MFilter.prototype.lpf1 = function (samples, start, end, envelope, frq, amt, res, key) {
            var b0 = this.m_b0, b1 = this.m_b1;
            var i;
            var fb;
            var cut;
            var k = key * (2.0 * Math.PI / (flmml.MSequencer.SAMPLE_RATE * 440.0));
            if (amt > 0.0001 || amt < -0.0001) {
                for (i = start; i < end; i++) {
                    cut = flmml.MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                    if (cut < (1.0 / 127.0))
                        cut = 0.0;
                    if (cut > (1.0 - 0.0001))
                        cut = 1.0 - 0.0001;
                    fb = res + res / (1.0 - cut);
                    b0 = b0 + cut * (samples[i] - b0 + fb * (b0 - b1));
                    samples[i] = b1 = b1 + cut * (b0 - b1);
                }
            }
            else {
                cut = flmml.MChannel.getFrequency(frq) * k;
                if (cut < (1.0 / 127.0))
                    cut = 0.0;
                if (cut > (1.0 - 0.0001))
                    cut = 1.0 - 0.0001;
                fb = res + res / (1.0 - cut);
                for (i = start; i < end; i++) {
                    b0 = b0 + cut * (samples[i] - b0 + fb * (b0 - b1));
                    samples[i] = b1 = b1 + cut * (b0 - b1);
                }
            }
            this.m_b0 = b0;
            this.m_b1 = b1;
        };
        MFilter.prototype.lpf2 = function (samples, start, end, envelope, frq, amt, res, key) {
            var t1 = this.m_t1, t2 = this.m_t2, b0 = this.m_b0, b1 = this.m_b1, b2 = this.m_b2, b3 = this.m_b3, b4 = this.m_b4;
            var k = key * (2.0 * Math.PI / (flmml.MSequencer.SAMPLE_RATE * 440.0));
            for (var i = start; i < end; i++) {
                var cut = flmml.MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                if (cut < (1.0 / 127.0))
                    cut = 0.0;
                if (cut > 1.0)
                    cut = 1.0;
                var q = 1.0 - cut;
                var p = cut + 0.8 * cut * q;
                var f = p + p - 1.0;
                q = res * (1.0 + 0.5 * q * (1.0 - q + 5.6 * q * q));
                var input = samples[i];
                input -= q * b4;
                t1 = b1;
                b1 = (input + b0) * p - b1 * f;
                t2 = b2;
                b2 = (b1 + t1) * p - b2 * f;
                t1 = b3;
                b3 = (b2 + t2) * p - b3 * f;
                b4 = (b3 + t1) * p - b4 * f;
                b4 = b4 - b4 * b4 * b4 * 0.166667;
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
        };
        MFilter.prototype.hpf1 = function (samples, start, end, envelope, frq, amt, res, key) {
            var b0 = this.m_b0, b1 = this.m_b1;
            var i;
            var fb;
            var cut;
            var k = key * (2.0 * Math.PI / (flmml.MSequencer.SAMPLE_RATE * 440.0));
            var input;
            if (amt > 0.0001 || amt < -0.0001) {
                for (i = start; i < end; i++) {
                    cut = flmml.MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                    if (cut < (1.0 / 127.0))
                        cut = 0.0;
                    if (cut > (1.0 - 0.0001))
                        cut = 1.0 - 0.0001;
                    fb = res + res / (1.0 - cut);
                    input = samples[i];
                    b0 = b0 + cut * (input - b0 + fb * (b0 - b1));
                    b1 = b1 + cut * (b0 - b1);
                    samples[i] = input - b0;
                }
            }
            else {
                cut = flmml.MChannel.getFrequency(frq) * k;
                if (cut < (1.0 / 127.0))
                    cut = 0.0;
                if (cut > (1.0 - 0.0001))
                    cut = 1.0 - 0.0001;
                fb = res + res / (1.0 - cut);
                for (i = start; i < end; i++) {
                    input = samples[i];
                    b0 = b0 + cut * (input - b0 + fb * (b0 - b1));
                    b1 = b1 + cut * (b0 - b1);
                    samples[i] = input - b0;
                }
            }
            this.m_b0 = b0;
            this.m_b1 = b1;
        };
        MFilter.prototype.hpf2 = function (samples, start, end, envelope, frq, amt, res, key) {
            var t1 = this.m_t1, t2 = this.m_t2, b0 = this.m_b0, b1 = this.m_b1, b2 = this.m_b2, b3 = this.m_b3, b4 = this.m_b4;
            var k = key * (2.0 * Math.PI / (flmml.MSequencer.SAMPLE_RATE * 440.0));
            for (var i = start; i < end; i++) {
                var cut = flmml.MChannel.getFrequency(frq + amt * envelope.getNextAmplitudeLinear()) * k;
                if (cut < (1.0 / 127.0))
                    cut = 0.0;
                if (cut > 1.0)
                    cut = 1.0;
                var q = 1.0 - cut;
                var p = cut + 0.8 * cut * q;
                var f = p + p - 1.0;
                q = res * (1.0 + 0.5 * q * (1.0 - q + 5.6 * q * q));
                var input = samples[i];
                input -= q * b4;
                t1 = b1;
                b1 = (input + b0) * p - b1 * f;
                t2 = b2;
                b2 = (b1 + t1) * p - b2 * f;
                t1 = b3;
                b3 = (b2 + t2) * p - b3 * f;
                b4 = (b3 + t1) * p - b4 * f;
                b4 = b4 - b4 * b4 * b4 * 0.166667;
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
        };
        return MFilter;
    })();
    flmml.MFilter = MFilter;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MFormant = (function () {
        function MFormant() {
            this.m_ca0 = 0.00000811044;
            this.m_ca1 = 8.943665402;
            this.m_ca2 = -36.83889529;
            this.m_ca3 = 92.01697887;
            this.m_ca4 = -154.337906;
            this.m_ca5 = 181.6233289;
            this.m_ca6 = -151.8651235;
            this.m_ca7 = 89.09614114;
            this.m_ca8 = -35.10298511;
            this.m_ca9 = 8.388101016;
            this.m_caA = -0.923313471;
            this.m_ce0 = 0.00000436215;
            this.m_ce1 = 8.90438318;
            this.m_ce2 = -36.55179099;
            this.m_ce3 = 91.05750846;
            this.m_ce4 = -152.422234;
            this.m_ce5 = 179.1170248;
            this.m_ce6 = -149.6496211;
            this.m_ce7 = 87.78352223;
            this.m_ce8 = -34.60687431;
            this.m_ce9 = 8.282228154;
            this.m_ceA = -0.914150747;
            this.m_ci0 = 0.00000333819;
            this.m_ci1 = 8.893102966;
            this.m_ci2 = -36.49532826;
            this.m_ci3 = 90.96543286;
            this.m_ci4 = -152.4545478;
            this.m_ci5 = 179.4835618;
            this.m_ci6 = -150.315433;
            this.m_ci7 = 88.43409371;
            this.m_ci8 = -34.98612086;
            this.m_ci9 = 8.407803364;
            this.m_ciA = -0.932568035;
            this.m_co0 = 0.00000113572;
            this.m_co1 = 8.994734087;
            this.m_co2 = -37.2084849;
            this.m_co3 = 93.22900521;
            this.m_co4 = -156.6929844;
            this.m_co5 = 184.596544;
            this.m_co6 = -154.3755513;
            this.m_co7 = 90.49663749;
            this.m_co8 = -35.58964535;
            this.m_co9 = 8.478996281;
            this.m_coA = -0.929252233;
            this.m_cu0 = 4.09431e-7;
            this.m_cu1 = 8.997322763;
            this.m_cu2 = -37.20218544;
            this.m_cu3 = 93.11385476;
            this.m_cu4 = -156.2530937;
            this.m_cu5 = 183.7080141;
            this.m_cu6 = -153.2631681;
            this.m_cu7 = 89.59539726;
            this.m_cu8 = -35.12454591;
            this.m_cu9 = 8.338655623;
            this.m_cuA = -0.910251753;
            this.m_vowel = MFormant.VOWEL_A;
            this.m_power = false;
            this.reset();
        }
        MFormant.prototype.setVowel = function (vowel) {
            this.m_power = true;
            this.m_vowel = vowel;
        };
        MFormant.prototype.disable = function () {
            this.m_power = false;
            this.reset();
        };
        MFormant.prototype.reset = function () {
            this.m_m0 = this.m_m1 = this.m_m2 = this.m_m3 = this.m_m4 = this.m_m5 = this.m_m6 = this.m_m7 = this.m_m8 = this.m_m9 = 0;
        };
        MFormant.prototype.checkToSilence = function () {
            return this.m_power && (-0.000001 <= this.m_m0 && this.m_m0 <= 0.000001 &&
                -0.000001 <= this.m_m1 && this.m_m1 <= 0.000001 &&
                -0.000001 <= this.m_m2 && this.m_m2 <= 0.000001 &&
                -0.000001 <= this.m_m3 && this.m_m3 <= 0.000001 &&
                -0.000001 <= this.m_m4 && this.m_m4 <= 0.000001 &&
                -0.000001 <= this.m_m5 && this.m_m5 <= 0.000001 &&
                -0.000001 <= this.m_m6 && this.m_m6 <= 0.000001 &&
                -0.000001 <= this.m_m7 && this.m_m7 <= 0.000001 &&
                -0.000001 <= this.m_m8 && this.m_m8 <= 0.000001 &&
                -0.000001 <= this.m_m9 && this.m_m9 <= 0.000001);
        };
        MFormant.prototype.run = function (samples, start, end) {
            if (!this.m_power)
                return;
            var i;
            switch (this.m_vowel) {
                case 0:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_ca0 * samples[i] +
                            this.m_ca1 * this.m_m0 + this.m_ca2 * this.m_m1 +
                            this.m_ca3 * this.m_m2 + this.m_ca4 * this.m_m3 +
                            this.m_ca5 * this.m_m4 + this.m_ca6 * this.m_m5 +
                            this.m_ca7 * this.m_m6 + this.m_ca8 * this.m_m7 +
                            this.m_ca9 * this.m_m8 + this.m_caA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
                case 1:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_ce0 * samples[i] +
                            this.m_ce1 * this.m_m0 + this.m_ce2 * this.m_m1 +
                            this.m_ce3 * this.m_m2 + this.m_ce4 * this.m_m3 +
                            this.m_ce5 * this.m_m4 + this.m_ce6 * this.m_m5 +
                            this.m_ce7 * this.m_m6 + this.m_ce8 * this.m_m7 +
                            this.m_ce9 * this.m_m8 + this.m_ceA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
                case 2:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_ci0 * samples[i] +
                            this.m_ci1 * this.m_m0 + this.m_ci2 * this.m_m1 +
                            this.m_ci3 * this.m_m2 + this.m_ci4 * this.m_m3 +
                            this.m_ci5 * this.m_m4 + this.m_ci6 * this.m_m5 +
                            this.m_ci7 * this.m_m6 + this.m_ci8 * this.m_m7 +
                            this.m_ci9 * this.m_m8 + this.m_ciA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
                case 3:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_co0 * samples[i] +
                            this.m_co1 * this.m_m0 + this.m_co2 * this.m_m1 +
                            this.m_co3 * this.m_m2 + this.m_co4 * this.m_m3 +
                            this.m_co5 * this.m_m4 + this.m_co6 * this.m_m5 +
                            this.m_co7 * this.m_m6 + this.m_co8 * this.m_m7 +
                            this.m_co9 * this.m_m8 + this.m_coA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
                case 4:
                    for (i = start; i < end; i++) {
                        samples[i] = this.m_cu0 * samples[i] +
                            this.m_cu1 * this.m_m0 + this.m_cu2 * this.m_m1 +
                            this.m_cu3 * this.m_m2 + this.m_cu4 * this.m_m3 +
                            this.m_cu5 * this.m_m4 + this.m_cu6 * this.m_m5 +
                            this.m_cu7 * this.m_m6 + this.m_cu8 * this.m_m7 +
                            this.m_cu9 * this.m_m8 + this.m_cuA * this.m_m9;
                        this.m_m9 = this.m_m8;
                        this.m_m8 = this.m_m7;
                        this.m_m7 = this.m_m6;
                        this.m_m6 = this.m_m5;
                        this.m_m5 = this.m_m4;
                        this.m_m4 = this.m_m3;
                        this.m_m3 = this.m_m2;
                        this.m_m2 = this.m_m1;
                        this.m_m1 = this.m_m0;
                        this.m_m0 = samples[i];
                    }
                    return;
            }
        };
        MFormant.VOWEL_A = 0;
        MFormant.VOWEL_E = 1;
        MFormant.VOWEL_I = 2;
        MFormant.VOWEL_O = 3;
        MFormant.VOWEL_U = 4;
        return MFormant;
    })();
    flmml.MFormant = MFormant;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MML = (function () {
        function MML() {
            this.m_sequencer = new flmml.MSequencer();
        }
        MML.isWhitespace = function (c) {
            if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "　") {
                return true;
            }
            else {
                return false;
            }
        };
        MML.removeWhitespace = function (str) {
            return str.replace(new RegExp("[ 　\n\r\t\f]+", "g"), "");
        };
        MML.remove = function (str, start, end) {
            return str.substring(0, start) + str.substring(end + 1);
        };
        MML.prototype.getWarnings = function () {
            return this.m_warning;
        };
        MML.prototype.warning = function (warnId, str) {
            this.m_warning += flmml.MWarning.getString(warnId, str) + "\n";
        };
        MML.prototype.len2tick = function (len) {
            if (len === 0)
                return this.m_length;
            return 384 / len | 0;
        };
        MML.prototype.note = function (noteNo) {
            noteNo += this.m_noteShift + this.getKeySig();
            if (this.getChar() === '*') {
                this.m_beforeNote = noteNo + this.m_octave * 12;
                this.m_portamento = 1;
                this.next();
            }
            else {
                var lenMode;
                var len;
                var tick = 0;
                var tickTemp;
                var tie = 0;
                var keyon = (this.m_keyoff === 0) ? 0 : 1;
                this.m_keyoff = 1;
                while (1) {
                    if (this.getChar() !== '%') {
                        lenMode = 0;
                    }
                    else {
                        lenMode = 1;
                        this.next();
                    }
                    len = this.getUInt(0);
                    if (tie === 1 && len === 0) {
                        this.m_keyoff = 0;
                        break;
                    }
                    tickTemp = (lenMode ? len : this.len2tick(len));
                    tick += this.getDot(tickTemp);
                    tie = 0;
                    if (this.getChar() === '&') {
                        tie = 1;
                        this.next();
                    }
                    else {
                        break;
                    }
                }
                if (this.m_portamento === 1) {
                    this.m_tracks[this.m_trackNo].recPortamento(this.m_beforeNote - (noteNo + this.m_octave * 12), tick);
                }
                this.m_tracks[this.m_trackNo].recNote(noteNo + this.m_octave * 12, tick, this.m_velocity, keyon, this.m_keyoff);
                if (this.m_portamento === 1) {
                    this.m_tracks[this.m_trackNo].recPortamento(0, 0);
                    this.m_portamento = 0;
                }
            }
        };
        MML.prototype.rest = function () {
            var lenMode = 0;
            if (this.getChar() === '%') {
                lenMode = 1;
                this.next();
            }
            var len;
            len = this.getUInt(0);
            var tick = lenMode ? len : this.len2tick(len);
            tick = this.getDot(tick);
            this.m_tracks[this.m_trackNo].recRest(tick);
        };
        MML.prototype.atmark = function () {
            var _this = this;
            var c = this.getChar();
            var o = 1, a = 0, d = 64, s = 32, r = 0, sens = 0, mode = 0;
            var w = 0, f = 0;
            var pmd, amd, pms, ams;
            switch (c) {
                case 'v':
                    this.m_velDetail = true;
                    this.next();
                    this.m_velocity = this.getUInt(this.m_velocity);
                    if (this.m_velocity > 127)
                        this.m_velocity = 127;
                    break;
                case 'x':
                    this.next();
                    o = this.getUInt(127);
                    if (o > 127)
                        o = 127;
                    this.m_tracks[this.m_trackNo].recExpression(o);
                    break;
                case 'e':
                    (function () {
                        var releasePos;
                        var t = new Array(), l = new Array();
                        _this.next();
                        o = _this.getUInt(o);
                        if (_this.getChar() === ',')
                            _this.next();
                        a = _this.getUInt(a);
                        releasePos = _this.m_letter;
                        while (true) {
                            if (_this.getChar() === ',') {
                                _this.next();
                            }
                            else {
                                break;
                            }
                            releasePos = _this.m_letter - 1;
                            d = _this.getUInt(d);
                            if (_this.getChar() === ',') {
                                _this.next();
                            }
                            else {
                                _this.m_letter = releasePos;
                                break;
                            }
                            s = _this.getUInt(s);
                            t.push(d);
                            l.push(s);
                        }
                        if (t.length === 0) {
                            t.push(d);
                            l.push(s);
                        }
                        if (_this.getChar() === ',')
                            _this.next();
                        r = _this.getUInt(r);
                        _this.m_tracks[_this.m_trackNo].recEnvelope(o, a, t, l, r);
                    })();
                    break;
                case 'm':
                    this.next();
                    if (this.getChar() === 'h') {
                        this.next();
                        w = 0;
                        f = 0;
                        pmd = 0;
                        amd = 0;
                        pms = 0;
                        ams = 0;
                        s = 1;
                        do {
                            w = this.getUInt(w);
                            if (this.getChar() !== ',')
                                break;
                            this.next();
                            f = this.getUInt(f);
                            if (this.getChar() !== ',')
                                break;
                            this.next();
                            pmd = this.getUInt(pmd);
                            if (this.getChar() !== ',')
                                break;
                            this.next();
                            amd = this.getUInt(amd);
                            if (this.getChar() !== ',')
                                break;
                            this.next();
                            pms = this.getUInt(pms);
                            if (this.getChar() !== ',')
                                break;
                            this.next();
                            ams = this.getUInt(ams);
                            if (this.getChar() !== ',')
                                break;
                            this.next();
                            s = this.getUInt(s);
                        } while (false);
                        this.m_tracks[this.m_trackNo].recHwLfo(w, f, pmd, amd, pms, ams, s);
                    }
                    break;
                case 'n':
                    this.next();
                    if (this.getChar() === 's') {
                        this.next();
                        this.m_noteShift += this.getSInt(0);
                    }
                    else {
                        o = this.getUInt(0);
                        if (o < 0 || o > 127)
                            o = 0;
                        this.m_tracks[this.m_trackNo].recNoiseFreq(o);
                    }
                    break;
                case 'w':
                    this.next();
                    o = this.getSInt(50);
                    if (o < 0) {
                        if (o > -1)
                            o = -1;
                        if (o < -99)
                            o = -99;
                    }
                    else {
                        if (o < 1)
                            o = 1;
                        if (o > 99)
                            o = 99;
                    }
                    this.m_tracks[this.m_trackNo].recPWM(o);
                    break;
                case 'p':
                    this.next();
                    if (this.getChar() === 'l') {
                        this.next();
                        o = this.getUInt(this.m_polyVoice);
                        o = Math.max(0, Math.min(this.m_polyVoice, o));
                        this.m_tracks[this.m_trackNo].recPoly(o);
                    }
                    else {
                        o = this.getUInt(64);
                        if (o < 1)
                            o = 1;
                        if (o > 127)
                            o = 127;
                        this.m_tracks[this.m_trackNo].recPan(o);
                    }
                    break;
                case '\'':
                    this.next();
                    o = this.m_string.indexOf('\'', this.m_letter);
                    if (o >= 0) {
                        var vstr = this.m_string.substring(this.m_letter, o);
                        var vowel = 0;
                        switch (vstr) {
                            case 'a':
                                vowel = flmml.MFormant.VOWEL_A;
                                break;
                            case 'e':
                                vowel = flmml.MFormant.VOWEL_E;
                                break;
                            case 'i':
                                vowel = flmml.MFormant.VOWEL_I;
                                break;
                            case 'o':
                                vowel = flmml.MFormant.VOWEL_O;
                                break;
                            case 'u':
                                vowel = flmml.MFormant.VOWEL_U;
                                break;
                            default:
                                vowel = -1;
                                break;
                        }
                        this.m_tracks[this.m_trackNo].recFormant(vowel);
                        this.m_letter = o + 1;
                    }
                    break;
                case 'd':
                    this.next();
                    o = this.getSInt(0);
                    this.m_tracks[this.m_trackNo].recDetune(o);
                    break;
                case 'l':
                    (function () {
                        var dp = 0, wd = 0, fm = 1, sf = 0, rv = 1, dl = 0, tm = 0, cn = 0, sw = 0;
                        _this.next();
                        dp = _this.getUInt(dp);
                        if (_this.getChar() === ',')
                            _this.next();
                        wd = _this.getUInt(wd);
                        if (_this.getChar() === ',') {
                            _this.next();
                            if (_this.getChar() === '-') {
                                rv = -1;
                                _this.next();
                            }
                            fm = (_this.getUInt(fm) + 1) * rv;
                            if (_this.getChar() === '-') {
                                _this.next();
                                sf = _this.getUInt(0);
                            }
                            if (_this.getChar() === ',') {
                                _this.next();
                                dl = _this.getUInt(dl);
                                if (_this.getChar() === ',') {
                                    _this.next();
                                    tm = _this.getUInt(tm);
                                    if (_this.getChar() === ',') {
                                        _this.next();
                                        sw = _this.getUInt(sw);
                                    }
                                }
                            }
                        }
                        _this.m_tracks[_this.m_trackNo].recLFO(dp, wd, fm, sf, dl, tm, sw);
                    })();
                    break;
                case 'f':
                    (function () {
                        var swt = 0, amt = 0, frq = 0, res = 0;
                        _this.next();
                        swt = _this.getSInt(swt);
                        if (_this.getChar() === ',') {
                            _this.next();
                            amt = _this.getSInt(amt);
                            if (_this.getChar() === ',') {
                                _this.next();
                                frq = _this.getUInt(frq);
                                if (_this.getChar() === ',') {
                                    _this.next();
                                    res = _this.getUInt(res);
                                }
                            }
                        }
                        _this.m_tracks[_this.m_trackNo].recLPF(swt, amt, frq, res);
                    })();
                    break;
                case 'q':
                    this.next();
                    this.m_tracks[this.m_trackNo].recGate2(this.getUInt(2) * 2);
                    break;
                case 'i':
                    sens = 0;
                    this.next();
                    sens = this.getUInt(sens);
                    if (this.getChar() === ',') {
                        this.next();
                        a = this.getUInt(a);
                        if (a > this.m_maxPipe)
                            a = this.m_maxPipe;
                    }
                    this.m_tracks[this.m_trackNo].recInput(sens, a);
                    break;
                case 'o':
                    mode = 0;
                    this.next();
                    mode = this.getUInt(mode);
                    if (this.getChar() === ',') {
                        this.next();
                        a = this.getUInt(a);
                        if (a > this.m_maxPipe) {
                            this.m_maxPipe = a;
                            if (this.m_maxPipe >= MML.MAX_PIPE)
                                this.m_maxPipe = a = MML.MAX_PIPE;
                        }
                    }
                    this.m_tracks[this.m_trackNo].recOutput(mode, a);
                    break;
                case 'r':
                    (function () {
                        sens = 0;
                        _this.next();
                        sens = _this.getUInt(sens);
                        if (_this.getChar() === ',') {
                            _this.next();
                            a = _this.getUInt(a);
                            if (a > _this.m_maxPipe)
                                a = _this.m_maxPipe;
                        }
                        _this.m_tracks[_this.m_trackNo].recRing(sens, a);
                    })();
                    break;
                case 's':
                    {
                        mode = 0;
                        this.next();
                        mode = this.getUInt(mode);
                        if (this.getChar() === ',') {
                            this.next();
                            a = this.getUInt(a);
                            if (mode === 1) {
                                if (a > this.m_maxSyncSource) {
                                    this.m_maxSyncSource = a;
                                    if (this.m_maxSyncSource >= MML.MAX_SYNCSOURCE)
                                        this.m_maxSyncSource = a = MML.MAX_SYNCSOURCE;
                                }
                            }
                            else if (mode === 2) {
                                if (a > this.m_maxSyncSource)
                                    a = this.m_maxSyncSource;
                            }
                        }
                        this.m_tracks[this.m_trackNo].recSync(mode, a);
                    }
                    break;
                case 'u':
                    this.next();
                    var rate;
                    mode = this.getUInt(0);
                    switch (mode) {
                        case 0:
                        case 1:
                            this.m_tracks[this.m_trackNo].recMidiPort(mode);
                            break;
                        case 2:
                            rate = 0;
                            if (this.getChar() === ',') {
                                this.next();
                                rate = this.getUInt(0);
                                if (rate < 0)
                                    rate = 0;
                                if (rate > 127)
                                    rate = 127;
                            }
                            this.m_tracks[this.m_trackNo].recMidiPortRate(rate * 1);
                            break;
                        case 3:
                            if (this.getChar() === ',') {
                                this.next();
                                var oct;
                                var baseNote = -1;
                                if (this.getChar() !== 'o') {
                                    oct = this.m_octave;
                                }
                                else {
                                    this.next();
                                    oct = this.getUInt(0);
                                }
                                c = this.getChar();
                                switch (c) {
                                    case 'c':
                                        baseNote = 0;
                                        break;
                                    case 'd':
                                        baseNote = 2;
                                        break;
                                    case 'e':
                                        baseNote = 4;
                                        break;
                                    case 'f':
                                        baseNote = 5;
                                        break;
                                    case 'g':
                                        baseNote = 7;
                                        break;
                                    case 'a':
                                        baseNote = 9;
                                        break;
                                    case 'b':
                                        baseNote = 11;
                                        break;
                                }
                                if (baseNote >= 0) {
                                    this.next();
                                    baseNote += this.m_noteShift + this.getKeySig();
                                    baseNote += oct * 12;
                                }
                                else {
                                    baseNote = this.getUInt(60);
                                }
                                if (baseNote < 0)
                                    baseNote = 0;
                                if (baseNote > 127)
                                    baseNote = 127;
                                this.m_tracks[this.m_trackNo].recPortBase(baseNote);
                            }
                            break;
                    }
                    break;
                default:
                    this.m_form = this.getUInt(this.m_form);
                    a = 0;
                    if (this.getChar() === '-') {
                        this.next();
                        a = this.getUInt(0);
                    }
                    this.m_tracks[this.m_trackNo].recForm(this.m_form, a);
                    break;
            }
        };
        MML.prototype.firstLetter = function () {
            var c = this.getCharNext();
            var c0;
            var i;
            switch (c) {
                case "c":
                    this.note(0);
                    break;
                case "d":
                    this.note(2);
                    break;
                case "e":
                    this.note(4);
                    break;
                case "f":
                    this.note(5);
                    break;
                case "g":
                    this.note(7);
                    break;
                case "a":
                    this.note(9);
                    break;
                case "b":
                    this.note(11);
                    break;
                case "r":
                    this.rest();
                    break;
                case "o":
                    this.m_octave = this.getUInt(this.m_octave);
                    if (this.m_octave < -2)
                        this.m_octave = -2;
                    if (this.m_octave > 8)
                        this.m_octave = 8;
                    break;
                case "v":
                    this.m_velDetail = false;
                    this.m_velocity = this.getUInt((this.m_velocity - 7) / 8) * 8 + 7;
                    if (this.m_velocity < 0)
                        this.m_velocity = 0;
                    if (this.m_velocity > 127)
                        this.m_velocity = 127;
                    break;
                case "(":
                case ")":
                    i = this.getUInt(1);
                    if (c === "(" && this.m_velDir ||
                        c === ")" && !this.m_velDir) {
                        this.m_velocity += (this.m_velDetail) ? (1 * i) : (8 * i);
                        if (this.m_velocity > 127)
                            this.m_velocity = 127;
                    }
                    else {
                        this.m_velocity -= (this.m_velDetail) ? (1 * i) : (8 * i);
                        if (this.m_velocity < 0)
                            this.m_velocity = 0;
                    }
                    break;
                case "l":
                    this.m_length = this.len2tick(this.getUInt(0));
                    this.m_length = this.getDot(this.m_length);
                    break;
                case "t":
                    this.m_tempo = this.getUNumber(this.m_tempo);
                    if (this.m_tempo < 1)
                        this.m_tempo = 1;
                    this.m_tracks[flmml.MTrack.TEMPO_TRACK].recTempo(this.m_tracks[this.m_trackNo].getRecGlobalTick(), this.m_tempo);
                    break;
                case "q":
                    this.m_gate = this.getUInt(this.m_gate);
                    this.m_tracks[this.m_trackNo].recGate(this.m_gate / this.m_maxGate);
                    break;
                case "<":
                    if (this.m_relativeDir)
                        this.m_octave++;
                    else
                        this.m_octave--;
                    break;
                case ">":
                    if (this.m_relativeDir)
                        this.m_octave--;
                    else
                        this.m_octave++;
                    break;
                case ";":
                    this.m_keyoff = 1;
                    if (this.m_tracks[this.m_trackNo].getNumEvents() > 0) {
                        this.m_trackNo++;
                    }
                    this.m_tracks[this.m_trackNo] = this.createTrack();
                    break;
                case "@":
                    this.atmark();
                    break;
                case "x":
                    this.m_tracks[this.m_trackNo].recVolMode(this.getUInt(1));
                    break;
                case "n":
                    c0 = this.getChar();
                    if (c0 === "s") {
                        this.next();
                        this.m_noteShift = this.getSInt(this.m_noteShift);
                    }
                    else
                        this.warning(flmml.MWarning.UNKNOWN_COMMAND, c + c0);
                    break;
                case '[':
                    this.m_tracks[this.m_trackNo].recChordStart();
                    break;
                case ']':
                    this.m_tracks[this.m_trackNo].recChordEnd();
                    break;
                default:
                    {
                        var cc = c.charCodeAt(0);
                        if (cc < 128)
                            this.warning(flmml.MWarning.UNKNOWN_COMMAND, c);
                    }
                    break;
            }
        };
        MML.prototype.getCharNext = function () {
            return (this.m_letter < this.m_string.length) ? this.m_string.charAt(this.m_letter++) : '';
        };
        MML.prototype.getChar = function () {
            return (this.m_letter < this.m_string.length) ? this.m_string.charAt(this.m_letter) : '';
        };
        MML.prototype.next = function (i) {
            if (i === void 0) { i = 1; }
            this.m_letter += 1;
        };
        MML.prototype.getKeySig = function () {
            var k = 0;
            var f = 1;
            while (f) {
                var c = this.getChar();
                switch (c) {
                    case "+":
                    case "#":
                        k++;
                        this.next();
                        break;
                    case "-":
                        k--;
                        this.next();
                        break;
                    default:
                        f = 0;
                        break;
                }
            }
            return k;
        };
        MML.prototype.getUInt = function (def) {
            var ret = 0;
            var l = this.m_letter;
            var f = 1;
            while (f) {
                var c = this.getChar();
                switch (c) {
                    case '0':
                        ret = ret * 10 + 0;
                        this.next();
                        break;
                    case '1':
                        ret = ret * 10 + 1;
                        this.next();
                        break;
                    case '2':
                        ret = ret * 10 + 2;
                        this.next();
                        break;
                    case '3':
                        ret = ret * 10 + 3;
                        this.next();
                        break;
                    case '4':
                        ret = ret * 10 + 4;
                        this.next();
                        break;
                    case '5':
                        ret = ret * 10 + 5;
                        this.next();
                        break;
                    case '6':
                        ret = ret * 10 + 6;
                        this.next();
                        break;
                    case '7':
                        ret = ret * 10 + 7;
                        this.next();
                        break;
                    case '8':
                        ret = ret * 10 + 8;
                        this.next();
                        break;
                    case '9':
                        ret = ret * 10 + 9;
                        this.next();
                        break;
                    default:
                        f = 0;
                        break;
                }
            }
            return (this.m_letter === l) ? def : ret;
        };
        MML.prototype.getUNumber = function (def) {
            var ret = this.getUInt(def | 0);
            var l = 1;
            if (this.getChar() === '.') {
                this.next();
                var f = true;
                while (f) {
                    var c = this.getChar();
                    l *= 0.1;
                    switch (c) {
                        case '0':
                            ret = ret + 0 * l;
                            this.next();
                            break;
                        case '1':
                            ret = ret + 1 * l;
                            this.next();
                            break;
                        case '2':
                            ret = ret + 2 * l;
                            this.next();
                            break;
                        case '3':
                            ret = ret + 3 * l;
                            this.next();
                            break;
                        case '4':
                            ret = ret + 4 * l;
                            this.next();
                            break;
                        case '5':
                            ret = ret + 5 * l;
                            this.next();
                            break;
                        case '6':
                            ret = ret + 6 * l;
                            this.next();
                            break;
                        case '7':
                            ret = ret + 7 * l;
                            this.next();
                            break;
                        case '8':
                            ret = ret + 8 * l;
                            this.next();
                            break;
                        case '9':
                            ret = ret + 9 * l;
                            this.next();
                            break;
                        default:
                            f = false;
                            break;
                    }
                }
            }
            return ret;
        };
        MML.prototype.getSInt = function (def) {
            var c = this.getChar();
            var s = 1;
            if (c === '-') {
                s = -1;
                this.next();
            }
            else if (c === '+')
                this.next();
            return this.getUInt(def) * s;
        };
        MML.prototype.getDot = function (tick) {
            var c = this.getChar();
            var intick = tick;
            while (c === '.') {
                this.next();
                intick /= 2;
                tick += intick;
                c = this.getChar();
            }
            return tick;
        };
        MML.prototype.createTrack = function () {
            this.m_octave = 4;
            this.m_velocity = 100;
            this.m_noteShift = 0;
            return new flmml.MTrack();
        };
        MML.prototype.begin = function () {
            this.m_letter = 0;
        };
        MML.prototype.process = function () {
            this.begin();
            while (this.m_letter < this.m_string.length) {
                this.firstLetter();
            }
        };
        MML.prototype.processRepeat = function () {
            this.m_string = this.m_string.toLowerCase();
            this.begin();
            var repeat = new Array();
            var origin = new Array();
            var start = new Array();
            var last = new Array();
            var nest = -1;
            while (this.m_letter < this.m_string.length) {
                var c = this.getCharNext();
                switch (c) {
                    case '/':
                        if (this.getChar() === ':') {
                            this.next();
                            origin[++nest] = this.m_letter - 2;
                            repeat[nest] = this.getUInt(2);
                            start[nest] = this.m_letter;
                            last[nest] = -1;
                        }
                        else if (nest >= 0) {
                            last[nest] = this.m_letter - 1;
                            this.m_string = this.m_string.substring(0, this.m_letter - 1) + this.m_string.substring(this.m_letter);
                            this.m_letter--;
                        }
                        else {
                        }
                        break;
                    case ':':
                        if (this.getChar() === '/' && nest >= 0) {
                            this.next();
                            var contents = this.m_string.substring(start[nest], this.m_letter - 2);
                            var newstr = this.m_string.substring(0, origin[nest]);
                            for (var i = 0; i < repeat[nest]; i++) {
                                if (i < repeat[nest] - 1 || last[nest] < 0)
                                    newstr += contents;
                                else
                                    newstr += this.m_string.substring(start[nest], last[nest]);
                            }
                            var l = newstr.length;
                            newstr += this.m_string.substring(this.m_letter);
                            this.m_string = newstr;
                            this.m_letter = l;
                            nest--;
                        }
                        break;
                    default:
                        break;
                }
            }
            if (nest >= 0)
                this.warning(flmml.MWarning.UNCLOSED_REPEAT, "");
        };
        MML.prototype.replaceMacro = function (macroTable) {
            for (var m in macroTable) {
                var macro = macroTable[m];
                if (this.m_string.substr(this.m_letter, macro.id.length) === macro.id) {
                    var start = this.m_letter, last = this.m_letter + macro.id.length, code = macro.code;
                    this.m_letter += macro.id.length;
                    var c = this.getCharNext();
                    while (MML.isWhitespace(c)) {
                        c = this.getCharNext();
                    }
                    var args = new Array();
                    var q = 0;
                    if (macro.args.length > 0) {
                        if (c === "{") {
                            c = this.getCharNext();
                            while (q === 1 || (c !== "}" && c !== "")) {
                                if (c === '"')
                                    q = 1 - q;
                                if (c === "$") {
                                    this.replaceMacro(macroTable);
                                }
                                c = this.getCharNext();
                            }
                            last = this.m_letter;
                            var argstr = this.m_string.substring(start + macro.id.length + 1, last - 1);
                            var curarg = "", quoted = false;
                            for (var pos = 0; pos < argstr.length; pos++) {
                                if (!quoted && argstr.charAt(pos) === '"') {
                                    quoted = true;
                                }
                                else if (quoted && (pos + 1) < argstr.length && argstr.charAt(pos) === '\\' && argstr.charAt(pos + 1) === '"') {
                                    curarg += '"';
                                    pos++;
                                }
                                else if (quoted && argstr.charAt(pos) === '"') {
                                    quoted = false;
                                }
                                else if (!quoted && argstr.charAt(pos) === ',') {
                                    args.push(curarg);
                                    curarg = "";
                                }
                                else {
                                    curarg += argstr.charAt(pos);
                                }
                            }
                            args.push(curarg);
                            if (quoted) {
                                this.warning(flmml.MWarning.UNCLOSED_ARGQUOTE, "");
                            }
                        }
                        for (var i = 0; i < code.length; i++) {
                            for (var j = 0; j < args.length; j++) {
                                if (j >= macro.args.length) {
                                    break;
                                }
                                if (code.substr(i, macro.args[j].id.length + 1) === ("%" + macro.args[j].id)) {
                                    code = code.substring(0, i) + code.substring(i).replace("%" + macro.args[j].id, args[macro.args[j].index]);
                                    i += args[macro.args[j].index].length - 1;
                                    break;
                                }
                            }
                        }
                    }
                    this.m_string = this.m_string.substring(0, start - 1) + code + this.m_string.substring(last);
                    this.m_letter = start - 1;
                    return true;
                }
            }
            return false;
        };
        MML.prototype.processMacro = function () {
            var i;
            var matched;
            var exp = /^#OCTAVE\s+REVERSE\s*$/m;
            if (this.m_string.match(exp)) {
                this.m_string = this.m_string.replace(exp, "");
                this.m_relativeDir = false;
            }
            exp = /^#VELOCITY\s+REVERSE\s*$/m;
            if (this.m_string.match(exp)) {
                this.m_string = this.m_string.replace(exp, "");
                this.m_velDir = false;
            }
            this.m_metaTitle = this.findMetaDescN("TITLE");
            this.m_metaArtist = this.findMetaDescN("ARTIST");
            this.m_metaComment = this.findMetaDescN("COMMENT");
            this.m_metaCoding = this.findMetaDescN("CODING");
            this.findMetaDescN("PRAGMA");
            exp = /^#OPM@(\d+)[ \t]*{([^}]*)}/gm;
            matched = this.m_string.match(exp);
            if (matched) {
                this.m_string = this.m_string.replace(exp, "");
                var fmm;
                for (i = 0; i < matched.length; i++) {
                    fmm = matched[i].match(/^#OPM@(\d+)[ \t]*{([^}]*)}/m);
                    flmml.MOscOPM.setTimber(parseInt(fmm[1]), flmml.MOscOPM.TYPE_OPM, fmm[2]);
                }
            }
            exp = /^#OPN@(\d+)[ \t]*{([^}]*)}/gm;
            matched = this.m_string.match(exp);
            if (matched) {
                this.m_string = this.m_string.replace(exp, "");
                var fmn;
                for (i = 0; i < matched.length; i++) {
                    fmn = matched[i].match(/^#OPN@(\d+)[ \t]*{([^}]*)}/m);
                    flmml.MOscOPM.setTimber(parseInt(fmn[1]), flmml.MOscOPM.TYPE_OPN, fmn[2]);
                }
            }
            var fmg = this.findMetaDescV("FMGAIN");
            for (i = 0; i < fmg.length; i++) {
                flmml.MOscOPM.setCommonGain(20.0 * parseInt(fmg[i]) / 127.0);
            }
            {
                var usePoly = this.findMetaDescN("USING\\s+POLY");
                usePoly = usePoly.replace("\r", "");
                usePoly = usePoly.replace("\n", " ");
                usePoly = usePoly.toLowerCase();
                if (usePoly.length > 0) {
                    var ss = usePoly.split(" ");
                    if (ss.length < 1) {
                        this.m_usingPoly = false;
                    }
                    else {
                        this.m_usingPoly = true;
                        this.m_polyVoice = Math.min(Math.max(1, parseInt(ss[0])), MML.MAX_POLYVOICE);
                    }
                    for (i = 1; i < ss.length; i++) {
                        if (ss[i] === "force") {
                            this.m_polyForce = true;
                        }
                    }
                    if (this.m_polyVoice <= 1) {
                        this.m_usingPoly = false;
                        this.m_polyForce = false;
                    }
                }
            }
            {
                exp = /^#WAV10\s.*$/gm;
                matched = this.m_string.match(exp);
                if (matched) {
                    for (i = 0; i < matched.length; i++) {
                        this.m_string = this.m_string.replace(exp, "");
                        var wav = matched[i].split(" ");
                        var wavs = "";
                        for (var j = 1; j < wav.length; j++)
                            wavs += wav[j];
                        var arg = wavs.split(",");
                        var waveNo = parseInt(arg[0]);
                        if (waveNo < 0)
                            waveNo = 0;
                        if (waveNo >= flmml.MOscGbWave.MAX_WAVE)
                            waveNo = flmml.MOscGbWave.MAX_WAVE - 1;
                        flmml.MOscGbWave.setWave(waveNo, (arg[1].toLowerCase() + "00000000000000000000000000000000").substr(0, 32));
                    }
                }
                exp = /^#WAV13\s.*$/gm;
                matched = this.m_string.match(exp);
                if (matched) {
                    for (i = 0; i < matched.length; i++) {
                        this.m_string = this.m_string.replace(exp, "");
                        wav = matched[i].split(" ");
                        wavs = "";
                        for (j = 1; j < wav.length; j++)
                            wavs += wav[j];
                        arg = wavs.split(",");
                        waveNo = parseInt(arg[0]);
                        if (waveNo < 0)
                            waveNo = 0;
                        if (waveNo >= flmml.MOscWave.MAX_WAVE)
                            waveNo = flmml.MOscWave.MAX_WAVE - 1;
                        flmml.MOscWave.setWave(waveNo, arg[1].toLowerCase());
                    }
                }
                exp = /^#WAV9\s.*$/gm;
                matched = this.m_string.match(exp);
                if (matched) {
                    for (i = 0; i < matched.length; i++) {
                        this.m_string = this.m_string.replace(exp, "");
                        wav = matched[i].split(" ");
                        wavs = "";
                        for (j = 1; j < wav.length; j++)
                            wavs += wav[j];
                        arg = wavs.split(",");
                        waveNo = parseInt(arg[0]);
                        if (waveNo < 0)
                            waveNo = 0;
                        if (waveNo >= flmml.MOscFcDpcm.MAX_WAVE)
                            waveNo = flmml.MOscFcDpcm.MAX_WAVE - 1;
                        var intVol = parseInt(arg[1]);
                        if (intVol < 0)
                            intVol = 0;
                        if (intVol > 127)
                            intVol = 127;
                        var loopFg = parseInt(arg[2]);
                        if (loopFg < 0)
                            loopFg = 0;
                        if (loopFg > 1)
                            loopFg = 1;
                        flmml.MOscFcDpcm.setWave(waveNo, intVol, loopFg, arg[3]);
                    }
                }
            }
            this.begin();
            var top = true;
            var macroTable = new Array();
            var regTrimHead = /^\s*/m;
            var regTrimFoot = /\s*$/m;
            while (this.m_letter < this.m_string.length) {
                var c = this.getCharNext();
                switch (c) {
                    case '$':
                        if (top) {
                            var last = this.m_string.indexOf(";", this.m_letter);
                            if (last > this.m_letter) {
                                var nameEnd = this.m_string.indexOf("=", this.m_letter);
                                if (nameEnd > this.m_letter && nameEnd < last) {
                                    var start = this.m_letter;
                                    var argspos = this.m_string.indexOf("{");
                                    if (argspos < 0 || argspos >= nameEnd) {
                                        argspos = nameEnd;
                                    }
                                    var idPart = this.m_string.substring(start, argspos);
                                    var regexResult = idPart.match("[a-zA-Z_][a-zA-Z_0-9#\+\(\)]*");
                                    if (regexResult !== null) {
                                        var id = regexResult[0];
                                        idPart = idPart.replace(regTrimHead, '').replace(regTrimFoot, '');
                                        if (idPart !== id) {
                                            this.warning(flmml.MWarning.INVALID_MACRO_NAME, idPart);
                                        }
                                        if (id.length > 0) {
                                            var args = new Array();
                                            if (argspos < nameEnd) {
                                                var argstr = this.m_string.substring(argspos + 1, this.m_string.indexOf("}", argspos));
                                                args = argstr.split(",");
                                                for (i = 0; i < args.length; i++) {
                                                    var argid = args[i].match("[a-zA-Z_][a-zA-Z_0-9#\+\(\)]*");
                                                    args[i] = { id: (argid !== null ? argid[0] : ""), index: i };
                                                }
                                                args.sort(function (a, b) {
                                                    if (a.id.length > b.id.length)
                                                        return -1;
                                                    if (a.id.length === b.id.length)
                                                        return 0;
                                                    return 1;
                                                });
                                            }
                                            this.m_letter = nameEnd + 1;
                                            c = this.getCharNext();
                                            while (this.m_letter < last) {
                                                if (c === "$") {
                                                    if (!this.replaceMacro(macroTable)) {
                                                        if (this.m_string.substr(this.m_letter, id.length) === id) {
                                                            this.m_letter--;
                                                            this.m_string = MML.remove(this.m_string, this.m_letter, this.m_letter + id.length);
                                                            this.warning(flmml.MWarning.RECURSIVE_MACRO, id);
                                                        }
                                                    }
                                                    last = this.m_string.indexOf(";", this.m_letter);
                                                }
                                                c = this.getCharNext();
                                            }
                                            var pos = 0;
                                            for (; pos < macroTable.length; pos++) {
                                                if (macroTable[pos].id === id) {
                                                    macroTable.splice(pos, 1);
                                                    pos--;
                                                    continue;
                                                }
                                                if (macroTable[pos].id.length < id.length) {
                                                    break;
                                                }
                                            }
                                            macroTable.splice(pos, 0, { id: id, code: this.m_string.substring(nameEnd + 1, last), args: args });
                                            this.m_string = MML.remove(this.m_string, start - 1, last);
                                            this.m_letter = start - 1;
                                        }
                                    }
                                }
                                else {
                                    this.replaceMacro(macroTable);
                                    top = false;
                                }
                            }
                            else {
                                this.replaceMacro(macroTable);
                                top = false;
                            }
                        }
                        else {
                            this.replaceMacro(macroTable);
                            top = false;
                        }
                        break;
                    case ';':
                        top = true;
                        break;
                    default:
                        if (!MML.isWhitespace(c)) {
                            top = false;
                        }
                        break;
                }
            }
        };
        MML.prototype.findMetaDescV = function (sectionName) {
            var i;
            var matched;
            var mm;
            var e1;
            var e2;
            var tt = new Array();
            e1 = new RegExp("^#" + sectionName + "(\\s*|\\s+(.*))$", "gm");
            e2 = new RegExp("^#" + sectionName + "(\\s*|\\s+(.*))$", "m");
            matched = this.m_string.match(e1);
            if (matched) {
                this.m_string = this.m_string.replace(e1, "");
                for (i = 0; i < matched.length; i++) {
                    mm = matched[i].match(e2);
                    if (mm[2] !== undefined) {
                        tt.push(mm[2]);
                    }
                }
            }
            return tt;
        };
        MML.prototype.findMetaDescN = function (sectionName) {
            var i;
            var matched;
            var mm;
            var e1;
            var e2;
            var tt = "";
            e1 = new RegExp("^#" + sectionName + "(\\s*|\\s+(.*))$", "gm");
            e2 = new RegExp("^#" + sectionName + "(\\s*|\\s+(.*))$", "m");
            matched = this.m_string.match(e1);
            if (matched) {
                this.m_string = this.m_string.replace(e1, "");
                for (i = 0; i < matched.length; i++) {
                    mm = matched[i].match(e2);
                    if (mm[2] !== undefined) {
                        tt += mm[2];
                        if (i + 1 < matched.length) {
                            tt += "\r\n";
                        }
                    }
                }
            }
            return tt;
        };
        MML.prototype.processComment = function (str) {
            this.m_string = str;
            this.begin();
            var commentStart = -1;
            while (this.m_letter < this.m_string.length) {
                var c = this.getCharNext();
                switch (c) {
                    case '/':
                        if (this.getChar() === '*') {
                            if (commentStart < 0)
                                commentStart = this.m_letter - 1;
                            this.next();
                        }
                        break;
                    case '*':
                        if (this.getChar() === '/') {
                            if (commentStart >= 0) {
                                this.m_string = MML.remove(this.m_string, commentStart, this.m_letter);
                                this.m_letter = commentStart;
                                commentStart = -1;
                            }
                            else {
                                this.warning(flmml.MWarning.UNOPENED_COMMENT, "");
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
            if (commentStart >= 0)
                this.warning(flmml.MWarning.UNCLOSED_COMMENT, "");
            this.begin();
            commentStart = -1;
            while (this.m_letter < this.m_string.length) {
                if (this.getCharNext() === '`') {
                    if (commentStart < 0) {
                        commentStart = this.m_letter - 1;
                    }
                    else {
                        this.m_string = MML.remove(this.m_string, commentStart, this.m_letter - 1);
                        this.m_letter = commentStart;
                        commentStart = -1;
                    }
                }
            }
        };
        MML.prototype.processGroupNotes = function () {
            var GroupNotesStart = -1;
            var GroupNotesEnd;
            var noteCount = 0;
            var repend, len, tick, tick2, tickdiv, noteTick, noteOn;
            var lenMode;
            var defLen = 96;
            var newstr;
            this.begin();
            while (this.m_letter < this.m_string.length) {
                var c = this.getCharNext();
                switch (c) {
                    case 'l':
                        defLen = this.len2tick(this.getUInt(0));
                        defLen = this.getDot(defLen);
                        break;
                    case '{':
                        GroupNotesStart = this.m_letter - 1;
                        noteCount = 0;
                        break;
                    case '}':
                        repend = this.m_letter;
                        if (GroupNotesStart < 0) {
                            this.warning(flmml.MWarning.UNOPENED_GROUPNOTES, "");
                        }
                        tick = 0;
                        while (1) {
                            if (this.getChar() !== '%') {
                                lenMode = 0;
                            }
                            else {
                                lenMode = 1;
                                this.next();
                            }
                            len = this.getUInt(0);
                            if (len === 0) {
                                if (tick === 0)
                                    tick = defLen;
                                break;
                            }
                            tick2 = (lenMode ? len : this.len2tick(len));
                            tick2 = this.getDot(tick2);
                            tick += tick2;
                            if (this.getChar() !== '&') {
                                break;
                            }
                            this.next();
                        }
                        GroupNotesEnd = this.m_letter;
                        this.m_letter = GroupNotesStart + 1;
                        newstr = this.m_string.substring(0, GroupNotesStart);
                        tick2 = 0;
                        tickdiv = tick / noteCount;
                        noteCount = 1;
                        noteOn = 0;
                        while (this.m_letter < repend) {
                            c = this.getCharNext();
                            switch (c) {
                                case '+':
                                case '#':
                                case '-':
                                    break;
                                default:
                                    if ((c >= 'a' && c <= 'g') || c === 'r') {
                                        if (noteOn === 0) {
                                            noteOn = 1;
                                            break;
                                        }
                                    }
                                    if (noteOn === 1) {
                                        noteTick = Math.round(noteCount * tickdiv - tick2);
                                        noteCount++;
                                        tick2 += noteTick;
                                        if (tick2 > tick) {
                                            noteTick -= (tick2 - tick);
                                            tick2 = tick;
                                        }
                                        newstr += "%";
                                        newstr += noteTick.toString();
                                    }
                                    noteOn = 0;
                                    if ((c >= 'a' && c <= 'g') || c === 'r') {
                                        noteOn = 1;
                                    }
                                    break;
                            }
                            if (c !== '}') {
                                newstr += c;
                            }
                        }
                        this.m_letter = newstr.length;
                        newstr += this.m_string.substring(GroupNotesEnd);
                        this.m_string = newstr;
                        GroupNotesStart = -1;
                        break;
                    default:
                        if ((c >= 'a' && c <= 'g') || c === 'r') {
                            noteCount++;
                        }
                        break;
                }
            }
            if (GroupNotesStart >= 0)
                this.warning(flmml.MWarning.UNCLOSED_GROUPNOTES, "");
        };
        MML.prototype.play = function (str) {
            if (this.m_sequencer.isPaused()) {
                this.m_sequencer.play();
                return;
            }
            msgr.onstopsound = this.play2.bind(this, str);
            msgr.stopSound(true);
        };
        MML.prototype.play2 = function (str) {
            this.m_sequencer.disconnectAll();
            this.m_tracks = new Array();
            this.m_tracks[0] = this.createTrack();
            this.m_tracks[1] = this.createTrack();
            this.m_warning = "";
            this.m_trackNo = flmml.MTrack.FIRST_TRACK;
            this.m_octave = 4;
            this.m_relativeDir = true;
            this.m_velocity = 100;
            this.m_velDetail = true;
            this.m_velDir = true;
            this.m_length = this.len2tick(4);
            this.m_tempo = flmml.MTrack.DEFAULT_BPM;
            this.m_keyoff = 1;
            this.m_gate = 15;
            this.m_maxGate = 16;
            this.m_form = flmml.MOscillator.PULSE;
            this.m_noteShift = 0;
            this.m_maxPipe = 0;
            this.m_maxSyncSource = 0;
            this.m_beforeNote = 0;
            this.m_portamento = 0;
            this.m_usingPoly = false;
            this.m_polyVoice = 1;
            this.m_polyForce = false;
            this.m_metaTitle = "";
            this.m_metaArtist = "";
            this.m_metaCoding = "";
            this.m_metaComment = "";
            this.processComment(str);
            this.processMacro();
            this.m_string = MML.removeWhitespace(this.m_string);
            this.processRepeat();
            this.processGroupNotes();
            this.process();
            if (this.m_tracks[this.m_tracks.length - 1].getNumEvents() === 0)
                this.m_tracks.pop();
            this.m_tracks[flmml.MTrack.TEMPO_TRACK].conduct(this.m_tracks);
            for (var i = flmml.MTrack.TEMPO_TRACK; i < this.m_tracks.length; i++) {
                if (i > flmml.MTrack.TEMPO_TRACK) {
                    if (this.m_usingPoly && (this.m_polyForce || this.m_tracks[i].findPoly())) {
                        this.m_tracks[i].usingPoly(this.m_polyVoice);
                    }
                    this.m_tracks[i].recRestMSec(2000);
                    this.m_tracks[i].recClose();
                }
                this.m_sequencer.connect(this.m_tracks[i]);
            }
            this.m_sequencer.createPipes(this.m_maxPipe + 1);
            this.m_sequencer.createSyncSources(this.m_maxSyncSource + 1);
            msgr.compileComplete();
            this.m_sequencer.play();
            msgr.onstopsound = null;
        };
        MML.prototype.stop = function () {
            this.m_sequencer.stop();
        };
        MML.prototype.pause = function () {
            this.m_sequencer.pause();
        };
        MML.prototype.resume = function () {
            this.m_sequencer.play();
        };
        MML.prototype.isPlaying = function () {
            return this.m_sequencer.isPlaying();
        };
        MML.prototype.isPaused = function () {
            return this.m_sequencer.isPaused();
        };
        MML.prototype.getTotalMSec = function () {
            return this.m_tracks[flmml.MTrack.TEMPO_TRACK].getTotalMSec();
        };
        MML.prototype.getTotalTimeStr = function () {
            return this.m_tracks[flmml.MTrack.TEMPO_TRACK].getTotalTimeStr();
        };
        MML.prototype.getNowMSec = function () {
            return this.m_sequencer.getNowMSec();
        };
        MML.prototype.getNowTimeStr = function () {
            return this.m_sequencer.getNowTimeStr();
        };
        MML.prototype.getVoiceCount = function () {
            var i;
            var c = 0;
            for (i = 0; i < this.m_tracks.length; i++) {
                c += this.m_tracks[i].getVoiceCount();
            }
            return c;
        };
        MML.prototype.getMetaTitle = function () {
            return this.m_metaTitle;
        };
        MML.prototype.getMetaComment = function () {
            return this.m_metaComment;
        };
        MML.prototype.getMetaArtist = function () {
            return this.m_metaArtist;
        };
        MML.prototype.getMetaCoding = function () {
            return this.m_metaCoding;
        };
        MML.MAX_PIPE = 3;
        MML.MAX_SYNCSOURCE = 3;
        MML.MAX_POLYVOICE = 64;
        return MML;
    })();
    flmml.MML = MML;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MSequencer = (function () {
        function MSequencer() {
            this.bufferSize = Math.round(msgr.audioBufferSize * MSequencer.SAMPLE_RATE / msgr.audioSampleRate);
            msgr.emptyBuffer = this.emptyBuffer = new Float32Array(this.bufferSize * MSequencer.MULTIPLE);
            var sLen = this.bufferSize * MSequencer.MULTIPLE;
            flmml.MChannel.boot(sLen);
            flmml.MOscillator.boot();
            flmml.MEnvelope.boot();
            this.m_trackArr = new Array();
            this.m_playSide = 1;
            this.m_playSize = 0;
            this.m_step = 0;
            this.m_buffer = [
                [new Float32Array(sLen), new Float32Array(sLen)],
                [new Float32Array(sLen), new Float32Array(sLen)]
            ];
            this.m_maxProcTime = this.bufferSize / MSequencer.SAMPLE_RATE * 1000.0 * 0.8;
            this.processAllBinded = this.processAll.bind(this);
            msgr.onrequestbuffer = this.onSampleData.bind(this);
            this.stop();
        }
        MSequencer.getTimer = function () {
            return self.performance ? self.performance.now() : new Date().getTime();
        };
        MSequencer.prototype.play = function () {
            if (this.m_status === 1) {
                var bufMSec = this.bufferSize / MSequencer.SAMPLE_RATE * 1000.0;
                this.m_status = 3;
                msgr.playSound();
                this.startProcTimer();
            }
            else {
                this.m_globalSample = 0;
                this.m_totalMSec = this.getTotalMSec();
                for (var i = 0; i < this.m_trackArr.length; i++) {
                    this.m_trackArr[i].seekTop();
                }
                this.lastSample = [0.0, 0.0];
                this.m_status = 2;
                this.processStart();
            }
            this.m_lastTime = 0;
            this.m_waitPause = false;
            if (msgr.infoInterval > 0) {
                clearInterval(msgr.tIDInfo);
                msgr.tIDInfo = setInterval(msgr.onInfoTimerBinded, msgr.infoInterval);
            }
        };
        MSequencer.prototype.stop = function () {
            clearTimeout(this.m_procTimer);
            msgr.stopSound(true);
            this.m_status = 0;
            this.m_lastTime = 0;
            this.m_maxNowMSec = 0;
            this.m_waitPause = false;
        };
        MSequencer.prototype.pause = function () {
            switch (this.m_status) {
                case 2:
                    this.m_waitPause = true;
                    break;
                case 3:
                    msgr.stopSound();
                    this.m_status = 1;
                    if (this.m_waitPause) {
                        msgr.syncInfo();
                        this.m_waitPause = false;
                    }
            }
        };
        MSequencer.prototype.disconnectAll = function () {
            while (this.m_trackArr.pop()) { }
            this.m_status = 0;
        };
        MSequencer.prototype.connect = function (track) {
            this.m_trackArr.push(track);
        };
        MSequencer.prototype.reqBuffering = function () {
            if (!this.m_buffTimer) {
                this.m_buffTimer = setTimeout(this.onBufferingReq.bind(this), 0);
            }
        };
        MSequencer.prototype.onBufferingReq = function () {
            this.m_status = 2;
            this.startProcTimer();
            this.m_buffTimer = 0;
        };
        MSequencer.prototype.startProcTimer = function (interval) {
            if (interval === void 0) { interval = 0; }
            clearTimeout(this.m_procTimer);
            if (this.m_status === 0)
                return;
            this.m_procTimer = setTimeout(this.processAllBinded, interval);
        };
        MSequencer.prototype.processStart = function () {
            this.m_step = 1;
            this.startProcTimer();
        };
        MSequencer.prototype.processAll = function () {
            var buffer = this.m_buffer[1 - this.m_playSide], bufSize = this.bufferSize, sLen = bufSize * MSequencer.MULTIPLE, bLen = bufSize * 2, nLen = this.m_trackArr.length, msgr_ = msgr;
            switch (this.m_step) {
                case 1:
                    buffer = this.m_buffer[1 - this.m_playSide];
                    buffer[0].set(this.emptyBuffer);
                    buffer[1].set(this.emptyBuffer);
                    if (nLen > 0) {
                        var track = this.m_trackArr[flmml.MTrack.TEMPO_TRACK];
                        track.onSampleData(null, 0, bufSize * MSequencer.MULTIPLE, true);
                    }
                    this.m_processTrack = flmml.MTrack.FIRST_TRACK;
                    this.m_processOffset = 0;
                    this.m_step++;
                    this.startProcTimer();
                    break;
                case 2:
                    var status = this.m_status, endTime = this.m_lastTime ? this.m_maxProcTime + this.m_lastTime : 0.0, infoInterval = msgr_.infoInterval, infoTime = msgr_.lastInfoTime + infoInterval;
                    do {
                        this.m_trackArr[this.m_processTrack].onSampleData(buffer, this.m_processOffset, this.m_processOffset + bLen);
                        this.m_processOffset += bLen;
                        if (this.m_processOffset >= sLen) {
                            this.m_processTrack++;
                            this.m_processOffset = 0;
                        }
                        if (status === 2) {
                            msgr_.buffering((this.m_processTrack * sLen + this.m_processOffset) / (nLen * sLen) * 100.0 | 0);
                        }
                        if (this.m_processTrack >= nLen) {
                            this.m_step++;
                            break;
                        }
                        if (infoInterval > 0 && MSequencer.getTimer() > infoTime) {
                            msgr_.syncInfo();
                            infoTime = msgr_.lastInfoTime + infoInterval;
                        }
                    } while (status < 3 || MSequencer.getTimer() < endTime);
                    if (infoInterval > 0) {
                        msgr_.syncInfo();
                        clearInterval(msgr_.tIDInfo);
                        msgr_.tIDInfo = setInterval(msgr_.onInfoTimerBinded, msgr_.infoInterval);
                    }
                    this.startProcTimer();
                    break;
                case 3:
                    this.m_step = 4;
                    if (this.m_status === 2) {
                        this.m_status = 3;
                        this.m_playSide = 1 - this.m_playSide;
                        this.m_playSize = 0;
                        if (this.m_waitPause) {
                            this.pause();
                            this.m_step = 1;
                        }
                        else {
                            msgr_.playSound();
                            this.processStart();
                        }
                    }
                    break;
            }
        };
        MSequencer.prototype.onSampleData = function (e) {
            var _this = this;
            this.m_lastTime = MSequencer.getTimer();
            if (this.m_status < 3)
                return;
            if (this.m_globalSample / MSequencer.SAMPLE_RATE * 1000.0 >= this.m_totalMSec) {
                this.stop();
                msgr.complete();
                return;
            }
            if (this.m_playSize >= MSequencer.MULTIPLE) {
                if (this.m_step === 4) {
                    this.m_playSide = 1 - this.m_playSide;
                    this.m_playSize = 0;
                    this.processStart();
                }
                else {
                    this.reqBuffering();
                    return;
                }
                if (this.m_status === 4) {
                    return;
                }
                else if (this.m_status === 3) {
                    if (this.m_trackArr[flmml.MTrack.TEMPO_TRACK].isEnd()) {
                        this.m_status = 4;
                    }
                }
            }
            var bufSize = this.bufferSize;
            var audioBufSize = msgr.audioBufferSize;
            var rateRatio = audioBufSize / bufSize;
            var sendBuf = e.retBuf || [new Float32Array(audioBufSize), new Float32Array(audioBufSize)];
            var base = bufSize * this.m_playSize;
            [0, 1].forEach(function (ch) {
                var samples = _this.m_buffer[_this.m_playSide][ch].subarray(base, base + bufSize);
                if (bufSize === audioBufSize) {
                    sendBuf[ch].set(samples);
                }
                else {
                    _this.convertRate(samples, sendBuf[ch], rateRatio, _this.lastSample[ch]);
                    _this.lastSample[ch] = samples[samples.length - 1];
                }
            });
            msgr.sendBuffer(sendBuf);
            this.m_playSize++;
            this.m_globalSample += bufSize;
        };
        MSequencer.prototype.convertRate = function (samplesIn, samplesOut, ratio, last) {
            var xa = (samplesOut.length - 1) / ratio % 1;
            last = last == null ? 0.0 : last;
            for (var i = 0; i < samplesOut.length; i++) {
                var x = i / ratio - xa;
                var x0 = Math.floor(x);
                var x1 = Math.ceil(x);
                var y0 = x0 < 0.0 ? last : samplesIn[x0];
                var y1 = samplesIn[x1];
                samplesOut[i] = x0 === x1 ? y0 : y0 + (y1 - y0) * (x - x0);
            }
        };
        MSequencer.prototype.createPipes = function (num) {
            flmml.MChannel.createPipes(num);
        };
        MSequencer.prototype.createSyncSources = function (num) {
            flmml.MChannel.createSyncSources(num);
        };
        MSequencer.prototype.isPlaying = function () {
            return (this.m_status > 1);
        };
        MSequencer.prototype.isPaused = function () {
            return (this.m_status === 1);
        };
        MSequencer.prototype.getTotalMSec = function () {
            if (this.m_trackArr[flmml.MTrack.TEMPO_TRACK]) {
                return this.m_trackArr[flmml.MTrack.TEMPO_TRACK].getTotalMSec();
            }
            else {
                return 0.0;
            }
        };
        MSequencer.prototype.getNowMSec = function () {
            if (this.m_status === 0) {
                return 0.0;
            }
            else {
                var globalMSec = this.m_globalSample / MSequencer.SAMPLE_RATE * 1000.0, elapsed = this.m_lastTime ? MSequencer.getTimer() - this.m_lastTime : 0.0, bufMSec = this.bufferSize / MSequencer.SAMPLE_RATE * 1000.0;
                this.m_maxNowMSec = Math.max(this.m_maxNowMSec, globalMSec + Math.min(elapsed, bufMSec));
                return this.m_maxNowMSec;
            }
        };
        MSequencer.prototype.getNowTimeStr = function () {
            var sec = this.getNowMSec() / 1000.0;
            var smin = "0" + (sec / 60 | 0);
            var ssec = "0" + (sec % 60 | 0);
            return smin.substr(smin.length - 2, 2) + ":" + ssec.substr(ssec.length - 2, 2);
        };
        MSequencer.SAMPLE_RATE = 44100;
        MSequencer.MULTIPLE = 32;
        return MSequencer;
    })();
    flmml.MSequencer = MSequencer;
})(flmml || (flmml = {}));
/// <reference path="MSequencer.ts" />
var flmml;
(function (flmml) {
    var MOscMod = (function () {
        function MOscMod() {
            this.resetPhase();
            this.setFrequency(440.0);
        }
        MOscMod.prototype.resetPhase = function () {
            this.m_phase = 0;
        };
        MOscMod.prototype.addPhase = function (time) {
            this.m_phase = (this.m_phase + this.m_freqShift * time) & MOscMod.PHASE_MSK;
        };
        MOscMod.prototype.getNextSample = function () {
            return 0;
        };
        MOscMod.prototype.getNextSampleOfs = function (ofs) {
            return 0;
        };
        MOscMod.prototype.getSamples = function (samples, start, end) {
        };
        MOscMod.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            this.getSamples(samples, start, end);
        };
        MOscMod.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            this.getSamples(samples, start, end);
        };
        MOscMod.prototype.getFrequency = function () {
            return this.m_frequency;
        };
        MOscMod.prototype.setFrequency = function (frequency) {
            this.m_frequency = frequency;
            this.m_freqShift = frequency * (MOscMod.PHASE_LEN / flmml.MSequencer.SAMPLE_RATE) | 0;
        };
        MOscMod.prototype.setWaveNo = function (waveNo) {
        };
        MOscMod.prototype.setNoteNo = function (noteNo) {
        };
        MOscMod.TABLE_LEN = 1 << 16;
        MOscMod.PHASE_SFT = 14;
        MOscMod.PHASE_LEN = MOscMod.TABLE_LEN << MOscMod.PHASE_SFT;
        MOscMod.PHASE_HLF = MOscMod.TABLE_LEN << (MOscMod.PHASE_SFT - 1);
        MOscMod.PHASE_MSK = MOscMod.PHASE_LEN - 1;
        return MOscMod;
    })();
    flmml.MOscMod = MOscMod;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var flmml;
(function (flmml) {
    var MOscFcDpcm = (function (_super) {
        __extends(MOscFcDpcm, _super);
        function MOscFcDpcm() {
            MOscFcDpcm.boot();
            this.m_readCount = 0;
            this.m_address = 0;
            this.m_bit = 0;
            this.m_wav = 0;
            this.m_length = 0;
            this.m_ofs = 0;
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscFcDpcm.boot = function () {
            if (this.s_init)
                return;
            this.FC_DPCM_NEXT = flmml.MSequencer.SAMPLE_RATE << this.FC_DPCM_PHASE_SFT;
            this.s_table = new Array(this.MAX_WAVE);
            this.s_intVol = new Array(this.MAX_WAVE);
            this.s_loopFg = new Array(this.MAX_WAVE);
            this.s_length = new Array(this.MAX_WAVE);
            this.setWave(0, 127, 0, "");
            this.s_init = 1;
        };
        MOscFcDpcm.setWave = function (waveNo, intVol, loopFg, wave) {
            this.s_intVol[waveNo] = intVol;
            this.s_loopFg[waveNo] = loopFg;
            this.s_length[waveNo] = 0;
            this.s_table[waveNo] = new Array(this.FC_DPCM_TABLE_MAX_LEN);
            var strCnt = 0;
            var intCnt = 0;
            var intCn2 = 0;
            var intPos = 0;
            for (var i = 0; i < this.FC_DPCM_TABLE_MAX_LEN; i++) {
                this.s_table[waveNo][i] = 0;
            }
            for (strCnt = 0; strCnt < wave.length; strCnt++) {
                var code = wave.charCodeAt(strCnt);
                if (0x41 <= code && code <= 0x5a) {
                    code -= 0x41;
                }
                else if (0x61 <= code && code <= 0x7a) {
                    code -= 0x61 - 26;
                }
                else if (0x30 <= code && code <= 0x39) {
                    code -= 0x30 - 26 - 26;
                }
                else if (0x2b === code) {
                    code = 26 + 26 + 10;
                }
                else if (0x2f === code) {
                    code = 26 + 26 + 10 + 1;
                }
                else if (0x3d === code) {
                    code = 0;
                }
                else {
                    code = 0;
                }
                for (i = 5; i >= 0; i--) {
                    this.s_table[waveNo][intPos] += ((code >> i) & 1) << (intCnt * 8 + 7 - intCn2);
                    intCn2++;
                    if (intCn2 >= 8) {
                        intCn2 = 0;
                        intCnt++;
                    }
                    this.s_length[waveNo]++;
                    if (intCnt >= 4) {
                        intCnt = 0;
                        intPos++;
                        if (intPos >= this.FC_DPCM_TABLE_MAX_LEN) {
                            intPos = this.FC_DPCM_TABLE_MAX_LEN - 1;
                        }
                    }
                }
            }
            this.s_length[waveNo] -= ((this.s_length[waveNo] - 8) % 0x80);
            if (this.s_length[waveNo] > this.FC_DPCM_MAX_LEN * 8) {
                this.s_length[waveNo] = this.FC_DPCM_MAX_LEN * 8;
            }
            if (this.s_length[waveNo] === 0) {
                this.s_length[waveNo] = 8;
            }
        };
        MOscFcDpcm.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscFcDpcm.MAX_WAVE)
                waveNo = MOscFcDpcm.MAX_WAVE - 1;
            if (!MOscFcDpcm.s_table[waveNo])
                waveNo = 0;
            this.m_waveNo = waveNo;
        };
        MOscFcDpcm.prototype.getValue = function () {
            if (this.m_length > 0) {
                if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                    if (this.m_wav < 126)
                        this.m_wav += 2;
                }
                else {
                    if (this.m_wav > 1)
                        this.m_wav -= 2;
                }
                this.m_bit++;
                if (this.m_bit >= 32) {
                    this.m_bit = 0;
                    this.m_address++;
                }
                this.m_length--;
                if (this.m_length === 0) {
                    if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                        this.m_address = 0;
                        this.m_bit = 0;
                        this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                    }
                }
                return (this.m_wav - 64) / 64.0;
            }
            else {
                return (this.m_wav - 64) / 64.0;
            }
        };
        MOscFcDpcm.prototype.resetPhase = function () {
            this.m_phase = 0;
            this.m_address = 0;
            this.m_bit = 0;
            this.m_ofs = 0;
            this.m_wav = MOscFcDpcm.s_intVol[this.m_waveNo];
            this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
        };
        MOscFcDpcm.prototype.getNextSample = function () {
            var val = (this.m_wav - 64) / 64.0;
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcDpcm.PHASE_MSK;
            while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                {
                    if (this.m_length > 0) {
                        if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                            if (this.m_wav < 126)
                                this.m_wav += 2;
                        }
                        else {
                            if (this.m_wav > 1)
                                this.m_wav -= 2;
                        }
                        this.m_bit++;
                        if (this.m_bit >= 32) {
                            this.m_bit = 0;
                            this.m_address++;
                        }
                        this.m_length--;
                        if (this.m_length === 0) {
                            if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                this.m_address = 0;
                                this.m_bit = 0;
                                this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                            }
                        }
                        val = (this.m_wav - 64) / 64.0;
                    }
                    else {
                        val = (this.m_wav - 64) / 64.0;
                    }
                }
            }
            return val;
        };
        MOscFcDpcm.prototype.getNextSampleOfs = function (ofs) {
            var val = (this.m_wav - 64) / 64.0;
            this.m_phase = (this.m_phase + this.m_freqShift + ((ofs - this.m_ofs) >> (MOscFcDpcm.PHASE_SFT - 7))) & MOscFcDpcm.PHASE_MSK;
            while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                {
                    if (this.m_length > 0) {
                        if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                            if (this.m_wav < 126)
                                this.m_wav += 2;
                        }
                        else {
                            if (this.m_wav > 1)
                                this.m_wav -= 2;
                        }
                        this.m_bit++;
                        if (this.m_bit >= 32) {
                            this.m_bit = 0;
                            this.m_address++;
                        }
                        this.m_length--;
                        if (this.m_length === 0) {
                            if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                this.m_address = 0;
                                this.m_bit = 0;
                                this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                            }
                        }
                        val = (this.m_wav - 64) / 64.0;
                    }
                    else {
                        val = (this.m_wav - 64) / 64.0;
                    }
                }
            }
            this.m_ofs = ofs;
            return val;
        };
        MOscFcDpcm.prototype.getSamples = function (samples, start, end) {
            var i;
            var val = (this.m_wav - 64) / 64.0;
            for (i = start; i < end; i++) {
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcDpcm.PHASE_MSK;
                while (MOscFcDpcm.FC_DPCM_NEXT <= this.m_phase) {
                    this.m_phase -= MOscFcDpcm.FC_DPCM_NEXT;
                    {
                        if (this.m_length > 0) {
                            if ((MOscFcDpcm.s_table[this.m_waveNo][this.m_address] >> this.m_bit) & 1) {
                                if (this.m_wav < 126)
                                    this.m_wav += 2;
                            }
                            else {
                                if (this.m_wav > 1)
                                    this.m_wav -= 2;
                            }
                            this.m_bit++;
                            if (this.m_bit >= 32) {
                                this.m_bit = 0;
                                this.m_address++;
                            }
                            this.m_length--;
                            if (this.m_length === 0) {
                                if (MOscFcDpcm.s_loopFg[this.m_waveNo]) {
                                    this.m_address = 0;
                                    this.m_bit = 0;
                                    this.m_length = MOscFcDpcm.s_length[this.m_waveNo];
                                }
                            }
                            val = (this.m_wav - 64) / 64.0;
                        }
                        else {
                            val = (this.m_wav - 64) / 64.0;
                        }
                    }
                }
                samples[i] = val;
            }
        };
        MOscFcDpcm.prototype.setFrequency = function (frequency) {
            this.m_freqShift = frequency * (1 << (MOscFcDpcm.FC_DPCM_PHASE_SFT + 4)) | 0;
        };
        MOscFcDpcm.prototype.setDpcmFreq = function (no) {
            if (no < 0)
                no = 0;
            if (no > 15)
                no = 15;
            this.m_freqShift = (MOscFcDpcm.FC_CPU_CYCLE << MOscFcDpcm.FC_DPCM_PHASE_SFT) / MOscFcDpcm.s_interval[no] | 0;
        };
        MOscFcDpcm.prototype.setNoteNo = function (noteNo) {
            this.setDpcmFreq(noteNo);
        };
        MOscFcDpcm.MAX_WAVE = 16;
        MOscFcDpcm.FC_CPU_CYCLE = 1789773;
        MOscFcDpcm.FC_DPCM_PHASE_SFT = 2;
        MOscFcDpcm.FC_DPCM_MAX_LEN = 0xff1;
        MOscFcDpcm.FC_DPCM_TABLE_MAX_LEN = (MOscFcDpcm.FC_DPCM_MAX_LEN >> 2) + 2;
        MOscFcDpcm.s_interval = [
            428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 85, 72, 54,
        ];
        return MOscFcDpcm;
    })(flmml.MOscMod);
    flmml.MOscFcDpcm = MOscFcDpcm;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscFcNoise = (function (_super) {
        __extends(MOscFcNoise, _super);
        function MOscFcNoise() {
            MOscFcNoise.boot();
            _super.call(this);
            this.setLongMode();
            this.m_fcr = 0x8000;
            this.m_val = this.getValue();
            this.setNoiseFreq(0);
        }
        MOscFcNoise.prototype.getValue = function () {
            this.m_fcr >>= 1;
            this.m_fcr |= ((this.m_fcr ^ (this.m_fcr >> this.m_snz)) & 1) << 15;
            return (this.m_fcr & 1) ? 1.0 : -1.0;
        };
        MOscFcNoise.prototype.setShortMode = function () {
            this.m_snz = 6;
        };
        MOscFcNoise.prototype.setLongMode = function () {
            this.m_snz = 1;
        };
        MOscFcNoise.prototype.resetPhase = function () {
        };
        MOscFcNoise.prototype.addPhase = function (time) {
            this.m_phase = this.m_phase + MOscFcNoise.FC_NOISE_PHASE_DLT * time | 0;
            while (this.m_phase >= this.m_freqShift) {
                this.m_phase -= this.m_freqShift;
                this.m_val = this.getValue();
            }
        };
        MOscFcNoise.boot = function () {
            MOscFcNoise.FC_NOISE_PHASE_DLT = MOscFcNoise.FC_NOISE_PHASE_SEC / flmml.MSequencer.SAMPLE_RATE | 0;
        };
        MOscFcNoise.prototype.getNextSample = function () {
            var val = this.m_val;
            var sum = 0;
            var cnt = 0;
            var delta = MOscFcNoise.FC_NOISE_PHASE_DLT;
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
        };
        MOscFcNoise.prototype.getNextSampleOfs = function (ofs) {
            var fcr = this.m_fcr;
            var phase = this.m_phase;
            var val = this.m_val;
            var sum = 0;
            var cnt = 0;
            var delta = MOscFcNoise.FC_NOISE_PHASE_DLT + ofs;
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
            this.m_fcr = fcr;
            this.m_phase = phase;
            this.getNextSample();
            return val;
        };
        MOscFcNoise.prototype.getSamples = function (samples, start, end) {
            for (var i = start; i < end; i++) {
                samples[i] = this.getNextSample();
            }
        };
        MOscFcNoise.prototype.setFrequency = function (frequency) {
            this.m_freqShift = MOscFcNoise.FC_NOISE_PHASE_SEC / frequency | 0;
        };
        MOscFcNoise.prototype.setNoiseFreq = function (no) {
            if (no < 0)
                no = 0;
            if (no > 15)
                no = 15;
            this.m_freqShift = MOscFcNoise.s_interval[no] << MOscFcNoise.FC_NOISE_PHASE_SFT | 0;
        };
        MOscFcNoise.prototype.setNoteNo = function (noteNo) {
            this.setNoiseFreq(noteNo);
        };
        MOscFcNoise.FC_NOISE_PHASE_SFT = 10;
        MOscFcNoise.FC_NOISE_PHASE_SEC = (1789773 << MOscFcNoise.FC_NOISE_PHASE_SFT) | 0;
        MOscFcNoise.s_interval = [
            0x004, 0x008, 0x010, 0x020, 0x040, 0x060, 0x080, 0x0a0, 0x0ca, 0x0fe, 0x17c, 0x1fc, 0x2fa, 0x3f8, 0x7f2, 0xfe4
        ];
        return MOscFcNoise;
    })(flmml.MOscMod);
    flmml.MOscFcNoise = MOscFcNoise;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscFcTri = (function (_super) {
        __extends(MOscFcTri, _super);
        function MOscFcTri() {
            MOscFcTri.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscFcTri.boot = function () {
            if (this.s_init)
                return;
            this.s_table = new Array(this.MAX_WAVE);
            this.s_table[0] = new Array(this.FC_TRI_TABLE_LEN);
            this.s_table[1] = new Array(this.FC_TRI_TABLE_LEN);
            var i;
            for (i = 0; i < 16; i++) {
                this.s_table[0][i] = this.s_table[0][31 - i] = i * 2.0 / 15.0 - 1.0;
            }
            for (i = 0; i < 32; i++) {
                this.s_table[1][i] = (i < 8) ? i * 2.0 / 14.0 : ((i < 24) ? (8 - i) * 2.0 / 15.0 + 1.0 : (i - 24) * 2.0 / 15.0 - 1.0);
            }
            this.s_init = 1;
        };
        MOscFcTri.prototype.getNextSample = function () {
            var val = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            return val;
        };
        MOscFcTri.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscFcTri.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscFcTri.PHASE_MSK) >> (MOscFcTri.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            return val;
        };
        MOscFcTri.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            }
        };
        MOscFcTri.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscFcTri.PHASE_MSK;
            }
        };
        MOscFcTri.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscFcTri.s_table[this.m_waveNo][this.m_phase >> (MOscFcTri.PHASE_SFT + 11)];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscFcTri.PHASE_MSK);
                this.m_phase &= MOscFcTri.PHASE_MSK;
            }
        };
        MOscFcTri.prototype.setWaveNo = function (waveNo) {
            this.m_waveNo = Math.min(waveNo, MOscFcTri.MAX_WAVE - 1);
        };
        MOscFcTri.FC_TRI_TABLE_LEN = (1 << 5);
        MOscFcTri.MAX_WAVE = 2;
        MOscFcTri.s_init = 0;
        return MOscFcTri;
    })(flmml.MOscMod);
    flmml.MOscFcTri = MOscFcTri;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscGbLNoise = (function (_super) {
        __extends(MOscGbLNoise, _super);
        function MOscGbLNoise() {
            MOscGbLNoise.boot();
            _super.call(this);
            this.m_sum = 0;
            this.m_skip = 0;
        }
        MOscGbLNoise.boot = function () {
            if (this.s_init)
                return;
            var gbr = 0xffff;
            var output = 1;
            for (var i = 0; i < this.GB_NOISE_TABLE_LEN; i++) {
                if (gbr === 0)
                    gbr = 1;
                gbr += gbr + (((gbr >> 14) ^ (gbr >> 13)) & 1) | 0;
                output ^= gbr & 1;
                this.s_table[i] = output * 2 - 1;
            }
            this.s_init = 1;
        };
        MOscGbLNoise.prototype.getNextSample = function () {
            var val = MOscGbLNoise.s_table[this.m_phase >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
            if (this.m_skip > 0) {
                val = (val + this.m_sum) / (this.m_skip + 1);
            }
            this.m_sum = 0;
            this.m_skip = 0;
            var freqShift = this.m_freqShift;
            while (freqShift > MOscGbLNoise.GB_NOISE_PHASE_DLT) {
                this.m_phase = (this.m_phase + MOscGbLNoise.GB_NOISE_PHASE_DLT) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
                freqShift -= MOscGbLNoise.GB_NOISE_PHASE_DLT;
                this.m_sum += MOscGbLNoise.s_table[this.m_phase >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
                this.m_skip++;
            }
            this.m_phase = (this.m_phase + freqShift) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
            return val;
        };
        MOscGbLNoise.prototype.getNextSampleOfs = function (ofs) {
            var phase = (this.m_phase + ofs) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
            var val = MOscGbLNoise.s_table[(phase + ((phase >> 31) & MOscGbLNoise.GB_NOISE_TABLE_MOD)) >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
            return val;
        };
        MOscGbLNoise.prototype.getSamples = function (samples, start, end) {
            var i;
            var val;
            for (i = start; i < end; i++) {
                val = MOscGbLNoise.s_table[this.m_phase >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
                if (this.m_skip > 0) {
                    val = (val + this.m_sum) / (this.m_skip + 1);
                }
                samples[i] = val;
                this.m_sum = 0;
                this.m_skip = 0;
                var freqShift = this.m_freqShift;
                while (freqShift > MOscGbLNoise.GB_NOISE_PHASE_DLT) {
                    this.m_phase = (this.m_phase + MOscGbLNoise.GB_NOISE_PHASE_DLT) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
                    freqShift -= MOscGbLNoise.GB_NOISE_PHASE_DLT;
                    this.m_sum += MOscGbLNoise.s_table[this.m_phase >> MOscGbLNoise.GB_NOISE_PHASE_SFT];
                    this.m_skip++;
                }
                this.m_phase = (this.m_phase + freqShift) % MOscGbLNoise.GB_NOISE_TABLE_MOD;
            }
        };
        MOscGbLNoise.prototype.setFrequency = function (frequency) {
            this.m_frequency = frequency;
        };
        MOscGbLNoise.prototype.setNoiseFreq = function (no) {
            if (no < 0)
                no = 0;
            if (no > 63)
                no = 63;
            this.m_freqShift = (1048576 << (MOscGbLNoise.GB_NOISE_PHASE_SFT - 2)) / (MOscGbLNoise.s_interval[no] * 11025) | 0;
        };
        MOscGbLNoise.prototype.setNoteNo = function (noteNo) {
            this.setNoiseFreq(noteNo);
        };
        MOscGbLNoise.GB_NOISE_PHASE_SFT = 12;
        MOscGbLNoise.GB_NOISE_PHASE_DLT = 1 << MOscGbLNoise.GB_NOISE_PHASE_SFT;
        MOscGbLNoise.GB_NOISE_TABLE_LEN = 32767;
        MOscGbLNoise.GB_NOISE_TABLE_MOD = (MOscGbLNoise.GB_NOISE_TABLE_LEN << MOscGbLNoise.GB_NOISE_PHASE_SFT) - 1;
        MOscGbLNoise.s_init = 0;
        MOscGbLNoise.s_table = new Array(MOscGbLNoise.GB_NOISE_TABLE_LEN);
        MOscGbLNoise.s_interval = [
            0x000002, 0x000004, 0x000008, 0x00000c, 0x000010, 0x000014, 0x000018, 0x00001c,
            0x000020, 0x000028, 0x000030, 0x000038, 0x000040, 0x000050, 0x000060, 0x000070,
            0x000080, 0x0000a0, 0x0000c0, 0x0000e0, 0x000100, 0x000140, 0x000180, 0x0001c0,
            0x000200, 0x000280, 0x000300, 0x000380, 0x000400, 0x000500, 0x000600, 0x000700,
            0x000800, 0x000a00, 0x000c00, 0x000e00, 0x001000, 0x001400, 0x001800, 0x001c00,
            0x002000, 0x002800, 0x003000, 0x003800, 0x004000, 0x005000, 0x006000, 0x007000,
            0x008000, 0x00a000, 0x00c000, 0x00e000, 0x010000, 0x014000, 0x018000, 0x01c000,
            0x020000, 0x028000, 0x030000, 0x038000, 0x040000, 0x050000, 0x060000, 0x070000
        ];
        return MOscGbLNoise;
    })(flmml.MOscMod);
    flmml.MOscGbLNoise = MOscGbLNoise;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscGbSNoise = (function (_super) {
        __extends(MOscGbSNoise, _super);
        function MOscGbSNoise() {
            MOscGbSNoise.boot();
            _super.call(this);
            this.m_sum = 0;
            this.m_skip = 0;
        }
        MOscGbSNoise.boot = function () {
            if (this.s_init)
                return;
            var gbr = 0xffff;
            var output = 1;
            for (var i = 0; i < this.GB_NOISE_TABLE_LEN; i++) {
                if (gbr === 0)
                    gbr = 1;
                gbr += gbr + (((gbr >> 6) ^ (gbr >> 5)) & 1) | 0;
                output ^= gbr & 1;
                this.s_table[i] = output * 2 - 1;
            }
            this.s_init = 1;
        };
        MOscGbSNoise.prototype.getNextSample = function () {
            var val = MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
            if (this.m_skip > 0) {
                val = (val + this.m_sum) / Number(this.m_skip + 1);
            }
            this.m_sum = 0;
            this.m_skip = 0;
            var freqShift = this.m_freqShift;
            while (freqShift > MOscGbSNoise.GB_NOISE_PHASE_DLT) {
                this.m_phase = (this.m_phase + MOscGbSNoise.GB_NOISE_PHASE_DLT) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
                freqShift -= MOscGbSNoise.GB_NOISE_PHASE_DLT;
                this.m_sum += MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
                this.m_skip++;
            }
            this.m_phase = (this.m_phase + freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            return val;
        };
        MOscGbSNoise.prototype.getNextSampleOfs = function (ofs) {
            var phase = (this.m_phase + ofs) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            var val = MOscGbSNoise.s_table[(phase + ((phase >> 31) & MOscGbSNoise.GB_NOISE_TABLE_MOD)) >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            return val;
        };
        MOscGbSNoise.prototype.getSamples = function (samples, start, end) {
            var i;
            var val;
            for (i = start; i < end; i++) {
                val = MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
                if (this.m_skip > 0) {
                    val = (val + this.m_sum) / Number(this.m_skip + 1);
                }
                samples[i] = val;
                this.m_sum = 0;
                this.m_skip = 0;
                var freqShift = this.m_freqShift;
                while (freqShift > MOscGbSNoise.GB_NOISE_PHASE_DLT) {
                    this.m_phase = (this.m_phase + MOscGbSNoise.GB_NOISE_PHASE_DLT) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
                    freqShift -= MOscGbSNoise.GB_NOISE_PHASE_DLT;
                    this.m_sum += MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
                    this.m_skip++;
                }
                this.m_phase = (this.m_phase + freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            }
        };
        MOscGbSNoise.prototype.setFrequency = function (frequency) {
            this.m_frequency = frequency;
        };
        MOscGbSNoise.prototype.setNoiseFreq = function (no) {
            if (no < 0)
                no = 0;
            if (no > 63)
                no = 63;
            this.m_freqShift = (1048576 << (MOscGbSNoise.GB_NOISE_PHASE_SFT - 2)) / (MOscGbSNoise.s_interval[no] * 11025);
        };
        MOscGbSNoise.prototype.setNoteNo = function (noteNo) {
            this.setNoiseFreq(noteNo);
        };
        MOscGbSNoise.GB_NOISE_PHASE_SFT = 12;
        MOscGbSNoise.GB_NOISE_PHASE_DLT = 1 << MOscGbSNoise.GB_NOISE_PHASE_SFT;
        MOscGbSNoise.GB_NOISE_TABLE_LEN = 127;
        MOscGbSNoise.GB_NOISE_TABLE_MOD = (MOscGbSNoise.GB_NOISE_TABLE_LEN << MOscGbSNoise.GB_NOISE_PHASE_SFT) - 1;
        MOscGbSNoise.s_init = 0;
        MOscGbSNoise.s_table = new Array(MOscGbSNoise.GB_NOISE_TABLE_LEN);
        MOscGbSNoise.s_interval = [
            0x000002, 0x000004, 0x000008, 0x00000c, 0x000010, 0x000014, 0x000018, 0x00001c,
            0x000020, 0x000028, 0x000030, 0x000038, 0x000040, 0x000050, 0x000060, 0x000070,
            0x000080, 0x0000a0, 0x0000c0, 0x0000e0, 0x000100, 0x000140, 0x000180, 0x0001c0,
            0x000200, 0x000280, 0x000300, 0x000380, 0x000400, 0x000500, 0x000600, 0x000700,
            0x000800, 0x000a00, 0x000c00, 0x000e00, 0x001000, 0x001400, 0x001800, 0x001c00,
            0x002000, 0x002800, 0x003000, 0x003800, 0x004000, 0x005000, 0x006000, 0x007000,
            0x008000, 0x00a000, 0x00c000, 0x00e000, 0x010000, 0x014000, 0x018000, 0x01c000,
            0x020000, 0x028000, 0x030000, 0x038000, 0x040000, 0x050000, 0x060000, 0x070000
        ];
        return MOscGbSNoise;
    })(flmml.MOscMod);
    flmml.MOscGbSNoise = MOscGbSNoise;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscGbWave = (function (_super) {
        __extends(MOscGbWave, _super);
        function MOscGbWave() {
            MOscGbWave.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscGbWave.boot = function () {
            if (this.s_init)
                return;
            this.s_table = new Array(this.MAX_WAVE);
            this.setWave(0, "0123456789abcdeffedcba9876543210");
            this.s_init = 1;
        };
        MOscGbWave.setWave = function (waveNo, wave) {
            this.s_table[waveNo] = new Array(this.GB_WAVE_TABLE_LEN);
            for (var i = 0; i < 32; i++) {
                var code = wave.charCodeAt(i);
                if (48 <= code && code < 58) {
                    code -= 48;
                }
                else if (97 <= code && code < 103) {
                    code -= 97 - 10;
                }
                else {
                    code = 0;
                }
                this.s_table[waveNo][i] = (code - 7.5) / 7.5;
            }
        };
        MOscGbWave.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscGbWave.MAX_WAVE)
                waveNo = MOscGbWave.MAX_WAVE - 1;
            if (!MOscGbWave.s_table[waveNo])
                waveNo = 0;
            this.m_waveNo = waveNo;
        };
        MOscGbWave.prototype.getNextSample = function () {
            var val = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            return val;
        };
        MOscGbWave.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscGbWave.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscGbWave.PHASE_MSK) >> (MOscGbWave.PHASE_SFT + 11)];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            return val;
        };
        MOscGbWave.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            }
        };
        MOscGbWave.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscGbWave.PHASE_MSK;
            }
        };
        MOscGbWave.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscGbWave.s_table[this.m_waveNo][this.m_phase >> (MOscGbWave.PHASE_SFT + 11)];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscGbWave.PHASE_MSK);
                this.m_phase &= MOscGbWave.PHASE_MSK;
            }
        };
        MOscGbWave.MAX_WAVE = 32;
        MOscGbWave.GB_WAVE_TABLE_LEN = (1 << 5);
        MOscGbWave.s_init = 0;
        return MOscGbWave;
    })(flmml.MOscMod);
    flmml.MOscGbWave = MOscGbWave;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MOscillator = (function () {
        function MOscillator() {
            MOscillator.boot();
            this.m_osc = new Array(MOscillator.MAX);
            this.m_osc[MOscillator.SINE] = new flmml.MOscSine();
            this.m_osc[MOscillator.SAW] = new flmml.MOscSaw();
            this.m_osc[MOscillator.TRIANGLE] = new flmml.MOscTriangle();
            this.m_osc[MOscillator.PULSE] = new flmml.MOscPulse();
            this.m_osc[MOscillator.NOISE] = new flmml.MOscNoise();
            this.m_osc[MOscillator.FC_PULSE] = new flmml.MOscPulse();
            this.m_osc[MOscillator.FC_TRI] = new flmml.MOscFcTri();
            this.m_osc[MOscillator.FC_NOISE] = new flmml.MOscFcNoise();
            this.m_osc[MOscillator.FC_S_NOISE] = null;
            this.m_osc[MOscillator.FC_DPCM] = new flmml.MOscFcDpcm();
            this.m_osc[MOscillator.GB_WAVE] = new flmml.MOscGbWave();
            this.m_osc[MOscillator.GB_NOISE] = new flmml.MOscGbLNoise();
            this.m_osc[MOscillator.GB_S_NOISE] = new flmml.MOscGbSNoise();
            this.m_osc[MOscillator.WAVE] = new flmml.MOscWave();
            this.m_osc[MOscillator.OPM] = new flmml.MOscOPM();
            this.setForm(MOscillator.PULSE);
            this.setNoiseToPulse();
        }
        MOscillator.prototype.asLFO = function () {
            if (this.m_osc[MOscillator.NOISE])
                this.m_osc[MOscillator.NOISE].disableResetPhase();
        };
        MOscillator.boot = function () {
            if (this.s_init)
                return;
            flmml.MOscSine.boot();
            flmml.MOscSaw.boot();
            flmml.MOscTriangle.boot();
            flmml.MOscPulse.boot();
            flmml.MOscNoise.boot();
            flmml.MOscFcTri.boot();
            flmml.MOscFcNoise.boot();
            flmml.MOscFcDpcm.boot();
            flmml.MOscGbWave.boot();
            flmml.MOscGbLNoise.boot();
            flmml.MOscGbSNoise.boot();
            flmml.MOscWave.boot();
            flmml.MOscOPM.boot();
            this.s_init = 1;
        };
        MOscillator.prototype.setForm = function (form) {
            var modNoise;
            var modFcNoise;
            if (form >= MOscillator.MAX)
                form = MOscillator.MAX - 1;
            this.m_form = form;
            switch (form) {
                case MOscillator.NOISE:
                    modNoise = this.m_osc[MOscillator.NOISE];
                    modNoise.restoreFreq();
                    break;
                case MOscillator.FC_NOISE:
                    modFcNoise = this.getMod(MOscillator.FC_NOISE);
                    modFcNoise.setLongMode();
                    break;
                case MOscillator.FC_S_NOISE:
                    modFcNoise = this.getMod(MOscillator.FC_S_NOISE);
                    modFcNoise.setShortMode();
                    break;
            }
            return this.getMod(form);
        };
        MOscillator.prototype.getForm = function () {
            return this.m_form;
        };
        MOscillator.prototype.getCurrent = function () {
            return this.getMod(this.m_form);
        };
        MOscillator.prototype.getMod = function (form) {
            return (form !== MOscillator.FC_S_NOISE) ? this.m_osc[form] : this.m_osc[MOscillator.FC_NOISE];
        };
        MOscillator.prototype.setNoiseToPulse = function () {
            var modPulse = this.getMod(MOscillator.PULSE);
            var modNoise = this.getMod(MOscillator.NOISE);
            modPulse.setNoise(modNoise);
        };
        MOscillator.SINE = 0;
        MOscillator.SAW = 1;
        MOscillator.TRIANGLE = 2;
        MOscillator.PULSE = 3;
        MOscillator.NOISE = 4;
        MOscillator.FC_PULSE = 5;
        MOscillator.FC_TRI = 6;
        MOscillator.FC_NOISE = 7;
        MOscillator.FC_S_NOISE = 8;
        MOscillator.FC_DPCM = 9;
        MOscillator.GB_WAVE = 10;
        MOscillator.GB_NOISE = 11;
        MOscillator.GB_S_NOISE = 12;
        MOscillator.WAVE = 13;
        MOscillator.OPM = 14;
        MOscillator.MAX = 15;
        MOscillator.s_init = 0;
        return MOscillator;
    })();
    flmml.MOscillator = MOscillator;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscNoise = (function (_super) {
        __extends(MOscNoise, _super);
        function MOscNoise() {
            MOscNoise.boot();
            _super.call(this);
            this.setNoiseFreq(1.0);
            this.m_phase = 0;
            this.m_counter = 0;
            this.m_resetPhase = true;
        }
        MOscNoise.prototype.disableResetPhase = function () {
            this.m_resetPhase = false;
        };
        MOscNoise.boot = function () {
            if (this.s_init)
                return;
            for (var i = 0; i < this.TABLE_LEN; i++) {
                this.s_table[i] = Math.random() * 2.0 - 1.0;
            }
            this.s_init = 1;
        };
        MOscNoise.prototype.resetPhase = function () {
            if (this.m_resetPhase)
                this.m_phase = 0;
        };
        MOscNoise.prototype.addPhase = function (time) {
            this.m_counter = (this.m_counter + this.m_freqShift * time);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
        };
        MOscNoise.prototype.getNextSample = function () {
            var val = MOscNoise.s_table[this.m_phase];
            this.m_counter = (this.m_counter + this.m_freqShift);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            return val;
        };
        MOscNoise.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscNoise.s_table[(this.m_phase + (ofs << MOscNoise.PHASE_SFT)) & MOscNoise.TABLE_MSK];
            this.m_counter = (this.m_counter + this.m_freqShift);
            this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
            this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            return val;
        };
        MOscNoise.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscNoise.s_table[this.m_phase];
                this.m_counter = (this.m_counter + this.m_freqShift);
                this.m_phase = (this.m_phase + (this.m_counter >> MOscNoise.NOISE_PHASE_SFT)) & MOscNoise.TABLE_MSK;
                this.m_counter &= MOscNoise.NOISE_PHASE_MSK;
            }
        };
        MOscNoise.prototype.setFrequency = function (frequency) {
            this.m_frequency = frequency;
        };
        MOscNoise.prototype.setNoiseFreq = function (frequency) {
            this.m_noiseFreq = frequency * (1 << MOscNoise.NOISE_PHASE_SFT);
            this.m_freqShift = this.m_noiseFreq;
        };
        MOscNoise.prototype.restoreFreq = function () {
            this.m_freqShift = this.m_noiseFreq;
        };
        MOscNoise.TABLE_MSK = MOscNoise.TABLE_LEN - 1;
        MOscNoise.NOISE_PHASE_SFT = 30;
        MOscNoise.NOISE_PHASE_MSK = (1 << MOscNoise.NOISE_PHASE_SFT) - 1;
        MOscNoise.s_init = 0;
        MOscNoise.s_table = new Array(MOscNoise.TABLE_LEN);
        return MOscNoise;
    })(flmml.MOscMod);
    flmml.MOscNoise = MOscNoise;
})(flmml || (flmml = {}));
var fmgenAs;
(function (fmgenAs) {
    var Timer = (function () {
        function Timer() {
            this.regta = new Array(2);
        }
        Timer.prototype.Reset = function () {
            this.timera_count = 0;
            this.timerb_count = 0;
        };
        Timer.prototype.Count = function (us) {
            var f = false;
            if (this.timera_count !== 0) {
                this.timera_count -= us << 16;
                if (this.timera_count <= 0) {
                    f = true;
                    this.TimerA();
                    while (this.timera_count <= 0)
                        this.timera_count += this.timera;
                    if (this.regtc & 4)
                        this.SetStatus(1);
                }
            }
            if (this.timerb_count !== 0) {
                this.timerb_count -= us << 12;
                if (this.timerb_count <= 0) {
                    f = true;
                    while (this.timerb_count <= 0)
                        this.timerb_count += this.timerb;
                    if (this.regtc & 8)
                        this.SetStatus(2);
                }
            }
            return f;
        };
        Timer.prototype.GetNextEvent = function () {
            var ta = ((this.timera_count + 0xffff) >> 16) - 1;
            var tb = ((this.timerb_count + 0xfff) >> 12) - 1;
            return (ta < tb ? ta : tb) + 1;
        };
        Timer.prototype.SetStatus = function (bit) { };
        Timer.prototype.ResetStatus = function (bit) { };
        Timer.prototype.SetTimerBase = function (clock) {
            this.timer_step = (1000000.0 * 65536 / clock) | 0;
        };
        Timer.prototype.SetTimerA = function (addr, data) {
            var tmp;
            this.regta[addr & 1] = data | 0;
            tmp = (this.regta[0] << 2) + (this.regta[1] & 3);
            this.timera = (1024 - tmp) * this.timer_step;
        };
        Timer.prototype.SetTimerB = function (data) {
            this.timerb = (256 - data) * this.timer_step;
        };
        Timer.prototype.SetTimerControl = function (data) {
            var tmp = this.regtc ^ data;
            this.regtc = data | 0;
            if (data & 0x10)
                this.ResetStatus(1);
            if (data & 0x20)
                this.ResetStatus(2);
            if (tmp & 0x01)
                this.timera_count = (data & 1) ? this.timera : 0;
            if (tmp & 0x02)
                this.timerb_count = (data & 2) ? this.timerb : 0;
        };
        Timer.prototype.TimerA = function () { };
        return Timer;
    })();
    fmgenAs.Timer = Timer;
})(fmgenAs || (fmgenAs = {}));
var fmgenAs;
(function (fmgenAs) {
    var JaggArray = (function () {
        function JaggArray() {
        }
        JaggArray.I2 = function (s1, s2) {
            var a = new Array(s1);
            for (var i = 0; i < s1; i++) {
                a[i] = new Array(s2);
            }
            return a;
        };
        JaggArray.I3 = function (s1, s2, s3) {
            var a = new Array(s1);
            for (var i = 0; i < s1; i++) {
                a[i] = new Array(s2);
                for (var j = 0; j < s2; j++) {
                    a[i][j] = new Array(s3);
                }
            }
            return a;
        };
        return JaggArray;
    })();
    fmgenAs.JaggArray = JaggArray;
})(fmgenAs || (fmgenAs = {}));
// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------
/// <reference path="JaggArray.ts" />
var fmgenAs;
(function (fmgenAs) {
    var Operator = (function () {
        function Operator() {
            this.chip_ = null;
            this.ar_ = this.dr_ = this.sr_ = this.rr_ = this.key_scale_rate_ = 0;
            this.ams_ = Operator.amtable[0][0];
            this.mute_ = false;
            this.keyon_ = false;
            this.tl_out_ = 0;
            this.ssg_type_ = 0;
            this.multiple_ = 0;
            this.detune_ = 0;
            this.detune2_ = 0;
            this.ms_ = 0;
        }
        Operator.prototype.SetChip = function (chip) {
            this.chip_ = chip;
        };
        Operator.prototype.Reset = function () {
            this.tl_ = this.tl_latch_ = 127;
            this.ShiftPhase(fmgenAs.EGPhase.off);
            this.eg_count_ = 0;
            this.eg_curve_count_ = 0;
            this.ssg_phase_ = 0;
            this.pg_count_ = 0;
            this.out_ = this.out2_ = 0;
            this.param_changed_ = true;
        };
        Operator.prototype.SetDPBN = function (dp, bn) {
            this.dp_ = dp;
            this.bn_ = bn;
            this.param_changed_ = true;
        };
        Operator.prototype.Prepare = function () {
            if (this.param_changed_ === false) {
                return;
            }
            this.param_changed_ = false;
            this.pg_diff_ = ((this.dp_ + Operator.dttable[this.detune_ + this.bn_]) * this.chip_.GetMulValue(this.detune2_, this.multiple_));
            this.pg_diff_lfo_ = this.pg_diff_ >> 11;
            this.key_scale_rate_ = this.bn_ >> (3 - this.ks_);
            this.tl_out_ = this.mute_ ? 0x3ff : this.tl_ * 8;
            switch (this.eg_phase_) {
                case fmgenAs.EGPhase.attack:
                    this.SetEGRate(this.ar_ !== 0 ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
                    break;
                case fmgenAs.EGPhase.decay:
                    this.SetEGRate(this.dr_ !== 0 ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0);
                    this.eg_level_on_next_phase_ = this.sl_ * 8;
                    break;
                case fmgenAs.EGPhase.sustain:
                    this.SetEGRate(this.sr_ !== 0 ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
                    break;
                case fmgenAs.EGPhase.release:
                    this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
                    break;
            }
            if (this.ssg_type_ !== 0 && (this.eg_phase_ !== fmgenAs.EGPhase.release)) {
                var m = (this.ar_ >= ((this.ssg_type_ === 8 || this.ssg_type_ === 12) ? 56 : 60)) ? 1 : 0;
                this.ssg_offset_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][0] * 0x200;
                this.ssg_vector_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][1];
            }
            this.ams_ = Operator.amtable[this.type_ | 0][this.amon_ ? (this.ms_ >> 4) & 3 : 0];
            this.EGUpdate();
        };
        Operator.prototype.ShiftPhase = function (nextphase) {
            switch (nextphase) {
                case fmgenAs.EGPhase.attack:
                    this.tl_ = this.tl_latch_;
                    if (this.ssg_type_ !== 0) {
                        this.ssg_phase_ = this.ssg_phase_ + 1;
                        if (this.ssg_phase_ > 2)
                            this.ssg_phase_ = 1;
                        var m = (this.ar_ >= ((this.ssg_type_ === 8 || this.ssg_type_ === 12) ? 56 : 60)) ? 1 : 0;
                        this.ssg_offset_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][0] * 0x200;
                        this.ssg_vector_ = Operator.ssgenvtable[this.ssg_type_ & 7][m][this.ssg_phase_][1];
                    }
                    if ((this.ar_ + this.key_scale_rate_) < 62) {
                        this.SetEGRate(this.ar_ !== 0 ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
                        this.eg_phase_ = fmgenAs.EGPhase.attack;
                        break;
                    }
                case fmgenAs.EGPhase.decay:
                    if (this.sl_ !== 0) {
                        this.eg_level_ = 0;
                        this.eg_level_on_next_phase_ = ((this.ssg_type_ !== 0) ? Math.min(this.sl_ * 8, 0x200) : this.sl_ * 8);
                        this.SetEGRate(this.dr_ !== 0 ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0);
                        this.eg_phase_ = fmgenAs.EGPhase.decay;
                        break;
                    }
                case fmgenAs.EGPhase.sustain:
                    this.eg_level_ = this.sl_ * 8;
                    this.eg_level_on_next_phase_ = (this.ssg_type_ !== 0) ? 0x200 : 0x400;
                    this.SetEGRate(this.sr_ !== 0 ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
                    this.eg_phase_ = fmgenAs.EGPhase.sustain;
                    break;
                case fmgenAs.EGPhase.release:
                    if (this.ssg_type_ !== 0) {
                        this.eg_level_ = this.eg_level_ * this.ssg_vector_ + this.ssg_offset_;
                        this.ssg_vector_ = 1;
                        this.ssg_offset_ = 0;
                    }
                    if (this.eg_phase_ === fmgenAs.EGPhase.attack || (this.eg_level_ < 955)) {
                        this.eg_level_on_next_phase_ = 0x400;
                        this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
                        this.eg_phase_ = fmgenAs.EGPhase.release;
                        break;
                    }
                case fmgenAs.EGPhase.off:
                default:
                    this.eg_level_ = 955;
                    this.eg_level_on_next_phase_ = 955;
                    this.EGUpdate();
                    this.SetEGRate(0);
                    this.eg_phase_ = fmgenAs.EGPhase.off;
                    break;
            }
        };
        Operator.prototype.SetFNum = function (f) {
            this.dp_ = (f & 2047) << ((f >> 11) & 7);
            this.bn_ = Operator.notetable[(f >> 7) & 127];
            this.param_changed_ = true;
        };
        Operator.prototype.SINE = function (s) {
            return Operator.sinetable[(s) & (1024 - 1)];
        };
        Operator.prototype.LogToLin = function (a) {
            return (a < 8192) ? Operator.cltable[a] : 0;
        };
        Operator.prototype.EGUpdate = function () {
            var a = (this.ssg_type_ === 0) ? this.tl_out_ + this.eg_level_ : this.tl_out_ + this.eg_level_ * this.ssg_vector_ + this.ssg_offset_;
            this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
        };
        Operator.prototype.SetEGRate = function (rate) {
            this.eg_rate_ = rate;
            this.eg_count_diff_ = Operator.decaytable2[(rate / 4) | 0] * this.chip_.GetRatio();
        };
        Operator.prototype.EGCalc = function () {
            this.eg_count_ = (2047 * 3) << 7;
            if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                if (c >= 0) {
                    this.eg_level_ -= 1 + (this.eg_level_ >> c);
                    if (this.eg_level_ <= 0)
                        this.ShiftPhase(fmgenAs.EGPhase.decay);
                }
                this.EGUpdate();
            }
            else {
                if (this.ssg_type_ === 0) {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                    this.EGUpdate();
                }
                else {
                    this.eg_level_ += 4 * Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_) {
                        this.EGUpdate();
                        switch (this.eg_phase_) {
                            case fmgenAs.EGPhase.decay:
                                this.ShiftPhase(fmgenAs.EGPhase.sustain);
                                break;
                            case fmgenAs.EGPhase.sustain:
                                this.ShiftPhase(fmgenAs.EGPhase.attack);
                                break;
                            case fmgenAs.EGPhase.release:
                                this.ShiftPhase(fmgenAs.EGPhase.off);
                                break;
                        }
                    }
                }
            }
            this.eg_curve_count_++;
        };
        Operator.prototype.EGStep = function () {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0)
                this.EGCalc();
        };
        Operator.prototype.PGCalc = function () {
            var ret = this.pg_count_;
            this.pg_count_ += this.pg_diff_;
            return ret;
        };
        Operator.prototype.PGCalcL = function () {
            var ret = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.GetPMV()) >> 5);
            return ret;
        };
        Operator.prototype.Calc = function (ii) {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << 7;
                if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                    var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0)
                            this.ShiftPhase(fmgenAs.EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a = this.tl_out_ + this.eg_level_;
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            this.out2_ = this.out_;
            var pgo = this.pg_count_;
            this.pg_count_ += this.pg_diff_;
            var pgin = pgo >> (20 + 9 - 10);
            pgin += ii >> (20 + 9 - 10 - (2 + Operator.IS2EC_SHIFT));
            var sino = this.eg_out_ + Operator.sinetable[pgin & (1024 - 1)];
            this.out_ = (sino < 8192) ? Operator.cltable[sino] : 0;
            return this.out_;
        };
        Operator.prototype.CalcL = function (ii) {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << 7;
                if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                    var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0)
                            this.ShiftPhase(fmgenAs.EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a = this.tl_out_ + this.eg_level_;
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            var pgo = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.pmv_) >> 5);
            var pgin = pgo >> (20 + 9 - 10);
            pgin += ii >> (20 + 9 - 10 - (2 + Operator.IS2EC_SHIFT));
            var sino = this.eg_out_ + Operator.sinetable[pgin & (1024 - 1)] + this.ams_[this.chip_.aml_];
            this.out_ = (sino < 8192) ? Operator.cltable[sino] : 0;
            return this.out_;
        };
        Operator.prototype.CalcN = function (noise) {
            this.EGStep();
            var lv = Math.max(0, 0x3ff - (this.tl_out_ + this.eg_level_)) << 1;
            noise = (noise & 1) - 1;
            this.out_ = (lv + noise) ^ noise;
            return this.out_;
        };
        Operator.prototype.CalcFB = function (fb) {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << 7;
                if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                    var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0)
                            this.ShiftPhase(fmgenAs.EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a = this.tl_out_ + this.eg_level_;
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            var ii = this.out_ + this.out2_;
            this.out2_ = this.out_;
            var pgo = this.pg_count_;
            this.pg_count_ += this.pg_diff_;
            var pgin = pgo >> (20 + 9 - 10);
            if (fb < 31) {
                pgin += ((ii << (1 + Operator.IS2EC_SHIFT)) >> fb) >> (20 + 9 - 10);
            }
            var sino = this.eg_out_ + Operator.sinetable[pgin & (1024 - 1)];
            this.out_ = (sino < 8192) ? Operator.cltable[sino] : 0;
            return this.out2_;
        };
        Operator.prototype.CalcFBL = function (fb) {
            this.eg_count_ -= this.eg_count_diff_;
            if (this.eg_count_ <= 0) {
                this.eg_count_ = (2047 * 3) << 7;
                if (this.eg_phase_ === fmgenAs.EGPhase.attack) {
                    var c = Operator.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (c >= 0) {
                        this.eg_level_ -= 1 + (this.eg_level_ >> c);
                        if (this.eg_level_ <= 0)
                            this.ShiftPhase(fmgenAs.EGPhase.decay);
                    }
                }
                else {
                    this.eg_level_ += Operator.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
                    if (this.eg_level_ >= this.eg_level_on_next_phase_)
                        this.ShiftPhase(this.eg_phase_ + 1);
                }
                var a = this.tl_out_ + this.eg_level_;
                this.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                this.eg_curve_count_++;
            }
            var ii = this.out_ + this.out2_;
            this.out2_ = this.out_;
            var pgo = this.pg_count_;
            this.pg_count_ += this.pg_diff_ + ((this.pg_diff_lfo_ * this.chip_.pmv_) >> 5);
            var pgin = pgo >> (20 + 9 - 10);
            if (fb < 31) {
                pgin += ((ii << (1 + Operator.IS2EC_SHIFT)) >> fb) >> (20 + 9 - 10);
            }
            var sino = this.eg_out_ + Operator.sinetable[pgin & (1024 - 1)] + this.ams_[this.chip_.aml_];
            this.out_ = (sino < 8192) ? Operator.cltable[sino] : 0;
            return this.out_;
        };
        Operator.prototype.ResetFB = function () {
            this.out_ = this.out2_ = 0;
        };
        Operator.prototype.KeyOn = function () {
            if (!this.keyon_) {
                this.keyon_ = true;
                if (this.eg_phase_ === fmgenAs.EGPhase.off || this.eg_phase_ === fmgenAs.EGPhase.release) {
                    this.ssg_phase_ = -1;
                    this.ShiftPhase(fmgenAs.EGPhase.attack);
                    this.EGUpdate();
                    this.in2_ = this.out_ = this.out2_ = 0;
                    this.pg_count_ = 0;
                }
            }
        };
        Operator.prototype.KeyOff = function () {
            if (this.keyon_) {
                this.keyon_ = false;
                this.ShiftPhase(fmgenAs.EGPhase.release);
            }
        };
        Operator.prototype.IsOn = function () {
            return this.eg_phase_ !== fmgenAs.EGPhase.off;
        };
        Operator.prototype.SetDT = function (dt) {
            this.detune_ = dt * 0x20;
            this.param_changed_ = true;
        };
        Operator.prototype.SetDT2 = function (dt2) {
            this.detune2_ = dt2 & 3;
            this.param_changed_ = true;
        };
        Operator.prototype.SetMULTI = function (mul) {
            this.multiple_ = mul;
            this.param_changed_ = true;
        };
        Operator.prototype.SetTL = function (tl, csm) {
            if (!csm) {
                this.tl_ = tl;
                this.param_changed_ = true;
            }
            this.tl_latch_ = tl;
        };
        Operator.prototype.SetAR = function (ar) {
            this.ar_ = ar;
            this.param_changed_ = true;
        };
        Operator.prototype.SetDR = function (dr) {
            this.dr_ = dr;
            this.param_changed_ = true;
        };
        Operator.prototype.SetSR = function (sr) {
            this.sr_ = sr;
            this.param_changed_ = true;
        };
        Operator.prototype.SetSL = function (sl) {
            this.sl_ = sl;
            this.param_changed_ = true;
        };
        Operator.prototype.SetRR = function (rr) {
            this.rr_ = rr;
            this.param_changed_ = true;
        };
        Operator.prototype.SetKS = function (ks) {
            this.ks_ = ks;
            this.param_changed_ = true;
        };
        Operator.prototype.SetAMON = function (amon) {
            this.amon_ = amon;
            this.param_changed_ = true;
        };
        Operator.prototype.Mute = function (mute) {
            this.mute_ = mute;
            this.param_changed_ = true;
        };
        Operator.prototype.SetMS = function (ms) {
            this.ms_ = ms;
            this.param_changed_ = true;
        };
        Operator.prototype.Out = function () {
            return this.out_;
        };
        Operator.prototype.Refresh = function () {
            this.param_changed_ = true;
        };
        Operator.notetable = [
            0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3,
            4, 4, 4, 4, 4, 4, 4, 5, 6, 7, 7, 7, 7, 7, 7, 7,
            8, 8, 8, 8, 8, 8, 8, 9, 10, 11, 11, 11, 11, 11, 11, 11,
            12, 12, 12, 12, 12, 12, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15,
            16, 16, 16, 16, 16, 16, 16, 17, 18, 19, 19, 19, 19, 19, 19, 19,
            20, 20, 20, 20, 20, 20, 20, 21, 22, 23, 23, 23, 23, 23, 23, 23,
            24, 24, 24, 24, 24, 24, 24, 25, 26, 27, 27, 27, 27, 27, 27, 27,
            28, 28, 28, 28, 28, 28, 28, 29, 30, 31, 31, 31, 31, 31, 31, 31
        ];
        Operator.dttable = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4,
            4, 6, 6, 6, 8, 8, 8, 10, 10, 12, 12, 14, 16, 16, 16, 16,
            2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 8, 8, 8, 10,
            10, 12, 12, 14, 16, 16, 18, 20, 22, 24, 26, 28, 32, 32, 32, 32,
            4, 4, 4, 4, 4, 6, 6, 6, 8, 8, 8, 10, 10, 12, 12, 14,
            16, 16, 18, 20, 22, 24, 26, 28, 32, 34, 38, 40, 44, 44, 44, 44,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, -2, -2, -2, -2, -2, -2, -2, -2, -4, -4, -4, -4,
            -4, -6, -6, -6, -8, -8, -8, -10, -10, -12, -12, -14, -16, -16, -16, -16,
            -2, -2, -2, -2, -4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8, -10,
            -10, -12, -12, -14, -16, -16, -18, -20, -22, -24, -26, -28, -32, -32, -32, -32,
            -4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8, -10, -10, -12, -12, -14,
            -16, -16, -18, -20, -22, -24, -26, -28, -32, -34, -38, -40, -44, -44, -44, -44
        ];
        Operator.decaytable1 = [
            [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 0, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1], [2, 1, 1, 1, 2, 1, 1, 1],
            [2, 1, 2, 1, 2, 1, 2, 1], [2, 2, 2, 1, 2, 2, 2, 1],
            [2, 2, 2, 2, 2, 2, 2, 2], [4, 2, 2, 2, 4, 2, 2, 2],
            [4, 2, 4, 2, 4, 2, 4, 2], [4, 4, 4, 2, 4, 4, 4, 2],
            [4, 4, 4, 4, 4, 4, 4, 4], [8, 4, 4, 4, 8, 4, 4, 4],
            [8, 4, 8, 4, 8, 4, 8, 4], [8, 8, 8, 4, 8, 8, 8, 4],
            [16, 16, 16, 16, 16, 16, 16, 16], [16, 16, 16, 16, 16, 16, 16, 16],
            [16, 16, 16, 16, 16, 16, 16, 16], [16, 16, 16, 16, 16, 16, 16, 16]
        ];
        Operator.decaytable2 = [
            1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2047, 2047, 2047, 2047, 2047
        ];
        Operator.attacktable = [
            [-1, -1, -1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1, -1, -1],
            [4, 4, 4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4, 4, 4],
            [4, 4, 4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4, 4, 4],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, -1, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, -1, 4, -1, 4, -1, 4, -1], [4, 4, 4, -1, 4, -1, 4, -1],
            [4, 4, 4, -1, 4, 4, 4, -1], [4, 4, 4, 4, 4, 4, 4, -1],
            [4, 4, 4, 4, 4, 4, 4, 4], [3, 4, 4, 4, 3, 4, 4, 4],
            [3, 4, 3, 4, 3, 4, 3, 4], [3, 3, 3, 4, 3, 3, 3, 4],
            [3, 3, 3, 3, 3, 3, 3, 3], [2, 3, 3, 3, 2, 3, 3, 3],
            [2, 3, 2, 3, 2, 3, 2, 3], [2, 2, 2, 3, 2, 2, 2, 3],
            [2, 2, 2, 2, 2, 2, 2, 2], [1, 2, 2, 2, 1, 2, 2, 2],
            [1, 2, 1, 2, 1, 2, 1, 2], [1, 1, 1, 2, 1, 1, 1, 2],
            [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]
        ];
        Operator.ssgenvtable = [
            [[[1, 1], [1, 1], [1, 1]],
                [[0, 1], [1, 1], [1, 1]]],
            [[[0, 1], [2, 0], [2, 0]],
                [[0, 1], [2, 0], [2, 0]]],
            [[[1, -1], [0, 1], [1, -1]],
                [[0, 1], [1, -1], [0, 1]]],
            [[[1, -1], [0, 0], [0, 0]],
                [[0, 1], [0, 0], [0, 0]]],
            [[[2, -1], [2, -1], [2, -1]],
                [[1, -1], [2, -1], [2, -1]]],
            [[[1, -1], [0, 0], [0, 0]],
                [[1, -1], [0, 0], [0, 0]]],
            [[[0, 1], [1, -1], [0, 1]],
                [[1, -1], [0, 1], [1, -1]]],
            [[[0, 1], [2, 0], [2, 0]],
                [[1, -1], [2, 0], [2, 0]]]
        ];
        Operator.sinetable = (function () {
            var sinetable = [];
            var log2 = Math.log(2.0);
            for (var i = 0; i < 1024 / 2; i++) {
                var r = (i * 2 + 1) * Math.PI / 1024;
                var q = -256 * Math.log(Math.sin(r)) / log2;
                var s = Math.floor(q + 0.5) + 1;
                sinetable[i] = s * 2;
                sinetable[1024 / 2 + i | 0] = s * 2 + 1;
            }
            return sinetable;
        })();
        Operator.cltable = (function () {
            var cltable = [];
            var i, j;
            for (i = 0, j = 0; i < 256; i++) {
                var v = Math.floor(Math.pow(2.0, 13.0 - i / 256.0));
                v = (v + 2) & ~3;
                cltable[j++] = v;
                cltable[j++] = -v;
            }
            i = j;
            while (j < 8192) {
                cltable[j++] = cltable[i++ - 512] / 2 | 0;
            }
            return cltable;
        })();
        Operator.amtable = (function () {
            var amtable = fmgenAs.JaggArray.I3(2, 8, 256);
            var i, j;
            var amt = [
                [31, 6, 4, 3],
                [31, 2, 1, 0],
            ];
            for (var type = 0; type < 2; type++) {
                for (i = 0; i < 4; i++) {
                    for (j = 0; j < 256; j++) {
                        amtable[type][i][j] = (((j * 4) >> amt[type][i]) * 2) << 2;
                    }
                }
            }
            return amtable;
        })();
        Operator.IS2EC_SHIFT = ((20 + 9) - 13);
        return Operator;
    })();
    fmgenAs.Operator = Operator;
})(fmgenAs || (fmgenAs = {}));
// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------
/// <reference path="Timer.ts" />
/// <reference path="Operator.ts" />
var fmgenAs;
(function (fmgenAs) {
    var OPM = (function (_super) {
        __extends(OPM, _super);
        function OPM() {
            _super.call(this);
            this.amplevel = 16384;
            this.kc = new Array(8);
            this.kf = new Array(8);
            this.pan = new Array(8);
            this.chip = new fmgenAs.Chip();
            this.buf = new Array(4);
            this.ch = [
                new fmgenAs.Channel4(), new fmgenAs.Channel4(),
                new fmgenAs.Channel4(), new fmgenAs.Channel4(),
                new fmgenAs.Channel4(), new fmgenAs.Channel4(),
                new fmgenAs.Channel4(), new fmgenAs.Channel4()
            ];
            this.lfo_count_ = 0;
            this.lfo_count_prev_ = ~0;
            OPM.BuildLFOTable();
            for (var i = 0; i < 8; i++) {
                this.ch[i].SetChip(this.chip);
                this.ch[i].SetType(fmgenAs.OpType.typeM);
            }
            this.ix = this.ch[0].ix;
            this.ox = this.ch[0].ox;
        }
        OPM.BuildLFOTable = function () {
            if (this.s_init)
                return;
            for (var type = 0; type < 4; type++) {
                var r = 0;
                for (var c = 0; c < 512; c++) {
                    var a = 0;
                    var p = 0;
                    switch (type) {
                        case 0:
                            p = (((c + 0x100) & 0x1ff) / 2) - 0x80;
                            a = 0xff - c / 2;
                            break;
                        case 1:
                            a = c < 0x100 ? 0xff : 0;
                            p = c < 0x100 ? 0x7f : -0x80;
                            break;
                        case 2:
                            p = (c + 0x80) & 0x1ff;
                            p = p < 0x100 ? p - 0x80 : 0x17f - p;
                            a = c < 0x100 ? 0xff - c : c - 0x100;
                            break;
                        case 3:
                            if ((c & 3) === 0)
                                r = ((Math.random() * 32768 | 0) / 17) & 0xff;
                            a = r;
                            p = r - 0x80;
                            break;
                    }
                    this.amtable[type][c] = a;
                    this.pmtable[type][c] = -p - 1;
                }
            }
            this.s_init = true;
        };
        OPM.prototype.Init = function (c, rf) {
            if (!this.SetRate(c, rf))
                return false;
            this.Reset();
            this.SetVolume(0);
            this.SetChannelMask(0);
            return true;
        };
        OPM.prototype.SetRate = function (c, r) {
            this.clock = c;
            this.pcmrate = r;
            this.rate = r;
            this.RebuildTimeTable();
            return true;
        };
        OPM.prototype.SetChannelMask = function (mask) {
            for (var i = 0; i < 8; i++)
                this.ch[i].Mute((mask & (1 << i)) !== 0);
        };
        OPM.prototype.Reset = function () {
            var i;
            for (i = 0x0; i < 0x100; i++)
                this.SetReg(i, 0);
            this.SetReg(0x19, 0x80);
            _super.prototype.Reset.call(this);
            this.status = 0;
            this.noise = 12345;
            this.noisecount = 0;
            for (i = 0; i < 8; i++)
                this.ch[i].Reset();
        };
        OPM.prototype.RebuildTimeTable = function () {
            var fmclock = this.clock / 64 | 0;
            this.rateratio = ((fmclock << 7) + (this.rate / 2)) / this.rate | 0;
            this.SetTimerBase(fmclock);
            this.chip.SetRatio(this.rateratio);
        };
        OPM.prototype.TimerA = function () {
            if (this.regtc & 0x80) {
                for (var i = 0; i < 8; i++) {
                    this.ch[i].KeyControl(0x0);
                    this.ch[i].KeyControl(0xf);
                }
            }
        };
        OPM.prototype.SetVolume = function (db) {
            db = Math.min(db, 20);
            if (db > -192)
                this.fmvolume = 16384 * Math.pow(10.0, db / 40.0) | 0;
            else
                this.fmvolume = 0;
        };
        OPM.prototype.SetExpression = function (amp) {
            this.amplevel = amp * 16384 | 0;
        };
        OPM.prototype.ReadStatus = function () {
            return this.status & 0x03;
        };
        OPM.prototype.SetStatus = function (bits) {
            if ((this.status & bits) === 0) {
                this.status |= bits;
                this.Intr(true);
            }
        };
        OPM.prototype.ResetStatus = function (bits) {
            if (this.status & bits) {
                this.status &= ~bits;
                if (this.status === 0)
                    this.Intr(false);
            }
        };
        OPM.prototype.SetReg = function (addr, data) {
            if (addr >= 0x100)
                return;
            var c = addr & 7;
            switch (addr & 0xff) {
                case 0x01:
                    if (data & 2) {
                        this.lfo_count_ = 0;
                        this.lfo_count_prev_ = ~0;
                    }
                    this.reg01 = data;
                    break;
                case 0x08:
                    if ((this.regtc & 0x80) === 0) {
                        this.ch[data & 7].KeyControl(data >> 3);
                    }
                    else {
                        c = data & 7;
                        if ((data & 0x08) === 0)
                            this.ch[c].op[0].KeyOff();
                        if ((data & 0x10) === 0)
                            this.ch[c].op[1].KeyOff();
                        if ((data & 0x20) === 0)
                            this.ch[c].op[2].KeyOff();
                        if ((data & 0x40) === 0)
                            this.ch[c].op[3].KeyOff();
                    }
                    break;
                case 0x10:
                case 0x11:
                    this.SetTimerA(addr, data);
                    break;
                case 0x12:
                    this.SetTimerB(data);
                    break;
                case 0x14:
                    this.SetTimerControl(data);
                    break;
                case 0x18:
                    this.lfofreq = data;
                    this.lfo_count_diff_ = this.rateratio * ((16 + (this.lfofreq & 15)) << (16 - 4 - 7)) / (1 << (15 - (this.lfofreq >> 4)));
                    break;
                case 0x19:
                    if (data & 0x80)
                        this.pmd = data & 0x7f;
                    else
                        this.amd = data & 0x7f;
                    break;
                case 0x1b:
                    this.lfowaveform = data & 3;
                    break;
                case 0x20:
                case 0x21:
                case 0x22:
                case 0x23:
                case 0x24:
                case 0x25:
                case 0x26:
                case 0x27:
                    this.ch[c].SetFB((data >> 3) & 7);
                    this.ch[c].SetAlgorithm(data & 7);
                    this.pan[c] = (data >> 6) & 3;
                    break;
                case 0x28:
                case 0x29:
                case 0x2a:
                case 0x2b:
                case 0x2c:
                case 0x2d:
                case 0x2e:
                case 0x2f:
                    this.kc[c] = data;
                    this.ch[c].SetKCKF(this.kc[c], this.kf[c]);
                    break;
                case 0x30:
                case 0x31:
                case 0x32:
                case 0x33:
                case 0x34:
                case 0x35:
                case 0x36:
                case 0x37:
                    this.kf[c] = data >> 2;
                    this.ch[c].SetKCKF(this.kc[c], this.kf[c]);
                    break;
                case 0x38:
                case 0x39:
                case 0x3a:
                case 0x3b:
                case 0x3c:
                case 0x3d:
                case 0x3e:
                case 0x3f:
                    this.ch[c].SetMS((data << 4) | (data >> 4));
                    break;
                case 0x0f:
                    this.noisedelta = data;
                    this.noisecount = 0;
                    break;
                default:
                    if (addr >= 0x40)
                        this.SetParameter(addr, data);
                    break;
            }
        };
        OPM.prototype.SetParameter = function (addr, data) {
            var slot = OPM.slottable[(addr >> 3) & 3];
            var op = this.ch[addr & 7].op[slot];
            switch ((addr >> 5) & 7) {
                case 2:
                    op.SetDT((data >> 4) & 0x07);
                    op.SetMULTI(data & 0x0f);
                    break;
                case 3:
                    op.SetTL(data & 0x7f, (this.regtc & 0x80) !== 0);
                    break;
                case 4:
                    op.SetKS((data >> 6) & 3);
                    op.SetAR((data & 0x1f) * 2);
                    break;
                case 5:
                    op.SetDR((data & 0x1f) * 2);
                    op.SetAMON((data & 0x80) !== 0);
                    break;
                case 6:
                    op.SetSR((data & 0x1f) * 2);
                    op.SetDT2((data >> 6) & 3);
                    break;
                case 7:
                    op.SetSL(OPM.sltable[(data >> 4) & 15]);
                    op.SetRR((data & 0x0f) * 4 + 2);
                    break;
            }
        };
        OPM.prototype.Mix = function (buffer, start, nsamples) {
            var i;
            var activech = 0;
            for (i = 0; i < 8; i++)
                activech = (activech << 2) | this.ch[i].Prepare();
            if (activech & 0x5555) {
                if (this.reg01 & 0x02)
                    activech &= 0x5555;
                var a, c, r, o, ii;
                var pgex, pgin, sino;
                var al = this.ch[0].algo_;
                var fb = this.ch[0].fb;
                var op0 = this.ch[0].op[0];
                var op1 = this.ch[0].op[1];
                var op2 = this.ch[0].op[2];
                var op3 = this.ch[0].op[3];
                var buf = this.buf;
                var ix = this.ix;
                var ox = this.ox;
                var cltable = OPM.cltable;
                var sinetable = OPM.sinetable;
                var attacktable = OPM.attacktable;
                var decaytable1 = OPM.decaytable1;
                if (this.lfowaveform !== 3) {
                    var pmtable = OPM.pmtable;
                    var amtable = OPM.amtable;
                }
                for (i = start; i < start + nsamples; i++) {
                    if (this.lfowaveform !== 3) {
                        c = (this.lfo_count_ >> 15) & 0x1fe;
                        this.chip.pml_ = (pmtable[this.lfowaveform][c] * this.pmd / 128 + 0x80) & (256 - 1);
                        this.chip.aml_ = (amtable[this.lfowaveform][c] * this.amd / 128) & (256 - 1);
                    }
                    else {
                        if ((this.lfo_count_ ^ this.lfo_count_prev_) & ~((1 << 17) - 1)) {
                            c = ((Math.random() * 32768 | 0) / 17) & 0xff;
                            this.chip.pml_ = ((c - 0x80) * this.pmd / 128 + 0x80) & (256 - 1);
                            this.chip.aml_ = (c * this.amd / 128) & (256 - 1);
                        }
                    }
                    this.lfo_count_prev_ = this.lfo_count_;
                    this.lfo_step_++;
                    if ((this.lfo_step_ & 7) === 0) {
                        this.lfo_count_ += this.lfo_count_diff_;
                    }
                    r = 0;
                    if (activech & 0x4000) {
                        if (activech & 0xaaaa) {
                            this.ch[0].chip_.pmv_ = this.ch[0].pms[this.ch[0].chip_.pml_];
                            buf[1] = buf[2] = buf[3] = 0;
                            buf[0] = op0.out_;
                            op0.eg_count_ -= op0.eg_count_diff_;
                            if (op0.eg_count_ <= 0) {
                                op0.eg_count_ = (2047 * 3) << 7;
                                if (op0.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op0.eg_level_ -= 1 + (op0.eg_level_ >> c);
                                        if (op0.eg_level_ <= 0)
                                            op0.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op0.eg_level_ += decaytable1[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (op0.eg_level_ >= op0.eg_level_on_next_phase_)
                                        op0.ShiftPhase(op0.eg_phase_ + 1);
                                }
                                a = op0.tl_out_ + op0.eg_level_;
                                op0.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op0.eg_curve_count_++;
                            }
                            ii = op0.out_ + op0.out2_;
                            op0.out2_ = op0.out_;
                            pgex = op0.pg_count_;
                            op0.pg_count_ += op0.pg_diff_ + ((op0.pg_diff_lfo_ * op0.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + 9 - 10);
                            if (fb < 31) {
                                pgin += ((ii << (1 + fmgenAs.Operator.IS2EC_SHIFT)) >> fb) >> (20 + 9 - 10);
                            }
                            sino = op0.eg_out_ + sinetable[pgin & (1024 - 1)] + op0.ams_[op0.chip_.aml_];
                            op0.out_ = (sino < 8192) ? cltable[sino] : 0;
                            op1.eg_count_ -= op1.eg_count_diff_;
                            if (op1.eg_count_ <= 0) {
                                op1.eg_count_ = (2047 * 3) << 7;
                                if (op1.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op1.eg_level_ -= 1 + (op1.eg_level_ >> c);
                                        if (op1.eg_level_ <= 0)
                                            op1.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op1.eg_level_ += decaytable1[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (op1.eg_level_ >= op1.eg_level_on_next_phase_)
                                        op1.ShiftPhase(op1.eg_phase_ + 1);
                                }
                                a = op1.tl_out_ + op1.eg_level_;
                                op1.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op1.eg_curve_count_++;
                            }
                            ii = buf[ix[0]];
                            op1.out2_ = op1.out_;
                            pgex = op1.pg_count_;
                            op1.pg_count_ += op1.pg_diff_ + ((op1.pg_diff_lfo_ * op1.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op1.eg_out_ + sinetable[pgin & (1024 - 1)] + op1.ams_[op1.chip_.aml_];
                            op1.out_ = (sino < 8192) ? cltable[sino] : 0;
                            buf[ox[0]] += op1.out_;
                            op2.eg_count_ -= op2.eg_count_diff_;
                            if (op2.eg_count_ <= 0) {
                                op2.eg_count_ = (2047 * 3) << 7;
                                if (op2.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op2.eg_level_ -= 1 + (op2.eg_level_ >> c);
                                        if (op2.eg_level_ <= 0)
                                            op2.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op2.eg_level_ += decaytable1[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (op2.eg_level_ >= op2.eg_level_on_next_phase_)
                                        op2.ShiftPhase(op2.eg_phase_ + 1);
                                }
                                a = op2.tl_out_ + op2.eg_level_;
                                op2.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op2.eg_curve_count_++;
                            }
                            ii = buf[ix[1]];
                            op2.out2_ = op2.out_;
                            pgex = op2.pg_count_;
                            op2.pg_count_ += op2.pg_diff_ + ((op2.pg_diff_lfo_ * op2.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op2.eg_out_ + sinetable[pgin & (1024 - 1)] + op2.ams_[op2.chip_.aml_];
                            op2.out_ = (sino < 8192) ? cltable[sino] : 0;
                            buf[ox[1]] += op2.out_;
                            op3.eg_count_ -= op3.eg_count_diff_;
                            if (op3.eg_count_ <= 0) {
                                op3.eg_count_ = (2047 * 3) << 7;
                                if (op3.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op3.eg_level_ -= 1 + (op3.eg_level_ >> c);
                                        if (op3.eg_level_ <= 0)
                                            op3.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op3.eg_level_ += decaytable1[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (op3.eg_level_ >= op3.eg_level_on_next_phase_)
                                        op3.ShiftPhase(op3.eg_phase_ + 1);
                                }
                                a = op3.tl_out_ + op3.eg_level_;
                                op3.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op3.eg_curve_count_++;
                            }
                            ii = buf[ix[2]];
                            op3.out2_ = op3.out_;
                            pgex = op3.pg_count_;
                            op3.pg_count_ += op3.pg_diff_ + ((op3.pg_diff_lfo_ * op3.chip_.pmv_) >> 5);
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op3.eg_out_ + sinetable[pgin & (1024 - 1)] + op3.ams_[op3.chip_.aml_];
                            op3.out_ = (sino < 8192) ? cltable[sino] : 0;
                            r = buf[ox[2]] + op3.out_;
                        }
                        else {
                            buf[1] = buf[2] = buf[3] = 0;
                            buf[0] = op0.out_;
                            op0.eg_count_ -= op0.eg_count_diff_;
                            if (op0.eg_count_ <= 0) {
                                op0.eg_count_ = (2047 * 3) << 7;
                                if (op0.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op0.eg_level_ -= 1 + (op0.eg_level_ >> c);
                                        if (op0.eg_level_ <= 0)
                                            op0.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op0.eg_level_ += decaytable1[op0.eg_rate_][op0.eg_curve_count_ & 7];
                                    if (op0.eg_level_ >= op0.eg_level_on_next_phase_)
                                        op0.ShiftPhase(op0.eg_phase_ + 1);
                                }
                                a = op0.tl_out_ + op0.eg_level_;
                                op0.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op0.eg_curve_count_++;
                            }
                            ii = op0.out_ + op0.out2_;
                            op0.out2_ = op0.out_;
                            pgex = op0.pg_count_;
                            op0.pg_count_ += op0.pg_diff_;
                            pgin = pgex >> (20 + 9 - 10);
                            if (fb < 31) {
                                pgin += ((ii << (1 + fmgenAs.Operator.IS2EC_SHIFT)) >> fb) >> (20 + 9 - 10);
                            }
                            sino = op0.eg_out_ + sinetable[pgin & (1024 - 1)];
                            op0.out_ = (sino < 8192) ? cltable[sino] : 0;
                            op1.eg_count_ -= op1.eg_count_diff_;
                            if (op1.eg_count_ <= 0) {
                                op1.eg_count_ = (2047 * 3) << 7;
                                if (op1.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op1.eg_level_ -= 1 + (op1.eg_level_ >> c);
                                        if (op1.eg_level_ <= 0)
                                            op1.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op1.eg_level_ += decaytable1[op1.eg_rate_][op1.eg_curve_count_ & 7];
                                    if (op1.eg_level_ >= op1.eg_level_on_next_phase_)
                                        op1.ShiftPhase(op1.eg_phase_ + 1);
                                }
                                a = op1.tl_out_ + op1.eg_level_;
                                op1.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op1.eg_curve_count_++;
                            }
                            ii = buf[ix[0]];
                            op1.out2_ = op1.out_;
                            pgex = op1.pg_count_;
                            op1.pg_count_ += op1.pg_diff_;
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op1.eg_out_ + sinetable[pgin & (1024 - 1)];
                            op1.out_ = (sino < 8192) ? cltable[sino] : 0;
                            buf[ox[0]] += op1.out_;
                            op2.eg_count_ -= op2.eg_count_diff_;
                            if (op2.eg_count_ <= 0) {
                                op2.eg_count_ = (2047 * 3) << 7;
                                if (op2.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op2.eg_level_ -= 1 + (op2.eg_level_ >> c);
                                        if (op2.eg_level_ <= 0)
                                            op2.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op2.eg_level_ += decaytable1[op2.eg_rate_][op2.eg_curve_count_ & 7];
                                    if (op2.eg_level_ >= op2.eg_level_on_next_phase_)
                                        op2.ShiftPhase(op2.eg_phase_ + 1);
                                }
                                a = op2.tl_out_ + op2.eg_level_;
                                op2.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op2.eg_curve_count_++;
                            }
                            ii = buf[ix[1]];
                            op2.out2_ = op2.out_;
                            pgex = op2.pg_count_;
                            op2.pg_count_ += op2.pg_diff_;
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op2.eg_out_ + sinetable[pgin & (1024 - 1)];
                            op2.out_ = (sino < 8192) ? cltable[sino] : 0;
                            buf[ox[1]] += op2.out_;
                            op3.eg_count_ -= op3.eg_count_diff_;
                            if (op3.eg_count_ <= 0) {
                                op3.eg_count_ = (2047 * 3) << 7;
                                if (op3.eg_phase_ === fmgenAs.EGPhase.attack) {
                                    c = attacktable[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (c >= 0) {
                                        op3.eg_level_ -= 1 + (op3.eg_level_ >> c);
                                        if (op3.eg_level_ <= 0)
                                            op3.ShiftPhase(fmgenAs.EGPhase.decay);
                                    }
                                }
                                else {
                                    op3.eg_level_ += decaytable1[op3.eg_rate_][op3.eg_curve_count_ & 7];
                                    if (op3.eg_level_ >= op3.eg_level_on_next_phase_)
                                        op3.ShiftPhase(op3.eg_phase_ + 1);
                                }
                                a = op3.tl_out_ + op3.eg_level_;
                                op3.eg_out_ = (a < 0x3ff) ? a << (1 + 2) : 0x3ff << (1 + 2);
                                op3.eg_curve_count_++;
                            }
                            ii = buf[ix[2]];
                            op3.out2_ = op3.out_;
                            pgex = op3.pg_count_;
                            op3.pg_count_ += op3.pg_diff_;
                            pgin = pgex >> (20 + 9 - 10);
                            pgin += ii >> (20 + 9 - 10 - (2 + fmgenAs.Operator.IS2EC_SHIFT));
                            sino = op3.eg_out_ + sinetable[pgin & (1024 - 1)];
                            op3.out_ = (sino < 8192) ? cltable[sino] : 0;
                            r = buf[ox[2]] + op3.out_;
                        }
                        buffer[i] = ((((r * this.fmvolume) >> 14) * this.amplevel) >> 14) / 8192.0;
                    }
                }
            }
            else {
                buffer.set(msgr.emptyBuffer.subarray(0, nsamples), start);
            }
        };
        OPM.prototype.Intr = function (f) {
        };
        OPM.prototype.IsOn = function (c) {
            var c4 = this.ch[c & 7];
            switch (c4.algo_) {
                case 0:
                case 1:
                case 2:
                case 3:
                    return (c4.op[3].eg_phase_ !== fmgenAs.EGPhase.off);
                case 4:
                    return (c4.op[1].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[3].eg_phase_ !== fmgenAs.EGPhase.off);
                case 5:
                case 6:
                    return (c4.op[1].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[2].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[3].eg_phase_ !== fmgenAs.EGPhase.off);
                case 7:
                    return (c4.op[0].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[1].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[2].eg_phase_ !== fmgenAs.EGPhase.off) || (c4.op[3].eg_phase_ !== fmgenAs.EGPhase.off);
            }
            return false;
        };
        OPM.s_init = false;
        OPM.amtable = fmgenAs.JaggArray.I2(4, 512);
        OPM.pmtable = fmgenAs.JaggArray.I2(4, 512);
        OPM.sltable = [
            0, 4, 8, 12, 16, 20, 24, 28,
            32, 36, 40, 44, 48, 52, 56, 124,
        ];
        OPM.slottable = [
            0, 2, 1, 3
        ];
        OPM.decaytable1 = fmgenAs.Operator.decaytable1;
        OPM.attacktable = fmgenAs.Operator.attacktable;
        OPM.sinetable = fmgenAs.Operator.sinetable;
        OPM.cltable = fmgenAs.Operator.cltable;
        return OPM;
    })(fmgenAs.Timer);
    fmgenAs.OPM = OPM;
})(fmgenAs || (fmgenAs = {}));
/// <reference path="MOscMod.ts" />
/// <reference path="../fmgenAs/OPM.ts" />
var flmml;
(function (flmml) {
    var OPM = fmgenAs.OPM;
    var MOscOPM = (function (_super) {
        __extends(MOscOPM, _super);
        function MOscOPM() {
            this.m_fm = new OPM();
            this.m_oneSample = new Float32Array(1);
            this.m_velocity = 127;
            this.m_al = 0;
            this.m_tl = new Array(4);
            _super.call(this);
            MOscOPM.boot();
            this.m_fm.Init(MOscOPM.OPM_CLOCK, flmml.MSequencer.SAMPLE_RATE);
            this.m_fm.Reset();
            this.m_fm.SetVolume(MOscOPM.s_comGain);
            this.setOpMask(15);
            this.setWaveNo(0);
        }
        MOscOPM.boot = function () {
            if (this.s_init !== 0)
                return;
            this.s_table[0] = this.defTimbre;
            this.s_init = 1;
        };
        MOscOPM.clearTimber = function () {
            for (var i = 0; i < this.s_table.length; i++) {
                if (i === 0)
                    this.s_table[i] = this.defTimbre;
                else
                    this.s_table[i] = null;
            }
        };
        MOscOPM.trim = function (str) {
            var regexHead = /^[,]*/m;
            var regexFoot = /[,]*$/m;
            return str.replace(regexHead, '').replace(regexFoot, '');
        };
        MOscOPM.setTimber = function (no, type, s) {
            if (no < 0 || this.MAX_WAVE <= no)
                return;
            s = s.replace(/[,;\s\t\r\n]+/gm, ",");
            s = this.trim(s);
            var a = s.split(",");
            var b = new Array(this.TIMB_SZ_M);
            switch (type) {
                case this.TYPE_OPM:
                    if (a.length < 2 + 11 * 4)
                        return;
                    break;
                case this.TYPE_OPN:
                    if (a.length < 2 + 10 * 4)
                        return;
                    break;
                default: return;
            }
            var i, j, l;
            switch (type) {
                case this.TYPE_OPM:
                    l = Math.min(this.TIMB_SZ_M, a.length);
                    for (i = 0; i < l; i++) {
                        b[i] = a[i] | 0;
                    }
                    for (; i < this.TIMB_SZ_M; i++) {
                        b[i] = this.zeroTimbre[i];
                    }
                    break;
                case this.TYPE_OPN:
                    for (i = 0, j = 0; i < 2; i++, j++) {
                        b[i] = a[j] | 0;
                    }
                    for (; i < 46; i++) {
                        if ((i - 2) % 11 === 9)
                            b[i] = 0;
                        else
                            b[i] = a[j++] | 0;
                    }
                    l = Math.min(this.TIMB_SZ_N, a.length);
                    for (; j < l; i++, j++) {
                        b[i] = a[j] | 0;
                    }
                    for (; i < this.TIMB_SZ_M; i++) {
                        b[i] = this.zeroTimbre[i];
                    }
                    break;
            }
            this.s_table[no] = b;
        };
        MOscOPM.prototype.loadTimbre = function (p) {
            this.SetFBAL(p[1], p[0]);
            var i, s;
            var slottable = MOscOPM.slottable;
            for (i = 2, s = 0; s < 4; s++, i += 11) {
                this.SetDT1ML(slottable[s], p[i + 8], p[i + 7]);
                this.m_tl[s] = p[i + 5];
                this.SetTL(slottable[s], p[i + 5]);
                this.SetKSAR(slottable[s], p[i + 6], p[i + 0]);
                this.SetDRAMS(slottable[s], p[i + 1], p[i + 10]);
                this.SetDT2SR(slottable[s], p[i + 9], p[i + 2]);
                this.SetSLRR(slottable[s], p[i + 4], p[i + 3]);
            }
            this.setVelocity(this.m_velocity);
            this.setOpMask(p[i + 0]);
            this.setWF(p[i + 1]);
            this.setLFRQ(p[i + 2]);
            this.setPMD(p[i + 3]);
            this.setAMD(p[i + 4]);
            this.setPMSAMS(p[i + 5], p[i + 6]);
            this.setNENFRQ(p[i + 7], p[i + 8]);
        };
        MOscOPM.setCommonGain = function (gain) {
            this.s_comGain = gain;
        };
        MOscOPM.prototype.SetFBAL = function (fb, al) {
            var pan = 3;
            this.m_al = al & 7;
            this.m_fm.SetReg(0x20, ((pan & 3) << 6) | ((fb & 7) << 3) | (al & 7));
        };
        MOscOPM.prototype.SetDT1ML = function (slot, DT1, MUL) {
            this.m_fm.SetReg((2 << 5) | ((slot & 3) << 3), ((DT1 & 7) << 4) | (MUL & 15));
        };
        MOscOPM.prototype.SetTL = function (slot, TL) {
            if (TL < 0)
                TL = 0;
            if (TL > 127)
                TL = 127;
            this.m_fm.SetReg((3 << 5) | ((slot & 3) << 3), TL & 0x7F);
        };
        MOscOPM.prototype.SetKSAR = function (slot, KS, AR) {
            this.m_fm.SetReg((4 << 5) | ((slot & 3) << 3), ((KS & 3) << 6) | (AR & 0x1f));
        };
        MOscOPM.prototype.SetDRAMS = function (slot, DR, AMS) {
            this.m_fm.SetReg((5 << 5) | ((slot & 3) << 3), ((AMS & 1) << 7) | (DR & 0x1f));
        };
        MOscOPM.prototype.SetDT2SR = function (slot, DT2, SR) {
            this.m_fm.SetReg((6 << 5) | ((slot & 3) << 3), ((DT2 & 3) << 6) | (SR & 0x1f));
        };
        MOscOPM.prototype.SetSLRR = function (slot, SL, RR) {
            this.m_fm.SetReg((7 << 5) | ((slot & 3) << 3), ((SL & 15) << 4) | (RR & 0x0f));
        };
        MOscOPM.prototype.setPMSAMS = function (PMS, AMS) {
            this.m_fm.SetReg(0x38, ((PMS & 7) << 4) | ((AMS & 3)));
        };
        MOscOPM.prototype.setPMD = function (PMD) {
            this.m_fm.SetReg(0x19, 0x80 | (PMD & 0x7f));
        };
        MOscOPM.prototype.setAMD = function (AMD) {
            this.m_fm.SetReg(0x19, 0x00 | (AMD & 0x7f));
        };
        MOscOPM.prototype.setNENFRQ = function (NE, NFQR) {
            this.m_fm.SetReg(0x0f, ((NE & 1) << 7) | (NFQR & 0x1F));
        };
        MOscOPM.prototype.setLFRQ = function (f) {
            this.m_fm.SetReg(0x18, f & 0xff);
        };
        MOscOPM.prototype.setWF = function (wf) {
            this.m_fm.SetReg(0x1b, wf & 3);
        };
        MOscOPM.prototype.noteOn = function () {
            this.m_fm.SetReg(0x01, 0x02);
            this.m_fm.SetReg(0x01, 0x00);
            this.m_fm.SetReg(0x08, this.m_opMask << 3);
        };
        MOscOPM.prototype.noteOff = function () {
            this.m_fm.SetReg(0x08, 0x00);
        };
        MOscOPM.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscOPM.MAX_WAVE)
                waveNo = MOscOPM.MAX_WAVE - 1;
            if (MOscOPM.s_table[waveNo] == null)
                waveNo = 0;
            this.m_fm.SetVolume(MOscOPM.s_comGain);
            this.loadTimbre(MOscOPM.s_table[waveNo]);
        };
        MOscOPM.prototype.setNoteNo = function (noteNo) {
            this.noteOn();
        };
        MOscOPM.prototype.setOpMask = function (mask) {
            this.m_opMask = mask & 0xF;
        };
        MOscOPM.prototype.setVelocity = function (vel) {
            this.m_velocity = vel;
            var al = this.m_al;
            var tl = this.m_tl;
            var carrierop = MOscOPM.carrierop[al];
            var slottable = MOscOPM.slottable;
            this.SetTL(slottable[0], tl[0] + (carrierop & 0x08 ? 127 - vel : 0));
            this.SetTL(slottable[1], tl[1] + (carrierop & 0x10 ? 127 - vel : 0));
            this.SetTL(slottable[2], tl[2] + (carrierop & 0x20 ? 127 - vel : 0));
            this.SetTL(slottable[3], tl[3] + (carrierop & 0x40 ? 127 - vel : 0));
        };
        MOscOPM.prototype.setExpression = function (ex) {
            this.m_fm.SetExpression(ex);
        };
        MOscOPM.prototype.setFrequency = function (frequency) {
            if (this.m_frequency === frequency) {
                return;
            }
            _super.prototype.setFrequency.call(this, frequency);
            var n = 1200.0 * Math.log(frequency / 440.0) * Math.LOG2E + 5700.0 + MOscOPM.OPM_RATIO + 0.5 | 0;
            var note = n / 100 | 0;
            var cent = n % 100;
            var kf = 64.0 * cent / 100.0 + 0.5 | 0;
            var kc = (((note - 1) / 12) << 4) | MOscOPM.kctable[(note + 1200) % 12];
            this.m_fm.SetReg(0x30, kf << 2);
            this.m_fm.SetReg(0x28, kc);
        };
        MOscOPM.prototype.getNextSample = function () {
            this.m_fm.Mix(this.m_oneSample, 0, 1);
            return this.m_oneSample[0];
        };
        MOscOPM.prototype.getNextSampleOfs = function (ofs) {
            this.m_fm.Mix(this.m_oneSample, 0, 1);
            return this.m_oneSample[0];
        };
        MOscOPM.prototype.getSamples = function (samples, start, end) {
            this.m_fm.Mix(samples, start, end - start);
        };
        MOscOPM.prototype.IsPlaying = function () {
            return this.m_fm.IsOn(0);
        };
        MOscOPM.MAX_WAVE = 128;
        MOscOPM.OPM_CLOCK = 3580000;
        MOscOPM.OPM_RATIO = 0;
        MOscOPM.TIMB_SZ_M = 55;
        MOscOPM.TIMB_SZ_N = 51;
        MOscOPM.TYPE_OPM = 0;
        MOscOPM.TYPE_OPN = 1;
        MOscOPM.s_init = 0;
        MOscOPM.s_table = new Array(MOscOPM.MAX_WAVE);
        MOscOPM.s_comGain = 14.25;
        MOscOPM.kctable = [
            0xE, 0x0, 0x1, 0x2, 0x4, 0x5, 0x6, 0x8, 0x9, 0xA, 0xC, 0xD,
        ];
        MOscOPM.slottable = [
            0, 2, 1, 3
        ];
        MOscOPM.carrierop = [
            0x40,
            0x40,
            0x40,
            0x40,
            0x40 | 0x10,
            0x40 | 0x20 | 0x10,
            0x40 | 0x20 | 0x10,
            0x40 | 0x20 | 0x10 | 0x08
        ];
        MOscOPM.defTimbre = [
            4, 5,
            31, 5, 0, 0, 0, 23, 1, 1, 3, 0, 0,
            20, 10, 3, 7, 8, 0, 1, 1, 3, 0, 0,
            31, 3, 0, 0, 0, 25, 1, 1, 7, 0, 0,
            31, 12, 3, 7, 10, 2, 1, 1, 7, 0, 0,
            15,
            0, 0, 0, 0,
            0, 0,
            0, 0
        ];
        MOscOPM.zeroTimbre = [
            0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            15,
            0, 0, 0, 0,
            0, 0,
            0, 0
        ];
        return MOscOPM;
    })(flmml.MOscMod);
    flmml.MOscOPM = MOscOPM;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscPulse = (function (_super) {
        __extends(MOscPulse, _super);
        function MOscPulse() {
            MOscPulse.boot();
            _super.call(this);
            this.setPWM(0.5);
            this.setMIX(0);
        }
        MOscPulse.boot = function () {
        };
        MOscPulse.prototype.getNextSample = function () {
            var val = (this.m_phase < this.m_pwm) ? 1.0 : (this.m_mix ? this.m_modNoise.getNextSample() : -1.0);
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
            return val;
        };
        MOscPulse.prototype.getNextSampleOfs = function (ofs) {
            var val = (((this.m_phase + ofs) & MOscPulse.PHASE_MSK) < this.m_pwm) ? 1.0 : (this.m_mix ? this.m_modNoise.getNextSampleOfs(ofs) : -1.0);
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
            return val;
        };
        MOscPulse.prototype.getSamples = function (samples, start, end) {
            var i;
            if (this.m_mix) {
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
            else {
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
        };
        MOscPulse.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            if (this.m_mix) {
                for (i = start; i < end; i++) {
                    if (syncin[i])
                        this.resetPhase();
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
            else {
                for (i = start; i < end; i++) {
                    if (syncin[i])
                        this.resetPhase();
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase = (this.m_phase + this.m_freqShift) & MOscPulse.PHASE_MSK;
                }
            }
        };
        MOscPulse.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            if (this.m_mix) {
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : this.m_modNoise.getNextSample();
                    this.m_phase += this.m_freqShift;
                    syncout[i] = (this.m_phase > MOscPulse.PHASE_MSK);
                    this.m_phase &= MOscPulse.PHASE_MSK;
                }
            }
            else {
                for (i = start; i < end; i++) {
                    samples[i] = (this.m_phase < this.m_pwm) ? 1.0 : -1.0;
                    this.m_phase += this.m_freqShift;
                    syncout[i] = (this.m_phase > MOscPulse.PHASE_MSK);
                    this.m_phase &= MOscPulse.PHASE_MSK;
                }
            }
        };
        MOscPulse.prototype.setPWM = function (pwm) {
            this.m_pwm = pwm * MOscPulse.PHASE_LEN;
        };
        MOscPulse.prototype.setMIX = function (mix) {
            this.m_mix = mix;
        };
        MOscPulse.prototype.setNoise = function (noise) {
            this.m_modNoise = noise;
        };
        return MOscPulse;
    })(flmml.MOscMod);
    flmml.MOscPulse = MOscPulse;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscSaw = (function (_super) {
        __extends(MOscSaw, _super);
        function MOscSaw() {
            MOscSaw.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscSaw.boot = function () {
            if (this.s_init)
                return;
            var d0 = 1.0 / this.TABLE_LEN;
            var p0;
            var i;
            this.s_table = new Array(this.MAX_WAVE);
            for (i = 0; i < this.MAX_WAVE; i++) {
                this.s_table[i] = new Array(this.TABLE_LEN);
            }
            for (i = 0, p0 = 0.0; i < this.TABLE_LEN; i++) {
                this.s_table[0][i] = p0 * 2.0 - 1.0;
                this.s_table[1][i] = (p0 < 0.5) ? 2.0 * p0 : 2.0 * p0 - 2.0;
                p0 += d0;
            }
            this.s_init = 1;
        };
        MOscSaw.prototype.getNextSample = function () {
            var val = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            return val;
        };
        MOscSaw.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscSaw.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscSaw.PHASE_MSK) >> MOscSaw.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            return val;
        };
        MOscSaw.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            }
        };
        MOscSaw.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSaw.PHASE_MSK;
            }
        };
        MOscSaw.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscSaw.s_table[this.m_waveNo][this.m_phase >> MOscSaw.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscSaw.PHASE_MSK);
                this.m_phase &= MOscSaw.PHASE_MSK;
            }
        };
        MOscSaw.prototype.setWaveNo = function (waveNo) {
            this.m_waveNo = Math.min(waveNo, MOscSaw.MAX_WAVE - 1);
        };
        MOscSaw.MAX_WAVE = 2;
        MOscSaw.s_init = 0;
        return MOscSaw;
    })(flmml.MOscMod);
    flmml.MOscSaw = MOscSaw;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscSine = (function (_super) {
        __extends(MOscSine, _super);
        function MOscSine() {
            MOscSine.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        ;
        MOscSine.boot = function () {
            if (this.s_init)
                return;
            var d0 = 2.0 * Math.PI / this.TABLE_LEN;
            var p0;
            var i;
            for (i = 0; i < this.MAX_WAVE; i++) {
                this.s_table[i] = new Array(this.TABLE_LEN);
            }
            for (i = 0, p0 = 0.0; i < this.TABLE_LEN; i++) {
                this.s_table[0][i] = Math.sin(p0);
                this.s_table[1][i] = Math.max(0.0, this.s_table[0][i]);
                this.s_table[2][i] = (this.s_table[0][i] >= 0.0) ? this.s_table[0][i] : this.s_table[0][i] * -1.0;
                p0 += d0;
            }
            this.s_init = 1;
        };
        MOscSine.prototype.getNextSample = function () {
            var val = MOscSine.s_table[this.m_waveNo][this.m_phase >> MOscSine.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            return val;
        };
        MOscSine.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscSine.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscSine.PHASE_MSK) >> MOscSine.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            return val;
        };
        MOscSine.prototype.getSamples = function (samples, start, end) {
            var i;
            var tbl = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            }
        };
        MOscSine.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            var tbl = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscSine.PHASE_MSK;
            }
        };
        MOscSine.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            var tbl = MOscSine.s_table[this.m_waveNo];
            for (i = start; i < end; i++) {
                samples[i] = tbl[this.m_phase >> MOscSine.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscSine.PHASE_MSK);
                this.m_phase &= MOscSine.PHASE_MSK;
            }
        };
        MOscSine.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscSine.MAX_WAVE)
                waveNo = MOscSine.MAX_WAVE - 1;
            if (!MOscSine.s_table[waveNo])
                waveNo = 0;
            this.m_waveNo = waveNo;
        };
        MOscSine.MAX_WAVE = 3;
        MOscSine.s_init = 0;
        MOscSine.s_table = new Array(MOscSine.MAX_WAVE);
        return MOscSine;
    })(flmml.MOscMod);
    flmml.MOscSine = MOscSine;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscTriangle = (function (_super) {
        __extends(MOscTriangle, _super);
        function MOscTriangle() {
            MOscTriangle.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscTriangle.boot = function () {
            if (this.s_init)
                return;
            var d0 = 1.0 / this.TABLE_LEN;
            var p0;
            var i;
            this.s_table = new Array(this.MAX_WAVE);
            for (i = 0; i < this.MAX_WAVE; i++) {
                this.s_table[i] = new Array(this.TABLE_LEN);
            }
            for (i = 0, p0 = 0.0; i < this.TABLE_LEN; i++) {
                this.s_table[0][i] = (p0 < 0.50) ? (1.0 - 4.0 * p0) : (1.0 - 4.0 * (1.0 - p0));
                this.s_table[1][i] = (p0 < 0.25) ? (0.0 - 4.0 * p0) : ((p0 < 0.75) ? (-2.0 + 4.0 * p0) : (4.0 - 4.0 * p0));
                p0 += d0;
            }
            this.s_init = 1;
        };
        MOscTriangle.prototype.getNextSample = function () {
            var val = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            return val;
        };
        MOscTriangle.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscTriangle.s_table[this.m_waveNo][((this.m_phase + ofs) & MOscTriangle.PHASE_MSK) >> MOscTriangle.PHASE_SFT];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            return val;
        };
        MOscTriangle.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            }
        };
        MOscTriangle.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscTriangle.PHASE_MSK;
            }
        };
        MOscTriangle.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscTriangle.s_table[this.m_waveNo][this.m_phase >> MOscTriangle.PHASE_SFT];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscTriangle.PHASE_MSK);
                this.m_phase &= MOscTriangle.PHASE_MSK;
            }
        };
        MOscTriangle.prototype.setWaveNo = function (waveNo) {
            this.m_waveNo = Math.min(waveNo, MOscTriangle.MAX_WAVE - 1);
        };
        MOscTriangle.MAX_WAVE = 2;
        MOscTriangle.s_init = 0;
        return MOscTriangle;
    })(flmml.MOscMod);
    flmml.MOscTriangle = MOscTriangle;
})(flmml || (flmml = {}));
/// <reference path="MOscMod.ts" />
var flmml;
(function (flmml) {
    var MOscWave = (function (_super) {
        __extends(MOscWave, _super);
        function MOscWave() {
            MOscWave.boot();
            _super.call(this);
            this.setWaveNo(0);
        }
        MOscWave.boot = function () {
            if (this.s_init)
                return;
            this.s_table = new Array(this.MAX_WAVE);
            this.s_length = new Array(this.MAX_WAVE);
            this.setWave(0, "00112233445566778899AABBCCDDEEFFFFEEDDCCBBAA99887766554433221100");
            this.s_init = 1;
        };
        MOscWave.setWave = function (waveNo, wave) {
            this.s_length[waveNo] = 0;
            this.s_table[waveNo] = new Array(wave.length / 2 | 0);
            this.s_table[waveNo][0] = 0;
            for (var i = 0, j = 0, val = 0; i < this.MAX_LENGTH && i < wave.length; i++, j++) {
                var code = wave.charCodeAt(i);
                if (48 <= code && code < 58) {
                    code -= 48;
                }
                else if (97 <= code && code < 103) {
                    code -= 97 - 10;
                }
                else {
                    code = 0;
                }
                if (j & 1) {
                    val += code;
                    this.s_table[waveNo][this.s_length[waveNo]] = (Number(val) - 127.5) / 127.5;
                    this.s_length[waveNo]++;
                }
                else {
                    val = code << 4;
                }
            }
            if (this.s_length[waveNo] === 0)
                this.s_length[waveNo] = 1;
            this.s_length[waveNo] = (this.PHASE_MSK + 1) / this.s_length[waveNo];
        };
        MOscWave.prototype.setWaveNo = function (waveNo) {
            if (waveNo >= MOscWave.MAX_WAVE)
                waveNo = MOscWave.MAX_WAVE - 1;
            if (!MOscWave.s_table[waveNo])
                waveNo = 0;
            this.m_waveNo = waveNo;
        };
        MOscWave.prototype.getNextSample = function () {
            var val = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            return val;
        };
        MOscWave.prototype.getNextSampleOfs = function (ofs) {
            var val = MOscWave.s_table[this.m_waveNo][Math.floor(((this.m_phase + ofs) & MOscWave.PHASE_MSK) / MOscWave.s_length[this.m_waveNo])];
            this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            return val;
        };
        MOscWave.prototype.getSamples = function (samples, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            }
        };
        MOscWave.prototype.getSamplesWithSyncIn = function (samples, syncin, start, end) {
            var i;
            for (i = start; i < end; i++) {
                if (syncin[i]) {
                    this.resetPhase();
                }
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase = (this.m_phase + this.m_freqShift) & MOscWave.PHASE_MSK;
            }
        };
        MOscWave.prototype.getSamplesWithSyncOut = function (samples, syncout, start, end) {
            var i;
            for (i = start; i < end; i++) {
                samples[i] = MOscWave.s_table[this.m_waveNo][Math.floor(this.m_phase / MOscWave.s_length[this.m_waveNo])];
                this.m_phase += this.m_freqShift;
                syncout[i] = (this.m_phase > MOscWave.PHASE_MSK);
                this.m_phase &= MOscWave.PHASE_MSK;
            }
        };
        MOscWave.MAX_WAVE = 32;
        MOscWave.MAX_LENGTH = 2048;
        MOscWave.s_init = 0;
        return MOscWave;
    })(flmml.MOscMod);
    flmml.MOscWave = MOscWave;
})(flmml || (flmml = {}));
/// <reference path="IChannel.ts" />
var flmml;
(function (flmml) {
    var MPolyChannel = (function () {
        function MPolyChannel(voiceLimit) {
            this.m_voices = new Array(voiceLimit);
            for (var i = 0; i < this.m_voices.length; i++) {
                this.m_voices[i] = new flmml.MChannel();
            }
            this.m_form = flmml.MOscillator.FC_PULSE;
            this.m_subform = 0;
            this.m_voiceId = 0;
            this.m_volMode = 0;
            this.m_voiceLimit = voiceLimit;
            this.m_lastVoice = null;
            this.m_voiceLen = this.m_voices.length;
        }
        MPolyChannel.prototype.setExpression = function (ex) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setExpression(ex);
        };
        MPolyChannel.prototype.setVelocity = function (velocity) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setVelocity(velocity);
        };
        MPolyChannel.prototype.setNoteNo = function (noteNo, tie) {
            if (tie === void 0) { tie = true; }
            if (this.m_lastVoice !== null && this.m_lastVoice.isPlaying()) {
                this.m_lastVoice.setNoteNo(noteNo, tie);
            }
        };
        MPolyChannel.prototype.setDetune = function (detune) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setDetune(detune);
        };
        MPolyChannel.prototype.getVoiceCount = function () {
            var i;
            var c = 0;
            for (i = 0; i < this.m_voiceLen; i++) {
                c += this.m_voices[i].getVoiceCount();
            }
            return c;
        };
        MPolyChannel.prototype.noteOn = function (noteNo, velocity) {
            var i;
            var vo = null;
            if (this.getVoiceCount() <= this.m_voiceLimit) {
                for (i = 0; i < this.m_voiceLen; i++) {
                    if (this.m_voices[i].isPlaying() === false) {
                        vo = this.m_voices[i];
                        break;
                    }
                }
            }
            if (vo == null) {
                var minId = Number.MAX_VALUE;
                for (i = 0; i < this.m_voiceLen; i++) {
                    if (minId > this.m_voices[i].getId()) {
                        minId = this.m_voices[i].getId();
                        vo = this.m_voices[i];
                    }
                }
            }
            vo.setForm(this.m_form, this.m_subform);
            vo.setVolMode(this.m_volMode);
            vo.noteOnWidthId(noteNo, velocity, this.m_voiceId++);
            this.m_lastVoice = vo;
        };
        MPolyChannel.prototype.noteOff = function (noteNo) {
            for (var i = 0; i < this.m_voiceLen; i++) {
                if (this.m_voices[i].getNoteNo() === noteNo) {
                    this.m_voices[i].noteOff(noteNo);
                }
            }
        };
        MPolyChannel.prototype.setSoundOff = function () {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setSoundOff();
        };
        MPolyChannel.prototype.close = function () {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].close();
        };
        MPolyChannel.prototype.setNoiseFreq = function (frequency) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setNoiseFreq(frequency);
        };
        MPolyChannel.prototype.setForm = function (form, subform) {
            this.m_form = form;
            this.m_subform = subform;
        };
        MPolyChannel.prototype.setEnvelope1Atk = function (attack) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope1Atk(attack);
        };
        MPolyChannel.prototype.setEnvelope1Point = function (time, level) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope1Point(time, level);
        };
        MPolyChannel.prototype.setEnvelope1Rel = function (release) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope1Rel(release);
        };
        MPolyChannel.prototype.setEnvelope2Atk = function (attack) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope2Atk(attack);
        };
        MPolyChannel.prototype.setEnvelope2Point = function (time, level) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope2Point(time, level);
        };
        MPolyChannel.prototype.setEnvelope2Rel = function (release) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setEnvelope2Rel(release);
        };
        MPolyChannel.prototype.setPWM = function (pwm) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setPWM(pwm);
        };
        MPolyChannel.prototype.setPan = function (pan) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setPan(pan);
        };
        MPolyChannel.prototype.setFormant = function (vowel) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setFormant(vowel);
        };
        MPolyChannel.prototype.setLFOFMSF = function (form, subform) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLFOFMSF(form, subform);
        };
        MPolyChannel.prototype.setLFODPWD = function (depth, freq) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLFODPWD(depth, freq);
        };
        MPolyChannel.prototype.setLFODLTM = function (delay, time) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLFODLTM(delay, time);
        };
        MPolyChannel.prototype.setLFOTarget = function (target) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLFOTarget(target);
        };
        MPolyChannel.prototype.setLpfSwtAmt = function (swt, amt) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLpfSwtAmt(swt, amt);
        };
        MPolyChannel.prototype.setLpfFrqRes = function (frq, res) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setLpfFrqRes(frq, res);
        };
        MPolyChannel.prototype.setVolMode = function (m) {
            this.m_volMode = m;
        };
        MPolyChannel.prototype.setInput = function (ii, p) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setInput(ii, p);
        };
        MPolyChannel.prototype.setOutput = function (oo, p) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setOutput(oo, p);
        };
        MPolyChannel.prototype.setRing = function (s, p) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setRing(s, p);
        };
        MPolyChannel.prototype.setSync = function (m, p) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setSync(m, p);
        };
        MPolyChannel.prototype.setPortamento = function (depth, len) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setPortamento(depth, len);
        };
        MPolyChannel.prototype.setMidiPort = function (mode) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setMidiPort(mode);
        };
        MPolyChannel.prototype.setMidiPortRate = function (rate) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setMidiPortRate(rate);
        };
        MPolyChannel.prototype.setPortBase = function (portBase) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setPortBase(portBase);
        };
        MPolyChannel.prototype.setVoiceLimit = function (voiceLimit) {
            this.m_voiceLimit = Math.max(1, Math.min(voiceLimit, this.m_voiceLen));
        };
        MPolyChannel.prototype.setHwLfo = function (data) {
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].setHwLfo(data);
        };
        MPolyChannel.prototype.reset = function () {
            this.m_form = 0;
            this.m_subform = 0;
            this.m_voiceId = 0;
            this.m_volMode = 0;
            for (var i = 0; i < this.m_voiceLen; i++)
                this.m_voices[i].reset();
        };
        MPolyChannel.prototype.getSamples = function (samplesSt, max, start, delta) {
            var slave = false;
            for (var i = 0; i < this.m_voiceLen; i++) {
                if (this.m_voices[i].isPlaying()) {
                    this.m_voices[i].setSlaveVoice(slave);
                    this.m_voices[i].getSamples(samplesSt, max, start, delta);
                    slave = true;
                }
            }
            if (slave === false) {
                this.m_voices[0].clearOutPipe(max, start, delta);
            }
        };
        return MPolyChannel;
    })();
    flmml.MPolyChannel = MPolyChannel;
})(flmml || (flmml = {}));
// 定数化したので未使用
var flmml;
(function (flmml) {
    var MTrack = (function () {
        function MTrack() {
            this.m_isEnd = 0;
            this.m_ch = new flmml.MChannel();
            this.m_needle = 0.0;
            this.m_polyFound = false;
            this.playTempo(MTrack.DEFAULT_BPM);
            this.m_volume = 100;
            this.recGate(15.0 / 16.0);
            this.recGate2(0);
            this.m_events = new Array();
            this.m_pointer = 0;
            this.m_delta = 0;
            this.m_globalTick = 0;
            this.m_lfoWidth = 0.0;
            this.m_totalMSec = 0;
            this.m_chordBegin = 0;
            this.m_chordEnd = 0;
            this.m_chordMode = false;
        }
        MTrack.prototype.getNumEvents = function () {
            return this.m_events.length;
        };
        MTrack.prototype.onSampleData = function (samplesSt, start, end, isTempoTrack) {
            if (isTempoTrack === void 0) { isTempoTrack = false; }
            if (this.isEnd())
                return;
            for (var i = start; i < end;) {
                var exec = 0;
                var eLen = this.m_events.length;
                var e;
                var delta;
                do {
                    exec = 0;
                    if (this.m_pointer < eLen) {
                        e = this.m_events[this.m_pointer];
                        delta = e.getDelta() * this.m_spt;
                        if (this.m_needle >= delta) {
                            exec = 1;
                            switch (e.getStatus()) {
                                case 2:
                                    this.m_ch.noteOn(e.getNoteNo(), e.getVelocity());
                                    break;
                                case 3:
                                    this.m_ch.noteOff(e.getNoteNo());
                                    break;
                                case 6:
                                    this.m_ch.setNoteNo(e.getNoteNo());
                                    break;
                                case 5:
                                    break;
                                case 4:
                                    this.playTempo(e.getTempo());
                                    break;
                                case 7:
                                    this.m_ch.setForm(e.getForm(), e.getSubForm());
                                    break;
                                case 8:
                                    this.m_ch.setEnvelope1Atk(e.getEnvelopeA());
                                    break;
                                case 9:
                                    this.m_ch.setEnvelope1Point(e.getEnvelopeT(), e.getEnvelopeL());
                                    break;
                                case 10:
                                    this.m_ch.setEnvelope1Rel(e.getEnvelopeR());
                                    break;
                                case 24:
                                    this.m_ch.setEnvelope2Atk(e.getEnvelopeA());
                                    break;
                                case 25:
                                    this.m_ch.setEnvelope2Point(e.getEnvelopeT(), e.getEnvelopeL());
                                    break;
                                case 26:
                                    this.m_ch.setEnvelope2Rel(e.getEnvelopeR());
                                    break;
                                case 11:
                                    this.m_ch.setNoiseFreq(e.getNoiseFreq());
                                    break;
                                case 12:
                                    this.m_ch.setPWM(e.getPWM());
                                    break;
                                case 13:
                                    this.m_ch.setPan(e.getPan());
                                    break;
                                case 14:
                                    this.m_ch.setFormant(e.getVowel());
                                    break;
                                case 15:
                                    this.m_ch.setDetune(e.getDetune());
                                    break;
                                case 16:
                                    this.m_ch.setLFOFMSF(e.getLFOForm(), e.getLFOSubForm());
                                    break;
                                case 17:
                                    this.m_lfoWidth = e.getLFOWidth() * this.m_spt;
                                    this.m_ch.setLFODPWD(e.getLFODepth(), flmml.MSequencer.SAMPLE_RATE / this.m_lfoWidth);
                                    break;
                                case 18:
                                    this.m_ch.setLFODLTM(e.getLFODelay() * this.m_spt, e.getLFOTime() * this.m_lfoWidth);
                                    break;
                                case 19:
                                    this.m_ch.setLFOTarget(e.getLFOTarget());
                                    break;
                                case 20:
                                    this.m_ch.setLpfSwtAmt(e.getLPFSwt(), e.getLPFAmt());
                                    break;
                                case 21:
                                    this.m_ch.setLpfFrqRes(e.getLPFFrq(), e.getLPFRes());
                                    break;
                                case 23:
                                    this.m_ch.setVolMode(e.getVolMode());
                                    break;
                                case 27:
                                    this.m_ch.setInput(e.getInputSens(), e.getInputPipe());
                                    break;
                                case 28:
                                    this.m_ch.setOutput(e.getOutputMode(), e.getOutputPipe());
                                    break;
                                case 29:
                                    this.m_ch.setExpression(e.getExpression());
                                    break;
                                case 30:
                                    this.m_ch.setRing(e.getRingSens(), e.getRingInput());
                                    break;
                                case 31:
                                    this.m_ch.setSync(e.getSyncMode(), e.getSyncPipe());
                                    break;
                                case 32:
                                    this.m_ch.setPortamento(e.getPorDepth() * 100, e.getPorLen() * this.m_spt);
                                    break;
                                case 33:
                                    this.m_ch.setMidiPort(e.getMidiPort());
                                    break;
                                case 34:
                                    var rate = e.getMidiPortRate();
                                    this.m_ch.setMidiPortRate((8 - (rate * 7.99 / 128)) / rate);
                                    break;
                                case 35:
                                    this.m_ch.setPortBase(e.getPortBase() * 100);
                                    break;
                                case 36:
                                    this.m_ch.setVoiceLimit(e.getVoiceCount());
                                    break;
                                case 39:
                                    this.m_ch.setHwLfo(e.getHwLfoData());
                                    break;
                                case 37:
                                    this.m_ch.setSoundOff();
                                    break;
                                case 38:
                                    this.m_ch.reset();
                                    break;
                                case 22:
                                    this.m_ch.close();
                                    break;
                                case 0:
                                    this.m_isEnd = 1;
                                    break;
                                case 1:
                                    break;
                                default:
                                    break;
                            }
                            this.m_needle -= delta;
                            this.m_pointer++;
                        }
                    }
                } while (exec);
                var di;
                if (this.m_pointer < eLen) {
                    e = this.m_events[this.m_pointer];
                    delta = e.getDelta() * this.m_spt;
                    di = Math.ceil(delta - this.m_needle);
                    if (i + di >= end)
                        di = end - i;
                    this.m_needle += di;
                    if (!isTempoTrack)
                        this.m_ch.getSamples(samplesSt, end, i, di);
                    i += di;
                }
                else {
                    break;
                }
            }
        };
        MTrack.prototype.seek = function (delta) {
            this.m_delta += delta;
            this.m_globalTick += delta;
            this.m_chordEnd = Math.max(this.m_chordEnd, this.m_globalTick);
        };
        MTrack.prototype.seekChordStart = function () {
            this.m_globalTick = this.m_chordBegin;
        };
        MTrack.prototype.recDelta = function (e) {
            e.setDelta(this.m_delta);
            this.m_delta = 0;
        };
        MTrack.prototype.recNote = function (noteNo, len, vel, keyon, keyoff) {
            if (keyon === void 0) { keyon = 1; }
            if (keyoff === void 0) { keyoff = 1; }
            var e0 = this.makeEvent();
            if (keyon) {
                e0.setNoteOn(noteNo, vel);
            }
            else {
                e0.setNote(noteNo);
            }
            this.pushEvent(e0);
            if (keyoff) {
                var gate;
                gate = ((len * this.m_gate) | 0) - this.m_gate2;
                if (gate <= 0)
                    gate = 0;
                this.seek(gate);
                this.recNoteOff(noteNo, vel);
                this.seek(len - gate);
                if (this.m_chordMode) {
                    this.seekChordStart();
                }
            }
            else {
                this.seek(len);
            }
        };
        MTrack.prototype.recNoteOff = function (noteNo, vel) {
            var e = this.makeEvent();
            e.setNoteOff(noteNo, vel);
            this.pushEvent(e);
        };
        MTrack.prototype.recRest = function (len) {
            this.seek(len);
            if (this.m_chordMode) {
                this.m_chordBegin += len;
            }
        };
        MTrack.prototype.recChordStart = function () {
            if (this.m_chordMode === false) {
                this.m_chordMode = true;
                this.m_chordBegin = this.m_globalTick;
            }
        };
        MTrack.prototype.recChordEnd = function () {
            if (this.m_chordMode) {
                if (this.m_events.length > 0) {
                    this.m_delta = this.m_chordEnd - this.m_events[this.m_events.length - 1].getTick();
                }
                else {
                    this.m_delta = 0;
                }
                this.m_globalTick = this.m_chordEnd;
                this.m_chordMode = false;
            }
        };
        MTrack.prototype.recRestMSec = function (msec) {
            var len = (msec * flmml.MSequencer.SAMPLE_RATE / (this.m_spt * 1000)) | 0;
            this.seek(len);
        };
        MTrack.prototype.recVolume = function (vol) {
            var e = this.makeEvent();
            e.setVolume(vol);
            this.pushEvent(e);
        };
        MTrack.prototype.recGlobal = function (globalTick, e) {
            var n = this.m_events.length;
            var preGlobalTick = 0;
            for (var i = 0; i < n; i++) {
                var en = this.m_events[i];
                var nextTick = preGlobalTick + en.getDelta();
                if (nextTick > globalTick || (nextTick === globalTick && en.getStatus() !== 4)) {
                    en.setDelta(nextTick - globalTick);
                    e.setDelta(globalTick - preGlobalTick);
                    this.m_events.splice(i, 0, e);
                    return;
                }
                preGlobalTick = nextTick;
            }
            e.setDelta(globalTick - preGlobalTick);
            this.m_events.push(e);
        };
        MTrack.prototype.insertEvent = function (e) {
            var n = this.m_events.length;
            var preGlobalTick = 0;
            var globalTick = e.getTick();
            for (var i = 0; i < n; i++) {
                var en = this.m_events[i];
                var nextTick = preGlobalTick + en.getDelta();
                if (nextTick > globalTick) {
                    en.setDelta(nextTick - globalTick);
                    e.setDelta(globalTick - preGlobalTick);
                    this.m_events.splice(i, 0, e);
                    return;
                }
                preGlobalTick = nextTick;
            }
            e.setDelta(globalTick - preGlobalTick);
            this.m_events.push(e);
        };
        MTrack.prototype.makeEvent = function () {
            var e = new flmml.MEvent(this.m_globalTick);
            e.setDelta(this.m_delta);
            this.m_delta = 0;
            return e;
        };
        MTrack.prototype.pushEvent = function (e) {
            if (this.m_chordMode === false) {
                this.m_events.push(e);
            }
            else {
                this.insertEvent(e);
            }
        };
        MTrack.prototype.recTempo = function (globalTick, tempo) {
            var e = new flmml.MEvent(globalTick);
            e.setTempo(tempo);
            this.recGlobal(globalTick, e);
        };
        MTrack.prototype.recEOT = function () {
            var e = this.makeEvent();
            e.setEOT();
            this.pushEvent(e);
        };
        MTrack.prototype.recGate = function (gate) {
            this.m_gate = gate;
        };
        MTrack.prototype.recGate2 = function (gate2) {
            if (gate2 < 0)
                gate2 = 0;
            this.m_gate2 = gate2;
        };
        MTrack.prototype.recForm = function (form, sub) {
            var e = this.makeEvent();
            e.setForm(form, sub);
            this.pushEvent(e);
        };
        MTrack.prototype.recEnvelope = function (env, attack, times, levels, release) {
            var e = this.makeEvent();
            if (env === 1)
                e.setEnvelope1Atk(attack);
            else
                e.setEnvelope2Atk(attack);
            this.pushEvent(e);
            for (var i = 0, pts = times.length; i < pts; i++) {
                e = this.makeEvent();
                if (env === 1)
                    e.setEnvelope1Point(times[i], levels[i]);
                else
                    e.setEnvelope2Point(times[i], levels[i]);
                this.pushEvent(e);
            }
            e = this.makeEvent();
            if (env === 1)
                e.setEnvelope1Rel(release);
            else
                e.setEnvelope2Rel(release);
            this.pushEvent(e);
        };
        MTrack.prototype.recNoiseFreq = function (freq) {
            var e = this.makeEvent();
            e.setNoiseFreq(freq);
            this.pushEvent(e);
        };
        MTrack.prototype.recPWM = function (pwm) {
            var e = this.makeEvent();
            e.setPWM(pwm);
            this.pushEvent(e);
        };
        MTrack.prototype.recPan = function (pan) {
            var e = this.makeEvent();
            e.setPan(pan);
            this.pushEvent(e);
        };
        MTrack.prototype.recFormant = function (vowel) {
            var e = this.makeEvent();
            e.setFormant(vowel);
            this.pushEvent(e);
        };
        MTrack.prototype.recDetune = function (d) {
            var e = this.makeEvent();
            e.setDetune(d);
            this.pushEvent(e);
        };
        MTrack.prototype.recLFO = function (depth, width, form, subform, delay, time, target) {
            var e = this.makeEvent();
            e.setLFOFMSF(form, subform);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLFODPWD(depth, width);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLFODLTM(delay, time);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLFOTarget(target);
            this.pushEvent(e);
        };
        MTrack.prototype.recLPF = function (swt, amt, frq, res) {
            var e = this.makeEvent();
            e.setLPFSWTAMT(swt, amt);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLPFFRQRES(frq, res);
            this.pushEvent(e);
        };
        MTrack.prototype.recVolMode = function (m) {
            var e = this.makeEvent();
            e.setVolMode(m);
            this.pushEvent(e);
        };
        MTrack.prototype.recInput = function (sens, pipe) {
            var e = this.makeEvent();
            e.setInput(sens, pipe);
            this.pushEvent(e);
        };
        MTrack.prototype.recOutput = function (mode, pipe) {
            var e = this.makeEvent();
            e.setOutput(mode, pipe);
            this.pushEvent(e);
        };
        MTrack.prototype.recExpression = function (ex) {
            var e = this.makeEvent();
            e.setExpression(ex);
            this.pushEvent(e);
        };
        MTrack.prototype.recRing = function (sens, pipe) {
            var e = this.makeEvent();
            e.setRing(sens, pipe);
            this.pushEvent(e);
        };
        MTrack.prototype.recSync = function (mode, pipe) {
            var e = this.makeEvent();
            e.setSync(mode, pipe);
            this.pushEvent(e);
        };
        MTrack.prototype.recClose = function () {
            var e = this.makeEvent();
            e.setClose();
            this.pushEvent(e);
        };
        MTrack.prototype.recPortamento = function (depth, len) {
            var e = this.makeEvent();
            e.setPortamento(depth, len);
            this.pushEvent(e);
        };
        MTrack.prototype.recMidiPort = function (mode) {
            var e = this.makeEvent();
            e.setMidiPort(mode);
            this.pushEvent(e);
        };
        MTrack.prototype.recMidiPortRate = function (rate) {
            var e = this.makeEvent();
            e.setMidiPortRate(rate);
            this.pushEvent(e);
        };
        MTrack.prototype.recPortBase = function (base) {
            var e = this.makeEvent();
            e.setPortBase(base);
            this.pushEvent(e);
        };
        MTrack.prototype.recPoly = function (voiceCount) {
            var e = this.makeEvent();
            e.setPoly(voiceCount);
            this.pushEvent(e);
            this.m_polyFound = true;
        };
        MTrack.prototype.recHwLfo = function (w, f, pmd, amd, pms, ams, syn) {
            var e = this.makeEvent();
            e.setHwLfo(w, f, pmd, amd, pms, ams, syn);
            this.pushEvent(e);
        };
        MTrack.prototype.isEnd = function () {
            return this.m_isEnd;
        };
        MTrack.prototype.getRecGlobalTick = function () {
            return this.m_globalTick;
        };
        MTrack.prototype.seekTop = function () {
            this.m_globalTick = 0;
        };
        MTrack.prototype.conduct = function (trackArr) {
            var ni = this.m_events.length;
            var nj = trackArr.length;
            var globalTick = 0;
            var globalSample = 0;
            var spt = this.calcSpt(MTrack.DEFAULT_BPM);
            var i, j;
            var e;
            for (i = 0; i < ni; i++) {
                e = this.m_events[i];
                globalTick += e.getDelta();
                globalSample += e.getDelta() * spt;
                switch (e.getStatus()) {
                    case 4:
                        spt = this.calcSpt(e.getTempo());
                        for (j = MTrack.FIRST_TRACK; j < nj; j++) {
                            trackArr[j].recTempo(globalTick, e.getTempo());
                        }
                        break;
                    default:
                        break;
                }
            }
            var maxGlobalTick = 0;
            for (j = MTrack.FIRST_TRACK; j < nj; j++) {
                if (maxGlobalTick < trackArr[j].getRecGlobalTick())
                    maxGlobalTick = trackArr[j].getRecGlobalTick();
            }
            e = this.makeEvent();
            e.setClose();
            this.recGlobal(maxGlobalTick, e);
            globalSample += (maxGlobalTick - globalTick) * spt;
            this.recRestMSec(3000);
            this.recEOT();
            globalSample += 3 * flmml.MSequencer.SAMPLE_RATE;
            this.m_totalMSec = globalSample * 1000.0 / flmml.MSequencer.SAMPLE_RATE;
        };
        MTrack.prototype.calcSpt = function (bpm) {
            var tps = bpm * 96.0 / 60.0;
            return flmml.MSequencer.SAMPLE_RATE / tps;
        };
        MTrack.prototype.playTempo = function (bpm) {
            this.m_bpm = bpm;
            this.m_spt = this.calcSpt(bpm);
        };
        MTrack.prototype.getTotalMSec = function () {
            return this.m_totalMSec;
        };
        MTrack.prototype.getTotalTimeStr = function () {
            var sec = Math.ceil(this.m_totalMSec / 1000);
            var smin = "0" + Math.floor(sec / 60);
            var ssec = "0" + (sec % 60);
            return smin.substr(smin.length - 2, 2) + ":" + ssec.substr(ssec.length - 2, 2);
        };
        MTrack.prototype.getVoiceCount = function () {
            return this.m_ch.getVoiceCount();
        };
        MTrack.prototype.usingMono = function () {
            this.m_ch = new flmml.MChannel();
        };
        MTrack.prototype.usingPoly = function (maxVoice) {
            this.m_ch = new flmml.MPolyChannel(maxVoice);
        };
        MTrack.prototype.findPoly = function () {
            return this.m_polyFound;
        };
        MTrack.TEMPO_TRACK = 0;
        MTrack.FIRST_TRACK = 1;
        MTrack.DEFAULT_BPM = 120;
        return MTrack;
    })();
    flmml.MTrack = MTrack;
})(flmml || (flmml = {}));
var flmml;
(function (flmml) {
    var MWarning = (function () {
        function MWarning() {
        }
        MWarning.getString = function (warnId, str) {
            return this.s_string[warnId].replace("%s", str);
        };
        MWarning.UNKNOWN_COMMAND = 0;
        MWarning.UNCLOSED_REPEAT = 1;
        MWarning.UNOPENED_COMMENT = 2;
        MWarning.UNCLOSED_COMMENT = 3;
        MWarning.RECURSIVE_MACRO = 4;
        MWarning.UNCLOSED_ARGQUOTE = 5;
        MWarning.UNCLOSED_GROUPNOTES = 6;
        MWarning.UNOPENED_GROUPNOTES = 7;
        MWarning.INVALID_MACRO_NAME = 8;
        MWarning.s_string = [
            "対応していないコマンド '%s' があります。",
            "終わりが見つからない繰り返しがあります。",
            "始まりが見つからないコメントがあります。",
            "終わりが見つからないコメントがあります。",
            "マクロが再帰的に呼び出されています。",
            "マクロ引数指定の \"\" が閉じられていません",
            "終りが見つからない連符があります",
            "始まりが見つからない連符があります",
            "マクロ名に使用できない文字が含まれています。'%s'"
        ];
        return MWarning;
    })();
    flmml.MWarning = MWarning;
})(flmml || (flmml = {}));
// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------
/// <reference path="Operator.ts" />
/// <reference path="JaggArray.ts" />
var fmgenAs;
(function (fmgenAs) {
    var Channel4 = (function () {
        function Channel4() {
            this.buf = new Array(4);
            this.ix = new Array(3);
            this.ox = new Array(3);
            this.op = [
                new fmgenAs.Operator(),
                new fmgenAs.Operator(),
                new fmgenAs.Operator(),
                new fmgenAs.Operator()
            ];
            this.SetAlgorithm(0);
            this.pms = Channel4.pmtable[0][0];
        }
        Channel4.prototype.SetType = function (type) {
            for (var i = 0; i < 4; i++)
                this.op[i].type_ = type;
        };
        Channel4.prototype.SetFB = function (feedback) {
            this.fb = Channel4.fbtable[feedback];
        };
        Channel4.prototype.SetMS = function (ms) {
            this.op[0].SetMS(ms);
            this.op[1].SetMS(ms);
            this.op[2].SetMS(ms);
            this.op[3].SetMS(ms);
        };
        Channel4.prototype.Mute = function (m) {
            for (var i = 0; i < 4; i++)
                this.op[i].Mute(m);
        };
        Channel4.prototype.Refresh = function () {
            for (var i = 0; i < 4; i++)
                this.op[i].Refresh();
        };
        Channel4.prototype.SetChip = function (chip) {
            this.chip_ = chip;
            for (var i = 0; i < 4; i++)
                this.op[i].SetChip(chip);
        };
        Channel4.prototype.Reset = function () {
            this.op[0].Reset();
            this.op[1].Reset();
            this.op[2].Reset();
            this.op[3].Reset();
        };
        Channel4.prototype.Prepare = function () {
            var op = this.op;
            op[0].Prepare();
            op[1].Prepare();
            op[2].Prepare();
            op[3].Prepare();
            this.pms = Channel4.pmtable[op[0].type_][op[0].ms_ & 7];
            var key = (op[0].IsOn() || op[1].IsOn() || op[2].IsOn() || op[3].IsOn()) ? 1 : 0;
            var lfo = (op[0].ms_ & (op[0].amon_ || op[1].amon_ || op[2].amon_ || op[3].amon_ ? 0x37 : 7)) ? 2 : 0;
            return key | lfo;
        };
        Channel4.prototype.SetFNum = function (f) {
            for (var i = 0; i < 4; i++)
                this.op[i].SetFNum(f);
        };
        Channel4.prototype.SetKCKF = function (kc, kf) {
            var oct = 19 - ((kc >> 4) & 7);
            var kcv = Channel4.kctable[kc & 0x0f];
            kcv = ((kcv + 2) / 4 | 0) * 4;
            var dp = kcv * Channel4.kftable[kf & 0x3f];
            dp >>= 16 + 3;
            dp <<= 16 + 3;
            dp >>= oct;
            var bn = (kc >> 2) & 31;
            this.op[0].SetDPBN(dp, bn);
            this.op[1].SetDPBN(dp, bn);
            this.op[2].SetDPBN(dp, bn);
            this.op[3].SetDPBN(dp, bn);
        };
        Channel4.prototype.KeyControl = function (key) {
            var op = this.op;
            if (key & 0x1)
                op[0].KeyOn();
            else
                op[0].KeyOff();
            if (key & 0x2)
                op[1].KeyOn();
            else
                op[1].KeyOff();
            if (key & 0x4)
                op[2].KeyOn();
            else
                op[2].KeyOff();
            if (key & 0x8)
                op[3].KeyOn();
            else
                op[3].KeyOff();
        };
        Channel4.prototype.SetAlgorithm = function (algo) {
            var iotable = Channel4.iotable;
            this.ix[0] = iotable[algo][0];
            this.ox[0] = iotable[algo][1];
            this.ix[1] = iotable[algo][2];
            this.ox[1] = iotable[algo][3];
            this.ix[2] = iotable[algo][4];
            this.ox[2] = iotable[algo][5];
            this.op[0].ResetFB();
            this.algo_ = algo;
        };
        Channel4.prototype.GetAlgorithm = function () {
            return this.algo_;
        };
        Channel4.prototype.Calc = function () {
            var r = 0;
            switch (this.algo_) {
                case 0:
                    this.op[2].Calc(this.op[1].Out());
                    this.op[1].Calc(this.op[0].Out());
                    r = this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 1:
                    this.op[2].Calc(this.op[0].Out() + this.op[1].Out());
                    this.op[1].Calc(0);
                    r = this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 2:
                    this.op[2].Calc(this.op[1].Out());
                    this.op[1].Calc(0);
                    r = this.op[3].Calc(this.op[0].Out() + this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 3:
                    this.op[2].Calc(0);
                    this.op[1].Calc(this.op[0].Out());
                    r = this.op[3].Calc(this.op[1].Out() + this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 4:
                    this.op[2].Calc(0);
                    r = this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(this.op[2].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 5:
                    r = this.op[2].Calc(this.op[0].Out());
                    r += this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(this.op[0].Out());
                    this.op[0].CalcFB(this.fb);
                    break;
                case 6:
                    r = this.op[2].Calc(0);
                    r += this.op[1].Calc(this.op[0].Out());
                    r += this.op[3].Calc(0);
                    this.op[0].CalcFB(this.fb);
                    break;
                case 7:
                    r = this.op[2].Calc(0);
                    r += this.op[1].Calc(0);
                    r += this.op[3].Calc(0);
                    r += this.op[0].CalcFB(this.fb);
                    break;
            }
            return r;
        };
        Channel4.prototype.CalcL = function () {
            this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
            var r = 0;
            switch (this.algo_) {
                case 0:
                    this.op[2].CalcL(this.op[1].Out());
                    this.op[1].CalcL(this.op[0].Out());
                    r = this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 1:
                    this.op[2].CalcL(this.op[0].Out() + this.op[1].Out());
                    this.op[1].CalcL(0);
                    r = this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 2:
                    this.op[2].CalcL(this.op[1].Out());
                    this.op[1].CalcL(0);
                    r = this.op[3].CalcL(this.op[0].Out() + this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 3:
                    this.op[2].CalcL(0);
                    this.op[1].CalcL(this.op[0].Out());
                    r = this.op[3].CalcL(this.op[1].Out() + this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 4:
                    this.op[2].CalcL(0);
                    r = this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(this.op[2].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 5:
                    r = this.op[2].CalcL(this.op[0].Out());
                    r += this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(this.op[0].Out());
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 6:
                    r = this.op[2].CalcL(0);
                    r += this.op[1].CalcL(this.op[0].Out());
                    r += this.op[3].CalcL(0);
                    this.op[0].CalcFBL(this.fb);
                    break;
                case 7:
                    r = this.op[2].CalcL(0);
                    r += this.op[1].CalcL(0);
                    r += this.op[3].CalcL(0);
                    r += this.op[0].CalcFBL(this.fb);
                    break;
            }
            return r;
        };
        Channel4.prototype.CalcN = function (noise) {
            this.buf[1] = this.buf[2] = this.buf[3] = 0;
            this.buf[0] = this.op[0].Out();
            this.op[0].CalcFB(this.fb);
            this.buf[this.ox[0]] += this.op[1].Calc(this.buf[this.ix[0]]);
            this.buf[this.ox[1]] += this.op[2].Calc(this.buf[this.ix[1]]);
            var o = this.op[3].Out();
            this.op[3].CalcN(noise);
            return this.buf[this.ox[2]] + o;
        };
        Channel4.prototype.CalcLN = function (noise) {
            this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
            this.buf[1] = this.buf[2] = this.buf[3] = 0;
            this.buf[0] = this.op[0].Out();
            this.op[0].CalcFBL(this.fb);
            this.buf[this.ox[0]] += this.op[1].CalcL(this.buf[this.ix[0]]);
            this.buf[this.ox[1]] += this.op[2].CalcL(this.buf[this.ix[1]]);
            var o = this.op[3].Out();
            this.op[3].CalcN(noise);
            return this.buf[this.ox[2]] + o;
        };
        Channel4.fbtable = [
            31, 7, 6, 5, 4, 3, 2, 1
        ];
        Channel4.kftable = [
            65536, 65595, 65654, 65713, 65773, 65832, 65891, 65951,
            66010, 66070, 66130, 66189, 66249, 66309, 66369, 66429,
            66489, 66549, 66609, 66669, 66729, 66789, 66850, 66910,
            66971, 67031, 67092, 67152, 67213, 67273, 67334, 67395,
            67456, 67517, 67578, 67639, 67700, 67761, 67822, 67883,
            67945, 68006, 68067, 68129, 68190, 68252, 68314, 68375,
            68437, 68499, 68561, 68623, 68685, 68747, 68809, 68871,
            68933, 68995, 69057, 69120, 69182, 69245, 69307, 69370
        ];
        Channel4.kctable = [
            5197, 5506, 5833, 6180, 6180, 6547, 6937, 7349,
            7349, 7786, 8249, 8740, 8740, 9259, 9810, 10394
        ];
        Channel4.iotable = [
            [0, 1, 1, 2, 2, 3], [1, 0, 0, 1, 1, 2],
            [1, 1, 1, 0, 0, 2], [0, 1, 2, 1, 1, 2],
            [0, 1, 2, 2, 2, 1], [0, 1, 0, 1, 0, 1],
            [0, 1, 2, 1, 2, 1], [1, 0, 1, 0, 1, 0]
        ];
        Channel4.pmtable = (function () {
            var pmtable = fmgenAs.JaggArray.I3(2, 8, 256);
            var i, j;
            var pms = [
                [0, 1 / 360.0, 2 / 360.0, 3 / 360.0, 4 / 360.0, 6 / 360.0, 12 / 360.0, 24 / 360.0],
                [0, 1 / 480.0, 2 / 480.0, 4 / 480.0, 10 / 480.0, 20 / 480.0, 80 / 480.0, 140 / 480.0]
            ];
            for (var type = 0; type < 2; type++) {
                for (i = 0; i < 8; i++) {
                    var pmb = pms[type][i];
                    for (j = 0; j < 256; j++) {
                        var v = Math.pow(2.0, pmb * (2 * j - 256 + 1) / (256 - 1));
                        var w = 0.6 * pmb * Math.sin(2 * j * Math.PI / 256) + 1;
                        pmtable[type][i][j] = (0x10000 * (w - 1)) | 0;
                    }
                }
            }
            return pmtable;
        })();
        return Channel4;
    })();
    fmgenAs.Channel4 = Channel4;
})(fmgenAs || (fmgenAs = {}));
// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------
/// <reference path="JaggArray.ts" />
var fmgenAs;
(function (fmgenAs) {
    var dt2lv = [
        1.0, 1.414, 1.581, 1.732
    ];
    var Chip = (function () {
        function Chip() {
            this.ratio_ = 0;
            this.aml_ = 0;
            this.pml_ = 0;
            this.pmv_ = 0;
            this.multable_ = fmgenAs.JaggArray.I2(4, 16);
        }
        Chip.prototype.Chip = function () {
            this.MakeTable();
        };
        Chip.prototype.SetRatio = function (ratio) {
            if (this.ratio_ !== ratio) {
                this.ratio_ = ratio;
                this.MakeTable();
            }
        };
        Chip.prototype.SetAML = function (l) {
            this.aml_ = l & (256 - 1);
        };
        Chip.prototype.SetPML = function (l) {
            this.pml_ = l & (256 - 1);
        };
        Chip.prototype.SetPMV = function (pmv) {
            this.pmv_ = pmv;
        };
        Chip.prototype.GetMulValue = function (dt2, mul) {
            return this.multable_[dt2][mul];
        };
        Chip.prototype.GetAML = function () {
            return this.aml_;
        };
        Chip.prototype.GetPML = function () {
            return this.pml_;
        };
        Chip.prototype.GetPMV = function () {
            return this.pmv_;
        };
        Chip.prototype.GetRatio = function () {
            return this.ratio_;
        };
        Chip.prototype.MakeTable = function () {
            var h, l;
            for (h = 0; h < 4; h++) {
                var rr = dt2lv[h] * this.ratio_ / (1 << (2 + 7 - 9));
                for (l = 0; l < 16; l++) {
                    var mul = (l !== 0) ? l * 2 : 1;
                    this.multable_[h][l] = (mul * rr) | 0;
                }
            }
        };
        return Chip;
    })();
    fmgenAs.Chip = Chip;
})(fmgenAs || (fmgenAs = {}));
var fmgenAs;
(function (fmgenAs) {
    var EGPhase = (function () {
        function EGPhase() {
        }
        EGPhase.next = 0;
        EGPhase.attack = 1;
        EGPhase.decay = 2;
        EGPhase.sustain = 3;
        EGPhase.release = 4;
        EGPhase.off = 5;
        return EGPhase;
    })();
    fmgenAs.EGPhase = EGPhase;
})(fmgenAs || (fmgenAs = {}));
// 定数化したので未使用
var fmgenAs;
(function (fmgenAs) {
    var OpType = (function () {
        function OpType() {
        }
        OpType.typeN = 0;
        OpType.typeM = 1;
        return OpType;
    })();
    fmgenAs.OpType = OpType;
})(fmgenAs || (fmgenAs = {}));
/// <reference path="../flmml/MML.ts" />
var messenger;
(function (messenger) {
    var MML = flmml.MML;
    var COM_BOOT = 1, COM_PLAY = 2, COM_STOP = 3, COM_PAUSE = 4, COM_BUFFER = 5, COM_COMPCOMP = 6, COM_BUFRING = 7, COM_COMPLETE = 8, COM_SYNCINFO = 9, COM_PLAYSOUND = 10, COM_STOPSOUND = 11, COM_DEBUG = 12;
    var Messenger = (function () {
        function Messenger() {
            this.onstopsound = null;
            this.onrequestbuffer = null;
            this.onInfoTimerBinded = this.onInfoTimer.bind(this);
            addEventListener("message", this.onMessage.bind(this));
        }
        Messenger.prototype.onMessage = function (e) {
            var data = e.data, type = data.type, mml = this.mml;
            switch (type) {
                case COM_BOOT:
                    this.audioSampleRate = data.sampleRate;
                    this.audioBufferSize = data.bufferSize;
                    this.mml = new MML();
                    break;
                case COM_PLAY:
                    mml.play(data.mml);
                    break;
                case COM_STOP:
                    mml.stop();
                    this.syncInfo();
                    break;
                case COM_PAUSE:
                    mml.pause();
                    this.syncInfo();
                    break;
                case COM_BUFFER:
                    this.onrequestbuffer && this.onrequestbuffer(data);
                    break;
                case COM_SYNCINFO:
                    if (typeof data.interval === "number") {
                        this.infoInterval = data.interval;
                        clearInterval(this.tIDInfo);
                        if (this.infoInterval > 0 && this.mml.isPlaying()) {
                            this.tIDInfo = setInterval(this.onInfoTimerBinded, this.infoInterval);
                        }
                    }
                    else {
                        this.syncInfo();
                    }
                    break;
                case COM_STOPSOUND:
                    this.onstopsound && this.onstopsound();
                    break;
            }
        };
        Messenger.prototype.buffering = function (progress) {
            postMessage({ type: COM_BUFRING, progress: progress });
        };
        Messenger.prototype.compileComplete = function () {
            var mml = this.mml;
            postMessage({
                type: COM_COMPCOMP,
                info: {
                    totalMSec: mml.getTotalMSec(),
                    totalTimeStr: mml.getTotalTimeStr(),
                    warnings: mml.getWarnings(),
                    metaTitle: mml.getMetaTitle(),
                    metaComment: mml.getMetaComment(),
                    metaArtist: mml.getMetaArtist(),
                    metaCoding: mml.getMetaCoding()
                }
            });
        };
        Messenger.prototype.playSound = function () {
            postMessage({ type: COM_PLAYSOUND });
            this.syncInfo();
        };
        Messenger.prototype.stopSound = function (isFlushBuf) {
            if (isFlushBuf === void 0) { isFlushBuf = false; }
            postMessage({ type: COM_STOPSOUND, isFlushBuf: isFlushBuf });
        };
        Messenger.prototype.sendBuffer = function (buffer) {
            postMessage({ type: COM_BUFFER, buffer: buffer }, [buffer[0].buffer, buffer[1].buffer]);
        };
        Messenger.prototype.complete = function () {
            postMessage({ type: COM_COMPLETE });
            this.syncInfo();
        };
        Messenger.prototype.syncInfo = function () {
            var mml = this.mml;
            this.lastInfoTime = self.performance ? self.performance.now() : new Date().getTime();
            postMessage({
                type: COM_SYNCINFO,
                info: {
                    _isPlaying: mml.isPlaying(),
                    _isPaused: mml.isPaused(),
                    nowMSec: mml.getNowMSec(),
                    nowTimeStr: mml.getNowTimeStr(),
                    voiceCount: mml.getVoiceCount()
                }
            });
        };
        Messenger.prototype.onInfoTimer = function () {
            if (this.mml.isPlaying()) {
                this.syncInfo();
            }
            else {
                clearInterval(this.tIDInfo);
            }
        };
        Messenger.prototype.debug = function (str) {
            if (str === void 0) { str = ""; }
            postMessage({ type: COM_DEBUG, str: str });
        };
        return Messenger;
    })();
    messenger.Messenger = Messenger;
})(messenger || (messenger = {}));
var msgr = new messenger.Messenger();
