﻿import { MOscMod } from "./MOscMod";

/**
   Special thanks to OffGao.
 */
export class MOscGbSNoise extends MOscMod {
    static readonly GB_NOISE_PHASE_SFT: number = 12;
    static readonly GB_NOISE_PHASE_DLT: number = 1 << MOscGbSNoise.GB_NOISE_PHASE_SFT
    static readonly GB_NOISE_TABLE_LEN: number = 127;
    static readonly GB_NOISE_TABLE_MOD: number = (MOscGbSNoise.GB_NOISE_TABLE_LEN << MOscGbSNoise.GB_NOISE_PHASE_SFT) - 1;
    protected static s_init: number = 0;
    protected static s_table: Array<number> = new Array<number>(MOscGbSNoise.GB_NOISE_TABLE_LEN);
    protected static readonly s_interval: Array<number> = [
        0x000002, 0x000004, 0x000008, 0x00000c, 0x000010, 0x000014, 0x000018, 0x00001c,
        0x000020, 0x000028, 0x000030, 0x000038, 0x000040, 0x000050, 0x000060, 0x000070,
        0x000080, 0x0000a0, 0x0000c0, 0x0000e0, 0x000100, 0x000140, 0x000180, 0x0001c0,
        0x000200, 0x000280, 0x000300, 0x000380, 0x000400, 0x000500, 0x000600, 0x000700,
        0x000800, 0x000a00, 0x000c00, 0x000e00, 0x001000, 0x001400, 0x001800, 0x001c00,
        0x002000, 0x002800, 0x003000, 0x003800, 0x004000, 0x005000, 0x006000, 0x007000,
        0x008000, 0x00a000, 0x00c000, 0x00e000, 0x010000, 0x014000, 0x018000, 0x01c000,
        0x020000, 0x028000, 0x030000, 0x038000, 0x040000, 0x050000, 0x060000, 0x070000
    ];

    protected m_sum: number;
    protected m_skip: number;

    constructor() {
        MOscGbSNoise.boot();
        super();
        this.m_sum = 0;
        this.m_skip = 0;
    }

    static boot(): void {
        if (this.s_init) return;
        var gbr: number = 0xffff;
        var output: number = 1;
        for (var i: number = 0; i < this.GB_NOISE_TABLE_LEN; i++) {
            if (gbr === 0) gbr = 1;
            gbr += gbr + (((gbr >> 6) ^ (gbr >> 5)) & 1) | 0;
            output ^= gbr & 1;
            this.s_table[i] = output * 2 - 1;
        }
        this.s_init = 1;
    }

    getNextSample(): number {
        var val: number = MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
        if (this.m_skip > 0) {
            val = (val + this.m_sum) / Number(this.m_skip + 1);
        }
        this.m_sum = 0;
        this.m_skip = 0;
        var freqShift: number = this.m_freqShift;
        while (freqShift > MOscGbSNoise.GB_NOISE_PHASE_DLT) {
            this.m_phase = (this.m_phase + MOscGbSNoise.GB_NOISE_PHASE_DLT) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
            freqShift -= MOscGbSNoise.GB_NOISE_PHASE_DLT;
            this.m_sum += MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
            this.m_skip++;
        }
        this.m_phase = (this.m_phase + freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
        return val;
    }

    getNextSampleOfs(ofs: number): number {
        var phase: number = (this.m_phase + ofs) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
        var val: number = MOscGbSNoise.s_table[(phase + ((phase >> 31) & MOscGbSNoise.GB_NOISE_TABLE_MOD)) >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
        this.m_phase = (this.m_phase + this.m_freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
        return val;
    }

    getSamples(samples: Float32Array, start: number, end: number): void {
        var i: number;
        var val: number;
        for (i = start; i < end; i++) {
            val = MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
            if (this.m_skip > 0) {
                val = (val + this.m_sum) / Number(this.m_skip + 1);
            }
            samples[i] = val;
            this.m_sum = 0;
            this.m_skip = 0;
            var freqShift: number = this.m_freqShift;
            while (freqShift > MOscGbSNoise.GB_NOISE_PHASE_DLT) {
                this.m_phase = (this.m_phase + MOscGbSNoise.GB_NOISE_PHASE_DLT) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
                freqShift -= MOscGbSNoise.GB_NOISE_PHASE_DLT;
                this.m_sum += MOscGbSNoise.s_table[this.m_phase >> MOscGbSNoise.GB_NOISE_PHASE_SFT];
                this.m_skip++;
            }
            this.m_phase = (this.m_phase + freqShift) % MOscGbSNoise.GB_NOISE_TABLE_MOD;
        }
    }

    setFrequency(frequency: number): void {
        this.m_frequency = frequency;
    }

    setNoiseFreq(no: number): void {
        if (no < 0) no = 0;
        if (no > 63) no = 63;
        this.m_freqShift = (1048576 << (MOscGbSNoise.GB_NOISE_PHASE_SFT - 2)) / (MOscGbSNoise.s_interval[no] * 11025);
    }

    setNoteNo(noteNo: number): void {
        this.setNoiseFreq(noteNo);
    }
}
