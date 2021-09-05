import { MsgTypes, AUDIO_BUFFER_SIZE } from "./common/Consts";
import { FlMMLWorkletScript } from "../src_generated/FlMMLWorkletScript";

// CSS セレクタ文字列を指定した場合対象の DOM 要素クリック時に Web Audio 初期化処理を行う
// (FlMML.init(playerSelectors) の呼び出しは不要になる)
const PLAYER_SELECTORS: string = null;

type FlMMLOptions = {
    workerURL?: string,
    infoInterval?: number,
    crossOriginWorker?: boolean
};

export class FlMML {
    private static readonly DEFAULT_INFO_INTERVAL = 125;
    private static readonly DEFAULT_WORKER_URL = "flmml-on-html5.worker.js";

    private static audioCtx: AudioContext;

    private worker: Worker;
    private booted: boolean = false;
    private volume: number = 100.0;
    private events: { [key: string]: Function[] } = {};

    private gain: GainNode;
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

    oncompilecomplete: () => void;
    onbuffering: (e: any) => void;
    oncomplete: () => void;
    onsyncinfo: () => void;

    private static initWebAudio(): void {
        // Web Audioコンテキスト生成
        // iOS14.5以上では AudioContext 生成時点で他アプリのバックグラウンド再生が止まるので、
        // 必要になったタイミングで生成する
        const audioCtx = FlMML.audioCtx = new AudioContext();

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

    static init(playerSelectors: string) {
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

        const worker = this.worker = new Worker(
            options.crossOriginWorker ?
                URL.createObjectURL(new Blob(
                    [`importScripts("${workerURL}")`],
                    { type: "application/javascript" }
                ))
            :
                workerURL
        );
        worker.addEventListener("message", this.onMessage.bind(this));
        this.setInfoInterval(infoInterval);
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
        }
    }

    private playSound() {
        if (this.gain || this.workletNode) return;

        const audioCtx = FlMML.audioCtx;

        const gain = this.gain = audioCtx.createGain();
        gain.gain.value = this.volume / 127.0;
        gain.connect(audioCtx.destination);

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
            workletNode.connect(gain);

            // Transfer MessagePort of AudioWorkletNode
            this.worker.postMessage({ type: MsgTypes.PLAYSOUND, workletPort: workletNode.port }, [workletNode.port]);
        })();
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

    play(mml: string) {
        // Web Audio 初期化が間に合わなかった場合の救済措置
        // ここで初期化すると再生されない場合あり
        if (!FlMML.audioCtx) FlMML.initWebAudio();

        if (!this.booted) {
            this.worker.postMessage({
                type: MsgTypes.BOOT,
                sampleRate: FlMML.audioCtx.sampleRate,
            });
            this.booted = true;
        }
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
if (PLAYER_SELECTORS) FlMML.init(PLAYER_SELECTORS);
