export interface ParticleDeviceNameResolution {
    deviceName: string;
    deviceNameResolvedAt: string;
    deviceNameSource: 'particle-api';
}
export interface ParticleDeviceProductIdResolution {
    productId: string;
    productIdResolvedAt: string;
    productIdSource: 'particle-api';
}
export declare function resolveParticleDeviceName(deviceId: string, resolvedAt?: Date): Promise<ParticleDeviceNameResolution | null>;
export declare function resolveParticleDeviceProductId(deviceId: string, resolvedAt?: Date): Promise<ParticleDeviceProductIdResolution | null>;
//# sourceMappingURL=particle-api.d.ts.map