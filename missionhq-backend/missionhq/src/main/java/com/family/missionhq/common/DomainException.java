package com.family.missionhq.common;

import org.springframework.http.HttpStatus;

public class DomainException extends RuntimeException {
    private final HttpStatus status;
    public DomainException(HttpStatus status, String message) { super(message); this.status = status; }
    public HttpStatus status() { return status; }
    public static DomainException notFound(String what) { return new DomainException(HttpStatus.NOT_FOUND, what + " not found"); }
    public static DomainException conflict(String msg) { return new DomainException(HttpStatus.CONFLICT, msg); }
    public static DomainException badRequest(String msg) { return new DomainException(HttpStatus.BAD_REQUEST, msg); }
    public static DomainException forbidden(String msg) { return new DomainException(HttpStatus.FORBIDDEN, msg); }
}
