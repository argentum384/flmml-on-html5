import { SAMPLE_RATE } from "../common/Consts";
import { FlMMLAudioExportError } from "../common/Errors";
import { AudioExport } from "./AudioExport";

const DEFAULT_MP3_BITRATE = 192; // kbps

export class Mp3Export extends AudioExport {
    private mp3Encoder: lamejs.Mp3Encoder;
    private mp3Data: ArrayBuffer[];

    constructor(bitrate: number = DEFAULT_MP3_BITRATE) {
        super();
        if (!self.lamejs || !self.lamejs.Mp3Encoder) {
            throw new FlMMLAudioExportError("lamejs is not imported");
        }
        this.mp3Encoder = new lamejs.Mp3Encoder(2, SAMPLE_RATE, bitrate);
        this.mp3Data = [];
    }

    process(buffer: Float32Array[]): void {
        const bufferInt16 = buffer.map(bufCh => {
            const bufChInt16 = new Int16Array(bufCh.length);
            bufCh.forEach((value, i) => {
                bufChInt16[i] = Math.floor(AudioExport.crop(value) * 32767.5);
            });
            return bufChInt16;
        });
        const mp3Buf = this.mp3Encoder.encodeBuffer(bufferInt16[0], bufferInt16[1]);
        this.mp3Data.push(mp3Buf.buffer);
        this.bufferId++;
    }

    complete(): ArrayBuffer[] {
        const mp3Buf = this.mp3Encoder.flush();
        if (mp3Buf.length > 0) this.mp3Data.push(mp3Buf.buffer);
        self.clearInterval(this.tID);
        return this.mp3Data;
    }
}
