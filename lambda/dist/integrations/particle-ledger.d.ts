export declare const ParticleLedgerNames: {
    readonly productDefault: "default-settings";
    readonly deviceSettings: "device-settings";
    readonly deviceStatus: "device-status";
    readonly deviceData: "device-data";
};
export type ParticleLedgerName = (typeof ParticleLedgerNames)[keyof typeof ParticleLedgerNames];
export type ParticleLedgerErrorKind = 'auth_failure' | 'missing_ledger' | 'retryable_failure' | 'network_failure' | 'malformed_json' | 'permanent_failure';
export type ParticleLedgerJson = Record<string, unknown>;
export interface ParticleLedgerInstance<T extends ParticleLedgerJson = ParticleLedgerJson> {
    name?: string;
    scope?: {
        type?: string;
        value?: string;
        name?: string;
        not_owned?: boolean;
    };
    size_bytes?: number;
    data: T;
    updated_at?: string;
    created_at?: string;
}
export interface ParticleLedgerSuccess<T extends ParticleLedgerJson = ParticleLedgerJson> {
    ok: true;
    ledgerName: ParticleLedgerName;
    productId: string;
    scopeValue: string;
    data: T;
    instance: ParticleLedgerInstance<T>;
}
export interface ParticleLedgerFailure {
    ok: false;
    ledgerName: ParticleLedgerName;
    productId: string;
    scopeValue: string;
    error: {
        kind: ParticleLedgerErrorKind;
        message: string;
        retryable: boolean;
        httpStatus?: number;
    };
}
export type ParticleLedgerResult<T extends ParticleLedgerJson = ParticleLedgerJson> = ParticleLedgerSuccess<T> | ParticleLedgerFailure;
export interface ParticleLedgerClientOptions {
    accessToken?: string;
    apiBaseUrl?: string;
    timeoutMs?: number;
    fetchFn?: typeof fetch;
}
export declare class ParticleLedgerClient {
    private readonly options;
    constructor(options?: ParticleLedgerClientOptions);
    getDeviceStatus<T extends ParticleLedgerJson = ParticleLedgerJson>(productId: string, deviceId: string): Promise<ParticleLedgerResult<T>>;
    getDeviceData<T extends ParticleLedgerJson = ParticleLedgerJson>(productId: string, deviceId: string): Promise<ParticleLedgerResult<T>>;
    getDeviceSettings<T extends ParticleLedgerJson = ParticleLedgerJson>(productId: string, deviceId: string): Promise<ParticleLedgerResult<T>>;
    getProductDefaults<T extends ParticleLedgerJson = ParticleLedgerJson>(productId: string): Promise<ParticleLedgerResult<T>>;
    getProductLedgerInstance<T extends ParticleLedgerJson = ParticleLedgerJson>(ledgerName: ParticleLedgerName, productId: string, instanceId: string): Promise<ParticleLedgerResult<T>>;
    private getLedgerInstance;
    private httpFailure;
    private failure;
}
export declare function getDeviceStatus<T extends ParticleLedgerJson = ParticleLedgerJson>(productId: string, deviceId: string): Promise<ParticleLedgerResult<T>>;
export declare function getDeviceData<T extends ParticleLedgerJson = ParticleLedgerJson>(productId: string, deviceId: string): Promise<ParticleLedgerResult<T>>;
export declare function getDeviceSettings<T extends ParticleLedgerJson = ParticleLedgerJson>(productId: string, deviceId: string): Promise<ParticleLedgerResult<T>>;
export declare function getProductDefaults<T extends ParticleLedgerJson = ParticleLedgerJson>(productId: string): Promise<ParticleLedgerResult<T>>;
//# sourceMappingURL=particle-ledger.d.ts.map