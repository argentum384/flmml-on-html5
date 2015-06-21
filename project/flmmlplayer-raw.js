"use strict";

var FlMMLPlayer = function (document) {
    var MMLST_ARG = 1,
        MMLST_WAIT = 2,
        MMLST_LOADING = 3,
        MMLST_SUCCEED = 4,
        MMLST_FAILED = 5,

        players = [];

    function removeChildren(elem) {
        var child;

        while ((child = elem.lastChild)) {
            elem.removeChild(child);
        }
    }

    function prevDefMouseLBtn(e) {
        if (e.buttons & 1) e.preventDefault();
    }

    function createSVGElem(name) {
        return document.createElementNS("http://www.w3.org/2000/svg", name);
    }

    function setAttrsNS(elem, list) {
        for (var v in list) {
            elem.setAttributeNS(null, v, list[v]);
        }
    }

    function FlMMLPlayer(options) {
        var no = players.length;

        this.workerURL = options.workerURL;

        if (options.mmlURL && options.mmlURL !== "") {
            this.mmlURL = options.mmlURL;
            this.mmlStatus = MMLST_WAIT;
        } else {
            this.mml = options.mml;
            this.mmlStatus = MMLST_ARG;
        }

        var hue = options.hue === undefined ? 200 : options.hue;
        this.volume = options.volume === undefined ? 100.0 : options.volume;
        this.logVolume = !!options.logVolume;

        var svg = this.svg = createSVGElem("svg");
        setAttrsNS(svg, {
            id: "FlMMLPlayer" + no,
            viewBox: "0 0 600 100"
        });
        svg.style.height = options.height ? options.height : "1.5em";
        svg.addEventListener("mousedown", prevDefMouseLBtn);
        svg.addEventListener("mousemove", prevDefMouseLBtn);

        var style = document.createElement("style");
        style.setAttribute("type", "text/css");
        style.appendChild(document.createTextNode("\
svg#FlMMLPlayer" + no + " .button:active{fill:url(#gradBtnPushed" + no + ");}\
svg#FlMMLPlayer" + no + " .button:hover{stroke:hsl(" + hue + ",100%,75%)}\
svg#FlMMLPlayer" + no + " text{text-anchor:middle;pointer-events:none}\
"));
        svg.appendChild(style);

        var defs = createSVGElem("defs");

        var filterGlow = createSVGElem("filter"),
            feBlur = createSVGElem("feGaussianBlur"),
            feMerge = createSVGElem("feMerge"),
            feMergeNodeGlow = createSVGElem("feMergeNode"),
            feMergeNodeSrc = createSVGElem("feMergeNode");
        setAttrsNS(filterGlow, {
            id: "filterGlow" + no,
            x: "-150%",
            y: "-100%",
            width: "600%",
            height: "400%"
        });
        setAttrsNS(feBlur, {
            "in": "SourceGraphic",
            stdDeviation: 8,
            result: "blur"
        });
        feMergeNodeGlow.setAttributeNS(null, "in", "blur");
        feMergeNodeSrc.setAttributeNS(null, "in", "SourceGraphic");
        feMerge.appendChild(feMergeNodeGlow);
        feMerge.appendChild(feMergeNodeSrc);
        filterGlow.appendChild(feBlur);
        filterGlow.appendChild(feMerge);
        defs.appendChild(filterGlow);

        var gradBtn = createSVGElem("linearGradient"),
            gradBtnPushed = createSVGElem("linearGradient"),
            stopBtnL = createSVGElem("stop"),
            stopBtnD = createSVGElem("stop");
        setAttrsNS(gradBtn, {
            id: "gradBtn" + no,
            x1: "0%",
            y1: "0%",
            x2: "0%",
            y2: "100%"
        });
        setAttrsNS(stopBtnL, {
            offset: 0,
            "stop-color": "hsl(" + hue + ",30%,98%)"
        });
        setAttrsNS(stopBtnD, {
            offset: 1,
            "stop-color": "hsl(" + hue + ",30%,83%)"
        });
        gradBtn.appendChild(stopBtnL);
        gradBtn.appendChild(stopBtnD);
        setAttrsNS(gradBtnPushed, {
            id: "gradBtnPushed" + no,
            x1: "0%",
            y1: "0%",
            x2: "0%",
            y2: "100%"
        });
        stopBtnD = stopBtnD.cloneNode();
        stopBtnL = stopBtnL.cloneNode();
        stopBtnD.setAttributeNS(null, "offset", 0);
        stopBtnL.setAttributeNS(null, "offset", 1);
        gradBtnPushed.appendChild(stopBtnD);
        gradBtnPushed.appendChild(stopBtnL);
        defs.appendChild(gradBtn);
        defs.appendChild(gradBtnPushed);

        var gradDisp = createSVGElem("linearGradient"),
            stopDispD = createSVGElem("stop"),
            stopDispL = createSVGElem("stop");
        setAttrsNS(gradDisp, {
            id: "gradDisp" + no,
            x1: "0%",
            y1: "0%",
            x2: "0%",
            y2: "100%"
        });
        setAttrsNS(stopDispD, {
            offset: 0,
            "stop-color": "hsl(" + hue + ",100%,2%)"
        });
        setAttrsNS(stopDispL, {
            offset: 1,
            "stop-color": "hsl(" + hue + ",100%,30%)"
        });
        gradDisp.appendChild(stopDispD);
        gradDisp.appendChild(stopDispL);
        defs.appendChild(gradDisp);

        svg.appendChild(defs);

        var gPlayFirst = this.gPlayFirst = createSVGElem("g"),
            gPlay = this.gPlay = createSVGElem("g"),
            gPlayD = this.gPlayD = createSVGElem("g"),
            gPause = this.gPause = createSVGElem("g"),
            gStop = this.gStop = createSVGElem("g"),
            gDisplay = this.gDisplay = createSVGElem("g"),
            gVolume = this.gVolume = createSVGElem("g");
        gPlayFirst.addEventListener("click", this.onPlayFirst.bind(this));
        gPlay.addEventListener("click", this.onPlayPause.bind(this));
        gPause.addEventListener("click", this.onPlayPause.bind(this));
        gStop.setAttributeNS(null, "transform", "translate(100,0)");
        gStop.addEventListener("click", this.onStop.bind(this));
        var gStopD = this.gStopD = gStop.cloneNode();

        var rectBtn = createSVGElem("rect");
        setAttrsNS(rectBtn, {
            x: 5,
            y: 5,
            width: 90,
            height: 90,
            rx: 6,
            ry: 6,
            fill: "url(#gradBtn" + no + ")",
            stroke: "hsl(" + hue + ",15%,50%)",
            "stroke-width": 4,
            "class": "button"
        });

        gPlay.appendChild(rectBtn.cloneNode());
        gPause.appendChild(rectBtn.cloneNode());
        gStop.appendChild(rectBtn.cloneNode());
        var rectBtnD = rectBtn.cloneNode();
        setAttrsNS(rectBtnD, {
            stroke: "hsl(" + hue + ",15%,75%)",
            "class": ""
        });
        gPlayD.appendChild(rectBtnD.cloneNode());
        gStopD.appendChild(rectBtnD.cloneNode());
        rectBtn.setAttributeNS(null, "width", 590);
        gPlayFirst.appendChild(rectBtn.cloneNode());

        var pathPlay = createSVGElem("path");
        setAttrsNS(pathPlay, {
            fill: "hsl(120,100%,35%)",
            d: "M22,22v56l56,-28z",
            filter: "url(#filterGlow" + no + ")",
            "pointer-events": "none"
        });
        gPlay.appendChild(pathPlay);
        var pathPlayD = pathPlay.cloneNode();
        setAttrsNS(pathPlayD, {
            fill: "gray",
            opacity: 0.5
        });
        gPlayD.appendChild(pathPlayD);

        var rectPause1 = createSVGElem("rect");
        setAttrsNS(rectPause1, {
            x: 26,
            y: 22,
            width: 17,
            height: 56,
            fill: "hsl(210,100%,50%)",
            filter: "url(#filterGlow" + no + ")",
            "pointer-events": "none"
        });
        var rectPause2 = rectPause1.cloneNode();
        rectPause2.setAttributeNS(null, "x", 57);
        gPause.appendChild(rectPause1);
        gPause.appendChild(rectPause2);

        var rectStop = createSVGElem("rect");
        setAttrsNS(rectStop, {
            x: 23,
            y: 23,
            width: 54,
            height: 54,
            fill: "hsl(15,100%,50%)",
            filter: "url(#filterGlow" + no + ")",
            "pointer-events": "none"
        });
        gStop.appendChild(rectStop);

        var rectStopD = rectStop.cloneNode();
        setAttrsNS(rectStopD, {
            fill: "gray",
            opacity: 0.5
        });
        gStopD.appendChild(rectStopD);

        var textPlayMML = createSVGElem("text");
        setAttrsNS(textPlayMML, {
            x: 345,
            y: 72,
            "font-family": "'Verdana'",
            "font-size": 62,
            "textLength": 280
        });
        textPlayMML.appendChild(document.createTextNode("Play MML"));
        gPlayFirst.appendChild(textPlayMML);
        pathPlay = pathPlay.cloneNode();
        pathPlay.setAttributeNS(null, "transform", "translate(115,0)");
        gPlayFirst.appendChild(pathPlay);
        svg.appendChild(gPlayFirst);

        var rectDisplay = createSVGElem("rect");
        setAttrsNS(rectDisplay, {
            x: 203,
            y: 5,
            width: 394,
            height: 44,
            rx: 6,
            ry: 6,
            fill: "url(#gradDisp" + no + ")",
            stroke: "hsl(" + hue + ",100%,30%)",
            "stroke-width": 4,
            "pointer-events": "none"
        });
        gDisplay.appendChild(rectDisplay);

        var textDisplay = this.textDisplay = createSVGElem("text");
        setAttrsNS(textDisplay, {
            x: 401,
            y: 43,
            fill: "white",
            "font-family": "'Courier New'",
            "font-weight": "bold",
            "font-size": 50
        });
        gDisplay.appendChild(textDisplay);

        var rectVolume = createSVGElem("rect");
        setAttrsNS(rectVolume, {
            x: 205,
            y: 70,
            width: 390,
            height: 12,
            rx: 4,
            ry: 4,
            fill: "url(#gradBtnPushed" + no + ")",
            stroke: "hsl(" + hue + ",15%,75%)",
            "stroke-width": 4
        });
        gVolume.appendChild(rectVolume);

        var circleVolume = this.circleVolume = createSVGElem("circle");
        setAttrsNS(circleVolume, {
            cx: 498,
            cy: 76,
            r: 22,
            fill: "url(#gradBtn" + no + ")",
            stroke: "hsl(" + hue + ",15%,50%)",
            "stroke-width": 4,
            "class": "button"
        });
        this.circleVolume.setAttributeNS(null, "cx", this.volume / 127.0 * 340.0 + 230.0 | 0);
        gVolume.appendChild(circleVolume);

        gPlay.style.display =
        gPlayD.style.display =
        gPause.style.display =
        gStop.style.display =
        gStopD.style.display =
        gDisplay.style.display =
        gVolume.style.display = "none";

        if (!options.underground) {
            var scripts = document.getElementsByTagName("script"),
                parent = scripts.item(scripts.length - 1).parentNode;
            parent.appendChild(svg);
        }

        svg.addEventListener("mousedown", this.onMouseDown.bind(this));
        window.addEventListener("mousemove", this.onMouseMove.bind(this));
        window.addEventListener("mouseup", this.onMouseUp.bind(this));
        svg.addEventListener("touchstart", this.onTouchStart.bind(this));
        window.addEventListener("touchmove", this.onTouchMove.bind(this));
        window.addEventListener("touchend", this.onMouseUp.bind(this));

        this.hasPlayedOnce = false;
        this.isChangingVol = false;

        this.hasReplacedFonts = false;
        this.replaceFonts();
        players.push(this);
    }
    
    FlMMLPlayer.prototype.setMasterVolume = function (volume) {
        var tVol;

        if (volume === undefined) {
            volume = this.volume;
        } else {
            this.volume = volume;
        }
        if (this.logVolume) {
            var f = 40.0, // floor
                r = 1.0 / f;
            tVol = (Math.pow(f, volume / 127.0 - 1.0) - r) / (1 - r) * 127.0
        } else {
            tVol = volume;
        }
        if (this.hasPlayedOnce) this.flmml.setMasterVolume(tVol);
        //console.log(tVol.toFixed(2));
    };

    FlMMLPlayer.prototype.replaceFonts = function () {
        if (this.hasReplacedFonts || !FlMMLPlayer.hasLoadedFonts) return;

        setAttrsNS(this.textDisplay, {
            y: 45,
            "font-family": "'Press Start 2P'",
            "font-weight": "normal",
            "font-size": 33
        });
        this.hasReplacedFonts = true;
    };

    FlMMLPlayer.prototype.getSVGPos = function (x, y) {
        var point = this.svg.createSVGPoint();
        point.x = x;
        point.y = y;
        var p = point.matrixTransform(this.svg.getScreenCTM().inverse());
        return p;
    };

    FlMMLPlayer.prototype.changeStatus = function (str, txtLen) {
        removeChildren(this.textDisplay);
        this.textDisplay.appendChild(document.createTextNode(str));
        if (txtLen) {
            this.textDisplay.setAttributeNS(null, "textLength", txtLen);
        }
    };

    FlMMLPlayer.prototype.showVolume = function () {
        var strVol = (this.volume | 0) + "";
        while (strVol.length < 3) strVol = "\u00A0" + strVol;
        this.changeStatus("Volume:" + strVol, 289);
        this.isDispVol = true;
        clearTimeout(this.tIDDispVol);
        this.tIDDispVol = setTimeout(this.onDispVolTimer.bind(this), 2000);
    };

    FlMMLPlayer.prototype.changeVolume = function (px) {
        var vol;
        if (px < 230) {
            vol = 0.0;
        } else if (px >= 230 && px < 570) {
            vol = (px - 230.0) / 340.0 * 127.0;
        } else if (px >= 570) {
            vol = 127.0;
        }
        if (this.flmml) {
            this.setMasterVolume(vol);
            this.showVolume();
        }

        if (px < 225) px = 225;
        if (px > 575) px = 575;
        this.circleVolume.setAttributeNS(null, "cx", px);
    };

    FlMMLPlayer.prototype.onReadyStateChange = function (e) {
        if (this.xhr.readyState === XMLHttpRequest.DONE) {
            if (this.xhr.status === 200) {
                this.changeStatus("Compiling...", 347);
                this.gStop.style.display = "inline";
                this.gStopD.style.display = "none";
                this.mml = this.xhr.responseText;
                this.mmlStatus = MMLST_SUCCEED;
                this.flmml.play(this.mml);
                clearTimeout(this.tIDDispVol);
            } else {
                this.changeStatus("Failure.", 232);
                this.flmml.release();
                this.flmml = null;
                this.mmlStatus = MMLST_FAILED;
            }
        }
    }

    FlMMLPlayer.prototype.onPlayFirst = function () {
        this.hasPlayedOnce = true;

        var flmml = this.flmml = new FlMMLonHTML5(this.workerURL);
        this.setMasterVolume();
        flmml.addEventListener("compilecomplete", this.onCompileComplete.bind(this));
        flmml.addEventListener("buffering", this.onBuffering.bind(this));
        flmml.addEventListener("complete", this.onComplete.bind(this));
        flmml.addEventListener("syncinfo", this.onSyncInfo.bind(this));

        var svg = this.svg;
        this.gPlayD.style.display =
        this.gDisplay.style.display =
        this.gVolume.style.display = "inline";
        if (this.mmlStatus === MMLST_ARG) {
            this.changeStatus("Compiling...", 347);
            this.gStop.style.display = "inline";
            flmml.play(this.mml);
        } else if (this.mmlStatus === MMLST_WAIT) {
            var xhr = this.xhr = new XMLHttpRequest();
            xhr.addEventListener("readystatechange", this.onReadyStateChange.bind(this));
            xhr.open("GET", this.mmlURL);
            xhr.send(null);
            this.mmlStatus = MMLST_LOADING;
            this.changeStatus("Loading...", 289);
            this.gStopD.style.display = "inline";
        }

        svg.removeChild(this.gPlayFirst);
        svg.appendChild(this.gPlay);
        svg.appendChild(this.gPlayD);
        svg.appendChild(this.gPause);
        svg.appendChild(this.gStop);
        svg.appendChild(this.gStopD);
        svg.appendChild(this.gDisplay);
        svg.appendChild(this.gVolume);
    };

    FlMMLPlayer.prototype.onPlayPause = function () {
        if (this.flmml.isPlaying()) {
            this.gPlay.style.display = "inline";
            this.gPause.style.display = "none";
            this.flmml.pause();
        } else {
            this.gPlay.style.display =
            this.gStopD.style.display = "none";
            this.gPause.style.display =
            this.gStop.style.display = "inline";
            if (!this.flmml.isPaused()) {
                this.isCompiling = true;
                this.changeStatus("Compiling...", 347);
            }
            this.flmml.play(this.mml);
        }
        clearTimeout(this.tIDDispVol);
        this.onDispVolTimer();
    };
    

    FlMMLPlayer.prototype.onStop = function () {
        this.gPlay.style.display =
        this.gStopD.style.display = "inline";
        this.gPause.style.display =
        this.gStop.style.display = "none";
        this.flmml.stop();
        clearTimeout(this.tIDDispVol);
        this.onDispVolTimer();
    };
    
    FlMMLPlayer.prototype.onMouseDown = function (e) {
        if (!(e.buttons & 1) || !this.hasPlayedOnce) return;

        var p = this.getSVGPos(e.clientX, e.clientY);
        if (p.x >= 205 && p.x < 595 && p.y >= 50 && p.y < 100) {
            this.changeVolume(p.x);
            this.isChangingVol = true;
        }
    };

    FlMMLPlayer.prototype.onMouseMove = function (e) {
        if (!(e.buttons & 1) || !this.isChangingVol) return;

        var p = this.getSVGPos(e.clientX, e.clientY);
        this.changeVolume(p.x);
        e.preventDefault();
    };

    FlMMLPlayer.prototype.onMouseUp = function (e) {
        this.isChangingVol = false;
    };

    FlMMLPlayer.prototype.onTouchStart = function (e) {
        if (!this.hasPlayedOnce) return;

        var touch = e.touches[0];
        var p = this.getSVGPos(touch.clientX, touch.clientY);
        if (p.x >= 205 && p.x < 595 && p.y >= 50 && p.y < 100) {
            this.changeVolume(p.x);
            this.isChangingVol = true;
        }
    };

    FlMMLPlayer.prototype.onTouchMove = function (e) {
        if (!this.isChangingVol) return;

        var touch = e.touches[0];
        var p = this.getSVGPos(touch.clientX, touch.clientY);
        this.changeVolume(p.x);
        e.preventDefault();
    };

    FlMMLPlayer.prototype.onCompileComplete = function () {
        this.gPause.style.display = "inline";
        this.gPlayD.style.display = "none";
        this.isCompiling = false;
    };

    FlMMLPlayer.prototype.onBuffering = function (e) {
        if (e.progress === 100) {
            this.isBuffering = false;
            clearTimeout(this.tIDDispVol);
            this.onDispVolTimer();
        } else {
            if (!this.isDispVol) {
                this.changeStatus("Buffering:" + (e.progress < 10 ? "\u00A0" : "") + e.progress + "%", 377);
                this.isBuffering = true;
            }
        }
    };

    FlMMLPlayer.prototype.onComplete = function () {
        this.gPlay.style.display =
        this.gStopD.style.display = "inline"
        this.gPause.style.display =
        this.gStop.style.display = "none";
        clearTimeout(this.tIDDispVol);
        this.onDispVolTimer();
    };

    FlMMLPlayer.prototype.onSyncInfo = function () {
        if (this.isDispVol || this.isCompiling || this.isBuffering) return;
        this.changeStatus(this.flmml.getNowTimeStr() + "/" + this.flmml.getTotalTimeStr(), 318);
    };

    FlMMLPlayer.prototype.onDispVolTimer = function () {
        this.isDispVol = false;
        if (this.isCompiling) {
            this.changeStatus("Compiling...", 347);
        } else if (!this.isBuffering) {
            this.onSyncInfo();
        }
    };


    FlMMLPlayer.prototype.getElement = function () {
        return this.svg;
    };


    FlMMLPlayer.onActiveFonts = function () {
        FlMMLPlayer.hasLoadedFonts = true;
        for (var i = players.length; i--;) {
            players[i].replaceFonts.call(players[i]);
        }
    };
    
    return FlMMLPlayer;
}(document);

// Web Font Loader
var WebFontConfig = {
    google: {
        families: ["Press+Start+2P::latin"]
    },
    active: FlMMLPlayer.onActiveFonts
};
(function () {
    var wf = document.createElement("script");
    wf.src = ("https:" === document.location.protocol ? "https" : "http") +
        "://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js";
    wf.type = "text/javascript";
    wf.async = "true";
    var s = document.getElementsByTagName("script").item(0);
    s.parentNode.insertBefore(wf, s);
})();