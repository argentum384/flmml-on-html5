export type FlMMLOptions = {
    workerURL?: string,
    crossOriginWorker?: boolean,
    infoInterval?: number,
    bufferSize?: number,
    bufferMultiple?: number,
    lamejsURL?: string
};

export type SampleDataEvent = {
    retBuf?: Float32Array[];
    bufferId: number;
};
