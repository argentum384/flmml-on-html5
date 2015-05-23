// From https://github.com/Microsoft/TypeScript

interface Performance {
    navigation: PerformanceNavigation;
    timing: PerformanceTiming;
    clearMarks(markName?: string): void;
    clearMeasures(measureName?: string): void;
    clearResourceTimings(): void;
    getEntries(): any;
    getEntriesByName(name: string, entryType?: string): any;
    getEntriesByType(entryType: string): any;
    getMarks(markName?: string): any;
    getMeasures(measureName?: string): any;
    mark(markName: string): void;
    measure(measureName: string, startMarkName?: string, endMarkName?: string): void;
    now(): number;
    setResourceTimingBufferSize(maxSize: number): void;
    toJSON(): any;
}

declare var Performance: {
    prototype: Performance;
    new (): Performance;
}

declare var performance: Performance;

interface PerformanceEntry {
    duration: number;
    entryType: string;
    name: string;
    startTime: number;
}

declare var PerformanceEntry: {
    prototype: PerformanceEntry;
    new (): PerformanceEntry;
}

interface PerformanceNavigation {
    redirectCount: number;
    type: number;
    toJSON(): any;
    TYPE_BACK_FORWARD: number;
    TYPE_NAVIGATE: number;
    TYPE_RELOAD: number;
    TYPE_RESERVED: number;
}

declare var PerformanceNavigation: {
    prototype: PerformanceNavigation;
    new (): PerformanceNavigation;
    TYPE_BACK_FORWARD: number;
    TYPE_NAVIGATE: number;
    TYPE_RELOAD: number;
    TYPE_RESERVED: number;
}

interface PerformanceResourceTiming extends PerformanceEntry {
    connectEnd: number;
    connectStart: number;
    domainLookupEnd: number;
    domainLookupStart: number;
    fetchStart: number;
    initiatorType: string;
    redirectEnd: number;
    redirectStart: number;
    requestStart: number;
    responseEnd: number;
    responseStart: number;
}

declare var PerformanceResourceTiming: {
    prototype: PerformanceResourceTiming;
    new (): PerformanceResourceTiming;
}

interface PerformanceTiming {
    connectEnd: number;
    connectStart: number;
    domComplete: number;
    domContentLoadedEventEnd: number;
    domContentLoadedEventStart: number;
    domInteractive: number;
    domLoading: number;
    domainLookupEnd: number;
    domainLookupStart: number;
    fetchStart: number;
    loadEventEnd: number;
    loadEventStart: number;
    msFirstPaint: number;
    navigationStart: number;
    redirectEnd: number;
    redirectStart: number;
    requestStart: number;
    responseEnd: number;
    responseStart: number;
    unloadEventEnd: number;
    unloadEventStart: number;
    toJSON(): any;
}

declare var PerformanceTiming: {
    prototype: PerformanceTiming;
    new (): PerformanceTiming;
}

interface XMLHttpRequestUpload { }

interface Position { }
interface PositionError { }

interface MutationRecord { }
interface MutationObserver { }

interface MSExecAtPriorityFunctionCallback { }

interface MSAppAsyncOperation { }

interface MediaQueryList { }

interface AudioBuffer { }

interface Node { }
interface NodeList { }

interface EventInit { }
interface UIEvent { }