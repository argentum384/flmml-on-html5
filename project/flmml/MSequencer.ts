/// <reference path="MTrack.ts" />

module FlMMLWorker.flmml {
    var BUFFER_SIZE: number = 8192, // 2^n, 256～16384 flmmlonhtml5-raw.jsと合わせる
        BACKBUF_MULTIPLE: number = 32;

    var STATUS_STOP:      number = 0,
        STATUS_PAUSE:     number = 1,
        STATUS_BUFFERING: number = 2,
        STATUS_PLAY:      number = 3,
        STATUS_LAST:      number = 4,
        STEP_NONE:        number = 0,
        STEP_PRE:         number = 1,
        STEP_TRACK:       number = 2,
        STEP_POST:        number = 3,
        STEP_COMPLETE:    number = 4;

    // Web Audio + Web Worker利用につき大幅改定
    export class MSequencer {
        static SAMPLE_RATE: number;

        static ZEROBUFFER: Float32Array = new Float32Array(BUFFER_SIZE * BACKBUF_MULTIPLE);

        private m_buffer: Array<Array<Float32Array>>;
        private m_playSide: number;
        private m_playSize: number;
        private m_step: number;
        private m_processTrack: number;
        private m_processOffset: number;
        private m_trackArr: Array<MTrack>;
        private m_globalTick: number;
        private m_status: number;
        private m_startTime: number;
        private m_pausedPos: number;
        private m_buffTimer: number;
        private m_procTimer: number;
        private m_restTimer: number;
        private m_lastTime: number;
        private m_maxProcTime: number;

        private processAllBinded: Function;

        constructor() {
            var i: number;
            var sLen: number = BUFFER_SIZE * BACKBUF_MULTIPLE;

            MSequencer.SAMPLE_RATE = global.worker.sampleRate;
            MChannel.boot(sLen);
            MOscillator.boot();
            MEnvelope.boot();
            this.m_trackArr = new Array();
            this.m_playSide = 1;
            this.m_playSize = 0;
            this.m_step = STEP_NONE;
            this.m_buffer = [
                [new Float32Array(sLen), new Float32Array(sLen)],
                [new Float32Array(sLen), new Float32Array(sLen)]
            ];
            this.m_maxProcTime = BUFFER_SIZE / MSequencer.SAMPLE_RATE * 1000 * 0.9;
            this.m_lastTime = 0;

            this.processAllBinded = this.processAll.bind(this);

            global.worker.onRequestBuffer = this.onSampleData.bind(this);
            this.stop();
        }
        
        play(): void {
            if (this.m_status === STATUS_PAUSE) {
                var bufMSec: number = BUFFER_SIZE / MSequencer.SAMPLE_RATE * 1000;
                this.m_pausedPos = bufMSec * Math.ceil(this.m_pausedPos / bufMSec);
                var totl: number = this.getTotalMSec();
                var rest: number = (totl > this.m_pausedPos) ? (totl - this.m_pausedPos) : 0;
                this.m_status = STATUS_PLAY;
                this.m_startTime = global.worker.getTime();
                this.startRestTimer(rest);
                global.worker.playSound();
                this.m_lastTime = global.worker.getTime();
            } else {
                this.m_globalTick = 0;
                for (var i: number = 0; i < this.m_trackArr.length; i++) {
                    this.m_trackArr[i].seekTop();
                }
                this.m_status = STATUS_BUFFERING;
                this.processStart();
            }
        }

        stop(onStopSound: Function = null): void {
            clearTimeout(this.m_restTimer);
            clearTimeout(this.m_procTimer);
            global.worker.stopSound(onStopSound, true);
            this.m_status = STATUS_STOP;
            this.m_pausedPos = 0;
        }

        pause(): void {
            if (this.m_status !== STATUS_PLAY) return;
            clearTimeout(this.m_restTimer);
            global.worker.stopSound();
            this.m_pausedPos = this.getNowMSec();
            this.m_status = STATUS_PAUSE;
        }

        disconnectAll(): void {
            while (this.m_trackArr.pop()) { }
            this.m_status = STATUS_STOP;
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
            this.m_buffTimer = setTimeout(this.onBufferingReq.bind(this), 0);
        }

        private onBufferingReq(): void {
            clearTimeout(this.m_restTimer);
            this.m_pausedPos = this.getNowMSec();
            this.m_status = STATUS_BUFFERING;
            this.startProcTimer();
        }

        private startProcTimer(interval: number = 0): void {
            clearTimeout(this.m_procTimer);
            this.m_procTimer = setTimeout(this.processAllBinded, interval);
        }

        private startRestTimer(interval: number = 0): void {
            clearTimeout(this.m_restTimer);
            this.m_restTimer = setTimeout(this.onStopReq.bind(this), interval);
        }
        
        // バッファ書き込みリクエスト
        private processStart(): void {
            this.m_step = STEP_PRE;
            this.startProcTimer();
        }

        // 実際のバッファ書き込み
        private processAll(): void {
            var worker: any = global.worker,
                buffer: Array<Float32Array> = this.m_buffer[1 - this.m_playSide],
                sLen: number = BUFFER_SIZE * BACKBUF_MULTIPLE,
                bLen: number = BUFFER_SIZE * 2,
                nLen: number = this.m_trackArr.length;

            switch (this.m_step) {
                case STEP_PRE:                     
                    buffer = this.m_buffer[1 - this.m_playSide];
                    buffer[0].set(MSequencer.ZEROBUFFER);
                    buffer[1].set(MSequencer.ZEROBUFFER);
                    if (nLen > 0) {
                        var track: MTrack = this.m_trackArr[MTrack.TEMPO_TRACK];
                        track.onSampleData(null, 0, BUFFER_SIZE * BACKBUF_MULTIPLE, true);
                    }
                    this.m_processTrack = MTrack.FIRST_TRACK;
                    this.m_processOffset = 0;
                    this.m_step++;
                    if (this.m_status !== STATUS_PLAY) this.startProcTimer();
                    break;
                case STEP_TRACK:
                    var status: number = this.m_status,
                        endTime: number = this.m_maxProcTime + this.m_lastTime,
                        infoInterval: number = worker.infoInterval,
                        infoTime: number = worker.lastInfoTime + infoInterval;

                    do {
                        this.m_trackArr[this.m_processTrack].onSampleData(buffer, this.m_processOffset, this.m_processOffset + bLen);
                        this.m_processOffset += bLen;
                        if (this.m_processOffset >= sLen) {
                            this.m_processTrack++;
                            this.m_processOffset = 0;
                        }
                        if (status === STATUS_BUFFERING) {
                            worker.buffering((this.m_processTrack * sLen + this.m_processOffset) / (nLen * sLen) * 100 | 0);
                        }
                        if (this.m_processTrack >= nLen) {
                            this.m_step++;
                            break;
                        }
                        if (worker.getTime() > infoTime) {
                            worker.syncInfo();
                            infoTime = worker.lastInfoTime + infoInterval;
                        }
                    } while (status !== STATUS_PLAY || worker.getTime() < endTime);
                    worker.syncInfo();
                    setInterval(worker.onInfoTimerBinded, worker.infoInterval);
                    if (status !== STATUS_PLAY || this.m_step === STEP_POST) this.startProcTimer();
                    break;
                case STEP_POST:
                    this.m_step = STEP_COMPLETE;
                    if (this.m_status === STATUS_BUFFERING) {
                        var bufMSec: number = BUFFER_SIZE / MSequencer.SAMPLE_RATE * 1000;
                        this.m_pausedPos = bufMSec * Math.ceil(this.m_pausedPos / bufMSec);
                        var totl: number = this.getTotalMSec();
                        var rest: number = (totl > this.m_pausedPos) ? (totl - this.m_pausedPos) : 0;
                        this.m_status = STATUS_PLAY;
                        this.m_playSide = 1 - this.m_playSide;
                        this.m_playSize = 0;
                        this.m_startTime = worker.getTime();
                        this.processStart();
                        this.startRestTimer(rest);
                        worker.playSound();
                        this.m_lastTime = worker.getTime();
                    }
                    break;
                default:
                    break;
            }
        }

        private onSampleData(e: any): void {
            var i: number;
            var base: number;
            var sendBuf: Array<Float32Array>;

            this.m_lastTime = global.worker.getTime();
            if (this.m_status === STATUS_PLAY && this.m_step === STEP_TRACK) this.startProcTimer();

            if (this.m_playSize >= BACKBUF_MULTIPLE) {
                // バッファ完成済みの場合
                if (this.m_step === STEP_COMPLETE) {
                    this.m_playSide = 1 - this.m_playSide;
                    this.m_playSize = 0;
                    this.processStart();
                }
                // バッファが未完成の場合
                else {
                    this.reqBuffering();
                    return;
                }
                if (this.m_status === STATUS_LAST) {
                    return;
                } else if (this.m_status === STATUS_PLAY) {
                    if (this.m_trackArr[MTrack.TEMPO_TRACK].isEnd()) {
                        this.m_status = STATUS_LAST;
                    }
                }
            }
            
            if (e.retBuf) {
                sendBuf = e.retBuf;
            } else {
                sendBuf = [new Float32Array(BUFFER_SIZE), new Float32Array(BUFFER_SIZE)];
            }
            base = BUFFER_SIZE * this.m_playSize;
            for (i = 0; i < 2; i++) {
                sendBuf[i].set(this.m_buffer[this.m_playSide][i].subarray(base, base + BUFFER_SIZE));
            }
            global.worker.sendBuffer(sendBuf);
            this.m_playSize++;
        }

        createPipes(num: number): void {
            MChannel.createPipes(num);
        }

        createSyncSources(num: number): void {
        	MChannel.createSyncSources(num);
        }

        isPlaying(): boolean {
            return (this.m_status > STATUS_PAUSE);
        }

        isPaused(): boolean {
            return (this.m_status === STATUS_PAUSE);
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
                case STATUS_PLAY:
                case STATUS_LAST:
                    now = global.worker.getTime() - this.m_startTime + this.m_pausedPos;
                    break;
                case STATUS_PAUSE:
                case STATUS_BUFFERING:
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