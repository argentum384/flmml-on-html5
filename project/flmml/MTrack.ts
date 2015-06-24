module flmml {
    export class MTrack {
        static SAMPLE_RATE: number;

        static TEMPO_TRACK: number = 0;
        static FIRST_TRACK: number = 1;
        static DEFAULT_BPM: number = 120;
        private m_bpm: number;          // beat per minute
        private m_spt: number;          // samples per tick
        private m_ch: IChannel;         // channel (instrument)
        private m_needle: number        // delta time
        private m_volume: number;       // default volume    (max:127)
        private m_gate: number;         // default gate time (max:1.0)
        private m_gate2: number;        // gate time 2
        private m_events: Array<MEvent>; //
        private m_pointer: number;   // current event no.
        private m_delta: number;
        private m_isEnd: number;
        private m_globalTick: number;
        private m_lfoWidth: number;
        private m_totalMSec: number;
        private m_polyFound: boolean;
        private m_chordBegin: number;
        private m_chordEnd: number;
        private m_chordMode: boolean;

        constructor() {
            this.m_isEnd = 0;
            this.m_ch = new MChannel();
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
            if (!MTrack.SAMPLE_RATE) MTrack.SAMPLE_RATE = msgr.SAMPLE_RATE;
        }

        getNumEvents(): number {
            return this.m_events.length;
        }

        onSampleData(samplesSt: Array<Float32Array>, start: number, end: number, isTempoTrack: boolean = false): void {
            if (this.isEnd()) return;
            for (var i: number = start; i < end;) {
                // exec events
                var exec: number = 0;
                var eLen: number = this.m_events.length;
                var e: MEvent;
                var delta: number;
                do {
                    exec = 0;
                    if (this.m_pointer < eLen) {
                        e = this.m_events[this.m_pointer];
                        delta = e.getDelta() * this.m_spt;
                        if (this.m_needle >= delta) {
                            //console.log(this.m_pointer+"/global:"+(this.m_globalTick/this.m_spt|0)+"/status:"+e.getStatus()+"/delta:"+delta+"-"+e.getDelta()+"/noteNo:"+e.getNoteNo());
                            exec = 1;
                            switch (e.getStatus()) {
                                case /*MStatus.NOTE_ON*/2:
                                    this.m_ch.noteOn(e.getNoteNo(), e.getVelocity());
                                    break;
                                case /*MStatus.NOTE_OFF*/3:
                                    this.m_ch.noteOff(e.getNoteNo());
                                    break;
                                case /*MStatus.NOTE*/6:
                                    this.m_ch.setNoteNo(e.getNoteNo());
                                    break;
                                case /*MStatus.VOLUME*/5:
                                    break;
                                case /*MStatus.TEMPO*/4:
                                    this.playTempo(e.getTempo());
                                    break;
                                case /*MStatus.FORM*/7:
                                    this.m_ch.setForm(e.getForm(), e.getSubForm());
                                    break;
                                case /*MStatus.ENVELOPE1_ATK*/8:
                                    this.m_ch.setEnvelope1Atk(e.getEnvelopeA());
                                    break;
                                case /*MStatus.ENVELOPE1_ADD*/9:
                                    this.m_ch.setEnvelope1Point(e.getEnvelopeT(), e.getEnvelopeL());
                                    break;
                                case /*MStatus.ENVELOPE1_REL*/10:
                                    this.m_ch.setEnvelope1Rel(e.getEnvelopeR());
                                    break;
                                case /*MStatus.ENVELOPE2_ATK*/24:
                                    this.m_ch.setEnvelope2Atk(e.getEnvelopeA());
                                    break;
                                case /*MStatus.ENVELOPE2_ADD*/25:
                                    this.m_ch.setEnvelope2Point(e.getEnvelopeT(), e.getEnvelopeL());
                                    break;
                                case /*MStatus.ENVELOPE2_REL*/26:
                                    this.m_ch.setEnvelope2Rel(e.getEnvelopeR());
                                    break;
                                case /*MStatus.NOISE_FREQ*/11:
                                    this.m_ch.setNoiseFreq(e.getNoiseFreq());
                                    break;
                                case /*MStatus.PWM*/12:
                                    this.m_ch.setPWM(e.getPWM());
                                    break;
                                case /*MStatus.PAN*/13:
                                    this.m_ch.setPan(e.getPan());
                                    break;
                                case /*MStatus.FORMANT*/14:
                                    this.m_ch.setFormant(e.getVowel());
                                    break;
                                case /*MStatus.DETUNE*/15:
                                    this.m_ch.setDetune(e.getDetune());
                                    break;
                                case /*MStatus.LFO_FMSF*/16:
                                    this.m_ch.setLFOFMSF(e.getLFOForm(), e.getLFOSubForm());
                                    break;
                                case /*MStatus.LFO_DPWD*/17:
                                    this.m_lfoWidth = e.getLFOWidth() * this.m_spt;
                                    this.m_ch.setLFODPWD(e.getLFODepth(), MTrack.SAMPLE_RATE / this.m_lfoWidth);
                                    break;
                                case /*MStatus.LFO_DLTM*/18:
                                    this.m_ch.setLFODLTM(e.getLFODelay() * this.m_spt, e.getLFOTime() * this.m_lfoWidth);
                                    break;
                                case /*MStatus.LFO_TARGET*/19:
                                    this.m_ch.setLFOTarget(e.getLFOTarget());
                                    break;
                                case /*MStatus.LPF_SWTAMT*/20:
                                    this.m_ch.setLpfSwtAmt(e.getLPFSwt(), e.getLPFAmt());
                                    break;
                                case /*MStatus.LPF_FRQRES*/21:
                                    this.m_ch.setLpfFrqRes(e.getLPFFrq(), e.getLPFRes());
                                    break;
                                case /*MStatus.VOL_MODE*/23:
                                    this.m_ch.setVolMode(e.getVolMode());
                                    break;
                                case /*MStatus.INPUT*/27:
                                    this.m_ch.setInput(e.getInputSens(), e.getInputPipe());
                                    break;
                                case /*MStatus.OUTPUT*/28:
                                    this.m_ch.setOutput(e.getOutputMode(), e.getOutputPipe());
                                    break;
                                case /*MStatus.EXPRESSION*/29:
                                    this.m_ch.setExpression(e.getExpression());
                                    break;
                                case /*MStatus.RINGMODULATE*/30:
                                    this.m_ch.setRing(e.getRingSens(), e.getRingInput());
                                    break;
                                case /*MStatus.SYNC*/31:
                                    this.m_ch.setSync(e.getSyncMode(), e.getSyncPipe());
                                    break;
                                case /*MStatus.PORTAMENTO*/32:
                                    this.m_ch.setPortamento(e.getPorDepth() * 100, e.getPorLen() * this.m_spt);
                                    break;
                                case /*MStatus.MIDIPORT*/33:
                                    this.m_ch.setMidiPort(e.getMidiPort());
                                    break;
                                case /*MStatus.MIDIPORTRATE*/34:
                                    var rate: number = e.getMidiPortRate();
                                    this.m_ch.setMidiPortRate((8 - (rate * 7.99 / 128)) / rate);
                                    break;
                                case /*MStatus.BASENOTE*/35:
                                    this.m_ch.setPortBase(e.getPortBase() * 100);
                                    break;
                                case /*MStatus.POLY*/36:
                                    this.m_ch.setVoiceLimit(e.getVoiceCount());
                                    break;
                                case /*MStatus.HW_LFO*/39:
                                    this.m_ch.setHwLfo(e.getHwLfoData());
                                    break;
                                case /*MStatus.SOUND_OFF*/37:
                                    this.m_ch.setSoundOff();
                                    break;
                                case /*MStatus.RESET_ALL*/38:
                                    this.m_ch.reset();
                                    break;
                                case /*MStatus.CLOSE*/22:
                                    this.m_ch.close();
                                    break;
                                case /*MStatus.EOT*/0:
                                    this.m_isEnd = 1;
                                    break;
                                case /*MStatus.NOP*/1:
                                    break;
                                default:
                                    break;
                            }
                            this.m_needle -= delta;
                            this.m_pointer++;
                        }
                    }
                } while (exec);

                // create a short wave
                var di: number;
                if (this.m_pointer < eLen) {
                    e = this.m_events[this.m_pointer];
                    delta = e.getDelta() * this.m_spt;
                    di = Math.ceil(delta - this.m_needle);
                    if (i + di >= end) di = end - i;
                    this.m_needle += di;
                    if (!isTempoTrack) this.m_ch.getSamples(samplesSt, end, i, di);
                    i += di;
                } else {
                    break;
                }
            }
        }

        seek(delta: number): void {
            this.m_delta += delta;
            this.m_globalTick += delta;
            this.m_chordEnd = Math.max(this.m_chordEnd, this.m_globalTick);
        }

        seekChordStart(): void {
            this.m_globalTick = this.m_chordBegin;
        }

        recDelta(e: MEvent): void {
            e.setDelta(this.m_delta);
            this.m_delta = 0;
        }

        recNote(noteNo: number, len: number, vel: number, keyon: number = 1, keyoff: number = 1): void {
            var e0: MEvent = this.makeEvent();
            if (keyon) {
                e0.setNoteOn(noteNo, vel);
            }
            else {
                e0.setNote(noteNo);
            }
            this.pushEvent(e0);
            if (keyoff) {
                var gate: number;
                gate = ((len * this.m_gate) | 0) - this.m_gate2;
                if (gate <= 0) gate = 0;
                this.seek(gate);
                this.recNoteOff(noteNo, vel);
                this.seek(len - gate);
                if (this.m_chordMode) {
                    this.seekChordStart();
                }
            } else {
                this.seek(len);
            }
        }

        recNoteOff(noteNo: number, vel: number): void {
            var e: MEvent = this.makeEvent();
            e.setNoteOff(noteNo, vel);
            this.pushEvent(e);
        }

        recRest(len: number): void {
            this.seek(len);
            if (this.m_chordMode) {
                this.m_chordBegin += len;
            }
        }

        recChordStart(): void {
            if (this.m_chordMode === false) {
                this.m_chordMode = true;
                this.m_chordBegin = this.m_globalTick;
            }
        }

        recChordEnd(): void {
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
        }

        recRestMSec(msec: number): void {
            var len: number = (msec * MTrack.SAMPLE_RATE / (this.m_spt * 1000)) | 0;
            this.seek(len);
        }

        recVolume(vol: number): void {
            var e: MEvent = this.makeEvent();
            e.setVolume(vol);
            this.pushEvent(e);
        }

        // 挿入先が同時間の場合、前に挿入する。ただし、挿入先がテンポコマンドの場合を除く。
        protected recGlobal(globalTick: number, e: MEvent): void {
            var n: number = this.m_events.length;
            var preGlobalTick: number = 0;
            // var tmpArr: Array = new Array();
            for (var i: number = 0; i < n; i++) {
                var en: MEvent = this.m_events[i];
                var nextTick: number = preGlobalTick + en.getDelta();
                if (nextTick > globalTick || (nextTick === globalTick && en.getStatus() !== /*MStatus.TEMPO*/4)) {
                    en.setDelta(nextTick - globalTick);
                    e.setDelta(globalTick - preGlobalTick);
                    this.m_events.splice(i, 0, e);
                    //console.log("e(TEMPO"+e.getTempo()+") delta="+(globalTick-preGlobalTick));
                    return;
                }
                preGlobalTick = nextTick;
            }
            e.setDelta(globalTick - preGlobalTick);
            this.m_events.push(e);
            //console.log("e(TEMPO"+e.getTempo()+") delta="+(globalTick-preGlobalTick));
        }

        // 挿入先が同時間の場合、後に挿入する。
        protected insertEvent(e: MEvent): void {
            var n: number = this.m_events.length;
            var preGlobalTick: number = 0;
            var globalTick: number = e.getTick();
            // var tmpArr: Array = new Array();
            for (var i: number = 0; i < n; i++) {
                var en: MEvent = this.m_events[i];
                var nextTick: number = preGlobalTick + en.getDelta();
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
        }

        // 新規イベントインスタンスを得る
        protected makeEvent(): MEvent {
            var e: MEvent = new MEvent(this.m_globalTick);
            e.setDelta(this.m_delta);
            this.m_delta = 0;
            return e;
        }

        // イベントを適切に追加する
        protected pushEvent(e: MEvent): void {
            if (this.m_chordMode === false) {
                this.m_events.push(e);
            } else {
                this.insertEvent(e);
            }
        }

        recTempo(globalTick: number, tempo: number): void {
            var e: MEvent = new MEvent(globalTick); // makeEvent()は使用してはならない
            e.setTempo(tempo);
            this.recGlobal(globalTick, e);
        }

        recEOT(): void {
            var e: MEvent = this.makeEvent();
            e.setEOT();
            this.pushEvent(e);
        }

        recGate(gate: number): void {
            this.m_gate = gate;
        }

        recGate2(gate2: number): void {
            if (gate2 < 0) gate2 = 0;
            this.m_gate2 = gate2;
        }

        recForm(form: number, sub: number): void {
            var e: MEvent = this.makeEvent();
            e.setForm(form, sub);
            this.pushEvent(e);
        }

        recEnvelope(env: number, attack: number, times: Array<number>, levels: Array<number>, release: number): void {
            var e: MEvent = this.makeEvent();
            if (env === 1) e.setEnvelope1Atk(attack); else e.setEnvelope2Atk(attack);
            this.pushEvent(e);
            for (var i: number = 0, pts: number = times.length; i < pts; i++) {
                e = this.makeEvent();
                if (env === 1) e.setEnvelope1Point(times[i], levels[i]); else e.setEnvelope2Point(times[i], levels[i]);
                this.pushEvent(e);
            }
            e = this.makeEvent();
            if (env === 1) e.setEnvelope1Rel(release); else e.setEnvelope2Rel(release);
            this.pushEvent(e);
        }

        recNoiseFreq(freq: number): void {
            var e: MEvent = this.makeEvent();
            e.setNoiseFreq(freq);
            this.pushEvent(e);
        }

        recPWM(pwm: number): void {
            var e: MEvent = this.makeEvent();
            e.setPWM(pwm);
            this.pushEvent(e);
        }

        recPan(pan: number): void {
            var e: MEvent = this.makeEvent();
            e.setPan(pan);
            this.pushEvent(e);
        }

        recFormant(vowel: number): void {
            var e: MEvent = this.makeEvent();
            e.setFormant(vowel);
            this.pushEvent(e);
        }

        recDetune(d: number): void {
            var e: MEvent = this.makeEvent();
            e.setDetune(d);
            this.pushEvent(e);
        }

        recLFO(depth: number, width: number, form: number, subform: number, delay: number, time: number, target: number): void {
            var e: MEvent = this.makeEvent();
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
        }

        recLPF(swt: number, amt: number, frq: number, res: number): void {
            var e: MEvent = this.makeEvent();
            e.setLPFSWTAMT(swt, amt);
            this.pushEvent(e);
            e = this.makeEvent();
            e.setLPFFRQRES(frq, res);
            this.pushEvent(e);
        }

        recVolMode(m: number): void {
            var e: MEvent = this.makeEvent();
            e.setVolMode(m);
            this.pushEvent(e);
        }

        recInput(sens: number, pipe: number): void {
            var e: MEvent = this.makeEvent();
            e.setInput(sens, pipe);
            this.pushEvent(e);
        }

        recOutput(mode: number, pipe: number): void {
            var e: MEvent = this.makeEvent();
            e.setOutput(mode, pipe);
            this.pushEvent(e);
        }

        recExpression(ex: number): void {
            var e: MEvent = this.makeEvent();
            e.setExpression(ex);
            this.pushEvent(e);
        }

        recRing(sens: number, pipe: number): void {
            var e: MEvent = this.makeEvent();
            e.setRing(sens, pipe);
            this.pushEvent(e);
        }

        recSync(mode: number, pipe: number): void {
            var e: MEvent = this.makeEvent();
            e.setSync(mode, pipe);
            this.pushEvent(e);
        }

        recClose(): void {
            var e: MEvent = this.makeEvent();
            e.setClose();
            this.pushEvent(e);
        }

        recPortamento(depth: number, len: number): void {
            var e: MEvent = this.makeEvent();
            e.setPortamento(depth, len);
            this.pushEvent(e);
        }

        recMidiPort(mode: number): void {
            var e: MEvent = this.makeEvent();
            e.setMidiPort(mode);
            this.pushEvent(e);
        }

        recMidiPortRate(rate: number): void {
            var e: MEvent = this.makeEvent();
            e.setMidiPortRate(rate);
            this.pushEvent(e);
        }

        recPortBase(base: number): void {
            var e: MEvent = this.makeEvent();
            e.setPortBase(base);
            this.pushEvent(e);
        }

        recPoly(voiceCount: number): void {
            var e: MEvent = this.makeEvent();
            e.setPoly(voiceCount);
            this.pushEvent(e);
            this.m_polyFound = true;
        }

        recHwLfo(w: number, f: number, pmd: number, amd: number, pms: number, ams: number, syn: number): void {
            var e: MEvent = this.makeEvent();
            e.setHwLfo(w, f, pmd, amd, pms, ams, syn);
            this.pushEvent(e);
        }

        isEnd(): number {
            return this.m_isEnd;
        }

        getRecGlobalTick(): number {
            return this.m_globalTick;
        }

        seekTop(): void {
            this.m_globalTick = 0;
        }

        conduct(trackArr: Array<MTrack>): void {
            var ni: number = this.m_events.length;
            var nj: number = trackArr.length;
            var globalTick: number = 0;
            var globalSample: number = 0;
            var spt: number = this.calcSpt(MTrack.DEFAULT_BPM);
            var i: number, j: number;
            var e: MEvent;
            for (i = 0; i < ni; i++) {
                e = this.m_events[i];
                globalTick += e.getDelta();
                globalSample += e.getDelta() * spt;
                switch (e.getStatus()) {
                    case /*MStatus.TEMPO*/4:
                        spt = this.calcSpt(e.getTempo());
                        for (j = MTrack.FIRST_TRACK; j < nj; j++) {
                            trackArr[j].recTempo(globalTick, e.getTempo());
                        }
                        break;
                    default:
                        break;
                }
            }
            var maxGlobalTick: number = 0;
            for (j = MTrack.FIRST_TRACK; j < nj; j++) {
                if (maxGlobalTick < trackArr[j].getRecGlobalTick()) maxGlobalTick = trackArr[j].getRecGlobalTick();
            }
            e = this.makeEvent();
            e.setClose();
            this.recGlobal(maxGlobalTick, e);
            globalSample += (maxGlobalTick - globalTick) * spt;

            this.recRestMSec(3000);
            this.recEOT();
            globalSample += 3 * MTrack.SAMPLE_RATE;

            this.m_totalMSec = globalSample * 1000.0 / MTrack.SAMPLE_RATE;
        }
        // calc number of samples per tick
        private calcSpt(bpm: number): number {
            var tps: number = bpm * 96.0 / 60.0; // ticks per second (quater note = 96ticks)
            return MTrack.SAMPLE_RATE / tps;              // samples per tick
        }
        // set tempo
        private playTempo(bpm: number): void {
            this.m_bpm = bpm;
            this.m_spt = this.calcSpt(bpm);
            //console.log("spt:"+this.m_spt)
        }

        getTotalMSec(): number {
            return this.m_totalMSec;
        }

        getTotalTimeStr(): string {
            var sec: number = Math.ceil(this.m_totalMSec / 1000);
            var smin: string = "0" + Math.floor(sec / 60);
            var ssec: string = "0" + (sec % 60);
            return smin.substr(smin.length - 2, 2) + ":" + ssec.substr(ssec.length - 2, 2);
        }
        
        // 発声数取得
        getVoiceCount(): number {
            return this.m_ch.getVoiceCount();
        }
        
        // モノモードへ移行 (再生開始前に行うこと)
        usingMono(): void {
            this.m_ch = new MChannel();
        }
        
        // ポリモードへ移行 (再生開始前に行うこと)
        usingPoly(maxVoice: number): void {
            this.m_ch = new MPolyChannel(maxVoice);
        }
        
        // ポリ命令を１回でも使ったか？
        findPoly(): boolean {
            return this.m_polyFound;
        }
    }
}
