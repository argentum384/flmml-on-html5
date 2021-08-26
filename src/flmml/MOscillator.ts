import { MOscMod } from "./MOscMod";
import { MOscSine } from "./MOscSine";
import { MOscSaw } from "./MOscSaw";
import { MOscTriangle } from "./MOscTriangle";
import { MOscNoise } from "./MOscNoise";
import { MOscPulse } from "./MOscPulse";
import { MOscFcTri } from "./MOscFcTri";
import { MOscFcNoise } from "./MOscFcNoise";
import { MOscFcDpcm } from "./MOscFcDpcm";
import { MOscGbWave } from "./MOscGbWave";
import { MOscGbLNoise } from "./MOscGbLNoise";
import { MOscGbSNoise } from "./MOscGbSNoise";
import { MOscOPM } from "./MOscOPM";
import { MOscWave } from "./MOscWave";

export class MOscillator {
    static readonly SINE: number = 0;
    static readonly SAW: number = 1;
    static readonly TRIANGLE: number = 2;
    static readonly PULSE: number = 3;
    static readonly NOISE: number = 4;
    static readonly FC_PULSE: number = 5;
    static readonly FC_TRI: number = 6;
    static readonly FC_NOISE: number = 7;
    static readonly FC_S_NOISE: number = 8;
    static readonly FC_DPCM: number = 9;
    static readonly GB_WAVE: number = 10;
    static readonly GB_NOISE: number = 11;
    static readonly GB_S_NOISE: number = 12;
    static readonly WAVE: number = 13;
    static readonly OPM: number = 14;
    static readonly MAX: number = 15;
    protected m_osc: Array<MOscMod>;
    protected m_form: number;
    protected static s_init: number = 0;

    constructor() {
        MOscillator.boot();
        this.m_osc = new Array<MOscMod>(MOscillator.MAX); // 固定長
        this.m_osc[MOscillator.SINE] = new MOscSine();
        this.m_osc[MOscillator.SAW] = new MOscSaw();
        this.m_osc[MOscillator.TRIANGLE] = new MOscTriangle();
        this.m_osc[MOscillator.PULSE] = new MOscPulse();
        this.m_osc[MOscillator.NOISE] = new MOscNoise();
        this.m_osc[MOscillator.FC_PULSE] = new MOscPulse();
        this.m_osc[MOscillator.FC_TRI] = new MOscFcTri();
        this.m_osc[MOscillator.FC_NOISE] = new MOscFcNoise();
        this.m_osc[MOscillator.FC_S_NOISE] = null;
        //2009.05.10 OffGao MOD 1L addDPCM
        //this.m_osc[FC_DPCM]    = new MOscMod();
        this.m_osc[MOscillator.FC_DPCM] = new MOscFcDpcm();
        this.m_osc[MOscillator.GB_WAVE] = new MOscGbWave();
        this.m_osc[MOscillator.GB_NOISE] = new MOscGbLNoise();
        this.m_osc[MOscillator.GB_S_NOISE] = new MOscGbSNoise();
        this.m_osc[MOscillator.WAVE] = new MOscWave();
        this.m_osc[MOscillator.OPM] = new MOscOPM();
        this.setForm(MOscillator.PULSE);
        this.setNoiseToPulse();
    }

    asLFO(): void {

        if (this.m_osc[MOscillator.NOISE]) (<MOscNoise>this.m_osc[MOscillator.NOISE]).disableResetPhase();
    }

    static boot(): void {
        if (this.s_init) return;
        MOscSine.boot();
        MOscSaw.boot();
        MOscTriangle.boot();
        MOscPulse.boot();
        MOscNoise.boot();
        MOscFcTri.boot();
        MOscFcNoise.boot();
        //2009.05.10 OffGao ADD 1L addDPCM
        MOscFcDpcm.boot();
        MOscGbWave.boot();
        MOscGbLNoise.boot();
        MOscGbSNoise.boot();
        MOscWave.boot();
        MOscOPM.boot();
        this.s_init = 1;
    }

    setForm(form: number): MOscMod {
        var modNoise: MOscNoise;
        var modFcNoise: MOscFcNoise;
        if (form >= MOscillator.MAX) form = MOscillator.MAX - 1;
        this.m_form = form;
        switch (form) {
            case MOscillator.NOISE:
                modNoise = <MOscNoise>this.m_osc[MOscillator.NOISE];
                modNoise.restoreFreq();
                break;
            case MOscillator.FC_NOISE:
                modFcNoise = <MOscFcNoise>this.getMod(MOscillator.FC_NOISE);
                modFcNoise.setLongMode();
                break;
            case MOscillator.FC_S_NOISE:
                modFcNoise = <MOscFcNoise>this.getMod(MOscillator.FC_S_NOISE);
                modFcNoise.setShortMode();
                break;
        }
        return this.getMod(form);
    }

    getForm(): number {
        return this.m_form;
    }

    getCurrent(): MOscMod {
        return this.getMod(this.m_form);
    }

    getMod(form: number): MOscMod {
        return (form !== MOscillator.FC_S_NOISE) ? this.m_osc[form] : this.m_osc[MOscillator.FC_NOISE];
    }

    private setNoiseToPulse(): void {
        var modPulse: MOscPulse = <MOscPulse>this.getMod(MOscillator.PULSE);
        var modNoise: MOscNoise = <MOscNoise>this.getMod(MOscillator.NOISE);
        modPulse.setNoise(modNoise);
    }
}
