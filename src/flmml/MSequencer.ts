import { FlMMLWorker } from "../flmml-on-html5.worker";
import {
    SEQUENCER_SAMPLE_RATE,
    AUDIO_BUFFER_SIZE
} from "../common/Consts";
import { MOscillator } from "./MOscillator";
import { MChannel } from "./MChannel";
import { MEnvelope } from "./MEnvelope";
import { MTrack } from "./MTrack";

export class MSequencer {
    protected static readonly MULTIPLE: number = 32;
    
    //protected static readonly STATUS_STOP:      number = 0;
    //protected static readonly STATUS_PAUSE:     number = 1;
    //protected static readonly STATUS_BUFFERING: number = 2;
    //protected static readonly STATUS_PLAY:      number = 3;
    //protected static readonly STATUS_LAST:      number = 4;
    //protected static readonly STEP_NONE:     number = 0;
    //protected static readonly STEP_PRE:      number = 1;
    //protected static readonly STEP_TRACK:    number = 2;
    //protected static readonly STEP_POST:     number = 3;
    //protected static readonly STEP_COMPLETE: number = 4;

    protected worker: FlMMLWorker;
    protected bufferSize: number;
    protected bufferId: number;
    protected lastSample: Array<number>;
    protected isExportingAudio: boolean;

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

    constructor(worker: FlMMLWorker) {
        this.worker = worker;
        this.bufferSize = Math.round(AUDIO_BUFFER_SIZE * SEQUENCER_SAMPLE_RATE / worker.audioSampleRate);
        var sLen: number = this.bufferSize * MSequencer.MULTIPLE;
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
        this.m_maxProcTime = this.bufferSize / SEQUENCER_SAMPLE_RATE * 1000.0 * 0.8;
        //this.m_lastTime = 0;
        this.processAllBinded = this.processAll.bind(this);
        this.worker.onrequestbuffer = this.onSampleData.bind(this);
        this.stop();
    }
    
    static getTimer() {
        return self.performance ? self.performance.now() : new Date().getTime();
    }
    
    play(exportAudio: boolean = false): void {
        if (this.m_status === /*MSequencer.STATUS_PAUSE*/1) {
            var bufMSec: number = this.bufferSize / SEQUENCER_SAMPLE_RATE * 1000.0;
            this.m_status = /*MSequencer.STATUS_PLAY*/3;
            this.worker.playSound();
            this.startProcTimer();
        } else {
            //this.m_globalTick = 0;
            this.m_globalSample = 0;
            this.m_totalMSec = this.getTotalMSec();
            for (var i: number = 0; i < this.m_trackArr.length; i++) {
                this.m_trackArr[i].seekTop();
            }
            this.m_maxNowMSec = 0;
            this.lastSample = [0.0, 0.0];
            this.m_status = /*MSequencer.STATUS_BUFFERING*/2;
            this.isExportingAudio = exportAudio;
            this.processStart();
        }
        this.m_lastTime = 0;
        this.m_waitPause = false;
        this.bufferId = 1;
        if (this.worker.infoInterval > 0) {
            this.worker.restartInfoTimer();
        }
    }

    stop(): void {
        clearTimeout(this.m_procTimer);
        this.worker.stopSound();
        this.m_status = /*MSequencer.STATUS_STOP*/0;
        this.m_lastTime = 0;
        this.m_maxNowMSec = 0;
        this.m_waitPause = false;
    }

    pause(): void {
        if (this.isExportingAudio) return;
        switch (this.m_status) {
            case /*MSequencer.STATUS_BUFFERING*/2:
                this.m_waitPause = true;
                break;
            case /*MSequencer.STATUS_PLAY*/3:
                this.worker.stopSound();
                this.m_status = /*MSequencer.STATUS_PAUSE*/1;
                if (this.m_waitPause) {
                    this.worker.syncInfo();
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
            this.m_buffTimer = setTimeout(this.onBufferingReq.bind(this) as Function, 0);
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
            bufSize: number = this.bufferSize,
            sLen: number = bufSize * MSequencer.MULTIPLE,
            bLen: number = Math.min(bufSize * 4, sLen),
            nLen: number = this.m_trackArr.length;

        switch (this.m_step) {
            case /*MSequencer.STEP_PRE*/1:
                buffer = this.m_buffer[1 - this.m_playSide];
                buffer[0].fill(0.0);
                buffer[1].fill(0.0);
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
                    infoInterval: number = this.worker.infoInterval,
                    infoTime: number = this.worker.lastInfoTime + infoInterval;
                do {
                    if (this.m_processTrack >= nLen) {
                        this.m_step++;
                        break;
                    }
                    this.m_trackArr[this.m_processTrack].onSampleData(buffer, this.m_processOffset, this.m_processOffset + bLen);
                    this.m_processOffset += bLen;
                    if (this.m_processOffset >= sLen) {
                        this.m_processTrack++;
                        this.m_processOffset = 0;
                    }
                    if (status === /*MSequencer.STATUS_BUFFERING*/2) {
                        this.worker.buffering((this.m_processTrack * sLen + this.m_processOffset) / (nLen * sLen) * 100.0 | 0);
                    }
                    if (infoInterval > 0 && MSequencer.getTimer() > infoTime) {
                        this.worker.syncInfo();
                        infoTime = this.worker.lastInfoTime + infoInterval;
                    }
                } while (status < /*MSequencer.STATUS_PLAY*/3 || MSequencer.getTimer() < endTime);
                if (infoInterval > 0) {
                    this.worker.syncInfo();
                    this.worker.restartInfoTimer();
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
                        if (!this.isExportingAudio) this.worker.playSound();
                        this.processStart();
                    }
                }
                break;
        }
    }

    private onSampleData(e: MessageEvent<any>): void {
        const data = e.data;
        if (data.bufferId !== this.bufferId) return;

        this.m_lastTime = MSequencer.getTimer();
        if (this.m_status < /*MSequencer.STATUS_PLAY*/3) return;
        if (this.m_globalSample / SEQUENCER_SAMPLE_RATE * 1000.0 >= this.m_totalMSec) {
            this.stop();
            this.worker.complete();
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
        
        var bufSize: number = this.bufferSize;
        var rateRatio: number = AUDIO_BUFFER_SIZE / bufSize;
        var sendBuf: Float32Array[] =
            data.retBuf ||
            Array(2).fill(0).map(() => new Float32Array(this.isExportingAudio ? bufSize : AUDIO_BUFFER_SIZE));
        var base: number = bufSize * this.m_playSize;
        [0, 1].forEach(ch => {
            var samples: Float32Array = this.m_buffer[this.m_playSide][ch].subarray(base, base + bufSize);
            if (bufSize === AUDIO_BUFFER_SIZE || this.isExportingAudio) {
                sendBuf[ch].set(samples);
            } else {
                this.convertRate(samples, sendBuf[ch], rateRatio, this.lastSample[ch]);
                this.lastSample[ch] = samples[samples.length - 1];
            }
        });
        this.worker.sendBuffer(sendBuf);
        this.bufferId++;

        this.m_playSize++;
        this.m_globalSample += bufSize;
    }

    private convertRate(samplesIn: Float32Array, samplesOut: Float32Array, ratio: number, last: number): void {
        var xa: number = (samplesOut.length - 1) / ratio % 1;
        last = last == null ? 0.0 : last;
        for (var i: number = 0; i < samplesOut.length; i++) {
            var x: number = i / ratio - xa;
            // 線形補間
            var x0: number = Math.floor(x);
            var x1: number = Math.ceil(x);
            var y0: number = x0 < 0.0 ? last : samplesIn[x0]
            var y1: number = samplesIn[x1];
            samplesOut[i] = x0 === x1 ? y0 : y0 + (y1 - y0) * (x - x0);
        }
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
            var globalMSec = this.m_globalSample / SEQUENCER_SAMPLE_RATE * 1000.0,
                elapsed = this.m_lastTime ? MSequencer.getTimer() - this.m_lastTime : 0.0,
                bufMSec = this.bufferSize / SEQUENCER_SAMPLE_RATE * 1000.0;
            this.m_maxNowMSec = Math.max(
                this.m_maxNowMSec,
                globalMSec + (this.isExportingAudio ? 0.0 : Math.min(elapsed, bufMSec))
            );
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
