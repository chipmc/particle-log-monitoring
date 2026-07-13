/**
 * Fleet query endpoints backed by DeviceCurrentState.
 *
 * These endpoints query the compact current-state table by projectId. They do
 * not scan the historical event table and do not read raw S3 payloads.
 */
import { FleetAnomaliesResponse, FleetOfflineResponse, FleetSummaryResponse } from '../types';
export declare function handleFleetSummaryQuery(queryParameters: Record<string, string | undefined> | undefined): Promise<FleetSummaryResponse>;
export declare function handleFleetAnomaliesQuery(queryParameters: Record<string, string | undefined> | undefined): Promise<FleetAnomaliesResponse>;
export declare function handleFleetOfflineQuery(queryParameters: Record<string, string | undefined> | undefined): Promise<FleetOfflineResponse>;
//# sourceMappingURL=fleet.d.ts.map