import { SEQUENCER_SAMPLE_RATE } from "../common/Consts";
import { AudioExport } from "./AudioExport";

const N_CH = 2;
const BIT_DEPTH = 16;
const BLOCK_ALIGN = (BIT_DEPTH >> 3) * N_CH;
const HEADER = [
    0x52, 0x49, 0x46, 0x46, // 00 - 03: 'RIFF'
    0x00, 0x00, 0x00, 0x00, // 04 - 07: (ファイルサイズ - 8)
    0x57, 0x41, 0x56, 0x45, // 08 - 0B: 'WAVE'
    0x66, 0x6D, 0x74, 0x20, // 0C - 0F: 'fmt '
    0x10, 0x00, 0x00, 0x00, // 10 - 13: fmt チャンクのサイズ = 16
    0x01, 0x00,             // 14 - 15: フォーマットID = 1
    N_CH, 0x00,             // 16 - 17: チャンネル数
    0x00, 0x00, 0x00, 0x00, // 18 - 1B: (サンプリングレート)
    0x00, 0x00, 0x00, 0x00, // 1C - 1F: (データ深度)
    BLOCK_ALIGN, 0x00,      // 20 - 21: ブロック境界
    BIT_DEPTH, 0x00,        // 22 - 23: ビット深度
    0x64, 0x61, 0x74, 0x61, // 24 - 27: 'data'
    0x00, 0x00, 0x00, 0x00  // 28 - 2B: (サンプルデータサイズ)
];
const HEADER_LEN = HEADER.length;

export class WavExport extends AudioExport {
    private samples: Float32Array[];
    private offset: number; // Number of samples

    constructor(totalMSec: number) {
        super();
        this.offset = 0;
        this.samples = Array(2).fill(0).map(() => new Float32Array(Math.floor(totalMSec / 1000.0 * SEQUENCER_SAMPLE_RATE)));
    }

    process(buffer: Float32Array[]): void {
        if (this.offset < this.samples[0].length - buffer[0].length) {
            this.samples.forEach((samplesCh, ch) => {
                samplesCh.set(buffer[ch], this.offset);
            });
            this.offset += buffer[0].length;
        }
        this.bufferId++;
    }

    complete(): ArrayBuffer[] {
        const samples = this.samples;
        const aryBuf = new ArrayBuffer(HEADER.length + samples[0].length * BLOCK_ALIGN);
        const dataView = new DataView(aryBuf);
        for (let i = 0; i < HEADER.length; i++) {
            dataView.setUint8(i, HEADER[i]);
        }
        dataView.setUint32(0x04, aryBuf.byteLength - 8, true);               // 04 - 07: ファイルサイズ - 8
        dataView.setUint32(0x18, SEQUENCER_SAMPLE_RATE, true);               // 18 - 1B: サンプリングレート
        dataView.setUint32(0x1C, SEQUENCER_SAMPLE_RATE * BLOCK_ALIGN, true); // 1C - 1F: データ深度
        dataView.setUint32(0x28, samples[0].length * BLOCK_ALIGN, true);     // 28 - 2B: サンプルデータサイズ
        if (BIT_DEPTH === 16) {
            for (let i = 0; i < samples[0].length; i++) {
                dataView.setInt16(HEADER_LEN + i * BLOCK_ALIGN    , Math.floor(AudioExport.crop(samples[0][i]) * 32767.5), true);
                dataView.setInt16(HEADER_LEN + i * BLOCK_ALIGN + 2, Math.floor(AudioExport.crop(samples[1][i]) * 32767.5), true);
            }
        }
        // else if (BIT_DEPTH === 8) {
        //     for (let i = 0; i < samples[0].length; i++) {
        //         dataView.setUint8(HEADER_LEN + i * BLOCK_ALIGN    , Math.floor(AudioExport.crop(samples[0][i]) * 127.5 + 0x80));
        //         dataView.setUint8(HEADER_LEN + i * BLOCK_ALIGN + 1, Math.floor(AudioExport.crop(samples[1][i]) * 127.5 + 0x80));
        //     }
        // }

        self.clearInterval(this.tID);

        return [aryBuf];
    }
}
