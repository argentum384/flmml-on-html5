import { MsgTypes } from "./common/Consts";
import { FlMMLAudioExportError } from "./common/Errors";
import { SampleDataEvent } from "./common/Types";
import { AudioExport } from "./audioExport/AudioExport";
import { WavExport } from "./audioExport/WavExport";
import { Mp3Export } from "./audioExport/Mp3Export";
import { MML } from "./flmml/MML";

export class FlMMLWorker {
    private mml: MML;
    private audioExport: AudioExport;

    private tIDInfo: number;

    audioSampleRate: number;
    infoInterval: number;
    lastInfoTime: number;
    workletPort: MessagePort;
    onInfoTimerBinded: () => void;

    onstopsound: () => void;
    onrequestbuffer: (e: SampleDataEvent) => void;

    constructor() {
        this.onInfoTimerBinded = () => { this.onInfoTimer(); };
        addEventListener("message", e => { this.onMessage(e); });
    }

    private onMessage(e: MessageEvent<any>): void {
        const data = e.data;
        const type: number = data.type;
        const mml = this.mml;

        switch (type) {
            case MsgTypes.BOOT:
                this.audioSampleRate = data.sampleRate;
                this.mml = new MML(this);
                if (data.lamejsURL) self.importScripts(data.lamejsURL);
                break;
            case MsgTypes.PLAY:
                if (!mml) break;
                mml.play(data.mml);
                if (this.audioExport) this.completeAudioExport();
                break;
            case MsgTypes.STOP:
                if (!mml) break;
                mml.stop();
                this.syncInfo();
                if (this.audioExport) this.completeAudioExport();
                break;
            case MsgTypes.PAUSE:
                if (!mml) break;
                mml.pause();
                this.syncInfo();
                break;
            case MsgTypes.SYNCINFO:
                if (typeof data.interval === "number") {
                    this.infoInterval = data.interval;
                    clearInterval(this.tIDInfo);
                    if (this.infoInterval > 0 && this.mml && this.mml.isPlaying()) {
                        this.tIDInfo = self.setInterval(this.onInfoTimerBinded, this.infoInterval);
                    }
                } else {
                    this.syncInfo();
                }
                break;
            case MsgTypes.PLAYSOUND:
                this.workletPort = data.workletPort;
                this.workletPort.onmessage = e => { this.onrequestbuffer(e.data); };
                break;
            case MsgTypes.STOPSOUND:
                if (this.onstopsound) this.onstopsound();
                break;
            case MsgTypes.EXPORT:
                if (!mml) {
                    postMessage({ type: MsgTypes.EXPORT, errorMsg: "Sequencer is not ready"});
                    break;
                }
                mml.stop();
                try {
                    switch (data.format) {
                        case "wav": this.audioExport = new WavExport(); break;
                        case "mp3": this.audioExport = new Mp3Export(data.bitrate); break;
                    }
                } catch (ex) {
                    if (ex instanceof FlMMLAudioExportError) {
                        postMessage({ type: MsgTypes.EXPORT, errorMsg: ex.message });
                        return;
                    } else {
                        throw ex;
                    }
                }
                mml.play(data.mml, true);
                this.audioExport.beginRequest(this.onrequestbuffer);
                break;
        }
    }

    private completeAudioExport(): void {
        const data = this.audioExport.complete();
        postMessage({ type: MsgTypes.EXPORT, data: data }, data);
        this.audioExport = null;
    }

    buffering(progress: number): void {
        postMessage({ type: MsgTypes.BUFRING, progress: progress });
    }

    compileComplete(): void {
        const mml = this.mml;

        postMessage({
            type: MsgTypes.COMPCOMP,
            info: {
                totalMSec: mml.getTotalMSec(),
                totalTimeStr: mml.getTotalTimeStr(),
                warnings: mml.getWarnings(),
                metaTitle: mml.getMetaTitle(),
                metaComment: mml.getMetaComment(),
                metaArtist: mml.getMetaArtist(),
                metaCoding: mml.getMetaCoding()
            }
        });
    }

    playSound(): void {
        postMessage({ type: MsgTypes.PLAYSOUND });
        this.syncInfo();
    }

    stopSound(): void {
        if (this.workletPort) {
            this.workletPort.onmessage = null;
            this.workletPort.postMessage({ release: true });
        }
        postMessage({ type: MsgTypes.STOPSOUND });
    }

    sendBuffer(buffer: Float32Array[]): void {
        if (this.audioExport) {
            this.audioExport.process(buffer);
            this.audioExport.request(buffer);
        } else {
            this.workletPort.postMessage({ buffer: buffer }, [buffer[0].buffer, buffer[1].buffer]);
        }
    }

    complete(): void {
        postMessage({ type: MsgTypes.COMPLETE });
        this.syncInfo();
        if (this.audioExport) this.completeAudioExport();
    }

    syncInfo(): void {
        const mml = this.mml;
        if (!mml) return;

        this.lastInfoTime = self.performance ? self.performance.now() : new Date().getTime();
        postMessage({
            type: MsgTypes.SYNCINFO,
            info: {
                _isPlaying: mml.isPlaying(),
                _isPaused: mml.isPaused(),
                nowMSec: mml.getNowMSec(),
                nowTimeStr: mml.getNowTimeStr(),
                voiceCount: mml.getVoiceCount()
            }
        });
    }

    restartInfoTimer(): void {
        clearInterval(this.tIDInfo);
        this.tIDInfo = self.setInterval(this.onInfoTimerBinded, this.infoInterval);
    }

    onInfoTimer(): void {
        if (this.mml.isPlaying()) {
            this.syncInfo();
        } else {
            clearInterval(this.tIDInfo);
        }
    }
}

new FlMMLWorker();
