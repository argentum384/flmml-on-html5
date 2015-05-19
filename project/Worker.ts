/// <reference path="flmml/MML.ts" />

var global: any = this;

module FlMMLWorker {
    import MML = FlMMLWorker.flmml.MML;

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
		COM_STOPSOUND = 11; // Worker->Main->Worker

    export class Worker {
        private m_mml: MML;
        private sampleRate: number;
        private onStopSound: Function = null;
        onRequestBuffer: Function = null;

        constructor() {
            global.addEventListener("message", this.onMessage.bind(this));
        }

        onMessage(e: any) {
            var data: any = e.data,
                type: number = data.type,
                mml: MML = this.m_mml;

            if (!type) return;
            //console.log("Worker received " + type);
            switch (type) {
                case COM_BOOT:
                    this.sampleRate = e.data.sampleRate;
                    this.m_mml = new MML();
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
                    this.syncInfo();
                    break;
                case COM_STOPSOUND:
                    if (this.onStopSound) this.onStopSound();
                    break;
            }
        }

        buffering(progress: number): void {
            global.postMessage({ type: COM_BUFRING, progress: progress });
        }

        compileComplete(): void {
            var mml: MML = this.m_mml;

            global.postMessage({
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
            global.postMessage({ type: COM_PLAYSOUND });
            this.syncInfo();
        }

        stopSound(onStopSound: Function = null, isFlushBuf: boolean = false): void {
            global.postMessage({ type: COM_STOPSOUND, isFlushBuf: isFlushBuf });
            if (onStopSound) {
                this.onStopSound = onStopSound;
            } else {
                this.onStopSound = null;
            }
        }

        sendBuffer(buffer: Array<Float32Array>): void {
            try {
                global.postMessage({ type: COM_BUFFER, buffer: buffer }, [buffer[0].buffer, buffer[1].buffer]);
            } catch (e) {
                console.log("Buffer is null");
            }
        }

        complete(): void {
            global.postMessage({ type: COM_COMPLETE });
            this.syncInfo();
        }

        syncInfo(): void {
            var mml: MML = this.m_mml;

            global.postMessage({
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
    }

    global.worker = new Worker();
}