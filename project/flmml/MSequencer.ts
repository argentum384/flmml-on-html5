/// <reference path="MTrack.ts" />

module FlMMLWorker.flmml {
    // Web Audio + Web Worker利用につき大幅改定
    export class MSequencer {
        static SAMPLE_RATE: number;
        static BUFFER_SIZE: number = 8192; // 256～16384の2のべき乗, flmmlonhtml5-raw.jsと合わせる
        static BACK_MULTIPLE: number = 32; // 2以上の2の倍数
        static PROC_MULTIPLE: number = 0.5; // 0～1

        static ZEROBUFFER: Float32Array = new Float32Array(MSequencer.BUFFER_SIZE * MSequencer.BACK_MULTIPLE);

        protected static STATUS_STOP: number = 0;
        protected static STATUS_PAUSE: number = 1;
        protected static STATUS_BUFFERING: number = 2;
        protected static STATUS_PLAY: number = 3;
        protected static STATUS_LAST: number = 4;
        protected static STEP_NONE: number = 0;
        protected static STEP_PRE: number = 1;
        protected static STEP_TRACK: number = 2;
        protected static STEP_POST: number = 3;
        protected static STEP_COMPLETE: number = 4;
        protected m_buffer: Array<Array<Float32Array>>;
        protected m_playSide: number;
        protected m_playSize: number;
        protected m_step: number;
        protected m_processTrack: number;
        protected m_processOffset: number;
        protected m_output: boolean; //! 現在バッファ書き込み中かどうか
        protected m_trackArr: Array<MTrack>;
        protected m_globalTick: number;
        protected m_status: number;
        protected m_startTime: number;
        protected m_pausedPos: number;
        protected m_buffTimer: number;
        protected m_procTimer: number;
        protected m_restTimer: number;
        protected m_maxProcTime: number;

        constructor() {
            var i: number;
            var bufSize: number = MSequencer.BUFFER_SIZE;
            var sLen: number = bufSize * MSequencer.BACK_MULTIPLE;

            MSequencer.SAMPLE_RATE = global.worker.sampleRate;
            this.m_output = false;
            MChannel.boot(sLen);
            MOscillator.boot();
            MEnvelope.boot();
            this.m_trackArr = new Array();
            this.m_playSide = 1;
            this.m_playSize = 0;
            this.m_step = MSequencer.STEP_NONE;
            this.m_maxProcTime = bufSize / MSequencer.SAMPLE_RATE * 1000 * MSequencer.PROC_MULTIPLE;
            this.m_buffer = [
                [new Float32Array(sLen), new Float32Array(sLen)],
                [new Float32Array(sLen), new Float32Array(sLen)]
            ];

            global.worker.onRequestBuffer = this.onSampleData.bind(this);
            this.stop();
        }
        
        play(): void {
            if (this.m_status == MSequencer.STATUS_PAUSE) {
                var bufMSec: number = MSequencer.BUFFER_SIZE / MSequencer.SAMPLE_RATE * 1000;
                this.m_pausedPos = bufMSec * Math.ceil(this.m_pausedPos / bufMSec);
                var totl: number = this.getTotalMSec();
                var rest: number = (totl > this.m_pausedPos) ? (totl - this.m_pausedPos) : 0;
                this.m_status = MSequencer.STATUS_PLAY;
                this.m_startTime = global.performance.now();
                this.startRestTimer(rest);
                global.worker.playSound();
            } else {
                this.m_globalTick = 0;
                for (var i: number = 0; i < this.m_trackArr.length; i++) {
                    this.m_trackArr[i].seekTop();
                }
                this.m_status = MSequencer.STATUS_BUFFERING;
                this.processStart();
            }
        }

        stop(onStopSound: Function = null): void {
            clearTimeout(this.m_restTimer);
            global.worker.stopSound(onStopSound, true);
            this.m_status = MSequencer.STATUS_STOP;
            this.m_pausedPos = 0;
        }

        pause(): void {
            if (this.m_status != MSequencer.STATUS_PLAY) return;
            clearTimeout(this.m_restTimer);
            global.worker.stopSound();
            this.m_pausedPos = this.getNowMSec();
            this.m_status = MSequencer.STATUS_PAUSE;
        }

        disconnectAll(): void {
            while (this.m_trackArr.pop()) { }
            this.m_status = MSequencer.STATUS_STOP;
        }

        connect(track: MTrack): void {
            this.m_trackArr.push(track);
        }

        getGlobalTick(): number {
            return this.m_globalTick;
        }

        private onStopReq(): void {
            this.stop();
            global.worker.complete();
        }
        
        private reqBuffering(): void {
            clearTimeout(this.m_buffTimer);
            this.m_buffTimer = setTimeout(this.onBufferingReq.bind(this), 0, this);
        }

        private onBufferingReq(): void {
            clearTimeout(this.m_restTimer);
            this.m_pausedPos = this.getNowMSec();
            this.m_status = MSequencer.STATUS_BUFFERING;
        }

        private startProcTimer(interval: number = 0): void {
            clearTimeout(this.m_procTimer);
            this.m_procTimer = setTimeout(this.processAll.bind(this), interval);
        }

        private startRestTimer(interval: number = 0): void {
            clearTimeout(this.m_restTimer);
            this.m_restTimer = setTimeout(this.onStopReq.bind(this), interval);
        }
        
        //! バッファ書き込みリクエスト
        private processStart(): void {
            this.m_step = MSequencer.STEP_PRE;
            this.startProcTimer();
        }
        //! 実際のバッファ書き込み
        // 
        private processAll(): void {
            var buffer: Array<Float32Array> = this.m_buffer[1 - this.m_playSide];
            var bufSize: number = MSequencer.BUFFER_SIZE;
            var sLen: number = bufSize * MSequencer.BACK_MULTIPLE;
            var bLen: number = bufSize * 2;
            var nLen: number = this.m_trackArr.length;
            var beginProcTime: number;
            var progress: number;

            switch (this.m_step) {
                case MSequencer.STEP_PRE: 
                    if (this.m_output) {
                        this.startProcTimer();
                        return;
                    }
                    
                    buffer = this.m_buffer[1 - this.m_playSide];
                    buffer[0].set(MSequencer.ZEROBUFFER);
                    buffer[1].set(MSequencer.ZEROBUFFER);

                    if (nLen > 0) {
                        var track: MTrack = this.m_trackArr[MTrack.TEMPO_TRACK];
                        track.onSampleData(null, 0, bufSize * MSequencer.BACK_MULTIPLE, true);
                    }
                    this.m_processTrack = MTrack.FIRST_TRACK;
                    this.m_processOffset = 0;
                    this.m_step++;
                    this.startProcTimer();
                    break;
                case MSequencer.STEP_TRACK:
                    if (this.m_output) {
                        this.startProcTimer();
                        return;
                    }
                    beginProcTime = global.performance.now();
                    progress = 0;
                    do {
                        if (this.m_processTrack >= nLen) {
                            this.m_step++;
                            break;
                        } else {
                            this.m_trackArr[this.m_processTrack].onSampleData(buffer, this.m_processOffset, this.m_processOffset + bLen);
                            this.m_processOffset += bLen;
                            if (this.m_processOffset >= sLen) {
                                this.m_processTrack++;
                                this.m_processOffset = 0;
                            }
                            progress = (this.m_processTrack * sLen + this.m_processOffset) / (this.m_trackArr.length * sLen) * 100 | 0;
                        }
                    } while (global.performance.now() - beginProcTime < this.m_maxProcTime);
                    if (this.m_status == MSequencer.STATUS_BUFFERING) {
                        global.worker.buffering(progress);
                    }
                    this.startProcTimer();
                    break;
                case MSequencer.STEP_POST:
                    this.m_step = MSequencer.STEP_COMPLETE;
                    if (this.m_status == MSequencer.STATUS_BUFFERING) {
                        var bufMSec: number = MSequencer.BUFFER_SIZE / MSequencer.SAMPLE_RATE * 1000;
                        this.m_pausedPos = bufMSec * Math.ceil(this.m_pausedPos / bufMSec);
                        var totl: number = this.getTotalMSec();
                        var rest: number = (totl > this.m_pausedPos) ? (totl - this.m_pausedPos) : 0;
                        this.m_status = MSequencer.STATUS_PLAY;
                        this.m_playSide = 1 - this.m_playSide;
                        this.m_playSize = 0;
                        this.m_startTime = global.performance.now();
                        this.processStart();
                        this.startRestTimer(rest);
                        global.worker.playSound();
                    }
                    break;
                default:
                    break;
            }
        }

        //!
        private onSampleData(e: any): void {
            var i: number;
            var base: number;
            var bufSize = MSequencer.BUFFER_SIZE;
            var sendBuf: Array<Float32Array>;

            this.m_output = true;
            if (this.m_playSize >= MSequencer.BACK_MULTIPLE) {
                // バッファ完成済みの場合
                if (this.m_step == MSequencer.STEP_COMPLETE) {
                    this.m_playSide = 1 - this.m_playSide;
                    this.m_playSize = 0;
                    this.processStart();
                }
                // バッファが未完成の場合
                else {
                    this.m_output = false;
                    this.reqBuffering();
                    return;
                }
                if (this.m_status == MSequencer.STATUS_LAST) {
                    this.m_output = false;
                    return;
                }
                else if (this.m_status == MSequencer.STATUS_PLAY) {
                    if (this.m_trackArr[MTrack.TEMPO_TRACK].isEnd()) {
                        this.m_status = MSequencer.STATUS_LAST;
                    }
                }
            }
            
            if (e.retBuf) {
                sendBuf = e.retBuf;
            } else {
                sendBuf = [new Float32Array(bufSize), new Float32Array(bufSize)];
            }
            base = bufSize * this.m_playSize;
            for (i = 0; i < 2; i++) {
                sendBuf[i].set(this.m_buffer[this.m_playSide][i].subarray(base, base + bufSize));
            }
            global.worker.sendBuffer(sendBuf);
            this.m_playSize++;
            this.m_output = false;
        }

        createPipes(num: number): void {
            MChannel.createPipes(num);
        }

        createSyncSources(num: number): void {
        	MChannel.createSyncSources(num);
        }

        isPlaying(): boolean {
            return (this.m_status > MSequencer.STATUS_PAUSE);
        }

        isPaused(): boolean {
            return (this.m_status == MSequencer.STATUS_PAUSE);
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
                case MSequencer.STATUS_PLAY:
                case MSequencer.STATUS_LAST:
                    now = global.performance.now() - this.m_startTime + this.m_pausedPos;
                    break;
                case MSequencer.STATUS_PAUSE:
                case MSequencer.STATUS_BUFFERING:
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