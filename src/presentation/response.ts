import type { Response } from "express";
import type { Paginated } from "../domain/interfaces";
import { HttpStatus } from "../shared/http-status";

/**
 * One response envelope for the whole API.
 *
 * Every success carries `status: "success"` and a `data` field; every failure
 * carries `status: "error"` and an `error` object (see the error handler).
 * A client can therefore branch on one field instead of inferring shape from
 * the status code, and adding an endpoint cannot accidentally invent a
 * fourth response shape.
 */

export interface SuccessBody<T> {
    status: "success";
    message?: string;
    data: T;
}

export interface PaginatedBody<T> extends SuccessBody<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export function ok<T>(res: Response, data: T, message?: string): void {
    const body: SuccessBody<T> = { status: "success", data, ...(message ? { message } : {}) };
    res.status(HttpStatus.OK).json(body);
}

export function created<T>(res: Response, data: T, message?: string): void {
    const body: SuccessBody<T> = { status: "success", data, ...(message ? { message } : {}) };
    res.status(HttpStatus.CREATED).json(body);
}

export function noContent(res: Response): void {
    res.status(HttpStatus.NO_CONTENT).send();
}

export function paginated<T>(res: Response, result: Paginated<T>, message?: string): void {
    const body: PaginatedBody<T> = {
        status: "success",
        ...(message ? { message } : {}),
        data: result.items,
        pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
            hasNext: result.hasNext,
            hasPrev: result.hasPrev,
        },
    };
    res.status(HttpStatus.OK).json(body);
}
