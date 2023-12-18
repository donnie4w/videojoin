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
    videoBitsPerSecond = 1000000;
    sendStream = null;
    recorderHz = 300;
    constructor(video, constraints) {
        this.mediavideo = video;
        this.constraints = constraints;
    }
    MediaDevices() {
        if (!VJUtil.isEmpty(navigator.mediaDevices) && navigator.mediaDevices.getUserMedia) {
            console.log("navigator.mediaDevices");
            navigator.mediaDevices.getUserMedia(this.constraints)
                .then(stream => this.parseStream(stream)).catch(err => { console.error(`mediaDevices failed: ${err}`) });
        } else if (navigator.webkitGetUserMedia) {
            console.log("webkitGetUserMedia")
            navigator.webkitGetUserMedia(this.constraints)
                .then(stream => this.parseStream(stream)).catch(err => { console.error(`mediaDevices failed: ${err}`) });
        } else if (navigator.mozGetUserMedia) {
            console.log("navigator.mozGetUserMedia")
            navigator.mozGetUserMedia(this.constraints)
                .then(stream => this.parseStream(stream)).catch(err => { console.error(`mediaDevices failed: ${err}`) });
        } else if (navigator.getUserMedia) {
            console.log("navigator.getUserMedia")
            navigator.getUserMedia(this.constraints)
                .then(stream => this.parseStream(stream)).catch(err => { console.error(`mediaDevices failed: ${err}`) });
        } else {
            throw new Error("MediaDevice data unavailable")
        }
    }

    parseStream(stream) {
        this.mediavideo.srcObject = stream;
        let data = stream;
        try {
            data = this.mediavideo.captureStream()
        } catch (err) {
            console.error(err)
            data = stream;
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
    vppre = this.crc32(this.stringToUint8Array(Date.now().toString()));
    videoType = "audio/mp3;video/mp4";
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
        console.log(count, "<<<add>>>", this.videoOn);
        if (!this.videoOn) {
            if (this.modeRealtime) {
                this.callvideo(count)
            } else {
                console.log(this.currentnum, ",", count)
                if (this.currentnum <= count) {
                    this.callvideo(this.currentnum++);
                }
            }
        }
    }

    Clear() {
        this.turnOn = false;
        if (!VJUtil.isEmpty(this.parentNode)) {
            this.parentNode.innerHTML = "";
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
        video.style.display = "none";
        video.addEventListener("ended", (e) => {
            console.log("ended>>>>", count)
            video.pause()
            this.callvideo(count + 1);
        });
        video.addEventListener("error", (e) => {
            console.log("error>>>>", count, " :", e)
            this.rmvideo(count, true);
            if (this.currentnum == count) {
                this.callvideo(count + 1);
            }
        });
        video.addEventListener('canplay', (e) => {
            video.name = this.vname(count);
        })
        return video;
    }

    rmvideo(count, isone) {
        if (isone) {
            const bf = document.getElementById(this.vname(count));
            this.datamap.delete(count);
            if (!VJUtil.isEmpty(bf)) {
                this.parentNode.removeChild(bf);
            }
        } else if (count >= this.delnum) {
            for (let i = this.delnum; i <= count; i++) {
                const u = document.getElementById(this.vname(i));
                this.datamap.delete(i);
                if (!VJUtil.isEmpty(u)) {
                    this.parentNode.removeChild(u);
                }
            }
            this.delnum = count;
        }
        console.log("delete>>>", this.delnum)
    }

    loadvideo(num) {
        let len = this.parentNode.children.length;
        console.log(len, ", ", this.loadnum, ",", this.addcount);
        if (num > 0) {
            let v = this.datamap.get(num);
            if (!VJUtil.isEmpty(v)) {
                this.parentNode.appendChild(v);
                this.datamap.delete(num);
            }
        } else if (len < 5 && this.loadnum <= this.addcount) {
            let c = 1;
            let id = this.loadnum
            while (id <= this.addcount) {
                let v = this.datamap.get(id);
                if (!VJUtil.isEmpty(v)) {
                    this.parentNode.appendChild(v);
                    this.datamap.delete(id);
                    if (c++ > 5) {
                        break
                    }
                }
                this.loadnum = id;
                id++
            }
        }
    }

    callvideo(count) {
        console.log("callvideo>>>", count)
        this.loadvideo(count);
        if (count > this.currentnum) {
            this.currentnum = count;
        }
        this.videoOn = true;
        const v = document.getElementById(this.vname(count));
        console.log(count, "<<<call>>>", !VJUtil.isEmpty(v));
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
            this.mvplay(v, count);
        } else {
            console.log(count, " not found");
            this.videoOn = false;
            // if (isEmpty(this.datamap.get(count))) {
            //   console.log(count, " not found");
            //   this.videoOn = false;
            // } else {
            //   this.loadvideo(count);
            //   this.callvideo(count);
            // }
        }
    }

    mvplay(mv, count) {
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
                console.log("play failed >>", count, error)
                this.rmvideo(count, true);
                this.videoOn = false;
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


