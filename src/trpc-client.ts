import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import WebSocket from 'ws'

/**
 * Companion does not publish its tRPC router types as a package, so this client is untyped.
 * The procedures used here were checked against the Companion 5.1 sources
 * (companion/lib/UI/TRPC.ts and the *TrpcRouter.ts files). See docs/COMPANION-API.md.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CompanionClient = any

export function createCompanionClient(url: string): {
	client: CompanionClient
	wsClient: ReturnType<typeof createWSClient>
} {
	const base = url.replace(/\/+$/, '')
	const wsUrl = base.replace(/^http/, 'ws') + '/trpc'
	const wsClient = createWSClient({
		url: wsUrl,
		WebSocket: WebSocket as never,
		onError: (err) => {
			const e = err as unknown as { message?: string } | undefined
			console.error(`[companion-mcp] websocket error for ${wsUrl}: ${e?.message ?? String(err)}`)
		},
	})
	const client = createTRPCClient<AnyTRPCRouter>({ links: [wsLink({ client: wsClient })] })
	return { client, wsClient }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubscriptionObserver = { onData: (data: any) => void; onError: (err: unknown) => void }

/**
 * Subscribe to a tRPC subscription and return the first data value.
 * Automatically unsubscribes after receiving the first value.
 *
 * Companion's `watch` subscriptions always yield an `init` message first, which carries the
 * full current state, so this is how the server reads state without keeping subscriptions open.
 *
 * Usage:
 *   const data = await getInitialData((obs) => client.foo.watch.subscribe(undefined, obs))
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getInitialData(
	subscribeFn: (observer: SubscriptionObserver) => { unsubscribe: () => void },
	timeoutMs = 10000
): Promise<any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return new Promise<any>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			sub.unsubscribe()
			reject(new Error(`Companion did not answer within ${timeoutMs / 1000}s. Is Companion running and reachable?`))
		}, timeoutMs)

		const sub = subscribeFn({
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			onData: (data: any) => {
				clearTimeout(timeoutId)
				sub.unsubscribe()
				resolve(data)
			},
			onError: (err: unknown) => {
				clearTimeout(timeoutId)
				sub.unsubscribe()
				reject(err)
			},
		})
	})
}

/**
 * Some Companion `watch` subscriptions yield an array of updates (connections, surfaces);
 * others yield a single update. Normalise to the init message and check it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expectInit(raw: any, what: string): any {
	const data = Array.isArray(raw) ? raw[0] : raw
	if (!data || data.type !== 'init') throw new Error(`Expected init message from ${what}`)
	return data
}

/**
 * Companion 5 stores most option values as `{ value, isExpression }`. Accept either a plain
 * value (wrapped as a literal) or an already-wrapped value (passed through), so callers can
 * write `{ "value": "$(custom:x) + 1", "isExpression": true }` when they need an expression.
 */
export function toExpressionOrValue(value: unknown): { value: unknown; isExpression: boolean } {
	if (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		'isExpression' in (value as Record<string, unknown>) &&
		typeof (value as Record<string, unknown>).isExpression === 'boolean' &&
		'value' in (value as Record<string, unknown>)
	) {
		return value as { value: unknown; isExpression: boolean }
	}
	return { value, isExpression: false }
}

export function textResult(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
	return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}
