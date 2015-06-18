"use strict";

var FlMMLonHTML5 = function () {
    var BUFFER_SIZE = 8192; // MSequencer.tsと合わせる

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

    var ZEROBUFFER = new Float32Array(BUFFER_SIZE);

    var divDebug;

    function debug(str) {
        if (!divDebug) {
            divDebug = document.createElement("div");
            document.body.appendChild(divDebug);
        }
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        divDebug.appendChild(div);
        
        var divs = divDebug.getElementsByTagName("div");
        if (divs.length > 10) divDebug.removeChild(divDebug.firstChild);
    }

    function extend (target) {
        var i, options, name,
            len = arguments.length;

        for (i = 1; i < len; i++) {
            for (name in (options = arguments[i])) {
                target[name] = options[name];
            }
        }
        return target;
    }
    
    function FlMMLonHTML5(workerURL) {
        // 難読化されればFlMMLonHTML5の名前が変わる
        // (IEにFunction.nameはないけどどうせWeb Audioもない)
        if (!workerURL) {
            workerURL = (FlMMLonHTML5.name === "FlMMLonHTML5") ? "flmmlworker-raw.js" : "flmmlworker.js"
        }
        this.worker = new Worker(workerURL);
	    this.worker.addEventListener("message", this.onMessage.bind(this));

	    if (!FlMMLonHTML5.audioCtx) {
	        var AudioCtx = window.AudioContext || window.webkitAudioContext;
	        FlMMLonHTML5.audioCtx = new AudioCtx();
	    }

        addEventListener("touchstart", this.onTouchStartBinded = this.onTouchStart.bind(this));

	    this.warnings = "";
	    this.totalTimeStr = "00:00";
	    this.bufferReady = false;
	    this.volume = 100.0;

	    this.events = {};
        
	    this.worker.postMessage({ type: COM_BOOT, sampleRate: FlMMLonHTML5.audioCtx.sampleRate });
        this.setInfoInterval(125);
    }

    FlMMLonHTML5.prototype.onMessage = function (e) {
        var data = e.data,
            type = data.type;

        if (!type) return;
        
        //console.log("Main received " + type);
        switch (type) {
            case COM_BUFFER:
                this.buffer = data.buffer;
                this.bufferReady = true;
                break;
            case COM_COMPCOMP:
                extend(this, data.info);
                if (this.oncompilecomplete) this.oncompilecomplete();
                this.trigger("compilecomplete");
                break;
            case COM_BUFRING:
                if (this.onbuffering) this.onbuffering(data);
                this.trigger("buffering", data);
                break;
            case COM_COMPLETE:
                if (this.oncomplete) this.oncomplete();
                this.trigger("complete");
                break;
            case COM_SYNCINFO:
                extend(this, data.info);
                if (this.onsyncinfo) this.onsyncinfo();
                this.trigger("syncinfo");
                break;
            case COM_PLAYSOUND:
                this.playSound();
                break;
            case COM_STOPSOUND:
                this.stopSound(data.isFlushBuf);
                this.worker.postMessage({ type: COM_STOPSOUND });
                break;
            case COM_DEBUG:
                debug(data.str);
        }
    };

    FlMMLonHTML5.prototype.playSound = function () {
        if (this.gain || this.scrProc || this.oscDmy) return;

        var audioCtx = FlMMLonHTML5.audioCtx;

        this.gain = audioCtx.createGain();
        this.gain.gain.value = this.volume / 127.0;
        this.gain.connect(audioCtx.destination);

        this.scrProc = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 2);
        this.onAudioProcessBinded = this.onAudioProcess.bind(this);
        this.scrProc.addEventListener("audioprocess", this.onAudioProcessBinded);
        this.scrProc.connect(this.gain);

        // iOS Safari対策
        this.oscDmy = audioCtx.createOscillator();
        this.oscDmy.connect(this.scrProc);
        this.oscDmy.start(0);
    };

    FlMMLonHTML5.prototype.stopSound = function (isFlushBuf) {
        if (isFlushBuf) this.bufferReady = false;
        if (this.gain || this.scrProc || this.oscDmy) {
            this.scrProc.removeEventListener("audioprocess", this.onAudioProcessBinded);
            if (this.gain) { this.gain.disconnect(); this.gain = null; }
            if (this.scrProc) { this.scrProc.disconnect(); this.scrProc = null; }
            if (this.oscDmy) { this.oscDmy.disconnect(); this.oscDmy = null; }
        }
    };

    // iOS Safari 対策
    FlMMLonHTML5.prototype.onTouchStart = function (e) {
        var audioCtx = FlMMLonHTML5.audioCtx;
        var bufSrc = audioCtx.createBufferSource();
        bufSrc.connect(audioCtx.destination);
        bufSrc.start(0);
        removeEventListener("touchstart", this.onTouchStartBinded);
    };
    
    FlMMLonHTML5.prototype.onAudioProcess = function (e) {
        var outBuf = e.outputBuffer;

        if (this.bufferReady) {
            outBuf.getChannelData(0).set(this.buffer[0]);
            outBuf.getChannelData(1).set(this.buffer[1]);
            this.bufferReady = false;
            this.worker.postMessage({ type: COM_BUFFER, retBuf: this.buffer }, [this.buffer[0].buffer, this.buffer[1].buffer]);
        } else {
            outBuf.getChannelData(0).set(ZEROBUFFER);
            outBuf.getChannelData(1).set(ZEROBUFFER);
            this.worker.postMessage({ type: COM_BUFFER, retBuf: null });
        }
    };

    FlMMLonHTML5.prototype.trigger = function (type, args) {
        var handlers = this.events[type];
        if (!handlers) return;
        var e = {};
        extend(e, args);
        for (var i = 0, len = handlers.length; i < len; i++) {
            handlers[i].call(this, e);
        }
    };


    FlMMLonHTML5.prototype.play = function (mml) {
        this.worker.postMessage({ type: COM_PLAY, mml: mml });
    };

    FlMMLonHTML5.prototype.stop = function () {
        this.worker.postMessage({ type: COM_STOP });
    };

    FlMMLonHTML5.prototype.pause = function () {
        this.worker.postMessage({ type: COM_PAUSE });
    };

    FlMMLonHTML5.prototype.setMasterVolume = function (volume) {
        this.volume = volume;
        if (this.gain) this.gain.gain.value = this.volume / 127.0;
    };

    FlMMLonHTML5.prototype.isPlaying = function () {
        return this._isPlaying;
    };

    FlMMLonHTML5.prototype.isPaused = function () {
        return this._isPaused;
    };

    FlMMLonHTML5.prototype.getWarnings = function () {
        return this.warnings;
    };

    FlMMLonHTML5.prototype.getTotalMSec = function () {
        return this.totalMSec | 0;
    };

    FlMMLonHTML5.prototype.getTotalTimeStr = function () {
        return this.totalTimeStr;
    };

    FlMMLonHTML5.prototype.getNowMSec = function () {
        return this.nowMSec | 0;
    };

    FlMMLonHTML5.prototype.getNowTimeStr = function () {
        return this.nowTimeStr;
    };
    
    FlMMLonHTML5.prototype.getVoiceCount = function () {
        return this.voiceCount;
    };
    
    FlMMLonHTML5.prototype.getMetaTitle = function () {
        return this.metMetaTitle;
    };

    FlMMLonHTML5.prototype.getMetaComment = function () {
        return this.metMetaComment;
    };

    FlMMLonHTML5.prototype.getMetaArtist = function () {
        return this.metMetaArtist;
    };

    FlMMLonHTML5.prototype.getMetaCoding = function () {
        return this.metaCoding;
    };

    FlMMLonHTML5.prototype.setInfoInterval = function (interval) {
        this.worker.postMessage({ type: COM_SYNCINFO, interval: interval });
    };

    FlMMLonHTML5.prototype.syncInfo = function () {
        this.worker.postMessage({ type: COM_SYNCINFO, interval: null });
    };

    FlMMLonHTML5.prototype.addEventListener = function (type, listener) {
        var handlers = this.events[type];

        if (!handlers) handlers = this.events[type] = [];
        for (var i = handlers.length; i--;) {
            if (handlers[i] === listener) return false;
        }
        handlers.push(listener);
        return true;
    };

    FlMMLonHTML5.prototype.removeEventListener = function (type, listener) {
        var handlers = this.events[type];

        if (!handlers) return false;
        for (var i = handlers.length; i--;) {
            if (handlers[i] === listener) {
                handlers.splice(i, 1);
                return true;
            }
        }
        return false;
    };

    FlMMLonHTML5.prototype.release = function () {
        this.stopSound();
        this.worker.terminate();
    };

    return FlMMLonHTML5;
}();
