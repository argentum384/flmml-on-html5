export class FlMMLAudioExportError extends Error {
    constructor(...params: any[]) {
        super(...params);
        this.name = "FlMMLAudioExportError";
    }
}
