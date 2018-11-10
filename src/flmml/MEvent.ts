module flmml {
    export class MEvent {
        private m_delta: number;
        private m_status: number;
        private m_data0: number;
        private m_data1: number;
        private m_tick: number;
        private TEMPO_SCALE: number = 100; // bpm小数点第二位まで有効

        constructor(tick: number) {
            this.set(/*MStatus.NOP*/1, 0, 0);
            this.setTick(tick);
        }
        set(status: number, data0: number, data1: number): void {
            this.m_status = status;
            this.m_data0 = data0;
            this.m_data1 = data1;
        }

        setEOT(): void { this.set(/*MStatus.EOT*/0, 0, 0); }
        setNoteOn(noteNo: number, vel: number): void { this.set(/*MStatus.NOTE_ON*/2, noteNo, vel); }
        setNoteOff(noteNo: number, vel: number): void { this.set(/*MStatus.NOTE_OFF*/3, noteNo, vel); }
        setTempo(tempo: number): void { this.set(/*MStatus.TEMPO*/4, tempo * this.TEMPO_SCALE, 0); }
        setVolume(vol: number): void { this.set(/*MStatus.VOLUME*/5, vol, 0); }
        setNote(noteNo: number): void { this.set(/*MStatus.NOTE*/6, noteNo, 0); }
        setForm(form: number, sub: number): void { this.set(/*MStatus.FORM*/7, form, sub); }
        setEnvelope1Atk(a: number): void { this.set(/*MStatus.ENVELOPE1_ATK*/8, a, 0); }
        setEnvelope1Point(t: number, l: number): void { this.set(/*MStatus.ENVELOPE1_ADD*/9, t, l); }
        setEnvelope1Rel(r: number): void { this.set(/*MStatus.ENVELOPE1_REL*/10, r, 0); }
        setEnvelope2Atk(a: number): void { this.set(/*MStatus.ENVELOPE2_ATK*/24, a, 0); }
        setEnvelope2Point(t: number, l: number): void { this.set(/*MStatus.ENVELOPE2_ADD*/25, t, l); }
        setEnvelope2Rel(r: number): void { this.set(/*MStatus.ENVELOPE2_REL*/26, r, 0); }
        setNoiseFreq(f: number): void { this.set(/*MStatus.NOISE_FREQ*/11, f, 0); }
        setPWM(w: number): void { this.set(/*MStatus.PWM*/12, w, 0); }
        setPan(p: number): void { this.set(/*MStatus.PAN*/13, p, 0); }
        setFormant(vowel: number): void { this.set(/*MStatus.FORMANT*/14, vowel, 0); }
        setDetune(d: number): void { this.set(/*MStatus.DETUNE*/15, d, 0); }
        setLFOFMSF(fm: number, sf: number): void { this.set(/*MStatus.LFO_FMSF*/16, fm, sf); }
        setLFODPWD(dp: number, wd: number): void { this.set(/*MStatus.LFO_DPWD*/17, dp, wd); }
        setLFODLTM(dl: number, tm: number): void { this.set(/*MStatus.LFO_DLTM*/18, dl, tm); }
        setLFOTarget(target: number): void { this.set(/*MStatus.LFO_TARGET*/19, target, 0); }
        setLPFSWTAMT(swt: number, amt: number): void { this.set(/*MStatus.LPF_SWTAMT*/20, swt, amt); }
        setLPFFRQRES(frq: number, res: number): void { this.set(/*MStatus.LPF_FRQRES*/21, frq, res); }
        setClose(): void { this.set(/*MStatus.CLOSE*/22, 0, 0); }
        setVolMode(m: number): void { this.set(/*MStatus.VOL_MODE*/23, m, 0); }
        setInput(sens: number, pipe: number): void { this.set(/*MStatus.INPUT*/27, sens, pipe); }
        setOutput(mode: number, pipe: number): void { this.set(/*MStatus.OUTPUT*/28, mode, pipe); }
        setExpression(ex: number): void { this.set(/*MStatus.EXPRESSION*/29, ex, 0); }
        setRing(sens: number, pipe: number): void { this.set(/*MStatus.RINGMODULATE*/30, sens, pipe); }
        setSync(mode: number, pipe: number): void { this.set(/*MStatus.SYNC*/31, mode, pipe); }
        setDelta(delta: number): void { this.m_delta = delta; }
        setTick(tick: number): void { this.m_tick = tick; }
        setPortamento(depth: number, len: number): void { this.set(/*MStatus.PORTAMENTO*/32, depth, len); }
        setMidiPort(mode: number): void { this.set(/*MStatus.MIDIPORT*/33, mode, 0); };
        setMidiPortRate(rate: number): void { this.set(/*MStatus.MIDIPORTRATE*/34, rate, 0); };
        setPortBase(base: number): void { this.set(/*MStatus.BASENOTE*/35, base, 0); };
        setPoly(voiceCount: number): void { this.set(/*MStatus.POLY*/36, voiceCount, 0); };
        setResetAll(): void { this.set(/*MStatus.RESET_ALL*/38, 0, 0); }
        setSoundOff(): void { this.set(/*MStatus.SOUND_OFF*/37, 0, 0); }
        setHwLfo(w: number, f: number, pmd: number, amd: number, pms: number, ams: number, s: number): void {
            this.set(/*MStatus.HW_LFO*/39, ((w & 3) << 27) | ((f & 0xff) << 19) | ((pmd & 0x7f) << 12) | ((amd & 0x7f) << 5) | ((pms & 7) << 2) | (ams & 3), 0);
        }
        getStatus(): number { return this.m_status; }
        getDelta(): number { return this.m_delta; }
        getTick(): number { return this.m_tick; }
        getNoteNo(): number { return this.m_data0; }
        getVelocity(): number { return this.m_data1; }
        getTempo(): number { return Math.floor(this.m_data0) / this.TEMPO_SCALE; }
        getVolume(): number { return this.m_data0; }
        getForm(): number { return this.m_data0; }
        getSubForm(): number { return this.m_data1; }
        getEnvelopeA(): number { return this.m_data0; }
        getEnvelopeT(): number { return this.m_data0; }
        getEnvelopeL(): number { return this.m_data1; }
        getEnvelopeR(): number { return this.m_data0; }
        getNoiseFreq(): number { return this.m_data0; }
        getPWM(): number { return this.m_data0; }
        getPan(): number { return this.m_data0; }
        getVowel(): number { return this.m_data0; }
        getDetune(): number { return this.m_data0; }
        getLFODepth(): number { return this.m_data0; }
        getLFOWidth(): number { return this.m_data1; }
        getLFOForm(): number { return this.m_data0; }
        getLFOSubForm(): number { return this.m_data1; }
        getLFODelay(): number { return this.m_data0; }
        getLFOTime(): number { return this.m_data1; }
        getLFOTarget(): number { return this.m_data0; }
        getLPFSwt(): number { return this.m_data0; }
        getLPFAmt(): number { return this.m_data1; }
        getLPFFrq(): number { return this.m_data0; }
        getLPFRes(): number { return this.m_data1; }
        getVolMode(): number { return this.m_data0; }
        getInputSens(): number { return this.m_data0; }
        getInputPipe(): number { return this.m_data1; }
        getOutputMode(): number { return this.m_data0; }
        getOutputPipe(): number { return this.m_data1; }
        getExpression(): number { return this.m_data0; }
        getRingSens(): number { return this.m_data0; }
        getRingInput(): number { return this.m_data1; }
        getSyncMode(): number { return this.m_data0; }
        getSyncPipe(): number { return this.m_data1; }
        getPorDepth(): number { return this.m_data0; }
        getPorLen(): number { return this.m_data1; }
        getMidiPort(): number { return this.m_data0; }
        getMidiPortRate(): number { return this.m_data0; }
        getPortBase(): number { return this.m_data0; }
        getVoiceCount(): number { return this.m_data0; }
        getHwLfoData(): number { return this.m_data0; }
    }
}
