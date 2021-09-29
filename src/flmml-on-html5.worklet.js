registerProcessor("flmml-worklet-processor", class extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args);

        this.buffer = null;
        this.backBuffer = null;
        this.bufferId = 1;
        this.offset = 0; // Number of samples
        this.reqTimes = 0;
        this.reqCount = 0;
        this.release = false;

        this.port.addEventListener("message", e => this.onMessage(e));
        this.port.start();
    }

    process(input, output, params) {
        if (this.buffer) {
            output[0][0].set(this.buffer[0].subarray(this.offset, this.offset + 128));
            output[0][1].set(this.buffer[1].subarray(this.offset, this.offset + 128));
            this.offset += 128;
            if (this.offset >= this.buffer[0].length) {
                const oldBuffer = this.buffer;
                if (this.backBuffer) {
                    this.buffer = this.backBuffer;
                    this.backBuffer = null;
                } else {
                    this.buffer = null;
                }
                this.offset = 0;
                this.port.postMessage(
                    { bufferId: this.bufferId, retBuf: oldBuffer },
                    [oldBuffer[0].buffer, oldBuffer[1].buffer]
                );
            }
        } else {
            output[0][0].fill(0.0);
            output[0][1].fill(0.0);
            // 連続で postMessage し過ぎないようにする
            if (++this.reqCount >= 1 << this.reqTimes) {
                this.port.postMessage({ bufferId: this.bufferId, retBuf: null });
                if (this.reqTimes < 10) this.reqTimes++;
                this.reqCount = 0;
            }
        }
        return !this.release;
    }

    onMessage(e) {
        const data = e.data;
        if (data.buffer) {
            this.bufferId++;
            if (this.buffer) {
                this.backBuffer = data.buffer;
            } else {
                this.buffer = data.buffer;
                this.reqTimes = 0;
                this.reqCount = 0;
                this.port.postMessage({ bufferId: this.bufferId, retBuf: null });
            }
        }
        if (data.release) {
            this.release = true;
        }
    }
});
