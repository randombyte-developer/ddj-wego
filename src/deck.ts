import { MidiControl } from "@controls/midiControl";
import { DeckMidiControl } from "@controls/deckMidiControl";
import { DeckFineMidiControl } from "@controls/deckFineMidiControl";
import { DeckButton } from "@controls/deckButton";
import { log, toggleControl, activate, makeLedConnection, clamp } from "@/utils";

export class Deck {
    public readonly index: number;
    public readonly controls: MidiControl[];
    private readonly connections: Connection[] = [];
    private readonly group: string;

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
            new DeckMidiControl(this.index, "LoopEncoderShifted", {
                onNewValue: value => {
                    this.activate(value > 0x40 ? "loop_halve" : "loop_double");
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
                    if (this.hotcue3.lastValue > 0) {
                        this.modifyAndClampBeatjumpSize(forward ? 0.5 : 2);
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
        const jogTouchVariants = [ "JogTouchButton", "JogTouchButtonShifted" ];
        for (const jogTouchVariant of jogTouchVariants) {
            this.controls.push(new DeckButton(this.index, jogTouchVariant, {
                onNewValue: value => {
                    // this has a weird shift state:
                    // use onNewValue instead of onPressed because the shifted jog touch event only fires values of 0x7F
                    // it never fires for 0x00, which means that onValueChanged (used for onPressed) also never fires
                    if (value > 0) {
                        const alpha = 1.0 / 8;
                        const beta = alpha / 32;
                        engine.scratchEnable(this.channel, 512, 33 + 1 / 3, alpha, beta, true);
                    }
                },
                onReleased: () => {
                    engine.scratchDisable(this.channel, true);
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

        this.hotcue3 = new DeckButton(this.index, "Hotcue3", { });
        this.controls.push(this.hotcue3);

        // Hotcues
/*         for (let hotcuethis.index = 0; hotcuethis.index < 4; hotcuethis.index++) {
            const hotcueNumber = hotcuethis.index + 1;
            const padMidiNo = 0x00 + hotcuethis.index;
            const shiftedpadMidiNo = padMidiNo + Deck.padShiftOffset;

            this.controls.push(new DeckButton(padStatus, padMidiNo, {
                onValueChanged: pressed => {
                    this.setValue(`hotcue_${hotcueNumber}_activate`, pressed);
                }
            }));
            this.controls.push(new DeckButton(padStatus, shiftedpadMidiNo, {
                onPressed: () => {
                    this.activate(`hotcue_${hotcueNumber}_clear`);
                }
            }));

            this.makeConnection(`hotcue_${hotcueNumber}_enabled`, enabled => {
                midi.sendShortMsg(padLedStatusWithBase, padMidiNo, Deck.hotcueGreen * enabled);
                midi.sendShortMsg(padLedStatusWithBase, shiftedpadMidiNo, Deck.hotcueDeleteRed * enabled);
            });

            midi.sendShortMsg(padLedStatusWithBase, padMidiNo, Deck.hotcueGreen);
            midi.sendShortMsg(padLedStatusWithBase, shiftedpadMidiNo, Deck.hotcueDeleteRed);
        } */

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
/*         engine.softTakeover(this.group, "rate", true);
        // softTakeoverIgnoreNextValue when switching away from a deck
        this.controls.push(new DeckButton(this.index, 0x72, {
            onPressed: () => {
                engine.softTakeoverIgnoreNextValue(`[Channel${Deck.partnerDecks[]}]`, "rate");
            }
        })); */
/* 
        this.makeLedConnection("play", 0x0B);
        this.makeLedConnection("pfl", 0x54);
        this.makeLedConnection("quantize", 0x1A);
        this.makeLedConnection("loop_enabled", 0x14); */

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

/*     private makeLedConnection(key: string, midiLedNo: number) {
        this.connections.push(makeLedConnection(this.group, key, this.deckStatus, midiLedNo));
    } */
}