/*! flmml-on-html5 v1.2.0 | (c) 2015, argentum384 | BSD-3-Clause | https://github.com/argentum384/flmml-on-html5 */

"use strict";

var FlMMLonHTML5 = function () {
    var staticProps = {
        BUFFER_SIZE: 8192,

        COM_BOOT     :  1, // Main->Worker
        COM_PLAY     :  2, // Main->Worker
        COM_STOP     :  3, // Main->Worker
        COM_PAUSE    :  4, // Main->Worker
        COM_BUFFER   :  5, // Main->Worker->Main
        COM_COMPCOMP :  6, // Worker->Main
        COM_BUFRING  :  7, // Worker->Main
        COM_COMPLETE :  8, // Worker->Main
        COM_SYNCINFO :  9, // Main->Worker->Main
        COM_PLAYSOUND: 10, // Worker->Main
        COM_STOPSOUND: 11  // Worker->Main->Worker
    };
    staticProps.emptyBuffer = new Float32Array(staticProps.BUFFER_SIZE);

    function extend(target, object) {
        for (var name in object) {
            target[name] = object[name];
        }
        return target;
    }
    
    function FlMMLonHTML5(workerURL) {
        // 難読化されればFlMMLonHTML5の名前が変わる
        // (IEにFunction.nameはないけどどうせWeb Audioもない)
        if (!workerURL) {
            workerURL = FlMMLonHTML5.name === "FlMMLonHTML5" ? "flmmlworker-raw.js" : "flmmlworker.js"
        }
        var worker = this.worker = new Worker(workerURL);
        worker.addEventListener("message", this.onMessage.bind(this));

        this.onAudioProcessBinded = this.onAudioProcess.bind(this);
        this.warnings = "";
        this.totalTimeStr = "00:00";
        this.bufferReady = false;
        this.volume = 100.0;

        this.events = {};
        
        worker.postMessage({
            type: FlMMLonHTML5.COM_BOOT,
            sampleRate: (FlMMLonHTML5.audioCtx != null) ? FlMMLonHTML5.audioCtx.sampleRate : 48000,
            bufferSize: FlMMLonHTML5.BUFFER_SIZE
        });
        this.setInfoInterval(125);
    }

    // static
    extend(FlMMLonHTML5, staticProps);

    // not static
    extend(FlMMLonHTML5.prototype, {
        onMessage: function (e) {
            var data = e.data,
                type = data.type;

            // console.log("Main received " + Object.keys(FlMMLonHTML5).filter(k => k.indexOf("COM_") === 0 && FlMMLonHTML5[k] === type));
            switch (type) {
                case FlMMLonHTML5.COM_BUFFER:
                    this.buffer = data.buffer;
                    this.bufferReady = true;
                    break;
                case FlMMLonHTML5.COM_COMPCOMP:
                    extend(this, data.info);
                    this.oncompilecomplete && this.oncompilecomplete();
                    this.trigger("compilecomplete");
                    break;
                case FlMMLonHTML5.COM_BUFRING:
                    this.onbuffering && this.onbuffering(data);
                    this.trigger("buffering", data);
                    break;
                case FlMMLonHTML5.COM_COMPLETE:
                    this.oncomplete && this.oncomplete();
                    this.trigger("complete");
                    break;
                case FlMMLonHTML5.COM_SYNCINFO:
                    extend(this, data.info);
                    this.onsyncinfo && this.onsyncinfo();
                    this.trigger("syncinfo");
                    break;
                case FlMMLonHTML5.COM_PLAYSOUND:
                    this.playSound();
                    break;
                case FlMMLonHTML5.COM_STOPSOUND:
                    this.stopSound(data.isFlushBuf);
                    this.worker.postMessage({ type: FlMMLonHTML5.COM_STOPSOUND });
                    break;
            }
        },

        playSound: function () {
            if (this.gain || this.scrProc || this.oscDmy) return;

            var audioCtx = FlMMLonHTML5.audioCtx;

            var gain = this.gain = audioCtx.createGain();
            gain.gain.value = this.volume / 127.0;
            gain.connect(audioCtx.destination);

            this.scrProc = audioCtx.createScriptProcessor(FlMMLonHTML5.BUFFER_SIZE, 1, 2);
            this.scrProc.addEventListener("audioprocess", this.onAudioProcessBinded);
            this.scrProc.connect(this.gain);

            // iOS Safari対策
            this.oscDmy = audioCtx.createOscillator();
            this.oscDmy.connect(this.scrProc);
            this.oscDmy.start(0);
        },

        stopSound: function (isFlushBuf) {
            if (isFlushBuf) this.bufferReady = false;
            if (this.gain || this.scrProc || this.oscDmy) {
                this.scrProc.removeEventListener("audioprocess", this.onAudioProcessBinded);
                if (this.gain) { this.gain.disconnect(); this.gain = null; }
                if (this.scrProc) { this.scrProc.disconnect(); this.scrProc = null; }
                if (this.oscDmy) { this.oscDmy.disconnect(); this.oscDmy = null; }
            }
        },

        onAudioProcess: function (e) {
            var outBuf = e.outputBuffer;

            if (this.bufferReady) {
                outBuf.getChannelData(0).set(this.buffer[0]);
                outBuf.getChannelData(1).set(this.buffer[1]);
                this.bufferReady = false;
                this.worker.postMessage({ type: FlMMLonHTML5.COM_BUFFER, retBuf: this.buffer }, [this.buffer[0].buffer, this.buffer[1].buffer]);
            } else {
                outBuf.getChannelData(0).set(FlMMLonHTML5.emptyBuffer);
                outBuf.getChannelData(1).set(FlMMLonHTML5.emptyBuffer);
                this.worker.postMessage({ type: FlMMLonHTML5.COM_BUFFER, retBuf: null });
            }
        },

        trigger: function (type, args) {
            var handlers = this.events[type];
            if (!handlers) return;
            var e = {};
            extend(e, args);
            for (var i = 0, len = handlers.length; i < len; i++) {
                handlers[i] && handlers[i].call(this, e);
            }
        },


        play: function (mml) {
            this.worker.postMessage({ type: FlMMLonHTML5.COM_PLAY, mml: mml });
        },

        stop: function () {
            this.worker.postMessage({ type: FlMMLonHTML5.COM_STOP });
        },

        pause: function () {
            this.worker.postMessage({ type: FlMMLonHTML5.COM_PAUSE });
        },

        setMasterVolume: function (volume) {
            this.volume = volume;
            if (this.gain) this.gain.gain.value = this.volume / 127.0;
        },

        isPlaying: function () {
            return this._isPlaying;
        },

        isPaused: function () {
            return this._isPaused;
        },

        getWarnings: function () {
            return this.warnings;
        },

        getTotalMSec: function () {
            return this.totalMSec | 0;
        },

        getTotalTimeStr: function () {
            return this.totalTimeStr;
        },

        getNowMSec: function () {
            return this.nowMSec | 0;
        },

        getNowTimeStr: function () {
            return this.nowTimeStr;
        },

        getVoiceCount: function () {
            return this.voiceCount;
        },

        getMetaTitle: function () {
            return this.metaTitle;
        },

        getMetaComment: function () {
            return this.metaComment;
        },

        getMetaArtist: function () {
            return this.metaArtist;
        },

        getMetaCoding: function () {
            return this.metaCoding;
        },

        setInfoInterval: function (interval) {
            this.worker.postMessage({ type: FlMMLonHTML5.COM_SYNCINFO, interval: interval });
        },

        syncInfo: function () {
            this.worker.postMessage({ type: FlMMLonHTML5.COM_SYNCINFO, interval: null });
        },

        addEventListener: function (type, listener) {
            var handlers = this.events[type];

            if (!handlers) handlers = this.events[type] = [];
            for (var i = handlers.length; i--;) {
                if (handlers[i] === listener) return false;
            }
            handlers.push(listener);
            return true;
        },

        removeEventListener: function (type, listener) {
            var handlers = this.events[type];

            if (!handlers) return false;
            for (var i = handlers.length; i--;) {
                if (handlers[i] === listener) {
                    handlers.splice(i, 1);
                    return true;
                }
            }
            return false;
        },

        release: function () {
            this.stopSound();
            this.worker.terminate();
        }
    });

    // Web Audioコンテキスト作成
    // iOS14.5以上では AudioContext 生成時点で他アプリのバックグラウンド再生が止まるので、
    // 必要になったタイミングで生成する
    var AudioCtx = null;
    FlMMLonHTML5.audioCtx = null;

    // iOS/Chrome向けWeb Audioアンロック処理
    document.addEventListener("DOMContentLoaded", function () {
        var audioCtx = null;
        var bufSrcDmy = null;

        var players = document.querySelectorAll('.FlMMLPlayer, [id^="piko"]');
        players.forEach(function(p) {
            p.addEventListener("click", function onClick(e) {
                if (AudioCtx === null && FlMMLonHTML5.audioCtx === null && audioCtx === null && bufSrcDmy === null) {
                    AudioCtx = window.AudioContext || window.webkitAudioContext;
                    FlMMLonHTML5.audioCtx = new AudioCtx();
                    audioCtx = FlMMLonHTML5.audioCtx;
                    bufSrcDmy = audioCtx.createBufferSource();

                    bufSrcDmy.connect(audioCtx.destination);
                    bufSrcDmy.start(0);
                    audioCtx.resume();
                    bufSrcDmy.stop();
                }

                players.forEach(function(p2) {
                    p2.removeEventListener("click", onClick, true);
                });
            }, true);
        });
    });
    
    return FlMMLonHTML5;
}();

