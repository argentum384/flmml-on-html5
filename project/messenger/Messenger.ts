/// <reference path="../flmml/MML.ts" />

module messenger {
    import MML = flmml.MML;

    var COM_BOOT      =  1, // Main->Worker
		COM_PLAY      =  2, // Main->Worker
		COM_STOP      =  3, // Main->Worker
		COM_PAUSE     =  4, // Main->Worker
		COM_BUFFER    =  5, // Main->Worker->Main
		COM_COMPCOMP  =  6, // Worker->Main
		COM_BUFRING   =  7, // Worker->Main
		COM_COMPLETE  =  8, // Worker->Main
		COM_SYNCINFO  =  9, // Main->Worker->Main
		COM_PLAYSOUND = 10, // Worker->Main
		COM_STOPSOUND = 11, // Worker->Main->Worker
		COM_DEBUG     = 12; // Worker->Main

    export class Messenger {
        mml: MML;
        tIDInfo: number;
        infoInterval: number;
        lastInfoTime: number;

        onStopSound: Function = null;
        onRequestBuffer: Function = null;
        onInfoTimerBinded: Function;

        constructor() {
            this.onInfoTimerBinded = this.onInfoTimer.bind(this);

            addEventListener("message", this.onMessage.bind(this));
        }

        onMessage(e: any) {
            var data: any = e.data,
                type: number = data.type,
                mml: MML = this.mml;

            if (!type) return;
            //console.log("Worker received " + type);
            switch (type) {
                case COM_BOOT:
                    SAMPLE_RATE = data.sampleRate;
                    this.mml = new MML();
                    break;
                case COM_PLAY:
                    mml.play(data.mml);
                    break;
                case COM_STOP:
                    mml.stop();
                    this.syncInfo();
                    break;
                case COM_PAUSE:
                    mml.pause();
                    this.syncInfo();
                    break;
                case COM_BUFFER:
                    if (this.onRequestBuffer) this.onRequestBuffer(data);
                    break;
                case COM_SYNCINFO:
                    if (typeof data.interval === "number") {
                        this.infoInterval = data.interval;
                        clearInterval(this.tIDInfo);
                        if (this.infoInterval !== 0) {
                            setInterval(this.onInfoTimerBinded, this.infoInterval);
                        }
                    } else {
                        this.syncInfo();
                    }
                    break;
                case COM_STOPSOUND:
                    if (this.onStopSound) this.onStopSound();
                    break;
            }
        }

        buffering(progress: number): void {
            postMessage({ type: COM_BUFRING, progress: progress });
        }

        compileComplete(): void {
            var mml: MML = this.mml;

            postMessage({
                type: COM_COMPCOMP,
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
            postMessage({ type: COM_PLAYSOUND });
            this.syncInfo();
        }

        stopSound(onStopSound: Function = null, isFlushBuf: boolean = false): void {
            postMessage({ type: COM_STOPSOUND, isFlushBuf: isFlushBuf });
            this.onStopSound = (onStopSound) ? onStopSound : null;
        }

        sendBuffer(buffer: Array<Float32Array>): void {
            try {
                postMessage({ type: COM_BUFFER, buffer: buffer }, [buffer[0].buffer, buffer[1].buffer]);
            } catch (e) {
                console.log("Buffer is null");
            }
        }

        complete(): void {
            postMessage({ type: COM_COMPLETE });
            this.syncInfo();
        }

        syncInfo(): void {
            var mml: MML = this.mml;

            this.lastInfoTime = self.performance ? self.performance.now() : new Date().getTime();
            postMessage({
                type: COM_SYNCINFO,
                info: {
                    _isPlaying: mml.isPlaying(),
                    _isPaused: mml.isPaused(),
                    nowMSec: mml.getNowMSec(),
                    nowTimeStr: mml.getNowTimeStr(),
                    voiceCount: mml.getVoiceCount()
                }
            });
        }

        onInfoTimer(): void {
            if (this.mml.isPlaying()) this.syncInfo();
        }

        debug(str: string): void {
            postMessage({ type: COM_DEBUG, str: str ? str : "" });
        }
    }
}

var msgr: messenger.Messenger = new messenger.Messenger();
