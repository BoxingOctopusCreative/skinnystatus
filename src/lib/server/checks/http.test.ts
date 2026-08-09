import { describe, expect, it } from 'vitest';
import { httpAuthHeaders } from './http';

describe('httpAuthHeaders', () => {
	it('sends nothing when there is no config', () => {
		expect(httpAuthHeaders(null)).toEqual({});
		expect(httpAuthHeaders(undefined)).toEqual({});
	});

	it('sends nothing when auth is off', () => {
		expect(httpAuthHeaders({ auth: 'none' })).toEqual({});
	});

	it('sends a bearer token', () => {
		expect(httpAuthHeaders({ auth: 'bearer', token: 'sk-live-123' })).toEqual({
			authorization: 'Bearer sk-live-123'
		});
	});

	it('base64 encodes basic credentials', () => {
		const headers = httpAuthHeaders({
			auth: 'basic',
			username: 'health',
			password: 'p@ss:word'
		});
		expect(headers.authorization).toBe('Basic aGVhbHRoOnBAc3M6d29yZA==');
		const decoded = Buffer.from(headers.authorization.slice('Basic '.length), 'base64').toString(
			'utf8'
		);
		expect(decoded).toBe('health:p@ss:word');
	});

	it('encodes non-ascii basic credentials as utf-8', () => {
		const headers = httpAuthHeaders({ auth: 'basic', username: 'user', password: 'pässwörd' });
		const decoded = Buffer.from(headers.authorization.slice('Basic '.length), 'base64').toString(
			'utf8'
		);
		expect(decoded).toBe('user:pässwörd');
	});

	it('lowercases a custom header name', () => {
		expect(
			httpAuthHeaders({ auth: 'header', headerName: 'X-API-Key', headerValue: 'abc123' })
		).toEqual({ 'x-api-key': 'abc123' });
	});

	it('sends nothing when a mode is missing its credential', () => {
		expect(httpAuthHeaders({ auth: 'bearer' })).toEqual({});
		expect(httpAuthHeaders({ auth: 'basic', username: 'health' })).toEqual({});
		expect(httpAuthHeaders({ auth: 'header', headerName: 'X-API-Key' })).toEqual({});
	});
});
