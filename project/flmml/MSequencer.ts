module flmml {
    // Web Audio + Web Worker利用につき大幅改定
    export class MSequencer {
        protected static BUFFER_SIZE: number = 8192; // 2^n, 256～16384 flmmlonhtml5-raw.jsと合わせる
        protected static MULTIPLE: number = 32;

        protected static SAMPLE_RATE: number;
        protected static ZEROBUFFER: Float32Array;
        
        // 戻すときは正規表現使用の置換で
        // /\*MSequencer\.(STATUS_|STEP_)(.*)\*/[0-9]*
        //  ↓
        // MSequencer.$1$2
        //
        //protected static STATUS_STOP:      number = 0;
        //protected static STATUS_PAUSE:     number = 1;
        //protected static STATUS_BUFFERING: number = 2;
        //protected static STATUS_PLAY:      number = 3;
        //protected static STATUS_LAST:      number = 4;
        //protected static STEP_NONE:     number = 0;
        //protected static STEP_PRE:      number = 1;
        //protected static STEP_TRACK:    number = 2;
        //protected static STEP_POST:     number = 3;
        //protected static STEP_COMPLETE: number = 4;

        protected m_buffer: Array<Array<Float32Array>>;
        protected m_playSide: number;
        protected m_playSize: number;
        protected m_step: number;
        protected m_processTrack: number;
        protected m_processOffset: number;
        protected m_trackArr: Array<MTrack>;
        protected m_globalTick: number;
        protected m_status: number;
        protected m_startTime: number;
        protected m_pausedPos: number;
        protected m_buffTimer: number;
        protected m_procTimer: number;
        protected m_restTimer: number;
        protected m_lastTime: number;
        protected m_maxProcTime: number;

        protected processAllBinded: Function;

        constructor() {
            var sLen: number = MSequencer.BUFFER_SIZE * MSequencer.MULTIPLE;

            MSequencer.SAMPLE_RATE = SAMPLE_RATE;
            ZEROBUFFER = MSequencer.ZEROBUFFER = new Float32Array(MSequencer.BUFFER_SIZE * MSequencer.MULTIPLE);
            MChannel.boot(sLen);
            MOscillator.boot();
            MEnvelope.boot();
            this.m_trackArr = new Array();
            this.m_playSide = 1;
            this.m_playSize = 0;
            this.m_step = /*MSequencer.STEP_NONE*/0;
            this.m_buffer = [
                [new Float32Array(sLen), new Float32Array(sLen)],
                [new Float32Array(sLen), new Float32Array(sLen)]
            ];
            this.m_maxProcTime = MSequencer.BUFFER_SIZE / MSequencer.SAMPLE_RATE * 1000 * 0.9;
            this.m_lastTime = 0;
            this.processAllBinded = this.processAll.bind(this);
            msgr.onRequestBuffer = this.onSampleData.bind(this);
            this.stop();
        }
        
        static getTimer() {
            return self.performance ? self.performance.now() : new Date().getTime();
        }
        
        play(): void {
            if (this.m_status === /*MSequencer.STATUS_PAUSE*/1) {
                var bufMSec: number = MSequencer.BUFFER_SIZE / MSequencer.SAMPLE_RATE * 1000;
                this.m_pausedPos = bufMSec * Math.ceil(this.m_pausedPos / bufMSec);
                var totl: number = this.getTotalMSec();
                var rest: number = (totl > this.m_pausedPos) ? (totl - this.m_pausedPos) : 0;
                this.m_status = /*MSequencer.STATUS_PLAY*/3;
                this.m_startTime = MSequencer.getTimer();
                this.startRestTimer(rest);
                msgr.playSound();
                this.m_lastTime = MSequencer.getTimer();
            } else {
                this.m_globalTick = 0;
                for (var i: number = 0; i < this.m_trackArr.length; i++) {
                    this.m_trackArr[i].seekTop();
                }
                this.m_status = /*MSequencer.STATUS_BUFFERING*/2;
                this.processStart();
            }
        }

        stop(onStopSound: Function = null): void {
            clearTimeout(this.m_restTimer);
            clearTimeout(this.m_procTimer);
            msgr.stopSound(onStopSound, true);
            this.m_status = /*MSequencer.STATUS_STOP*/0;
            this.m_pausedPos = 0;
        }

        pause(): void {
            if (this.m_status !== /*MSequencer.STATUS_PLAY*/3) return;
            clearTimeout(this.m_restTimer);
            msgr.stopSound();
            this.m_pausedPos = this.getNowMSec();
            this.m_status = /*MSequencer.STATUS_PAUSE*/1;
        }

        disconnectAll(): void {
            while (this.m_trackArr.pop()) { }
            this.m_status = /*MSequencer.STATUS_STOP*/0;
        }

        connect(track: MTrack): void {
            this.m_trackArr.push(track);
        }

        getGlobalTick(): number {
            return this.m_globalTick;
        }

        private onStopReq(): void {
            this.stop();
            msgr.complete();
            this.m_restTimer = 0;
        }
        
        private reqBuffering(): void {
            if (!this.m_buffTimer) {
                this.m_buffTimer = setTimeout(this.onBufferingReq.bind(this), 0);
            }
        }

        private onBufferingReq(): void {
            clearTimeout(this.m_restTimer);
            this.m_pausedPos = this.getNowMSec();
            this.m_status = /*MSequencer.STATUS_BUFFERING*/2;
            this.startProcTimer();
            this.m_buffTimer = 0;
        }

        private startProcTimer(interval: number = 0): void {
            clearTimeout(this.m_procTimer);
            this.m_procTimer = setTimeout(this.processAllBinded, interval);
        }

        private startRestTimer(interval: number = 0): void {
            if (!this.m_restTimer) {
                this.m_restTimer = setTimeout(this.onStopReq.bind(this), interval);
            }
        }
        
        // バッファ書き込みリクエスト
        private processStart(): void {
            this.m_step = /*MSequencer.STEP_PRE*/1;
            this.startProcTimer();
        }

        // 実際のバッファ書き込み
        private processAll(): void {
            var buffer: Array<Float32Array> = this.m_buffer[1 - this.m_playSide],
                bufSize: number = MSequencer.BUFFER_SIZE,
                sLen: number = bufSize * MSequencer.MULTIPLE,
                bLen: number = bufSize * 2,
                nLen: number = this.m_trackArr.length;

            switch (this.m_step) {
                case /*MSequencer.STEP_PRE*/1:
                    buffer = this.m_buffer[1 - this.m_playSide];
                    buffer[0].set(MSequencer.ZEROBUFFER);
                    buffer[1].set(MSequencer.ZEROBUFFER);
                    if (nLen > 0) {
                        var track: MTrack = this.m_trackArr[MTrack.TEMPO_TRACK];
                        track.onSampleData(null, 0, bufSize * MSequencer.MULTIPLE, true);
                    }
                    this.m_processTrack = MTrack.FIRST_TRACK;
                    this.m_processOffset = 0;
                    this.m_step++;
                    if (this.m_status !== /*MSequencer.STATUS_PLAY*/3) this.startProcTimer();
                    break;
                case /*MSequencer.STEP_TRACK*/2:
                    var cnt: number = 0,
                        status: number = this.m_status,
                        endTime: number = this.m_maxProcTime + this.m_lastTime,
                        infoInterval: number = msgr.infoInterval,
                        infoTime: number = msgr.lastInfoTime + infoInterval;

                    do {
                        cnt++;
                        this.m_trackArr[this.m_processTrack].onSampleData(buffer, this.m_processOffset, this.m_processOffset + bLen);
                        this.m_processOffset += bLen;
                        if (this.m_processOffset >= sLen) {
                            this.m_processTrack++;
                            this.m_processOffset = 0;
                        }
                        if (status === /*MSequencer.STATUS_BUFFERING*/2) {
                            msgr.buffering((this.m_processTrack * sLen + this.m_processOffset) / (nLen * sLen) * 100 | 0);
                        }
                        if (this.m_processTrack >= nLen) {
                            this.m_step++;
                            break;
                        }
                        if (infoInterval > 0 && MSequencer.getTimer() > infoTime) {
                            msgr.syncInfo();
                            infoTime = msgr.lastInfoTime + infoInterval;
                        }
                    } while (status !== /*MSequencer.STATUS_PLAY*/3 || MSequencer.getTimer() < endTime);
                    if (infoInterval > 0) {
                        msgr.syncInfo();
                        setInterval(msgr.onInfoTimerBinded, msgr.infoInterval);
                    }
                    if (status !== /*MSequencer.STATUS_PLAY*/3 || this.m_step === /*MSequencer.STEP_POST*/3) {
                        this.startProcTimer();
                    }
                    break;
                case /*MSequencer.STEP_POST*/3:
                    this.m_step = /*MSequencer.STEP_COMPLETE*/4;
                    if (this.m_status === /*MSequencer.STATUS_BUFFERING*/2) {
                        var bufMSec: number = MSequencer.BUFFER_SIZE / MSequencer.SAMPLE_RATE * 1000;
                        this.m_pausedPos = bufMSec * Math.ceil(this.m_pausedPos / bufMSec);
                        var totl: number = this.getTotalMSec();
                        var rest: number = (totl > this.m_pausedPos) ? (totl - this.m_pausedPos) : 0;
                        this.m_status = /*MSequencer.STATUS_PLAY*/3;
                        this.m_playSide = 1 - this.m_playSide;
                        this.m_playSize = 0;
                        this.m_startTime = this.m_lastTime = MSequencer.getTimer();
                        this.processStart();
                        this.startRestTimer(rest);
                        msgr.playSound();
                    }
                    break;
                default:
                    break;
            }
        }

        private onSampleData(e: any): void {
            var base: number;
            var sendBuf: Array<Float32Array>;

            this.m_lastTime = MSequencer.getTimer();
            if (this.m_status !== /*MSequencer.STATUS_PLAY*/3) return;
            if (this.m_step === /*MSequencer.STEP_TRACK*/2) this.startProcTimer();
            if (this.m_playSize >= MSequencer.MULTIPLE) {
                // バッファ完成済みの場合
                if (this.m_step === /*MSequencer.STEP_COMPLETE*/4) {
                    this.m_playSide = 1 - this.m_playSide;
                    this.m_playSize = 0;
                    this.processStart();
                }
                // バッファが未完成の場合
                else {
                    this.reqBuffering();
                    return;
                }
                if (this.m_status === /*MSequencer.STATUS_LAST*/4) {
                    return;
                } else if (this.m_status === /*MSequencer.STATUS_PLAY*/3) {
                    if (this.m_trackArr[MTrack.TEMPO_TRACK].isEnd()) {
                        this.m_status = /*MSequencer.STATUS_LAST*/4;
                    }
                }
            }
            
            var bufSize = MSequencer.BUFFER_SIZE;
            sendBuf = (e.retBuf) ? e.retBuf : [new Float32Array(bufSize), new Float32Array(bufSize)];
            base = bufSize * this.m_playSize;
            sendBuf[0].set(this.m_buffer[this.m_playSide][0].subarray(base, base + bufSize));
            sendBuf[1].set(this.m_buffer[this.m_playSide][1].subarray(base, base + bufSize));
            msgr.sendBuffer(sendBuf);
            this.m_playSize++;
        }

        createPipes(num: number): void {
            MChannel.createPipes(num);
        }

        createSyncSources(num: number): void {
        	MChannel.createSyncSources(num);
        }

        isPlaying(): boolean {
            return (this.m_status > /*MSequencer.STATUS_PAUSE*/1);
        }

        isPaused(): boolean {
            return (this.m_status === /*MSequencer.STATUS_PAUSE*/1);
        }

        getTotalMSec(): number {
            if (this.m_trackArr[MTrack.TEMPO_TRACK]) {
                return this.m_trackArr[MTrack.TEMPO_TRACK].getTotalMSec();
            } else {
                return 0;
            }
        }

        getNowMSec(): number {
            var now: number;
            var tot: number = this.getTotalMSec();
            switch (this.m_status) {
                case /*MSequencer.STATUS_PLAY*/3:
                case /*MSequencer.STATUS_LAST*/4:
                    now = MSequencer.getTimer() - this.m_startTime + this.m_pausedPos;
                    break;
                case /*MSequencer.STATUS_PAUSE*/1:
                case /*MSequencer.STATUS_BUFFERING*/2:
                    now = this.m_pausedPos;
                    break;
                default:
                    return 0;
            }
            return (now < tot) ? now : tot;
        }

        getNowTimeStr(): string {
            var sec: number = this.getNowMSec() / 1000;
            var smin: string = "0" + (sec / 60 | 0);
            var ssec: string = "0" + (sec % 60 | 0);
            return smin.substr(smin.length-2, 2) + ":" + ssec.substr(ssec.length-2, 2);
        }
    }
} 
