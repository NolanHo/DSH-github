/**
 * Wire helpers for the /plugins/dsh-github JSON API: bounded body reading,
 * response writing, and the shared error envelope. Every method returns
 * {ok: true, value} on success and {ok: false, error: {code, message}}
 * (HTTP 4xx/5xx matching the code) on failure.
 */
import type { ApiResponse } from './shims.d.ts';
import type { GithubWireErrorCode } from './shared.ts';
/** One API failure with its wire code and HTTP status. */
export declare class GithubError extends Error {
    readonly code: GithubWireErrorCode;
    readonly status: number;
    constructor(code: GithubWireErrorCode, message: string, status?: number);
}
/** The request face readJsonBody consumes (structural; node's IncomingMessage fits). */
export interface GithubApiRequest {
    [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>;
}
/** Read and parse the JSON request body (bounded; malformed → bad-request). */
export declare function readJsonBody(req: GithubApiRequest): Promise<unknown>;
/** Write a JSON response with the given status. */
export declare function writeJson(res: ApiResponse, status: number, body: unknown): void;
/** Write the success envelope. */
export declare function writeOk(res: ApiResponse, value: unknown): void;
/** Write the failure envelope for any thrown value (unknown → internal 500). */
export declare function writeError(res: ApiResponse, error: unknown): void;
/** Narrow an unknown payload value to a non-empty string, else throw bad-request. */
export declare function requireString(payload: unknown, key: string): string;
