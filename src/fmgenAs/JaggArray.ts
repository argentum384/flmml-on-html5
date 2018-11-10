module fmgenAs {
    /**
     * ...
     * @author ALOE
     */
    export class JaggArray {
        static I2(s1: number, s2: number): Array<Array<number>> {
            var a: Array<Array<number>> = new Array<Array<number>>(s1);
            for (var i: number = 0; i < s1; i++) {
                a[i] = new Array<number>(s2);
            }
            return a;
        }

        static I3(s1: number, s2: number, s3: number): Array<Array<Array<number>>> {
            var a: Array<Array<Array<number>>> = new Array<Array<Array<number>>>(s1);
            for (var i: number = 0; i < s1; i++) {
                a[i] = new Array<Array<number>>(s2);
                for (var j: number = 0; j < s2; j++) {
                    a[i][j] = new Array<number>(s3);
                }
            }
            return a;
        }
    }
}
