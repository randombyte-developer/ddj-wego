interface Engine {
    log(msg: string): void

    beginTimer(millis: number, func: () => void, oneShot: boolean): number
    stopTimer(timerId: number): void

    getParameter(group: string, key: string): number
    setParameter(group: string, key: string, value: number): void
    getValue(group: string, key: string): number | boolean
    setValue(group: string, key: string, value: number | boolean): void

    makeConnection(group: string, key: string, callback: ConnectionCallback): Connection

    scratchEnable(deck: number, intervalsPerRev: number, rpm: number, alpha: number, beta: number, ramp: boolean): void
    scratchTick(deck: number, interval: number): void
    scratchDisable(deck: number, ramp: boolean): void
    isScratching(deck: number): boolean

    softTakeover(group: string, key: string, enable: boolean): void
    softTakeoverIgnoreNextValue(group: string, key: string): void
}

interface ConnectionCallback {
    (value: number, group: string, key: string): void
}

interface Connection {
    trigger(): void
}

declare const engine: Engine

interface Midi {
    sendShortMsg(status: number, data1: number, data2: number): void
    sendSysexMsg(data: number[], length: number): void
}

declare const midi: Midi

declare function print(msg: string): void
