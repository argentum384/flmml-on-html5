"use strict";

var FlMMLPlayer = function (document) {
    var MMLST_ARG = 1,
        MMLST_LOADING = 2,
        MMLST_SUCCEED = 3,
        MMLST_FAILED = 4,

        dispBkgColor = "RGBA(255,255,255,0.6)",
        dispBorder = "1px inset RGBA(255,255,255,0.8)",

        dx, dy;

    function removeChildren(elem) {
        var child;

        while ((child = elem.lastChild)) {
            elem.removeChild(child);
        }
    }

    // button要素のデフォルトのボーダー幅を確認
    function checkButtonBorder() {
        var s, btnDmy, divDmy, rectBtn, rectDiv;

        btnDmy = document.createElement("button");
        s = btnDmy.style;
        s.margin = "0";
        s.position = "relative";
        s.width = s.height = "20px";
        s.visibility = "hidden";

        divDmy = document.createElement("div");
        s = divDmy.style;
        s.position = "absolute";
        s.left = s.top = "0";
        s.width = s.height = "20px";

        btnDmy.appendChild(divDmy);
        document.body.appendChild(btnDmy);
        rectBtn = btnDmy.getBoundingClientRect();
        rectDiv = divDmy.getBoundingClientRect();
        dx = rectBtn.left - rectDiv.left;
        dy = rectBtn.top - rectDiv.top;
        document.body.removeChild(btnDmy);
    }

    function FlMMLPlayer(options) {
        var s;

        if (options.mmlURL && options.mmlURL !== "") {
            var xhr = this.xhr = new XMLHttpRequest();
            xhr.addEventListener("readystatechange", this.onReadyStateChange.bind(this));
            xhr.open("GET", options.mmlURL);
            xhr.send(null);
            this.mmlStatus = MMLST_LOADING;
        } else {
            this.mml = options.mml;
            this.mmlStatus = MMLST_ARG;
        }

        if (dx === undefined || dy === undefined) checkButtonBorder();

        var divContainer = this.divContainer = document.createElement("div");
        s = divContainer.style;
        s.display = "inline-block";
        s.position = "relative";
        s.left = s.top = "0";
        s.width = "128px";
        s.height = "20px";
        s.color = "black";
        s.textAlign = "center";
        s.fontSize = "12px";
        s.fontFamily = "'Arial', sans-serif";
        s.zIndex = "0";
        s.boxSizing = "border-box";
        if (this.mmlStatus === MMLST_LOADING) {
            s.backgroundColor = dispBkgColor;
            s.border = dispBorder;

            var divSysMsg = this.divSysMsg = document.createElement("div");
            s = divSysMsg.style;
            s.marginLeft = s.marginRight = "-1px";
            s.marginTop = "-0.5em";
            s.position = "absolute";
            s.top = "9px";
            s.width = "128px";

            divSysMsg.appendChild(document.createTextNode("Loading..."));
            divContainer.appendChild(divSysMsg);
        } else {
            s.backgroundColor = "transparent";
        }

        var btnPlayPause = this.btnPlayPause = document.createElement("button");
        s = btnPlayPause.style;
        s.margin = "0";
        s.position = "absolute";
        s.left = s.top = "0";
        s.width = s.height = "20px";
        btnPlayPause.addEventListener("click", this.onPlayPause.bind(this));

        var btnPlayMML = this.btnPlayMML = btnPlayPause.cloneNode();
        btnPlayMML.style.width = "128px";
        btnPlayMML.addEventListener("click", this.onPlayFirst.bind(this));

        var btnStop = this.btnStop = btnPlayPause.cloneNode();
        btnStop.style.left = "20px";
        btnStop.addEventListener("click", this.onStop.bind(this));

        var btnVolume = this.btnVolume = btnPlayPause.cloneNode();
        btnVolume.style.left = "";
        btnVolume.style.right = "0";
        btnVolume.addEventListener("click", this.onVolume.bind(this));

        var imgPause = this.imgPause = document.createElement("img");
        imgPause.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAAUVBMVEUAgf8Agv0AdvwAf/0AgP8Afv4AgPsAgP8Akf8Af/8AfvwAfv8Af/8AffoAfv8Af/0Afv8Agf8AgP0AgP8Agf8Agv8AgP0Aff0Agf8Afv8Af/5GU6gfAAAAGnRSTlMQCgZFLxwVDAJfQDgqHhigJyOWiFErdnZZWQOnFfsAAACjSURBVBjTbZFLDsMgDERtEzDhl5Bv2/sftDaq2i48i5H8JMwwQIxEyPARI1GMIIwheO9rFQvARAo5+H5OQ2f3gQUSgi85uaGUSwUkIGhrfonmWT2vTRBCnZyO963upioIQ8+HjvuufuQeFK7pqeO2qT/SKpBbSWPbsozNqTQGbMX9Q1caWtA+bl1kR/qFv65vePOZZiFmdQJxlFxFo2SkaH7HG2/2EtuThcAOAAAAAElFTkSuQmCC";
        s = imgPause.style;
        s.marginLeft = s.marginRight = dx + "px";
        s.marginTop = s.marginBottom = dy + "px";
        s.position = "absolute";
        s.left = s.top = "0";
        s.width = s.height = "20px";

        var imgPlay = this.imgPlay = imgPause.cloneNode();
        imgPlay.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAASFBMVEUAAAAAmgAAlQAAlwAAmAAAmQAAmgAAlwAAmwAAmQAAmQAAmQAAmAAAmQAAmQAAmAAAlwAAmQAAmQAAmAAAlwAAmQAAmQAAmADD6lrGAAAAF3RSTlMABwQKGRUNJRE5IC9UKkRqYE9ANXNkRrSOT5UAAACQSURBVBjTbZFbEsMgCEV9oIivxKQt+99p0cm0fnA+z1xHuBjjrPWCtc6ZB3E+phBSiv6vrU+QETHDpsVhIaK7ZQiil42AN3Oto1NBSa9wyqWzcJy1U8shzmxAqrx4neMqy4q8Tn446rTeGmj9zT8GNYhTfg7eKJBUqT9XP1JH0oZX11QL2atbyu0lh71k9Rxfym0PdbeElC0AAAAASUVORK5CYII=";
        imgPlay.style.left = "25px";

        var imgStop = this.imgStop = imgPause.cloneNode();
        imgStop.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAAPFBMVEX+AD7/AD//AED/AEn+AD//AD/+AD/+AEH/ADn9ADv/AE3+AD79AD7/AD7/AED+AD7/AED8AD7/AD7+AD9mm+jzAAAAE3RSTlMqFhIIaUY9Hw0ZA1lOQjQmLWNiJUEu2wAAAINJREFUGNNtkUsOwzAIRMdgg/920vvftSiL1lJ47J6EgAG1Mmei8ECUmWtFNVV04WFpMV3BOSimjGQMmdCQGUy6pbcrGlfrspUYuUA+B4KSQTr7KftUAi1pp2yyCAHjPuU9EKxSPGVMpspbFle67e4gdyV3efdMNxA3un/Ie/9Cdt/xBc2vEO2zvZ1rAAAAAElFTkSuQmCC";

        var imgVolume = this.imgVolume = imgPause.cloneNode();
        imgVolume.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAAS1BMVEV+fgB+fgB9fQB+fgB+fgCAgAB+fgB+fgB5eQB+fgB/fwCAgACPjwB+fgB9fQB8fAB9fQCIiAB+fgB+fgB9fQB+fgB/fwCAgAB+fgDkkneCAAAAGHRSTlMVLykkHRlGNg47IQoEXU0RPwd8aVVRhT4xQnacAAAAkklEQVQY04XR2w7DIAgGYASVauthW7vx/k+6v+mW7IJk3PkFEJG2bbuty6AUq4jUmGhZgTCQcEAYVyjBkFY5aJnTLEAHnRYl6Cv3w8xKkESEWljJfW+GyMqR6GNHe9gZfSIVWFlxusz2rMCRJEyc7hc21KNpZM0/2AuafvH5D91y7yJ/JHd495nuQtzVuUt2v+MNB6QSU7F5AiUAAAAASUVORK5CYII=";

        var divDisplay = this.divDisplay = document.createElement("div");
        s = divDisplay.style;
        s.position = "absolute";
        s.left = "40px";
        s.top = "0";
        s.width = "68px";
        s.height = "20px";
        s.backgroundColor = dispBkgColor;
        s.boxSizing = "border-box";
        s.border = dispBorder;

        var divStatus = this.divStatus = document.createElement("div");
        s = divStatus.style;
        s.marginLeft = s.marginRight = "-1px";
        s.marginTop = "-0.5em";
        s.position = "absolute";
        s.top = "9px";
        s.width = "68px";
        s.fontSize = "10px";

        var divPlayMML = this.divPlayMML = document.createElement("div");
        s = divPlayMML.style;
        s.marginLeft = s.marginRight = dx + "px";
        s.marginTop = "-0.5em";
        s.position = "absolute";
        s.left = "45px";
        s.top = "50%";
        s.fontSize = "12px";
        divPlayMML.appendChild(document.createTextNode("Play MML"));

        var divVolume = this.divVolume = document.createElement("div");
        s = divVolume.style;
        s.position = "absolute";
        s.width = "88px";
        s.visibility = "hidden";
        s.backgroundColor = dispBkgColor;
        s.boxSizing = "border-box";
        s.border = dispBorder;
        s.zIndex = "1";

        var rangeVolume = this.rangeVolume = document.createElement("input");
        rangeVolume.type = "range";
        rangeVolume.defaultValue = (options.volume === undefined) ? "100" : options.volume + "";
        rangeVolume.min = "0";
        rangeVolume.max = "127";
        rangeVolume.step = "1";
        s = rangeVolume.style;
        s.marginLeft = s.marginRight = "0";
        s.marginTop = s.marginBottom = "-1px";
        s.padding = "0";
        s.left = s.top = "0";
        s.position = "absolute";
        s.width = "86px";
        rangeVolume.addEventListener("input", this.onInput.bind(this));

        btnPlayMML.appendChild(imgPlay);
        btnPlayMML.appendChild(divPlayMML);

        btnPlayPause.appendChild(imgPause);

        btnStop.appendChild(imgStop);

        btnVolume.appendChild(imgVolume);

        divDisplay.appendChild(divStatus);

        if (this.mmlStatus === MMLST_ARG) {
            divContainer.appendChild(btnPlayMML);
        }

        divVolume.appendChild(rangeVolume);

        var scripts = document.getElementsByTagName("script"),
            parent = scripts[scripts.length - 1].parentNode;
        parent.appendChild(divContainer);
        parent.appendChild(divVolume);

        var flmml = this.flmml = new FlMMLonHTML5(options.workerURL);
        flmml.addEventListener("compilecomplete", this.onCompileComplete.bind(this));
        flmml.addEventListener("buffering", this.onBuffering.bind(this));
        flmml.addEventListener("complete", this.onComplete.bind(this));
        flmml.addEventListener("syncinfo", this.onSyncInfo.bind(this));
        if (options.volume !== undefined) {
            flmml.setMasterVolume(options.volume);
        }
    }

    FlMMLPlayer.prototype.changeStatus = function (str) {
        removeChildren(this.divStatus);
        this.divStatus.appendChild(document.createTextNode(str));
    }

    FlMMLPlayer.prototype.showVolume = function () {
        this.changeStatus("Volume:" + this.rangeVolume.value);
        this.isDispVol = true;
        clearTimeout(this.tIDDispVol);
        this.tIDDispVol = setTimeout(this.onDispVolTimer.bind(this), 2000);
    }

    FlMMLPlayer.prototype.onReadyStateChange = function (e) {
        if (this.xhr.readyState === XMLHttpRequest.DONE) {
            removeChildren(this.divSysMsg);
            if (this.xhr.status === 200) {
                removeChildren(this.divContainer);
                var s = this.divContainer.style;
                s.backgroundColor = "transparent";
                s.border = "";
                this.divContainer.appendChild(this.btnPlayMML);
                this.mml = this.xhr.responseText;
                this.mmlStatus = MMLST_SUCCEED;
            } else {
                this.divSysMsg.appendChild(document.createTextNode("Can't load the file."));
                this.flmml = null;
                this.mmlStatus = MMLST_FAILED;
            }
        }
    }

    FlMMLPlayer.prototype.onPlayFirst = function () {
        var divContainer = this.divContainer;

        divContainer.removeChild(this.btnPlayMML);
        this.btnPlayMML.removeChild(this.imgPlay);
        this.imgPlay.style.left = "0";

        this.changeStatus("Compiling...");
        divContainer.appendChild(this.btnPlayPause);
        divContainer.appendChild(this.btnStop);
        divContainer.appendChild(this.divDisplay);
        divContainer.appendChild(this.btnVolume);

        this.flmml.play(this.mml);
    };

    FlMMLPlayer.prototype.onPlayPause = function () {
        removeChildren(this.btnPlayPause);
        if (this.flmml.isPlaying()) {
            this.btnPlayPause.appendChild(this.imgPlay);
            this.flmml.pause();
        } else {
            this.btnPlayPause.appendChild(this.imgPause);
            if (!this.flmml.isPaused()) {
                this.isCompiling = true;
                this.changeStatus("Compiling...");
            }
            this.flmml.play(this.mml);
        }
        clearTimeout(this.tIDDispVol);
        this.onDispVolTimer();
    };
    

    FlMMLPlayer.prototype.onStop = function () {
        removeChildren(this.btnPlayPause);
        this.btnPlayPause.appendChild(this.imgPlay);
        this.btnStop.disabled = "disabled";
        this.imgStop.style.opacity = "0.4";
        this.flmml.stop();
        clearTimeout(this.tIDDispVol);
        this.onDispVolTimer();
    };

    FlMMLPlayer.prototype.onVolume = function () {
        var s, rectCnt, rectVol, rectSldr;

        s = this.divVolume.style;
        if (s.visibility === "hidden") {
            s.left = s.top = "0";
            rectCnt = this.divContainer.getBoundingClientRect();
            rectVol = this.divVolume.getBoundingClientRect();
            rectSldr = this.rangeVolume.getBoundingClientRect();
            s.left = (rectCnt.left - rectVol.left + 40).toFixed(1) + "px";
            s.top = (rectCnt.top - rectVol.top + 20).toFixed(1) + "px";
            s.height = (rectSldr.bottom - rectSldr.top).toFixed(1) + "px";
            s.visibility = "visible";
            this.showVolume();
        } else if (s.visibility === "visible") {
            s.visibility = "hidden";
        }
    };
    
    FlMMLPlayer.prototype.onInput = function () {
        this.flmml.setMasterVolume(parseInt(this.rangeVolume.value));
        this.showVolume();
    };

    FlMMLPlayer.prototype.onCompileComplete = function () {
        this.btnStop.disabled = "";
        this.imgStop.style.opacity = "1.0";
        this.isCompiling = false;
    };

    FlMMLPlayer.prototype.onBuffering = function (e) {
        if (e.progress === 100) {
            this.isBuffering = false;
        } else {
            this.changeStatus("Buffering:" + e.progress + "%");
            this.isBuffering = true;
        }
    };

    FlMMLPlayer.prototype.onComplete = function () {
        removeChildren(this.btnPlayPause);
        this.btnPlayPause.appendChild(this.imgPlay);
        this.btnStop.disabled = "disabled";
        this.imgStop.style.opacity = "0.4";
        clearTimeout(this.tIDDispVol);
        this.onDispVolTimer();
    };

    FlMMLPlayer.prototype.onSyncInfo = function () {
        if (this.isDispVol || this.isCompiling || this.isBuffering) return;
        this.changeStatus(this.flmml.getNowTimeStr() + "/" + this.flmml.getTotalTimeStr());
    };

    FlMMLPlayer.prototype.onDispVolTimer = function () {
        this.isDispVol = false;
        this.onSyncInfo();
    };
    
    return FlMMLPlayer;
}(document);