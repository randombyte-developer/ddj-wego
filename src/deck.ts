import { MidiControl } from "@controls/midiControl";
import { DeckMidiControl } from "@controls/deckMidiControl";
import { DeckFineMidiControl } from "@controls/deckFineMidiControl";
import { DeckButton } from "@controls/deckButton";
import { log, toggleControl, activate, makeLedConnection, clamp } from "@/utils";
import { MidiMapping } from "./midiMapping";

export class Deck {
    public readonly index: number;
    public readonly controls: MidiControl[];
    private readonly connections: Connection[] = [];
    private readonly group: string;

    private readonly hotcue2: DeckButton;
    private readonly hotcue3: DeckButton;

    constructor(readonly channel: number) {
        this.index = channel - 1;
        this.group = `[Channel${channel}]`;

        const eqGroup = `[EqualizerRack1_${this.group}_Effect1]`;
        const filterEffectGroup = `[QuickEffectRack1_${this.group}]`;

        this.controls = [
            new DeckButton(this.index, "Play", {
                onPressed: () => {
                    this.toggleControl("play");
                }
            }),
            new DeckButton(this.index, "Sync", {
                onPressed: () => {
                    this.activate("beatsync");
                }
            }),
            new DeckButton(this.index, "Pfl", {
                onPressed: () => {
                    this.toggleControl("pfl");
                }
            }),

            // Loops
            new DeckButton(this.index, "LoopButton", {
                onPressed: () => {
                    this.activate(`beatloop_${this.getValue("beatloop_size")}_toggle`);
                }
            }),

            // EQ
            new DeckFineMidiControl(this.index, "EqLow", {
                onValueChanged: value => {
                    engine.setParameter(eqGroup, "parameter1", value);
                }
            }),
            new DeckFineMidiControl(this.index, "EqMid", {
                onValueChanged: value => {
                    engine.setParameter(eqGroup, "parameter2", value);
                }
            }),
            new DeckFineMidiControl(this.index, "EqHigh", {
                onValueChanged: value => {
                    engine.setParameter(eqGroup, "parameter3", value);
                }
            }),

            // Quick Effect / Filter
/*             new FineMidiControl(0xB6, 0x16 + this.index, 0x36 + this.index, {
                onValueChanged: value => {
                    engine.setParameter(filterEffectGroup, "super1", value);
                }
            }), */

            new DeckFineMidiControl(this.index, "Volume", {
                onValueChanged: value => {
                    this.setParameter("volume", value);
                }
            }),
/* 
            new DeckButton(this.index, 0x1A, {
                onPressed: () => {
                    this.toggleControl("quantize");
                }
            }), */

            // Beatjump
            new DeckButton(this.index, "LoopEncoder", {
                onNewValue: value => {
                    const forward = value > 0x40;
                    if (this.hotcue2.lastValue > 0) {
                        this.modifyAndClampBeatjumpSize(forward ? 0.5 : 2);
                    } else if (this.hotcue3.lastValue > 0) {
                        this.activate(forward ? "loop_halve" : "loop_double");
                    } else {
                        this.activate(forward ? "beatjump_backward" : "beatjump_forward");
                    }
                }
            }),

            new DeckFineMidiControl(this.index, "Tempo", {
                onValueChanged: value => {
                    this.setParameter("rate", 1 - value);
                }
            })
        ];
        

        // Jog wheel
        function scratchEnable() {
            const alpha = 1.0 / 8;
            const beta = alpha / 32;
            engine.scratchEnable(channel, 512, 33 + 1 / 3, alpha, beta, true);
        }

        function scratchDisable() {
            engine.scratchDisable(channel, true);
        }

        const jogTouchButton = "JogTouchButton";
        const jogTouchButtonShifted = "JogTouchButtonShifted";
        const jogTouchVariants = [ jogTouchButton, jogTouchButtonShifted ];

        let jogTouchButtonIgnoreNextRelease = false;
        for (const jogTouchVariant of jogTouchVariants) {
            this.controls.push(new DeckButton(this.index, jogTouchVariant, {
                // This has a weird shift state:
                // Use onNewValue instead of onPressed because the shifted jog touch event only fires values of 0x7F.
                // It never fires for 0x00, which means that onValueChanged (used for onPressed) also never fires.
                // And we have to use the unshifted release event which fires even while pressing shift.
                onNewValue: value => {
                    if (value > 0) {
                        scratchEnable();
                        jogTouchButtonIgnoreNextRelease = jogTouchVariant == jogTouchButtonShifted;
                    } else if (!jogTouchButtonIgnoreNextRelease) {
                        scratchDisable();
                    } else {
                        // released button but the event was ignored -> turn off the ignore to accept the next event
                        jogTouchButtonIgnoreNextRelease = false;
                    }
                }
            }));
        }

        const jogWheelCenter = 0x40;
        this.controls.push(new DeckMidiControl(this.index, "JogEncoder", {
            onNewValue: value => {
                if (engine.isScratching(this.channel)) {
                    engine.scratchTick(this.channel, value - jogWheelCenter);
                } else {
                    this.setParameter("jog", (value - jogWheelCenter) / 10.0);
                }
            }
        }));

        const jogWheelSpeeds: { [controlName: string]: number } = {
            "JogEncoderTouch": 1,
            "JogEncoderTouchShifted": 20
        };

        for (const controlName in jogWheelSpeeds) {
            this.controls.push(new DeckMidiControl(this.index, controlName, {
                onNewValue: value => {
                    engine.scratchTick(this.channel, (value - jogWheelCenter) * jogWheelSpeeds[controlName]);
                }
            }));
            
        }

        this.hotcue2 = new DeckButton(this.index, "Hotcue2", { });
        this.hotcue3 = new DeckButton(this.index, "Hotcue3", { });

        this.controls.push(this.hotcue2);
        this.controls.push(this.hotcue3);

        // Hotcues
        const hotcueIndices = [0, 1];
        for (const hotcueIndex of hotcueIndices) {
            const hotcueNumber = hotcueIndex + 1;

            this.controls.push(new DeckButton(this.index, `Hotcue${hotcueIndex}`, {
                onValueChanged: pressed => {
                    this.setValue(`hotcue_${hotcueNumber}_activate`, pressed);
                }
            }));
            this.controls.push(new DeckButton(this.index, `Hotcue${hotcueIndex}Shifted`, {
                onPressed: () => {
                    this.activate(`hotcue_${hotcueNumber}_clear`);
                }
            }));
        }

        // Load track
        this.controls.push(new DeckButton(this.index, "Load", {
            onPressed: () => {
                this.activate("LoadSelectedTrack");
            }
        }));

        // Eject track
        this.controls.push(new DeckButton(this.index, "LoadShifted", {
            onPressed: () => {
                if (!this.getValue("play")) this.activate("eject");
            }
        }));

        // SoftTakeover
        engine.softTakeover(this.group, "volume", true);
        engine.softTakeover(this.group, "rate", true);
        engine.softTakeover(eqGroup, "parameter1", true);
        engine.softTakeover(eqGroup, "parameter2", true);
        engine.softTakeover(eqGroup, "parameter3", true);

        // Leds
        this.makeLedConnection("play", "Play");
        this.makeLedConnection("pfl", "Pfl");
        this.makeLedConnection("hotcue_1_enabled", "Hotcue0");
        this.makeLedConnection("hotcue_2_enabled", "Hotcue1");
        this.makeLedConnection("loop_enabled", "Hotcue3");

        this.triggerConnections();
    }

    private triggerConnections() {
        for (const connection of this.connections) {
            connection.trigger();
        }
    }

    private modifyAndClampBeatjumpSize(factor: number) {
        this.setValue("beatjump_size", clamp(this.getValue("beatjump_size") as number * factor, 0.03125, 128));
    }

    private getParameter(key: string): number {
        return engine.getParameter(this.group, key);
    }

    private setParameter(key: string, value: number) {
        engine.setParameter(this.group, key, value);
    }

    private getValue(key: string): number | boolean {
        return engine.getValue(this.group, key);
    }

    private setValue(key: string, value: number | boolean) {
        engine.setValue(this.group, key, value);
    }

    private activate(key: string) {
        activate(this.group, key);
    }

    private toggleControl(key: string) {
        toggleControl(this.group, key);
    }

    private makeConnection(key: string, callback: ConnectionCallback) {
        this.connections.push(engine.makeConnection(this.group, key, callback));
    }

    private makeLedConnection(key: string, controlName: string) {
        const [status, midiNo] = MidiMapping.getMidiForControl(`${this.index}${controlName}`);
        this.connections.push(makeLedConnection(this.group, key, status, midiNo));
    }
}
