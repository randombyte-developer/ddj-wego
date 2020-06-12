export class MidiControl {

    public lastValue: number = 0;

    constructor(readonly name: string, protected readonly callback: MidiControlCallback) {}

    public offerValue(name: string, value: number) {
        if (name != this.name) return;

        if (this.callback.onNewValue) this.callback.onNewValue(value);

        if (this.lastValue === value) return;

        if (this.callback.onValueChanged) this.callback.onValueChanged(value);
        this.lastValue = value;
    }
}

export interface MidiControlCallback {
    onNewValue?(value: number): void;
    onValueChanged?(value: number): void;
}
