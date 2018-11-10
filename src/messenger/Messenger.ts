/// <reference path="../flmml/MML.ts" />

module messenger {
    import MML = flmml.MML;

    export class Messenger {
        static readonly COM_BOOT     : number =  1; // Main->Worker
        static readonly COM_PLAY     : number =  2; // Main->Worker
        static readonly COM_STOP     : number =  3; // Main->Worker
        static readonly COM_PAUSE    : number =  4; // Main->Worker
        static readonly COM_BUFFER   : number =  5; // Main->Worker->Main
        static readonly COM_COMPCOMP : number =  6; // Worker->Main
        static readonly COM_BUFRING  : number =  7; // Worker->Main
        static readonly COM_COMPLETE : number =  8; // Worker->Main
        static readonly COM_SYNCINFO : number =  9; // Main->Worker->Main
        static readonly COM_PLAYSOUND: number = 10; // Worker->Main
        static readonly COM_STOPSOUND: number = 11; // Worker->Main->Worker
        static readonly COM_DEBUG    : number = 12; // Worker->Main

        mml: MML;
        tIDInfo: number;
        infoInterval: number;
        lastInfoTime: number;
        audioSampleRate: number;
        audioBufferSize: number;
        emptyBuffer: Float32Array;

        onstopsound: Function = null;
        onrequestbuffer: Function = null;

        onInfoTimerBinded: Function;

        constructor() {
            this.onInfoTimerBinded = this.onInfoTimer.bind(this);

            addEventListener("message", this.onMessage.bind(this));
        }

        onMessage(e: any) {
            var data: any = e.data,
                type: number = data.type,
                mml: MML = this.mml;

            // console.log("Worker received " + Object.keys(Messenger).filter(k => k.indexOf("COM_") === 0 && Messenger[k] === type));
            switch (type) {
                case Messenger.COM_BOOT:
                    this.audioSampleRate = data.sampleRate;
                    this.audioBufferSize = data.bufferSize;
                    this.mml = new MML();
                    break;
                case Messenger.COM_PLAY:
                    mml.play(data.mml);
                    break;
                case Messenger.COM_STOP:
                    mml.stop();
                    this.syncInfo();
                    break;
                case Messenger.COM_PAUSE:
                    mml.pause();
                    this.syncInfo();
                    break;
                case Messenger.COM_BUFFER:
                    this.onrequestbuffer && this.onrequestbuffer(data);
                    break;
                case Messenger.COM_SYNCINFO:
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
                case Messenger.COM_STOPSOUND:
                    this.onstopsound && this.onstopsound();
                    break;
            }
        }

        buffering(progress: number): void {
            postMessage({ type: Messenger.COM_BUFRING, progress: progress });
        }

        compileComplete(): void {
            var mml: MML = this.mml;

            postMessage({
                type: Messenger.COM_COMPCOMP,
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
            postMessage({ type: Messenger.COM_PLAYSOUND });
            this.syncInfo();
        }

        stopSound(isFlushBuf: boolean = false): void {
            postMessage({ type: Messenger.COM_STOPSOUND, isFlushBuf: isFlushBuf });
        }

        sendBuffer(buffer: Array<Float32Array>): void {
            postMessage({ type: Messenger.COM_BUFFER, buffer: buffer }, [buffer[0].buffer, buffer[1].buffer]);
        }

        complete(): void {
            postMessage({ type: Messenger.COM_COMPLETE });
            this.syncInfo();
        }

        syncInfo(): void {
            var mml: MML = this.mml;

            this.lastInfoTime = self.performance ? self.performance.now() : new Date().getTime();
            postMessage({
                type: Messenger.COM_SYNCINFO,
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
            if (this.mml.isPlaying()) {
                this.syncInfo();
            } else {
                clearInterval(this.tIDInfo);
            }
        }

        debug(str: string = ""): void {
            postMessage({ type: Messenger.COM_DEBUG, str: str });
        }
    }
}

var msgr: messenger.Messenger = new messenger.Messenger();
