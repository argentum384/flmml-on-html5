module flmml {
    // Web Audio + Web Worker利用につき大幅改定
    export class MSequencer {
        protected static MULTIPLE: number = 32;
        
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

        protected BUFFER_SIZE: number;
        protected SAMPLE_RATE: number;
        protected emptyBuffer: Float32Array;

        protected m_buffer: Array<Array<Float32Array>>;
        protected m_playSide: number;
        protected m_playSize: number;
        protected m_step: number;
        protected m_processTrack: number;
        protected m_processOffset: number;
        protected m_trackArr: Array<MTrack>;
        //protected m_globalTick: number;
        protected m_globalSample: number;
        protected m_maxNowMSec: number;
        protected m_totalMSec: number;
        protected m_status: number;
        protected m_buffTimer: number;
        protected m_procTimer: number;
        protected m_lastTime: number;
        protected m_maxProcTime: number;
        protected m_waitPause: boolean;

        protected processAllBinded: Function;

        constructor() {
            this.SAMPLE_RATE = msgr.SAMPLE_RATE;
            this.BUFFER_SIZE = msgr.BUFFER_SIZE;
            msgr.emptyBuffer = this.emptyBuffer = new Float32Array(this.BUFFER_SIZE * MSequencer.MULTIPLE);
            var sLen: number = this.BUFFER_SIZE * MSequencer.MULTIPLE;
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
            this.m_maxProcTime = this.BUFFER_SIZE / this.SAMPLE_RATE * 1000.0 * 0.8;
            //this.m_lastTime = 0;
            this.processAllBinded = this.processAll.bind(this);
            msgr.onrequestbuffer = this.onSampleData.bind(this);
            this.stop();
        }
        
        static getTimer() {
            return self.performance ? self.performance.now() : new Date().getTime();
        }
        
        play(): void {
            if (this.m_status === /*MSequencer.STATUS_PAUSE*/1) {
                var bufMSec: number = this.BUFFER_SIZE / this.SAMPLE_RATE * 1000.0;
                this.m_status = /*MSequencer.STATUS_PLAY*/3;
                msgr.playSound();
                this.startProcTimer();
            } else {
                //this.m_globalTick = 0;
                this.m_globalSample = 0;
                this.m_totalMSec = this.getTotalMSec();
                for (var i: number = 0; i < this.m_trackArr.length; i++) {
                    this.m_trackArr[i].seekTop();
                }
                this.m_status = /*MSequencer.STATUS_BUFFERING*/2;
                this.processStart();
            }
            this.m_lastTime = 0;
            this.m_waitPause = false;
            if (msgr.infoInterval > 0) {
                clearInterval(msgr.tIDInfo);
                msgr.tIDInfo = setInterval(msgr.onInfoTimerBinded, msgr.infoInterval);
            }
        }

        stop(): void {
            clearTimeout(this.m_procTimer);
            msgr.stopSound(true);
            this.m_status = /*MSequencer.STATUS_STOP*/0;
            this.m_lastTime = 0;
            this.m_maxNowMSec = 0;
            this.m_waitPause = false;
        }

        pause(): void {
            switch (this.m_status) {
                case /*MSequencer.STATUS_BUFFERING*/2:
                    this.m_waitPause = true;
                    break;
                case /*MSequencer.STATUS_PLAY*/3:
                    msgr.stopSound();
                    this.m_status = /*MSequencer.STATUS_PAUSE*/1;
                    if (this.m_waitPause) {
                        msgr.syncInfo();
                        this.m_waitPause = false;
                    }
            }
        }

        disconnectAll(): void {
            while (this.m_trackArr.pop()) { }
            this.m_status = /*MSequencer.STATUS_STOP*/0;
        }

        connect(track: MTrack): void {
            this.m_trackArr.push(track);
        }

        //getGlobalTick(): number {
        //    return this.m_globalTick;
        //}

        private reqBuffering(): void {
            if (!this.m_buffTimer) {
                this.m_buffTimer = setTimeout(this.onBufferingReq.bind(this), 0);
            }
        }

        private onBufferingReq(): void {
            this.m_status = /*MSequencer.STATUS_BUFFERING*/2;
            this.startProcTimer();
            this.m_buffTimer = 0;
        }

        private startProcTimer(interval: number = 0): void {
            clearTimeout(this.m_procTimer);
            if (this.m_status === /*MSequencer.STATUS_STOP*/0) return;
            this.m_procTimer = setTimeout(this.processAllBinded, interval);
        }
        
        // バッファ書き込みリクエスト
        private processStart(): void {
            this.m_step = /*MSequencer.STEP_PRE*/1;
            this.startProcTimer();
        }

        // 実際のバッファ書き込み
        private processAll(): void {
            var buffer: Array<Float32Array> = this.m_buffer[1 - this.m_playSide],
                bufSize: number = this.BUFFER_SIZE,
                sLen: number = bufSize * MSequencer.MULTIPLE,
                bLen: number = bufSize * 2,
                nLen: number = this.m_trackArr.length,
                msgr_: messenger.Messenger = msgr;

            switch (this.m_step) {
                case /*MSequencer.STEP_PRE*/1:
                    buffer = this.m_buffer[1 - this.m_playSide];
                    buffer[0].set(this.emptyBuffer);
                    buffer[1].set(this.emptyBuffer);
                    if (nLen > 0) {
                        var track: MTrack = this.m_trackArr[MTrack.TEMPO_TRACK];
                        track.onSampleData(null, 0, bufSize * MSequencer.MULTIPLE, true);
                    }
                    this.m_processTrack = MTrack.FIRST_TRACK;
                    this.m_processOffset = 0;
                    this.m_step++;
                    this.startProcTimer();
                    break;
                case /*MSequencer.STEP_TRACK*/2:
                    var status: number = this.m_status,
                        endTime: number = this.m_lastTime ? this.m_maxProcTime + this.m_lastTime : 0.0,
                        infoInterval: number = msgr_.infoInterval,
                        infoTime: number = msgr_.lastInfoTime + infoInterval;
                    do {
                        this.m_trackArr[this.m_processTrack].onSampleData(buffer, this.m_processOffset, this.m_processOffset + bLen);
                        this.m_processOffset += bLen;
                        if (this.m_processOffset >= sLen) {
                            this.m_processTrack++;
                            this.m_processOffset = 0;
                        }
                        if (status === /*MSequencer.STATUS_BUFFERING*/2) {
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
                    } while (status < /*MSequencer.STATUS_PLAY*/3 || MSequencer.getTimer() < endTime);
                    if (infoInterval > 0) {
                        msgr_.syncInfo();
                        clearInterval(msgr_.tIDInfo);
                        msgr_.tIDInfo = setInterval(msgr_.onInfoTimerBinded, msgr_.infoInterval);
                    }
                    this.startProcTimer();
                    break;
                case /*MSequencer.STEP_POST*/3:
                    this.m_step = /*MSequencer.STEP_COMPLETE*/4;
                    if (this.m_status === /*MSequencer.STATUS_BUFFERING*/2) {
                        this.m_status = /*MSequencer.STATUS_PLAY*/3;
                        this.m_playSide = 1 - this.m_playSide;
                        this.m_playSize = 0;
                        if (this.m_waitPause) {
                            this.pause();
                            this.m_step = /*MSequencer.STEP_PRE*/1;
                        } else {
                            msgr_.playSound();
                            this.processStart();
                        }
                    }
                    break;
            }
        }

        private onSampleData(e: any): void {
            this.m_lastTime = MSequencer.getTimer();
            if (this.m_status < /*MSequencer.STATUS_PLAY*/3) return;
            if (this.m_globalSample / this.SAMPLE_RATE * 1000.0 >= this.m_totalMSec) {
                this.stop();
                msgr.complete();
                return;
            }
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
            
            var bufSize = this.BUFFER_SIZE;
            var sendBuf: Array<Float32Array> = e.retBuf || [new Float32Array(bufSize), new Float32Array(bufSize)];
            var base: number = bufSize * this.m_playSize;
            sendBuf[0].set(this.m_buffer[this.m_playSide][0].subarray(base, base + bufSize));
            sendBuf[1].set(this.m_buffer[this.m_playSide][1].subarray(base, base + bufSize));
            msgr.sendBuffer(sendBuf);
            this.m_playSize++;
            this.m_globalSample += bufSize;
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
                return 0.0;
            }
        }

        getNowMSec(): number {
            if (this.m_status === /*MSequencer.STATUS_STOP*/0) {
                return 0.0;
            } else {
                var globalMSec = this.m_globalSample / this.SAMPLE_RATE * 1000.0,
                    elapsed = this.m_lastTime ? MSequencer.getTimer() - this.m_lastTime : 0.0,
                    bufMSec = this.BUFFER_SIZE / this.SAMPLE_RATE * 1000.0;
                this.m_maxNowMSec = Math.max(this.m_maxNowMSec, globalMSec + Math.min(elapsed, bufMSec));
                return this.m_maxNowMSec
            }
        }

        getNowTimeStr(): string {
            var sec: number = this.getNowMSec() / 1000.0;
            var smin: string = "0" + (sec / 60 | 0);
            var ssec: string = "0" + (sec % 60 | 0);
            return smin.substr(smin.length-2, 2) + ":" + ssec.substr(ssec.length-2, 2);
        }
    }
} 
