export function log(msg: any) {
    engine.log(`DDJ-WEGO-LOG: ${msg}`);
}

export function clamp(value: number, min: number, max: number): number {
    return value <= min ? min : value >= max ? max : value;
}

export function toggleControl(channel: string, key: string) {
    engine.setValue(channel, key, !engine.getValue(channel, key));
}

export function activate(channel: string, key: string) {
    engine.setValue(channel, key, 1);
}

export function makeLedConnection(channel: string, key: string, midiLedStatus: number, midiLedNo: number): Connection {
    return engine.makeConnection(channel, key, value => {
        midi.sendShortMsg(midiLedStatus, midiLedNo, value * 0x7F);
    });
}
