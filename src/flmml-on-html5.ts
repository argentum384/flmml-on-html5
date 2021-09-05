import { MsgTypes, AUDIO_BUFFER_SIZE } from "./common/Consts";
import { FlMMLAudioExportError } from "./common/Errors";
import { FlMMLWorkletScript } from "../src_generated/FlMMLWorkletScript";

type FlMMLOptions = {
    workerURL?: string,
    infoInterval?: number,
    lamejsURL?: string
};

export class FlMML {
    private static readonly DEFAULT_INFO_INTERVAL = 125;
    private static readonly DEFAULT_WORKER_URL = "flmml-on-html5.worker.js";

    private static audioCtx: AudioContext;

    private worker: Worker;
    private events: { [key: string]: Function[] };
    private volume: number;
    private gain: GainNode;
    private workletNode: AudioWorkletNode;
    
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

    private audioExportResolve: (data: ArrayBuffer[]) => void;
    private audioExportReject: (error: any) => void;

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

        // AudioWorklet モジュール追加
        const reader = new FileReader();
        reader.onload = () => {
            FlMML.audioCtx.audioWorklet.addModule(reader.result as string)
                .then(result => {
                    // TODO: addModule() 完了後の処理要るならここに書く, 要らなそうなら消す
                })
        }
        reader.readAsDataURL(new Blob([FlMMLWorkletScript], { type: "application/javascript" }));
    }

    constructor(options: FlMMLOptions | string = FlMML.DEFAULT_WORKER_URL) {
        // 引数が文字列の場合 workerURL のみ指定されたものとみなす
        if (typeof options === "string") {
            options = { workerURL: options };
        }
        options.workerURL = options.workerURL || FlMML.DEFAULT_WORKER_URL;
        options.infoInterval = options.infoInterval >= 0 ?
            options.infoInterval
        :
            FlMML.DEFAULT_INFO_INTERVAL
        ;

        const worker = this.worker = new Worker(options.workerURL);
        worker.addEventListener("message", this.onMessage.bind(this));

        this.warnings = "";
        this.totalTimeStr = "00:00";
        this.volume = 100.0;

        this.events = {};
        
        worker.postMessage({
            type: MsgTypes.BOOT,
            sampleRate: FlMML.audioCtx.sampleRate,
            lamejsURL: options.lamejsURL
        });
        this.setInfoInterval(options.infoInterval);
    }

    private onMessage(e: MessageEvent<any>) {
        const data = e.data;
        const type = data.type;

        switch (type) {
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
                this.stopSound();
                break;
            case MsgTypes.EXPORT:
                if (data.data) {
                    this.audioExportResolve(data.data);
                    this.audioExportResolve = null;
                    this.audioExportReject = null;
                } else {
                    this.errorAudioExport(data.errorMsg);
                }
                break;
        }
    }

    private playSound() {
        if (this.gain || this.workletNode) return;

        const audioCtx = FlMML.audioCtx;

        const gain = this.gain = audioCtx.createGain();
        gain.gain.value = this.volume / 127.0;
        gain.connect(audioCtx.destination);

        const workletNode = this.workletNode = new AudioWorkletNode(FlMML.audioCtx, "flmml-worklet-processor", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2]
        });
        workletNode.connect(gain);

        // Transfer MessagePort of AudioWorkletNode
        this.worker.postMessage({ type: MsgTypes.PLAYSOUND, workletPort: workletNode.port }, [workletNode.port]);
    }

    private stopSound() {
        if (this.gain) { this.gain.disconnect(); this.gain = null; }
        if (this.workletNode) { this.workletNode.disconnect(); this.workletNode = null; }
        this.worker.postMessage({ type: MsgTypes.STOPSOUND });
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

    private exportAudio(mml: string, format: string, options: {} = {}): Promise<ArrayBuffer[]> {
        return new Promise<ArrayBuffer[]>((resolve, reject) => {
            if (this.audioExportResolve) {
                reject(new FlMMLAudioExportError("Another process is already running"))
                return;
            }
            this.worker.postMessage({
                type: MsgTypes.EXPORT,
                mml: mml,
                format: format,
                ...options
            });
            this.audioExportResolve = resolve;
            this.audioExportReject = reject;
        });
    }

    private errorAudioExport(msg: string): void {
        if (!this.audioExportReject) return;
        this.audioExportReject(new FlMMLAudioExportError(msg));
        this.audioExportResolve = null;
        this.audioExportReject = null;
    }

    play(mml: string) {
        this.worker.postMessage({ type: MsgTypes.PLAY, mml: mml });
        if (this.audioExportResolve) {
            this.errorAudioExport("Aborted exporting audio file");
        }
    }

    stop() {
        this.worker.postMessage({ type: MsgTypes.STOP });
        if (this.audioExportResolve) {
            this.errorAudioExport("Aborted exporting audio file");
        }
    }

    pause() {
        this.worker.postMessage({ type: MsgTypes.PAUSE });
    }

    exportWav(mml: string): Promise<ArrayBuffer[]> {
        return this.exportAudio(mml, "wav");
    }

    exportMp3(mml: string, bitrate?: number): Promise<ArrayBuffer[]> {
        return this.exportAudio(mml, "mp3", { bitrate: bitrate });
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
