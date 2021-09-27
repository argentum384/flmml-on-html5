import { MsgTypes, SAMPLE_RATE } from "./common/Consts";
import { FlMMLOptions } from "./common/Types";
import { FlMMLAudioExportError } from "./common/Errors";
import { FlMMLWorkletScript } from "../src_generated/FlMMLWorkletScript";

// CSS セレクタ文字列を指定した場合対象の DOM 要素クリック時に Web Audio 初期化処理を行う
// (FlMML.prepare(playerSelectors) の呼び出しは不要になる)
const PLAYER_SELECTORS: string = null;

export class FlMML {
    private static readonly DEFAULT_INFO_INTERVAL = 125;
    private static readonly DEFAULT_WORKER_URL = "flmml-on-html5.worker.js";
    private static readonly DEFAULT_BUFFER_SIZE = 8192;
    private static readonly DEFAULT_BUFFER_MULTIPLE = 32;

    private static audioCtx: AudioContext;

    private worker: Worker;
    private booted: boolean = false;
    private volume: number = 100.0;
    private bufferSize: number;
    private bufferMultiple: number;
    private lamejsURL: string;
    private events: { [key: string]: ((...args: any[]) => void)[] } = {};

    private gainNode: GainNode;
    private workletNode: AudioWorkletNode;
    private workletModuleLoaded: boolean = false;
    
    private totalMSec: number = 0;
    private totalTimeStr: string = "00:00";
    private warnings: string = "";
    private metaTitle: string = "";
    private metaComment: string = "";
    private metaArtist: string = "";
    private metaCoding: string = "";

    private _isPlaying: boolean = false;
    private _isPaused: boolean = false;
    private nowMSec: number = 0;
    private nowTimeStr: string = "00:00";
    private voiceCount: number = 0;

    private audioExportResolve: (data: ArrayBuffer[]) => void;
    private audioExportReject: (error: any) => void;

    oncompilecomplete: () => void;
    onbuffering: (e: any) => void;
    oncomplete: () => void;
    onsyncinfo: () => void;

    private static initWebAudio(): void {
        // Web Audioコンテキスト生成
        // iOS14.5以上では AudioContext 生成時点で他アプリのバックグラウンド再生が止まるので、
        // 必要になったタイミングで生成する
        const audioCtx = FlMML.audioCtx = new AudioContext({
            sampleRate: SAMPLE_RATE
        });

        // iOS/Chrome向けWeb Audioアンロック処理
        const bufSrcDmy = audioCtx.createBufferSource();
        bufSrcDmy.connect(audioCtx.destination);
        bufSrcDmy.start(0);
        audioCtx.resume();
        bufSrcDmy.stop();
    }

    private static hookInitWebAudio(playerSelectors: string): void {
        const players = document.querySelectorAll(playerSelectors);
        players.forEach(p => {
            p.addEventListener("click", function onClick() {
                if (!FlMML.audioCtx) FlMML.initWebAudio();
                players.forEach(p2 => {
                    p2.removeEventListener("click", onClick, true);
                });
            }, true);
        });
    }

    static prepare(playerSelectors: string): void {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                FlMML.hookInitWebAudio(playerSelectors);
            });
        } else {
            FlMML.hookInitWebAudio(playerSelectors);
        }
    }

    constructor(options: FlMMLOptions | string = FlMML.DEFAULT_WORKER_URL) {
        // 引数が文字列の場合 workerURL のみ指定されたものとみなす
        if (typeof options === "string") {
            options = { workerURL: options };
        }
        const workerURL = options.workerURL || FlMML.DEFAULT_WORKER_URL;
        const infoInterval = options.infoInterval >= 0 ?
            options.infoInterval
        :
            FlMML.DEFAULT_INFO_INTERVAL
        ;
        this.bufferSize = options.bufferSize >= 128 ?
            Math.floor(options.bufferSize - options.bufferSize % 128)
        :
            FlMML.DEFAULT_BUFFER_SIZE
        ;
        this.bufferMultiple = options.bufferMultiple >= 1 ?
            Math.floor(options.bufferMultiple)
        :
            FlMML.DEFAULT_BUFFER_MULTIPLE
        ;
        this.lamejsURL = options.lamejsURL;

        const worker = this.worker = new Worker(
            options.crossOriginWorker ?
                URL.createObjectURL(new Blob(
                    [`importScripts("${workerURL}")`],
                    { type: "application/javascript" }
                ))
            :
                workerURL
        );
        worker.addEventListener("message", e => { this.onMessage(e); });
        this.setInfoInterval(infoInterval);
    }

    private onMessage(e: MessageEvent<any>): void {
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
                if (this.oncompilecomplete) this.oncompilecomplete();
                this.trigger("compilecomplete");
                break;
            case MsgTypes.BUFRING:
                if (this.onbuffering) this.onbuffering(data);
                this.trigger("buffering", { progress: data.progress });
                break;
            case MsgTypes.COMPLETE:
                if (this.oncomplete) this.oncomplete();
                this.trigger("complete");
                break;
            case MsgTypes.SYNCINFO:
                this._isPlaying = data.info._isPlaying;
                this._isPaused = data.info._isPaused;
                this.nowMSec = data.info.nowMSec;
                this.nowTimeStr = data.info.nowTimeStr;
                this.voiceCount = data.info.voiceCount;
                if (this.onsyncinfo) this.onsyncinfo();
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
                    this.completeAudioExport(data.data);
                } else {
                    this.errorAudioExport(data.errorMsg);
                }
                break;
        }
    }

    private boot(): void {
        this.worker.postMessage({
            type: MsgTypes.BOOT,
            bufferSize: this.bufferSize,
            bufferMultiple: this.bufferMultiple,
            lamejsURL: this.lamejsURL
        });
        this.booted = true;
    }

    private playSound(): void {
        if (this.gainNode || this.workletNode) return;

        const audioCtx = FlMML.audioCtx;

        const gainNode = this.gainNode = audioCtx.createGain();
        gainNode.gain.value = this.volume / 127.0;
        gainNode.connect(audioCtx.destination);

        (async () => {
            // 初回のみ AudioWorklet にモジュール追加
            if (!this.workletModuleLoaded) {
                await new Promise<void>(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => {
                        audioCtx.audioWorklet.addModule(e.target.result as string)
                            .then(resolve)
                    }
                    reader.readAsDataURL(
                        new Blob([FlMMLWorkletScript],
                        { type: "application/javascript" })
                    );
                });
                this.workletModuleLoaded = true;
            }

            const workletNode = this.workletNode = new AudioWorkletNode(audioCtx, "flmml-worklet-processor", {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [2]
            });
            workletNode.connect(gainNode);

            // Transfer MessagePort of AudioWorkletNode
            this.worker.postMessage({ type: MsgTypes.PLAYSOUND, workletPort: workletNode.port }, [workletNode.port]);
        })();
    }

    private stopSound(): void {
        if (this.gainNode) { this.gainNode.disconnect(); this.gainNode = null; }
        if (this.workletNode) { this.workletNode.disconnect(); this.workletNode = null; }
        this.worker.postMessage({ type: MsgTypes.STOPSOUND });
    }

    private trigger(type: string, args?: {}): void {
        const handlers = this.events[type];
        if (!handlers) return;

        // Deep copy
        const e = {};
        for (let name in args) {
            e[name] = args[name];
        }

        for (let i = 0, len = handlers.length; i < len; i++) {
            if (handlers[i]) handlers[i].call(this, e);
        }
    }

    private exportAudio(mml: string, format: string, options: {} = {}): Promise<ArrayBuffer[]> {
        if (!FlMML.audioCtx) FlMML.initWebAudio();
        if (!this.booted) this.boot();

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

    private completeAudioExport(data: ArrayBuffer[]): void {
        if (!this.audioExportResolve) return;
        this.audioExportResolve(data);
        this.audioExportResolve = null;
        this.audioExportReject = null;
    }

    private errorAudioExport(msg: string): void {
        if (!this.audioExportReject) return;
        this.audioExportReject(new FlMMLAudioExportError(msg));
        this.audioExportResolve = null;
        this.audioExportReject = null;
    }

    play(mml: string): void {
        // Web Audio 初期化が間に合わなかった場合の救済措置
        // ここで初期化すると再生されない場合あり
        if (!FlMML.audioCtx) FlMML.initWebAudio();

        if (!this.booted) this.boot();
        this.worker.postMessage({ type: MsgTypes.PLAY, mml: mml });
    }

    stop(): void {
        this.worker.postMessage({ type: MsgTypes.STOP });
    }

    pause(): void {
        this.worker.postMessage({ type: MsgTypes.PAUSE });
    }

    exportWav(mml: string): Promise<ArrayBuffer[]> {
        return this.exportAudio(mml, "wav");
    }

    exportMp3(mml: string, bitrate?: number): Promise<ArrayBuffer[]> {
        return this.exportAudio(mml, "mp3", { bitrate: bitrate });
    }

    setMasterVolume(volume: number): void {
        this.volume = volume;
        if (this.gainNode) this.gainNode.gain.value = this.volume / 127.0;
    }

    isPlaying(): boolean {
        return this._isPlaying;
    }

    isPaused(): boolean {
        return this._isPaused;
    }

    getWarnings(): string {
        return this.warnings;
    }

    getTotalMSec(): number {
        return Math.floor(this.totalMSec);
    }

    getTotalTimeStr(): string {
        return this.totalTimeStr;
    }

    getNowMSec(): number {
        return Math.floor(this.nowMSec);
    }

    getNowTimeStr(): string {
        return this.nowTimeStr;
    }

    getVoiceCount(): number {
        return this.voiceCount;
    }

    getMetaTitle(): string {
        return this.metaTitle;
    }

    getMetaComment(): string {
        return this.metaComment;
    }

    getMetaArtist(): string {
        return this.metaArtist;
    }

    getMetaCoding(): string {
        return this.metaCoding;
    }

    setInfoInterval(interval: number): void {
        this.worker.postMessage({ type: MsgTypes.SYNCINFO, interval: interval });
    }

    syncInfo(): void {
        this.worker.postMessage({ type: MsgTypes.SYNCINFO, interval: null });
    }

    addEventListener(type: string, listener: (...args: any[]) => void): boolean {
        let handlers = this.events[type];

        if (!handlers) handlers = this.events[type] = [];
        for (let i = handlers.length; i--;) {
            if (handlers[i] === listener) return false;
        }
        handlers.push(listener);
        return true;
    }

    removeEventListener(type: string, listener: (...args: any[]) => void): boolean {
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

    release(): void {
        this.stopSound();
        this.worker.terminate();
    }
}

export {
    FlMMLOptions,
    FlMMLAudioExportError
};

// v1.x 系後方互換
export const FlMMLonHTML5 = FlMML;

// スクリプト読み込み時に実行
if (PLAYER_SELECTORS) FlMML.prepare(PLAYER_SELECTORS);
