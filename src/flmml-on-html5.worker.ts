import { MsgTypes } from "./common/Consts";
import { MML } from "./flmml/MML";

export class FlMMLWorker {
    private mml: MML;
    private tIDInfo: number;

    audioSampleRate: number;
    infoInterval: number;
    lastInfoTime: number;
    onInfoTimerBinded: Function;

    onstopsound: Function = null;
    onrequestbuffer: Function = null;

    constructor() {
        this.onInfoTimerBinded = this.onInfoTimer.bind(this);

        addEventListener("message", this.onMessage.bind(this));
    }

    private onMessage(e: MessageEvent<any>) {
        var data: any = e.data,
            type: number = data.type,
            mml: MML = this.mml;

        switch (type) {
            case MsgTypes.BOOT:
                this.audioSampleRate = data.sampleRate;
                this.mml = new MML(this);
                break;
            case MsgTypes.PLAY:
                mml.play(data.mml);
                break;
            case MsgTypes.STOP:
                mml.stop();
                this.syncInfo();
                break;
            case MsgTypes.PAUSE:
                mml.pause();
                this.syncInfo();
                break;
            case MsgTypes.BUFFER:
                this.onrequestbuffer && this.onrequestbuffer(data);
                break;
            case MsgTypes.SYNCINFO:
                if (typeof data.interval === "number") {
                    this.infoInterval = data.interval;
                    clearInterval(this.tIDInfo);
                    if (this.infoInterval > 0 && this.mml.isPlaying()) {
                        this.tIDInfo = setInterval(this.onInfoTimerBinded, this.infoInterval);
                    }
                } else {
                    this.syncInfo();
                }
                break;
            case MsgTypes.STOPSOUND:
                this.onstopsound && this.onstopsound();
                break;
        }
    }

    buffering(progress: number): void {
        postMessage({ type: MsgTypes.BUFRING, progress: progress });
    }

    compileComplete(): void {
        var mml: MML = this.mml;

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

    stopSound(flushBuf: boolean = false): void {
        postMessage({ type: MsgTypes.STOPSOUND, flushBuf: flushBuf });
    }

    sendBuffer(buffer: Array<Float32Array>): void {
        postMessage({ type: MsgTypes.BUFFER, buffer: buffer }, [buffer[0].buffer, buffer[1].buffer]);
    }

    complete(): void {
        postMessage({ type: MsgTypes.COMPLETE });
        this.syncInfo();
    }

    syncInfo(): void {
        var mml: MML = this.mml;

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
        this.tIDInfo = setInterval(this.onInfoTimerBinded, this.infoInterval);
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
