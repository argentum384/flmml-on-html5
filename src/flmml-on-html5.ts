import { MsgTypes } from "./messenger/MsgTypes";

type FlMMLOptions = {
    workerURL?: string,
    bufferSize?: number,
    infoInterval?: number
};

export class FlMML {
    private static readonly DEFAULT_BUFFER_SIZE = 8192;
    private static readonly DEFAULT_INFO_INTERVAL = 125;
    private static readonly DEFAULT_WORKER_URL = "flmml-on-html5.worker.js";

    private static audioCtx: AudioContext;

    private worker: Worker;
    private buffer: AudioBuffer;
    private bufferSize: number;
    private bufferReady: boolean;
    private onAudioProcessBinded: any;
    private emptyBuffer: Float32Array;
    private events: { [key: string]: Function[] };
    private volume: number;
    private gain: GainNode;
    private scrProc: ScriptProcessorNode;
    private oscDmy: OscillatorNode;
    
    private totalMSec: number;
    private totalTimeStr: string;
    private warnings: string;
    private metaTitle: string;
    private metaComment: string;
    private metaArtist: string;
    private metaCoding: string;

    private _isPlaying: boolean;
    private _isPaused: boolean;
    private nowMSec: number;
    private nowTimeStr: string;
    private voiceCount: number;

    oncompilecomplete: () => void;
    onbuffering: (e: any) => void;
    oncomplete: () => void;
    onsyncinfo: () => void;

    // iOS/Chrome向けWeb Audioアンロック処理
    private static unlockWebAudio() {
        window.addEventListener("click", function onClick() {
            const audioCtx = FlMML.audioCtx;
            const bufSrcDmy = audioCtx.createBufferSource();
            bufSrcDmy.connect(audioCtx.destination);
            bufSrcDmy.start(0);
            audioCtx.resume();
            window.removeEventListener("click", onClick, true);
        }, true);
    }

    static init() {
        // Web Audioコンテキスト作成
        FlMML.audioCtx = new AudioContext();

        if (document.readyState === "complete") {
            FlMML.unlockWebAudio();
        } else {
            document.addEventListener("DOMContentLoaded", FlMML.unlockWebAudio, false);
        }
    }

    constructor(options: FlMMLOptions | string = FlMML.DEFAULT_WORKER_URL) {
        // 引数が文字列の場合 workerURL のみ指定されたものとみなす
        if (typeof options === "string") {
            options = { workerURL: options };
        }
        options.workerURL = options.workerURL || FlMML.DEFAULT_WORKER_URL;
        options.bufferSize = options.bufferSize >= 128 ?
            options.bufferSize - options.bufferSize % 128
        :
            FlMML.DEFAULT_BUFFER_SIZE
        ;
        options.infoInterval = options.infoInterval >= 0 ?
            options.infoInterval
        :
            FlMML.DEFAULT_INFO_INTERVAL
        ;

        const worker = this.worker = new Worker(options.workerURL);
        worker.addEventListener("message", this.onMessage.bind(this));

        this.onAudioProcessBinded = this.onAudioProcess.bind(this);
        this.warnings = "";
        this.totalTimeStr = "00:00";
        this.bufferSize = options.bufferSize;
        this.bufferReady = false;
        this.volume = 100.0;
        this.emptyBuffer = new Float32Array(options.bufferSize);

        this.events = {};
        
        worker.postMessage({
            type: MsgTypes.BOOT,
            sampleRate: FlMML.audioCtx.sampleRate,
            bufferSize: this.bufferSize
        });
        this.setInfoInterval(options.infoInterval);
    }

    private onMessage(e: any) {
        const data = e.data;
        const type = data.type;

        switch (type) {
            case MsgTypes.BUFFER:
                this.buffer = data.buffer;
                this.bufferReady = true;
                break;
            case MsgTypes.COMPCOMP:
                this.totalMSec = data.info.totalMSec;
                this.totalTimeStr = data.info.totalTimeStr;
                this.warnings = data.info.warnings;
                this.metaTitle = data.info.metaTitle;
                this.metaComment = data.info.metaComment;
                this.metaArtist = data.info.metaArtist;
                this.metaCoding = data.info.metaCoding;
                this.oncompilecomplete && this.oncompilecomplete();
                this.trigger("compilecomplete");
                break;
            case MsgTypes.BUFRING:
                this.onbuffering && this.onbuffering(data);
                this.trigger("buffering", data);
                break;
            case MsgTypes.COMPLETE:
                this.oncomplete && this.oncomplete();
                this.trigger("complete");
                break;
            case MsgTypes.SYNCINFO:
                this._isPlaying = data.info._isPlaying;
                this._isPaused = data.info._isPaused;
                this.nowMSec = data.info.nowMSec;
                this.nowTimeStr = data.info.nowTimeStr;
                this.voiceCount = data.info.voiceCount;
                this.onsyncinfo && this.onsyncinfo();
                this.trigger("syncinfo");
                break;
            case MsgTypes.PLAYSOUND:
                this.playSound();
                break;
            case MsgTypes.STOPSOUND:
                this.stopSound(data.flushBuf);
                this.worker.postMessage({ type: MsgTypes.STOPSOUND });
                break;
        }
    }

    private playSound() {
        if (this.gain || this.scrProc || this.oscDmy) return;

        const audioCtx = FlMML.audioCtx;

        const gain = this.gain = audioCtx.createGain();
        gain.gain.value = this.volume / 127.0;
        gain.connect(audioCtx.destination);

        this.scrProc = audioCtx.createScriptProcessor(this.bufferSize, 1, 2);
        this.scrProc.addEventListener("audioprocess", this.onAudioProcessBinded);
        this.scrProc.connect(this.gain);

        // iOS Safari対策
        this.oscDmy = audioCtx.createOscillator();
        this.oscDmy.connect(this.scrProc);
        this.oscDmy.start(0);
    }

    private stopSound(flushBuf: boolean = false) {
        if (flushBuf) this.bufferReady = false;
        if (this.gain || this.scrProc || this.oscDmy) {
            this.scrProc.removeEventListener("audioprocess", this.onAudioProcessBinded);
            if (this.gain) { this.gain.disconnect(); this.gain = null; }
            if (this.scrProc) { this.scrProc.disconnect(); this.scrProc = null; }
            if (this.oscDmy) { this.oscDmy.disconnect(); this.oscDmy = null; }
        }
    }

    private onAudioProcess(e: AudioProcessingEvent) {
        const outBuf = e.outputBuffer;

        if (this.bufferReady) {
            outBuf.getChannelData(0).set(this.buffer[0]);
            outBuf.getChannelData(1).set(this.buffer[1]);
            this.bufferReady = false;
            this.worker.postMessage({ type: MsgTypes.BUFFER, retBuf: this.buffer }, [this.buffer[0].buffer, this.buffer[1].buffer]);
        } else {
            outBuf.getChannelData(0).set(this.emptyBuffer);
            outBuf.getChannelData(1).set(this.emptyBuffer);
            this.worker.postMessage({ type: MsgTypes.BUFFER, retBuf: null });
        }
    }

    private trigger(type: string, args?: {}) {
        const handlers = this.events[type];
        if (!handlers) return;

        // Deep copy
        const e = {};
        for (let name in args) {
            e[name] = args[name];
        }

        for (let i = 0, len = handlers.length; i < len; i++) {
            handlers[i] && handlers[i].call(this, e);
        }
    }

    play(mml: string) {
        this.worker.postMessage({ type: MsgTypes.PLAY, mml: mml });
    }

    stop() {
        this.worker.postMessage({ type: MsgTypes.STOP });
    }

    pause() {
        this.worker.postMessage({ type: MsgTypes.PAUSE });
    }

    setMasterVolume(volume: number) {
        this.volume = volume;
        if (this.gain) this.gain.gain.value = this.volume / 127.0;
    }

    isPlaying() {
        return this._isPlaying;
    }

    isPaused() {
        return this._isPaused;
    }

    getWarnings() {
        return this.warnings;
    }

    getTotalMSec() {
        return Math.floor(this.totalMSec);
    }

    getTotalTimeStr() {
        return this.totalTimeStr;
    }

    getNowMSec() {
        return Math.floor(this.nowMSec);
    }

    getNowTimeStr() {
        return this.nowTimeStr;
    }

    getVoiceCount() {
        return this.voiceCount;
    }

    getMetaTitle() {
        return this.metaTitle;
    }

    getMetaComment() {
        return this.metaComment;
    }

    getMetaArtist() {
        return this.metaArtist;
    }

    getMetaCoding() {
        return this.metaCoding;
    }

    setInfoInterval(interval: number) {
        this.worker.postMessage({ type: MsgTypes.SYNCINFO, interval: interval });
    }

    syncInfo() {
        this.worker.postMessage({ type: MsgTypes.SYNCINFO, interval: null });
    }

    addEventListener(type: string, listener: Function) {
        let handlers = this.events[type];

        if (!handlers) handlers = this.events[type] = [];
        for (let i = handlers.length; i--;) {
            if (handlers[i] === listener) return false;
        }
        handlers.push(listener);
        return true;
    }

    removeEventListener(type: string, listener: Function) {
        const handlers = this.events[type];

        if (!handlers) return false;
        for (let i = handlers.length; i--;) {
            if (handlers[i] === listener) {
                handlers.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    release() {
        this.stopSound();
        this.worker.terminate();
    }
}

// v1.x 系後方互換
export const FlMMLonHTML5 = FlMML;

// スクリプト読み込み時に実行
FlMML.init();
