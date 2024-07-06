/// <reference types="node" />
import { EventEmitter } from 'events';
import { PlayerStatus } from '../types';
import { StateMap } from '../services';
export declare interface Player {
    on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
    on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
    on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
}
interface PlayerOptions {
    stateMap: StateMap;
    address: string;
    port: number;
    deviceId: string;
}
/**
 * A player represents a device on the StageLinq network.
 *
 * A player on the network may have up to 4 decks (or "layers" as they're
 * called on the harware). A player may also be given a player number.
 *
 * If you're using a Denon Prime Go/2/4 then you should only get one number.
 * If you're using a Denon SC5000/SC6000 then you assign the numbers in the
 * Denon's settings screen.
 *
 * Master tempo and master status only apply if you are using SC5000/SC6000
 * and if they're both on the network.
 *
 * A queue is used to group all the incoming messages from StageLinq to give us
 * a single updated PlayerStatus object.
 */
export declare class Player extends EventEmitter {
    private player;
    private address;
    private port;
    private masterTempo;
    private masterStatus;
    private decks;
    private lastTrackNetworkPath;
    private queue;
    private deviceId;
    /**
     * Initialize a player device.
     *
     * @param networkDevice Network device
     * @param stateMap Statemap service
     */
    constructor(options: PlayerOptions);
    /**
     * Parse the state data and push it into the update queue.
     *
     * @param data State data from Denon.
     * @returns
     */
    private messageHandler;
    /**
     * Update current state and emit.
     * @param data
     */
    private handleUpdate;
    private deckNumberToLayer;
    private getSourceAndTrackPath;
}
export {};
