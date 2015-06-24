"use strict";

var FlMMLPlayer = function (window, document) {
    var MMLST_ARG = 1,
        MMLST_WAIT = 2,
        MMLST_LOADING = 3,
        MMLST_SUCCEED = 4,
        MMLST_FAILED = 5,

        players = [];

    function extend(target, object) {
        for (var name in object) {
            target[name] = object[name];
        }
        return target;
    }

    function addEL(elem, type, func) {
        elem.addEventListener(type, func);
    }

    function apdChild(elem, child) {
        elem.appendChild(child);
    }

    function clone(elem) {
        return elem.cloneNode();
    }

    function createSVGElem(name) {
        return document.createElementNS("http://www.w3.org/2000/svg", name);
    }

    function setAttrNS(elem, name, value) {
        elem.setAttributeNS(null, name, value);
    }

    function setAttrsNS(elem, list) {
        for (var v in list) {
            elem.setAttributeNS(null, v, list[v]);
        }
    }

    function show() {
        for (var i = arguments.length; i--; ) {
            arguments[i].style.display = "inline";
        }
    }

    function hide() {
        for (var i = arguments.length; i--;) {
            arguments[i].style.display = "none";
        }
    }

    //function removeChildren(elem) {
    //    var child;
    //    while ((child = elem.lastChild)) {
    //        elem.removeChild(child);
    //    }
    //}

    function prevDefMouseLBtn(e) {
        if (e.buttons & 1) e.preventDefault();
    }

    function FlMMLPlayer(options) {
        var no = this.no = players.length;

        var hue = this.hue = options.hue == null ? 200 : options.hue;
        this.volume = options.volume == null ? 100.0 : options.volume;
        this.logVolume = !!options.logVolume;
        this.workerURL = options.workerURL;

        if (options.mmlURL && options.mmlURL !== "") {
            this.mmlURL = options.mmlURL;
            this.mmlStatus = MMLST_WAIT;
        } else {
            this.mml = options.mml;
            this.mmlStatus = MMLST_ARG;
        }

        var svg = this.svg = createSVGElem("svg");
        setAttrsNS(svg, {
            id: "flmmlplayer" + no,
            viewBox: "0 0 600 100"
        });
        svg.style.height = options.height || "1.5em";
        addEL(svg, "mousedown", prevDefMouseLBtn);
        addEL(svg, "mousemove", prevDefMouseLBtn);

        var style = document.createElement("style");
        style.setAttribute("type", "text/css");
        apdChild(style, document.createTextNode("\
svg#flmmlplayer" + no + " .clickable-button:active{fill:url(#gradBtnPushed" + no + ");}\
svg#flmmlplayer" + no + " .clickable-button:hover{stroke:hsl(" + hue + ",100%,75%)}\
svg#flmmlplayer" + no + " text{text-anchor:middle;pointer-events:none}\
"));
        apdChild(svg, style);

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
        setAttrNS(feMergeNodeGlow, "in", "blur");
        setAttrNS(feMergeNodeSrc, "in", "SourceGraphic");
        apdChild(feMerge, feMergeNodeGlow);
        apdChild(feMerge, feMergeNodeSrc);
        apdChild(filterGlow, feBlur);
        apdChild(filterGlow, feMerge);
        apdChild(defs, filterGlow);

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
        apdChild(gradBtn, stopBtnL);
        apdChild(gradBtn, stopBtnD);
        setAttrsNS(gradBtnPushed, {
            id: "gradBtnPushed" + no,
            x1: "0%",
            y1: "0%",
            x2: "0%",
            y2: "100%"
        });
        stopBtnD = clone(stopBtnD);
        stopBtnL = clone(stopBtnL);
        setAttrNS(stopBtnD, "offset", 0);
        setAttrNS(stopBtnL, "offset", 1);
        apdChild(gradBtnPushed, stopBtnD);
        apdChild(gradBtnPushed, stopBtnL);
        apdChild(defs, gradBtn);
        apdChild(defs, gradBtnPushed);

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
        apdChild(gradDisp, stopDispD);
        apdChild(gradDisp, stopDispL);
        apdChild(defs, gradDisp);

        apdChild(svg, defs);
        
        var gPlayFirst = this.gPlayFirst = createSVGElem("g");
        addEL(gPlayFirst, "click", this.playFirst.bind(this));

        var rectBtn = this.rectBtn = createSVGElem("rect");
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
            "class": "clickable-button"
        });
        var rectBtnPlayFirst = clone(rectBtn);
        setAttrNS(rectBtnPlayFirst, "width", 590);
        apdChild(gPlayFirst, rectBtnPlayFirst);

        var pathPlay = this.pathPlay = createSVGElem("path");
        setAttrsNS(pathPlay, {
            fill: "hsl(120,100%,35%)",
            d: "M22,22v56l56,-28z",
            filter: "url(#filterGlow" + no + ")",
            "pointer-events": "none"
        });
        var pathPlayFirst = clone(pathPlay);
        setAttrNS(pathPlayFirst, "transform", "translate(115,0)");
        var textPlayMML = createSVGElem("text");
        setAttrsNS(textPlayMML, {
            x: 345,
            y: 72,
            "font-family": "'Verdana'",
            "font-size": 62,
            "textLength": 280
        });
        apdChild(textPlayMML, document.createTextNode("Play MML"));
        apdChild(gPlayFirst, textPlayMML);
        apdChild(gPlayFirst, pathPlayFirst);
        apdChild(svg, gPlayFirst);

        if (!options.underground) {
            var scripts = document.getElementsByTagName("script"),
                parent = scripts.item(scripts.length - 1).parentNode;
            apdChild(parent, svg);
        }

        this.hasPlayedOnce = false;
        this.isChangingVol = false;
        this.hasReplacedFonts = false;

        players.push(this);
    }
    
    extend(FlMMLPlayer.prototype, {
        setMasterVolume: function (volume) {
            var tVol;

            if (volume == null) {
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
        },

        replaceFonts: function () {
            if (!this.hasPlayedOnce || this.hasReplacedFonts || !FlMMLPlayer.hasLoadedFonts) return;

            setAttrsNS(this.textDisplay, {
                y: 45,
                "font-family": "'Press Start 2P'",
                "font-weight": "normal",
                "font-size": 33
            });
            this.hasReplacedFonts = true;
        },

        getSVGPos: function (x, y) {
            var point = this.svg.createSVGPoint();
            point.x = x;
            point.y = y;
            var p = point.matrixTransform(this.svg.getScreenCTM().inverse());
            return p;
        },

        changeStatus: function (str, txtLen) {
            var textDisplay = this.textDisplay;

            //removeChildren(textDisplay);
            var child;
            while ((child = textDisplay.lastChild)) textDisplay.removeChild(child);
            apdChild(textDisplay, document.createTextNode(str));
            if (txtLen) {
                setAttrNS(textDisplay, "textLength", txtLen);
            }
        },

        showVolume: function () {
            var strVol = (this.volume | 0) + "";
            while (strVol.length < 3) strVol = "\u00A0" + strVol;
            this.changeStatus("Volume:" + strVol, 289);
            this.isDispVol = true;
            clearTimeout(this.tIDDispVol);
            this.tIDDispVol = setTimeout(this.onDispVolTimer.bind(this), 2000);
        },

        changeVolume: function (px) {
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
            setAttrNS(this.circleVolume, "cx", px);
        },

        onReadyStateChange: function (e) {
            if (this.xhr.readyState === XMLHttpRequest.DONE) {
                if (this.xhr.status === 200) {
                    this.changeStatus("Compiling...", 347);
                    show(this.gStop);
                    hide(this.gStopD);
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
        },

        playFirst: function () {
            var flmml = this.flmml = new FlMMLonHTML5(this.workerURL);
            this.setMasterVolume();
            addEL(flmml, "compilecomplete", this.onCompileComplete.bind(this));
            addEL(flmml, "buffering", this.onBuffering.bind(this));
            addEL(flmml, "complete", this.onComplete.bind(this));
            addEL(flmml, "syncinfo", this.onSyncInfo.bind(this));

            var svg = this.svg,
                no = this.no,
                hue = this.hue;

            var gPlay = this.gPlay = createSVGElem("g"),
                gPlayD = this.gPlayD = createSVGElem("g"),
                gPause = this.gPause = createSVGElem("g"),
                gStop = this.gStop = createSVGElem("g"),
                gDisplay = this.gDisplay = createSVGElem("g"),
                gVolume = this.gVolume = createSVGElem("g");
            addEL(gPlay, "click", this.playPause.bind(this));
            addEL(gPause, "click", this.playPause.bind(this));
            setAttrNS(gStop, "transform", "translate(100,0)");
            addEL(gStop, "click", this.stop.bind(this));
            var gStopD = this.gStopD = clone(gStop);

            var rectBtn = this.rectBtn;
            apdChild(gPlay, clone(rectBtn));
            apdChild(gPause, clone(rectBtn));
            apdChild(gStop, clone(rectBtn));
            var rectBtnD = clone(rectBtn);
            setAttrsNS(rectBtnD, {
                stroke: "hsl(" + hue + ",15%,75%)",
                "class": ""
            });
            apdChild(gPlayD, clone(rectBtnD));
            apdChild(gStopD, clone(rectBtnD));

            var pathPlay = this.pathPlay;
            apdChild(gPlay, pathPlay);
            var pathPlayD = clone(pathPlay);
            setAttrsNS(pathPlayD, {
                fill: "gray",
                opacity: 0.5
            });
            apdChild(gPlayD, pathPlayD);

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
            var rectPause2 = clone(rectPause1);
            setAttrNS(rectPause2, "x", 57);
            apdChild(gPause, rectPause1);
            apdChild(gPause, rectPause2);

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
            apdChild(gStop, rectStop);

            var rectStopD = clone(rectStop);
            setAttrsNS(rectStopD, {
                fill: "gray",
                opacity: 0.5
            });
            apdChild(gStopD, rectStopD);

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
            apdChild(gDisplay, rectDisplay);

            var textDisplay = this.textDisplay = createSVGElem("text");
            setAttrsNS(textDisplay, {
                x: 401,
                y: 43,
                fill: "white",
                "font-family": "'Courier New',Courier',monospace",
                "font-weight": "bold",
                "font-size": 50
            });
            apdChild(gDisplay, textDisplay);

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
            apdChild(gVolume, rectVolume);

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
            setAttrNS(circleVolume, "cx", this.volume / 127.0 * 340.0 + 230.0 | 0);
            apdChild(gVolume, circleVolume);

            hide(gPlay, gPause, gStop, gStopD);

            if (this.mmlStatus === MMLST_ARG) {
                this.changeStatus("Compiling...", 347);
                show(gStop);
                flmml.play(this.mml);
            } else if (this.mmlStatus === MMLST_WAIT) {
                var xhr = this.xhr = new XMLHttpRequest();
                addEL(xhr, "readystatechange", this.onReadyStateChange.bind(this));
                xhr.open("GET", this.mmlURL);
                xhr.send(null);
                this.mmlStatus = MMLST_LOADING;
                this.changeStatus("Loading...", 289);
                show(gStopD);
            }

            svg.removeChild(this.gPlayFirst);
            apdChild(svg, gPlay);
            apdChild(svg, gPlayD);
            apdChild(svg, gPause);
            apdChild(svg, gStop);
            apdChild(svg, gStopD);
            apdChild(svg, gDisplay);
            apdChild(svg, gVolume);

            addEL(svg, "mousedown", this.onMouseDown.bind(this));
            addEL(window, "mousemove", this.onMouseMove.bind(this));
            addEL(window, "mouseup", this.onMouseUp.bind(this));
            addEL(svg, "touchstart", this.onTouchStart.bind(this));
            addEL(window, "touchmove", this.onTouchMove.bind(this));
            addEL(window, "touchend", this.onMouseUp.bind(this));

            this.hasPlayedOnce = true;
            this.replaceFonts();
        },

        playPause: function () {
            if (this.flmml.isPlaying()) {
                show(this.gPlay);
                hide(this.gPause);
                this.flmml.pause();
            } else {
                show(this.gPause, this.gStop);
                hide(this.gPlay, this.gStopD);
                if (!this.flmml.isPaused()) {
                    this.isCompiling = true;
                    this.changeStatus("Compiling...", 347);
                }
                this.flmml.play(this.mml);
            }
            clearTimeout(this.tIDDispVol);
            this.onDispVolTimer();
        },


        stop: function () {
            show(this.gPlay, this.gStopD);
            hide(this.gPause, this.gStop);
            this.flmml.stop();
            clearTimeout(this.tIDDispVol);
            this.onDispVolTimer();
        },

        onMouseDown: function (e) {
            if (!(e.buttons & 1) || !this.hasPlayedOnce) return;

            var p = this.getSVGPos(e.clientX, e.clientY);
            if (p.x >= 205 && p.x < 595 && p.y >= 50 && p.y < 100) {
                this.changeVolume(p.x);
                this.isChangingVol = true;
            }
        },

        onMouseMove: function (e) {
            if (!(e.buttons & 1) || !this.isChangingVol) return;

            var p = this.getSVGPos(e.clientX, e.clientY);
            this.changeVolume(p.x);
            e.preventDefault();
        },

        onMouseUp: function (e) {
            this.isChangingVol = false;
        },

        onTouchStart: function (e) {
            if (!this.hasPlayedOnce) return;

            var touch = e.touches[0];
            var p = this.getSVGPos(touch.clientX, touch.clientY);
            if (p.x >= 205 && p.x < 595 && p.y >= 50 && p.y < 100) {
                this.changeVolume(p.x);
                this.isChangingVol = true;
            }
        },

        onTouchMove: function (e) {
            if (!this.isChangingVol) return;

            var touch = e.touches[0];
            var p = this.getSVGPos(touch.clientX, touch.clientY);
            this.changeVolume(p.x);
            e.preventDefault();
        },

        onCompileComplete: function () {
            show(this.gPause);
            hide(this.gPlayD);
            this.isCompiling = false;
        },

        onBuffering: function (e) {
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
        },

        onComplete: function () {
            show(this.gPlay, this.gStopD);
            hide(this.gPause, this.gStop);
            clearTimeout(this.tIDDispVol);
            this.onDispVolTimer();
        },

        onSyncInfo: function () {
            if (this.isDispVol || this.isCompiling || this.isBuffering) return;
            this.changeStatus(this.flmml.getNowTimeStr() + "/" + this.flmml.getTotalTimeStr(), 318);
        },

        onDispVolTimer: function () {
            this.isDispVol = false;
            if (this.isCompiling) {
                this.changeStatus("Compiling...", 347);
            } else if (!this.isBuffering) {
                this.onSyncInfo();
            }
        },


        getElement: function () {
            return this.svg;
        }
    });


    FlMMLPlayer.onActiveFonts = function () {
        FlMMLPlayer.hasLoadedFonts = true;
        for (var i = players.length; i--;) {
            players[i].replaceFonts.call(players[i]);
        }
    };
    FlMMLPlayer.hasLoadedFonts = false;
    
    return FlMMLPlayer;
}(window, document);

// Web Font Loader
var WebFontConfig = {
    google: {
        families: ["Press+Start+2P::latin"]
    },
    active: FlMMLPlayer.onActiveFonts
};
(function (document) {
    var wf = document.createElement("script");
    wf.src = ("https:" === document.location.protocol ? "https" : "http") + "://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js";
    wf.type = "text/javascript";
    wf.async = "true";
    var s = document.getElementsByTagName("script").item(0);
    s.parentNode.insertBefore(wf, s);
})(document);
