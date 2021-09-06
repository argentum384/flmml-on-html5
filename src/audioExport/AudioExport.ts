import { SampleDataEvent } from "../common/Types";

const REQUEST_INTERVAL = 50; // msec

export abstract class AudioExport {
    protected tID: number;
    protected bufferId: number;
    protected onrequestbuffer: (e: SampleDataEvent) => void;

    protected static crop (value: number): number {
        return value > 1.0 ? 1.0 : value < -1.0 ? -1.0 : value;
    }

    constructor() {
        this.bufferId = 1;
    }

    protected onRequest(): void {
        this.onrequestbuffer({ bufferId: this.bufferId });
    }

    beginRequest(onrequestbuffer?: (e: SampleDataEvent) => void) {
        if (onrequestbuffer) this.onrequestbuffer = onrequestbuffer;
        self.clearInterval(this.tID);
        this.tID = self.setInterval(() => { this.onRequest(); }, REQUEST_INTERVAL);
    }

    request(buffer: Float32Array[] = null): void {
        this.beginRequest();
        self.setTimeout(() => {
            this.onrequestbuffer({ retBuf: buffer, bufferId: this.bufferId });
        }, 0);
    }

    abstract process(buffer: Float32Array[]): void;
    abstract complete(): ArrayBuffer[];
}
