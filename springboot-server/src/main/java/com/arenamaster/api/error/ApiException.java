package com.arenamaster.api.error;

/**
 * Equivalent of FastAPI's HTTPException: a status code plus a "detail"
 * message. Thrown anywhere, rendered by {@link ApiExceptionHandler} as the
 * {"detail": "..."} body the old backend's clients already parse.
 */
public class ApiException extends RuntimeException {

    private final int status;

    public ApiException(int status, String detail) {
        super(detail);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
