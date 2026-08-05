import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { runTcpCheck } from './tcp';

describe('runTcpCheck', () => {
	it('succeeds when the port accepts connections', async () => {
		const server = net.createServer();
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const addr = server.address();
		if (!addr || typeof addr === 'string') throw new Error('expected port');

		const outcome = await runTcpCheck({ host: '127.0.0.1', port: addr.port }, 2000);
		server.close();
		expect(outcome.ok).toBe(true);
		expect(outcome.error).toBeNull();
	});

	it('fails when nothing is listening', async () => {
		const outcome = await runTcpCheck({ host: '127.0.0.1', port: 1 }, 500);
		expect(outcome.ok).toBe(false);
		expect(outcome.error).toBeTruthy();
	});
});
