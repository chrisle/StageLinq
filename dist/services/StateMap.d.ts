import { StageLinqValue } from '../types';
import { ReadContext } from '../utils/ReadContext';
import { Service } from './Service';
import type { ServiceMessage } from '../types';
export declare const States: StageLinqValue[];
export interface StateData {
    name: string;
    json?: {
        type: number;
        string?: string;
        value?: number;
    };
    interval?: number;
}
export declare class StateMap extends Service<StateData> {
    init(): Promise<void>;
    protected parseData(p_ctx: ReadContext): ServiceMessage<StateData>;
    protected messageHandler(_: ServiceMessage<StateData>): void;
    private subscribeState;
}
