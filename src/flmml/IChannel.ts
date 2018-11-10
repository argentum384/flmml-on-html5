module flmml {
    export interface IChannel {
        setExpression(ex: number): void;
        setVelocity(velocity: number): void;
        setNoteNo(noteNo: number, tie?: boolean): void;
        setDetune(detune: number): void;
        noteOn(noteNo: number, velocity: number): void;
        noteOff(noteNo: number): void;
        close(): void;
        setNoiseFreq(frequency: number): void;
        setForm(form: number, subform: number): void;
        setEnvelope1Atk(attack: number): void;
        setEnvelope1Point(time: number, level: number): void;
        setEnvelope1Rel(release: number): void;
        setEnvelope2Atk(attack: number): void;
        setEnvelope2Point(time: number, level: number): void;
        setEnvelope2Rel(release: number): void;
        setPWM(pwm: number): void;
        setPan(pan: number): void;
        setFormant(vowel: number): void;
        setLFOFMSF(form: number, subform: number): void;
        setLFODPWD(depth: number, freq: number): void;
        setLFODLTM(delay: number, time: number): void;
        setLFOTarget(target: number): void;
        setLpfSwtAmt(swt: number, amt: number): void;
        setLpfFrqRes(frq: number, res: number): void;
        setVolMode(m: number): void;
        setInput(i: number, p: number): void;
        setOutput(o: number, p: number): void;
        setRing(s: number, p: number): void;
        setSync(m: number, p: number): void;
        setPortamento(depth: number, len: number): void;
        setMidiPort(mode: number): void;
        setMidiPortRate(rate: number): void;
        setPortBase(base: number): void;
        setSoundOff(): void;
        getVoiceCount(): number;
        setVoiceLimit(voiceLimit: number): void;
        setHwLfo(data: number): void;
        reset(): void;
        getSamples(samplesSt: Array<Float32Array>, max: number, start: number, delta: number): void;
    }
}
