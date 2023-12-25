// Copyright (c) 2023, donnie <donnie4w@gmail.com>
// All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
//
// github.com/donnie4w/videojoin

const crc32table = [];

for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        if ((c & 1) === 1) {
            c = 0xEDB88320 ^ (c >>> 1);
        } else {
            c = c >>> 1;
        }
    }
    crc32table[i] = c;
}

const VJUtil = {

    sleep(ms) {
        return new Promise(function (resolve, reject) {
            setTimeout(resolve, ms);
        })
    },

    isEmpty(obj) {
        if (typeof obj == "undefined" || obj == null || obj == "") {
            return true;
        } else {
            return false;
        }
    }

}

/************************************************* */

class Media {
    mediaRecorder = null;
    pushon = true;
    mediavideo = null;
    constraints = null;
    audioBitsPerSecond = 320000;
    videoBitsPerSecond = 500000;
    sendStream = null;
    recorderHz = 300;
    constructor(video, constraints) {
        this.mediavideo = video;
        this.constraints = constraints;
    }
    MediaDevices() {
        if (!VJUtil.isEmpty(navigator.mediaDevices) && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(this.constraints)
                .then(stream => this.parseStream(stream)).catch(err => { console.error(`mediaDevices failed: ${err}`) });
        } else if (navigator.webkitGetUserMedia) {
            navigator.webkitGetUserMedia(this.constraints)
                .then(stream => this.parseStream(stream)).catch(err => { console.error(`mediaDevices failed: ${err}`) });
        } else if (navigator.mozGetUserMedia) {
            navigator.mozGetUserMedia(this.constraints)
                .then(stream => this.parseStream(stream)).catch(err => { console.error(`mediaDevices failed: ${err}`) });
        } else if (navigator.getUserMedia) {
            navigator.getUserMedia(this.constraints)
                .then(stream => this.parseStream(stream)).catch(err => { console.error(`mediaDevices failed: ${err}`) });
        } else {
            throw new Error("MediaDevice data unavailable")
        }
    }

    parseStream(stream) {
        this.mediavideo.srcObject = stream;
        let data = null;
        try {
            data = this.mediavideo.captureStream();
        } catch (err) {
            data = this.mediavideo.mozCaptureStream();
        }
        this.mediaRecorder = new MediaRecorder(data, {
            audioBitsPerSecond: this.audioBitsPerSecond,
            videoBitsPerSecond: this.videoBitsPerSecond,
        });
        this.mediaRecorder.ondataavailable = event => {
            if (!VJUtil.isEmpty(this.sendStream)) {
                event.data.arrayBuffer().then(buffer => {
                    this.sendStream(buffer)
                })
            }
        };
        this.mediaRecorder.onstop = () => {
        };
    }


    MediaRecorderStop() {
        this.pushon = false;
        try {
            if (this.mediaRecorder.state == 'active') {
                this.mediaRecorder.stop();
            }
            this.mediavideo.srcObject.getTracks().forEach((track) => track.stop());
        } catch (err) {
            console.log(err);
        }
    }

    Pushstream(on) {
        if (!this.pushon) {
            return
        }
        if (on) {
            if (VJUtil.isEmpty(this.mediaRecorder)) {
                VJUtil.sleep(this.recorderHz).then(() => this.Pushstream(on))
                return
            }
            try {
                this.mediaRecorder.start();
            } catch (err) {
                console.error(err);
            }
            VJUtil.sleep(this.recorderHz).then(() => this.Pushstream(!on));
        } else {
            try {
                this.mediaRecorder.stop();
            } catch (err) {
                console.error(err);
            }
            this.Pushstream(!on);
        }
    }
}

class VideoJoin {
    vppre = this.crc32(this.stringToUint8Array(new Date().getTime().toString()));
    videoType = "audio/mp3;video/mp4";
    playEvent = "canplaythrough"
    addcount = 1;
    currentnum = 0;
    loadnum = 1;
    delnum = 1;
    data_setup = "";
    style = null;
    parentNode = null;
    datamap = new Map();
    videoOn = false;
    turnOn = true;
    modeRealtime = true;
    modeSpeedRateup = true;

    constructor(videoParentNodeId) {
        this.parentNode = document.getElementById(videoParentNodeId);
        if (VJUtil.isEmpty(this.parentNode)) {
            throw new Error("parent node not exist");
        }
    }

    AddVideoSrc(videoSrc) {
        this._addvideo(videoSrc, false)
    }

    //streamBuffer
    AddVideoBuffer(buffer) {
        this._addvideo(new Uint8Array(buffer), true);
    }

    AddVideoUint8Array(data) {
        this._addvideo(data, true);
    }

    _addvideo(data, isStream) {
        const count = this.addcount++;
        this.datamap.set(count, this.createvideo(count, data, isStream))
        if (!this.videoOn) {
            if (this.modeRealtime) {
                this.callvideo(count)
            } else {
                if (this.currentnum <= count) {
                    this.callvideo(this.currentnum++);
                }
            }
        }
    }

    Clear() {
        this.turnOn = false;
        if (!VJUtil.isEmpty(this.parentNode)) {
            while (this.parentNode.firstChild) {
                this.parentNode.removeChild(this.parentNode.firstChild);
            }
        }
    }

    vname(count) {
        return this.vppre + "_" + count;
    }

    createvideo(count, data, isStream) {
        const video = document.createElement("video");
        if (!VJUtil.isEmpty(this.data_setup)) {
            video.setAttribute("data-setup", this.data_setup);
        }
        if (!VJUtil.isEmpty(this.style)) {
            video.setAttribute("style", this.style);
        }
        video.setAttribute("id", this.vname(count));
        video.setAttribute("preload", "auto");
        if (isStream) {
            try {
                video.srcObject = new Blob([data], { type: this.videoType });
            } catch (err) {
                video.src = URL.createObjectURL(new Blob([data], { type: this.videoType }));
            }
        } else {
            video.src = data;
        }
        video.playbackRate = 1;
        video.className = "1"
        video.style.display = "none";
        video.addEventListener("ended", (e) => {
            video.pause()
            this.callvideo(count + 1);
        });
        video.addEventListener("error", (e) => {
            if (video.className == "1") {
                video.load();
                video.className = "0";
            } else {
                // console.log("error>>>>", count, " :", e)
                this.rmvideo(count, true);
                if (this.currentnum == count) {
                    this.callvideo(count + 1);
                }
            }
        });
        video.addEventListener(this.playEvent, (e) => {
            video.name = this.vname(count);
        })
        return video;
    }

    rmvideo(count, isone) {
        if (isone) {
            const bf = document.getElementById(this.vname(count));
            this.datamap.delete(count);
            if (!VJUtil.isEmpty(bf)) {
                URL.revokeObjectURL(bf.src)
                this.parentNode.removeChild(bf);
            }
        } else if (count >= this.delnum) {
            for (let i = this.delnum; i <= count; i++) {
                const u = document.getElementById(this.vname(i));
                this.datamap.delete(i);
                if (!VJUtil.isEmpty(u)) {
                    URL.revokeObjectURL(u.src)
                    this.parentNode.removeChild(u);
                }
            }
            this.delnum = count;
        }
    }

    loadvideo(num) {
        let len = this.parentNode.children.length;
        if (num > 0) {
            let v = this.datamap.get(num);
            if (!VJUtil.isEmpty(v)) {
                this.parentNode.appendChild(v);
                this.datamap.delete(num);
            }
        } else if (len < 10 && this.loadnum <= this.addcount) {
            let c = 1;
            let id = this.loadnum
            while (id <= this.addcount) {
                let v = this.datamap.get(id);
                if (!VJUtil.isEmpty(v)) {
                    this.parentNode.appendChild(v);
                    this.datamap.delete(id);
                    if (c++ > 10) {
                        break
                    }
                }
                this.loadnum = id;
                id++
            }
        }
    }

    callvideo(count) {
        if (!this.turnOn) {
            return
        }
        this.loadvideo();
        if (count > this.currentnum) {
            this.currentnum = count;
        }
        const v = document.getElementById(this.vname(count));
        if (!VJUtil.isEmpty(v)) {
            if (this.modeSpeedRateup) {
                if (this.datamap.size > 16) {
                    let rate = 1 + this.datamap.size * 0.5;
                    if (rate > 16) {
                        rate = 16;
                    }
                    v.playbackRate = rate;
                    console.log("playbackRate>>>", v.playbackRate)
                }
            }
            this.mvplay(v, count, 1);
        } else if (!VJUtil.isEmpty(this.datamap.get(count))) {
            this.loadvideo(count);
            return this.callvideo(count);
        } else if (this.currentnum < this.loadnum) {
            for (let i = this.currentnum + 1; i <= this.loadnum; i++) {
                if (!isEmpty(document.getElementById(this.vname(i)))) {
                    return callvideo(i)
                }
            }
        } else {
            this.videoOn = false;
        }
    }

    mvplay(mv, count, playcount) {
        const play = mv.play();
        if (play) {
            play.then(() => {
                if (this._mvplay(count)) {
                    this.videoOn = false;
                    return
                }
                if (!this.turnOn) {
                    return
                }
                mv.style.display = "inline";
                this.rmvideo(count - 1, false);
            }).catch(error => {
                if (playcount > 0) {
                    mv.load();
                    this.mvplay(mv, count, 0)
                } else {
                    console.log("play failed >>", count, error)
                    this.rmvideo(count, true);
                    this.videoOn = false;
                }
            });
        } else {
            console.log("play not exist >>", count)
            this.videoOn = false;
        }
    }

    _mvplay(count) {
        if (!this.turnOn) {
            return false;
        }
        const mv = document.getElementById(this.vname(count))
        if (VJUtil.isEmpty(mv)) {
            return true;
        }
        if (VJUtil.isEmpty(mv.name)) {
            VJUtil.sleep(10).then(() => this._mvplay(count));
        }
        return false;
    }

    crc32(data) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = crc32table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (~crc >>> 0);
    }

    stringToUint8Array(text) {
        const encoder = new TextEncoder("ISO-8859-1");
        return encoder.encode(text);
    }
}




class VideoPlayer {
    mediaRecorder = null;
    pushon = true;
    mediavideo = null;
    sendStream = null;
    recorderHz = 300;
    audioBitsPerSecond = 320000;
    videoBitsPerSecond = 500000;
    sampleRate = 44100;
    videofile = null;
    EndEventFunc = null;
    constructor(video, videofile) {
        this.mediavideo = video;
        this.videofile = videofile;
        this.mediavideo.addEventListener("ended", (e) => {
            this.mediavideo.pause()
            this.pushon = false;
            if (!VJUtil.isEmpty(this.EndEventFunc)) {
                this.EndEventFunc()
            }
        });
    }

    Play() {
        if (!window.FileReader) {
            throw new Error("the browser does not support this feature");
        }
        let reader = new FileReader();
        reader.readAsArrayBuffer(this.videofile);
        reader.onload = () => {
            this.mediavideo.src = URL.createObjectURL(new Blob([new Uint8Array(reader.result)]));
            let data = null;
            try {
                data = this.mediavideo.captureStream();
            } catch (err) {
                data = this.mediavideo.mozCaptureStream();
            }
            this.mediaRecorder = new MediaRecorder(data, {
                audioBitsPerSecond: this.audioBitsPerSecond,
                videoBitsPerSecond: this.videoBitsPerSecond,

            });
            this.mediaRecorder.ondataavailable = event => {
                if (!VJUtil.isEmpty(this.sendStream)) {
                    event.data.arrayBuffer().then(buffer => {
                        this.sendStream(buffer)
                    })
                }
            };
            this.mediaRecorder.onstop = () => {
            };
        };
        reader.onerror = () => {
            console.error(reader.error);
        }
    }

    MediaRecorderStop() {
        this.pushon = false;
        try {
            if (this.mediaRecorder.state == 'active') {
                this.mediaRecorder.stop();
            }
        } catch (err) {
            console.log(err);
        }
    }

    Pushstream(on) {
        if (!this.pushon) {
            return
        }
        if (on) {
            if (VJUtil.isEmpty(this.mediaRecorder)) {
                VJUtil.sleep(this.recorderHz).then(() => this.Pushstream(on))
                return
            }
            try {
                if (this.mediaRecorder.state == 'active') {
                    this.mediaRecorder.stop();
                }
                this.mediaRecorder.start();
            } catch (err) {
                console.error(err);
            }
            VJUtil.sleep(this.recorderHz).then(() => this.Pushstream(!on));
        } else {
            try {
                this.mediaRecorder.stop();
            } catch (err) {
                console.error(err);
            }
            this.Pushstream(!on);
        }
    }
}


