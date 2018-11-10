// ---------------------------------------------------------------------------
//  FM Sound Generator - Core Unit
//  Copyright (C) cisc 1998, 2003.
//  Copyright (C) 2011 ALOE. All rights reserved.
// ---------------------------------------------------------------------------
module fmgenAs {
    /**
     * ...
     * @author ALOE
     */
    export class Timer {
        private regta: Array<number> = new Array<number>(2);
        private timera: number;
        private timera_count: number;
        private timerb: number;
        private timerb_count: number;
        private timer_step: number;

        protected status: number;
        protected regtc: number;

        Reset(): void {
            this.timera_count = 0;
            this.timerb_count = 0;
        }

        Count(us: number): boolean {
            var f: boolean = false;

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
        }

        GetNextEvent(): number {
            var ta: number = ((this.timera_count + 0xffff) >> 16) - 1;
            var tb: number = ((this.timerb_count + 0xfff) >> 12) - 1;
            return (ta < tb ? ta : tb) + 1;
        }

        protected /*abstract*/ SetStatus(bit: number): void { }
        protected /*abstract*/ ResetStatus(bit: number): void { }

        protected SetTimerBase(clock: number): void {
            this.timer_step = (1000000.0 * 65536 / clock) | 0;
        }

        protected SetTimerA(addr: number, data: number): void {
            var tmp: number;
            this.regta[addr & 1] = data | 0;
            tmp = (this.regta[0] << 2) + (this.regta[1] & 3);
            this.timera = (1024 - tmp) * this.timer_step;
        }

        protected SetTimerB(data: number): void {
            this.timerb = (256 - data) * this.timer_step;
        }

        protected SetTimerControl(data: number): void {
            var tmp: number = this.regtc ^ data;
            this.regtc = data | 0;

            if (data & 0x10)
                this.ResetStatus(1);
            if (data & 0x20)
                this.ResetStatus(2);

            if (tmp & 0x01)
                this.timera_count = (data & 1) ? this.timera : 0;
            if (tmp & 0x02)
                this.timerb_count = (data & 2) ? this.timerb : 0;
        }

        protected /*abstract*/ TimerA(): void { }

        /*
         * End Class Definition
         */
    }
}
