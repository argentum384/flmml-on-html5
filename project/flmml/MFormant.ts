module flmml {
    /**
     * This class was created based on "Formant filter" that programmed by alex.
     See following URL; http://www.musicdsp.org/showArchiveComment.php?ArchiveID=110
     Thanks to his great works!
    */
    export class MFormant {
        static VOWEL_A: number = 0;
        static VOWEL_E: number = 1;
        static VOWEL_I: number = 2;
        static VOWEL_O: number = 3;
        static VOWEL_U: number = 4;

        // ca = filter coefficients of 'a'
        private m_ca0: number = 0.00000811044;
        private m_ca1: number = 8.943665402;
        private m_ca2: number = -36.83889529;
        private m_ca3: number = 92.01697887;
        private m_ca4: number = -154.337906;
        private m_ca5: number = 181.6233289;
        private m_ca6: number = -151.8651235;
        private m_ca7: number = 89.09614114;
        private m_ca8: number = -35.10298511;
        private m_ca9: number = 8.388101016;
        private m_caA: number = -0.923313471;

        // ce = filter coefficients of 'e'
        private m_ce0: number = 0.00000436215;
        private m_ce1: number = 8.90438318;
        private m_ce2: number = -36.55179099;
        private m_ce3: number = 91.05750846;
        private m_ce4: number = -152.422234;
        private m_ce5: number = 179.1170248;
        private m_ce6: number = -149.6496211;
        private m_ce7: number = 87.78352223;
        private m_ce8: number = -34.60687431;
        private m_ce9: number = 8.282228154;
        private m_ceA: number = -0.914150747;

        // ci = filter coefficients of 'i'
        private m_ci0: number = 0.00000333819;
        private m_ci1: number = 8.893102966;
        private m_ci2: number = -36.49532826;
        private m_ci3: number = 90.96543286;
        private m_ci4: number = -152.4545478;
        private m_ci5: number = 179.4835618;
        private m_ci6: number = -150.315433;
        private m_ci7: number = 88.43409371;
        private m_ci8: number = -34.98612086;
        private m_ci9: number = 8.407803364;
        private m_ciA: number = -0.932568035;

        // co = filter coefficients of 'o'
        private m_co0: number = 0.00000113572;
        private m_co1: number = 8.994734087;
        private m_co2: number = -37.2084849;
        private m_co3: number = 93.22900521;
        private m_co4: number = -156.6929844;
        private m_co5: number = 184.596544;
        private m_co6: number = -154.3755513;
        private m_co7: number = 90.49663749;
        private m_co8: number = -35.58964535;
        private m_co9: number = 8.478996281;
        private m_coA: number = -0.929252233;

        // cu = filter coefficients of 'u'
        private m_cu0: number = 4.09431e-7;
        private m_cu1: number = 8.997322763;
        private m_cu2: number = -37.20218544;
        private m_cu3: number = 93.11385476;
        private m_cu4: number = -156.2530937;
        private m_cu5: number = 183.7080141;
        private m_cu6: number = -153.2631681;
        private m_cu7: number = 89.59539726;
        private m_cu8: number = -35.12454591;
        private m_cu9: number = 8.338655623;
        private m_cuA: number = -0.910251753;

        private m_m0: number;
        private m_m1: number;
        private m_m2: number;
        private m_m3: number;
        private m_m4: number;
        private m_m5: number;
        private m_m6: number;
        private m_m7: number;
        private m_m8: number;
        private m_m9: number;

        private m_vowel: number;
        private m_power: boolean;

        constructor() {
            this.m_vowel = MFormant.VOWEL_A;
            this.m_power = false;
            this.reset();
        }

        setVowel(vowel: number): void {
            this.m_power = true;
            this.m_vowel = vowel;
        }

        disable(): void {
            this.m_power = false;
            this.reset();
        }

        reset(): void {
            this.m_m0 = this.m_m1 = this.m_m2 = this.m_m3 = this.m_m4 = this.m_m5 = this.m_m6 = this.m_m7 = this.m_m8 = this.m_m9 = 0;
        }

        // 無音入力時に何かの信号を出力するかのチェック
        checkToSilence(): boolean {
            return this.m_power && (
                -0.000001 <= this.m_m0 && this.m_m0 <= 0.000001 &&
                -0.000001 <= this.m_m1 && this.m_m1 <= 0.000001 &&
                -0.000001 <= this.m_m2 && this.m_m2 <= 0.000001 &&
                -0.000001 <= this.m_m3 && this.m_m3 <= 0.000001 &&
                -0.000001 <= this.m_m4 && this.m_m4 <= 0.000001 &&
                -0.000001 <= this.m_m5 && this.m_m5 <= 0.000001 &&
                -0.000001 <= this.m_m6 && this.m_m6 <= 0.000001 &&
                -0.000001 <= this.m_m7 && this.m_m7 <= 0.000001 &&
                -0.000001 <= this.m_m8 && this.m_m8 <= 0.000001 &&
                -0.000001 <= this.m_m9 && this.m_m9 <= 0.000001
                );
        }

        run(samples: Float32Array, start: number, end: number): void {
            if (!this.m_power) return;
            var i: number;
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
        }
    }
}
